import { TaskQueue } from './task-queue.js';
import { OpenCodeAdapter } from '../opencode/adapter.js';
import { OpenCodeEvent, OpenCodeRunResult } from '../opencode/types.js';
import { RetryManager } from '../retry/retry-manager.js';
import { ErrorClassifier } from '../detection/error-classifier.js';
import { GitManager } from '../git/git-manager.js';
import { TaskLogger } from '../logging/logger.js';
import { AutotaskConfig } from '../types/config.js';
import { Task, TaskAttempt } from '../types/task.js';

export type RunnerEvent =
  | { type: 'QUEUE_STARTED' }
  | { type: 'QUEUE_PAUSED' }
  | { type: 'QUEUE_FINISHED' }
  | { type: 'TASK_STARTED'; task: Task; attempt: number }
  | { type: 'TASK_EVENT'; task: Task; event: OpenCodeEvent }
  | { type: 'TASK_BACKOFF'; task: Task; secondsRemaining: number; totalSeconds: number }
  | { type: 'TASK_COMPLETED'; task: Task; checkpointMessage?: string }
  | { type: 'TASK_FAILED'; task: Task; reason: string }
  | { type: 'TASK_RETRYING'; task: Task; attempt: number; maxAttempts: number };

export class TaskRunner {
  private queue: TaskQueue;
  private adapter: OpenCodeAdapter;
  private retryManager: RetryManager;
  private gitManager: GitManager;
  private logger: TaskLogger;
  private config: AutotaskConfig;
  private workingDir: string;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;
  private eventListeners: ((event: RunnerEvent) => void)[] = [];

  constructor(
    queue: TaskQueue,
    adapter: OpenCodeAdapter,
    config: AutotaskConfig,
    logger: TaskLogger,
    workingDir: string = process.cwd()
  ) {
    this.queue = queue;
    this.adapter = adapter;
    this.config = config;
    this.logger = logger;
    this.workingDir = workingDir;
    this.retryManager = new RetryManager(config);
    this.gitManager = new GitManager(workingDir, logger);
  }

  public onEvent(listener: (event: RunnerEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  private emit(event: RunnerEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener failure
      }
    }
  }

  public isBusy(): boolean {
    return this.isRunning;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.queue.setPaused(false);
    this.emit({ type: 'QUEUE_STARTED' });
    this.logger.info('QUEUE', 'Task runner supervisor loop started.');

    try {
      while (this.isRunning && !this.queue.isQueuePaused()) {
        const nextTask = this.queue.getNextPendingTask();
        if (!nextTask) {
          this.logger.info('QUEUE', 'No more pending tasks in queue.');
          break;
        }

        await this.executeTask(nextTask);
      }
    } finally {
      this.isRunning = false;
      this.queue.setActiveTaskId(null);
      this.emit({ type: 'QUEUE_FINISHED' });
      this.logger.info('QUEUE', 'Task runner supervisor loop finished.');
    }
  }

  public pause(): void {
    this.queue.setPaused(true);
    this.emit({ type: 'QUEUE_PAUSED' });
    this.logger.info('QUEUE', 'Task runner received pause request.');
  }

  public async stopCurrentTask(): Promise<void> {
    this.logger.warn('QUEUE', 'Stopping active task run...');
    this.abortController?.abort();
    await this.adapter.cancelActiveRun();
    this.isRunning = false;
    this.queue.setPaused(true);
  }

  private async executeTask(task: Task): Promise<void> {
    this.queue.setActiveTaskId(task.id);
    let success = false;

    while (task.attempts < task.maxAttempts && !success && this.isRunning && !this.queue.isQueuePaused()) {
      task.attempts++;
      const currentAttemptNumber = task.attempts;
      const attemptStart = new Date().toISOString();
      const logFile = this.logger.setTaskContext(task.id, currentAttemptNumber);

      const isRetry = currentAttemptNumber > 1;
      task.status = isRetry ? 'RETRYING' : 'RUNNING';
      task.startedAt = task.startedAt || attemptStart;
      this.queue.updateTask(task.id, { status: task.status, attempts: task.attempts });

      if (isRetry) {
        this.emit({ type: 'TASK_RETRYING', task, attempt: currentAttemptNumber, maxAttempts: task.maxAttempts });
      } else {
        this.emit({ type: 'TASK_STARTED', task, attempt: currentAttemptNumber });
      }

      this.logger.info('QUEUE', `Executing Task #${task.id} (Attempt ${currentAttemptNumber}/${task.maxAttempts}): "${task.title}"`);

      // Determine prompt to run (smart retry prompt on subsequent attempts)
      let promptToRun = task.prompt;
      if (isRetry && task.lastError) {
        promptToRun = this.retryManager.buildRetryPrompt(task.prompt, task.lastError, currentAttemptNumber);
      }

      this.abortController = new AbortController();

      let runResult: OpenCodeRunResult;
      try {
        runResult = await this.adapter.runTask(
          {
            prompt: promptToRun,
            agent: task.agent,
            sessionId: task.sessionId,
            continueSession: isRetry && Boolean(task.sessionId),
            workingDir: this.workingDir,
            abortSignal: this.abortController.signal,
          },
          (opencodeEvent) => {
            this.emit({ type: 'TASK_EVENT', task, event: opencodeEvent });
          }
        );
      } catch (err: any) {
        runResult = {
          success: false,
          exitCode: 1,
          output: '',
          error: err.message || String(err),
          durationMs: 0,
        };
      } finally {
        this.abortController = null;
      }

      const attemptRecord: TaskAttempt = {
        attemptNumber: currentAttemptNumber,
        startedAt: attemptStart,
        completedAt: new Date().toISOString(),
        exitCode: runResult.exitCode,
        error: runResult.error,
        durationMs: runResult.durationMs,
        logFile,
      };

      task.history.push(attemptRecord);
      task.durationMs = (task.durationMs || 0) + runResult.durationMs;
      if (runResult.sessionId) {
        task.sessionId = runResult.sessionId;
      }

      // Check OpenCode execution status
      if (runResult.success) {
        // Step 2: Post-task validation check (e.g. npm test or build)
        let validationPassed = true;
        if (this.config.git.postTaskCommand) {
          const valRes = await this.gitManager.runValidationCommand(this.config.git.postTaskCommand);
          if (!valRes.success) {
            validationPassed = false;
            task.lastError = `Validation command '${this.config.git.postTaskCommand}' failed with output:\n${valRes.output}`;
            task.errorCategory = 'VALIDATION_FAILED';
            this.logger.warn('QUEUE', `Post-task validation failed for Task #${task.id}. Inlining failure into retry prompt.`);
          }
        }

        if (validationPassed) {
          success = true;
          task.status = 'COMPLETED';
          task.completedAt = new Date().toISOString();
          task.lastError = undefined;
          task.exitCode = 0;

          // Step 3: Git Checkpoint
          let checkpointMsg: string | undefined;
          if (this.config.git.autoCommit) {
            const cpResult = await this.gitManager.createCheckpoint(task, this.config.git.commitPrefix);
            if (cpResult.committed) {
              checkpointMsg = cpResult.commitMessage;
            }
          }

          this.queue.updateTask(task.id, task);
          this.emit({ type: 'TASK_COMPLETED', task, checkpointMessage: checkpointMsg });
          this.logger.info('QUEUE', `Task #${task.id} COMPLETED successfully in ${Math.round((task.durationMs || 0) / 1000)}s.`);
          this.logger.clearTaskContext();
          return;
        }
      }

      // Handle Failure & Classify
      const rawError = runResult.error || `Process exited with code ${runResult.exitCode}`;
      const classified = ErrorClassifier.classify(rawError, runResult.exitCode);
      task.lastError = rawError;
      task.errorCategory = classified.category;
      attemptRecord.errorCategory = classified.category;

      this.logger.warn('QUEUE', `Task #${task.id} attempt ${currentAttemptNumber} failed. Category: ${classified.category}. Message: ${classified.message}`);

      // Handle Context Overflow (attempt session compaction)
      if (classified.category === 'CONTEXT_OVERFLOW' && task.sessionId && this.config.context.autoCompact) {
        this.logger.info('QUEUE', `Attempting session compaction for Task #${task.id}...`);
        const compacted = await this.adapter.compactSession(task.sessionId, this.workingDir);
        if (!compacted) {
          // If compaction fails, clear sessionId to trigger a fresh session with Git diff context
          this.logger.warn('QUEUE', `Compaction failed. Falling back to fresh session for Task #${task.id}.`);
          task.sessionId = undefined;
        }
      }

      // Check if retry is allowed
      const canRetry = this.retryManager.shouldRetry(currentAttemptNumber, task.maxAttempts, classified);

      if (canRetry && this.isRunning && !this.queue.isQueuePaused()) {
        const backoffSec = this.retryManager.calculateBackoffSeconds(currentAttemptNumber, classified);
        this.logger.info('QUEUE', `Waiting ${backoffSec}s backoff before attempt ${currentAttemptNumber + 1}/${task.maxAttempts}...`);

        for (let sec = backoffSec; sec > 0; sec--) {
          if (!this.isRunning || this.queue.isQueuePaused()) break;
          this.emit({ type: 'TASK_BACKOFF', task, secondsRemaining: sec, totalSeconds: backoffSec });
          await this.delay(1000);
        }
      } else {
        // No more retries allowed or fatal error
        task.status = 'FAILED';
        task.completedAt = new Date().toISOString();
        this.queue.updateTask(task.id, task);
        this.emit({ type: 'TASK_FAILED', task, reason: classified.message });
        this.logger.error('QUEUE', `Task #${task.id} FAILED permanently after ${currentAttemptNumber} attempts. Reason: ${classified.message}`);
        this.logger.clearTaskContext();
        return;
      }
    }

    if (!success && task.status !== 'FAILED') {
      task.status = 'FAILED';
      task.completedAt = new Date().toISOString();
      this.queue.updateTask(task.id, task);
      this.emit({ type: 'TASK_FAILED', task, reason: task.lastError || 'Max retry attempts exceeded' });
    }

    this.logger.clearTaskContext();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
