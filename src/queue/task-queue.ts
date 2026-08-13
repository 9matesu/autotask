import { AgentMode, QueueState, Task, TaskStatus } from '../types/task.js';
import { StateStore } from '../persistence/state-store.js';
import { TaskLogger } from '../logging/logger.js';
import { AutotaskConfig } from '../types/config.js';

export interface ParsedTaskInput {
  title: string;
  prompt: string;
  agent: AgentMode;
}

export class TaskQueue {
  private tasks: Task[] = [];
  private activeTaskId: string | null = null;
  private isPaused: boolean = false;
  private stateStore: StateStore;
  private logger?: TaskLogger;
  private config: AutotaskConfig;
  private changeListeners: ((state: QueueState) => void)[] = [];

  constructor(stateStore: StateStore, config: AutotaskConfig, logger?: TaskLogger) {
    this.stateStore = stateStore;
    this.config = config;
    this.logger = logger;
    this.loadFromStore();
  }

  public loadFromStore(): void {
    const state = this.stateStore.loadState();
    this.tasks = state.tasks;
    this.activeTaskId = state.activeTaskId;
    this.isPaused = state.isPaused;
  }

  public getState(): QueueState {
    return {
      version: '1.0.0',
      activeTaskId: this.activeTaskId,
      isPaused: this.isPaused,
      tasks: [...this.tasks],
      updatedAt: new Date().toISOString(),
    };
  }

  public onStateChange(listener: (state: QueueState) => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== listener);
    };
  }

  private notifyChange(): void {
    const state = this.getState();
    this.stateStore.saveState(state);
    for (const listener of this.changeListeners) {
      try {
        listener(state);
      } catch {
        // Ignore listener error
      }
    }
  }

  public getTasks(): Task[] {
    return [...this.tasks];
  }

  public getTask(id: string): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  public getNextPendingTask(): Task | undefined {
    if (this.isPaused) return undefined;
    return this.tasks.find((t) => t.status === 'PENDING');
  }

  public getActiveTask(): Task | undefined {
    if (!this.activeTaskId) return undefined;
    return this.tasks.find((t) => t.id === this.activeTaskId);
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.logger?.info('QUEUE', paused ? 'Queue paused.' : 'Queue resumed.');
    this.notifyChange();
  }

  public isQueuePaused(): boolean {
    return this.isPaused;
  }

  public addTask(title: string, prompt?: string, agent?: AgentMode): Task {
    const nextId = this.generateNextId();
    const cleanAgent = agent || this.config.opencode.agent || 'build';
    const cleanPrompt = (prompt || title).trim();

    const task: Task = {
      id: nextId,
      title: title.trim(),
      prompt: cleanPrompt,
      agent: cleanAgent,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: this.config.retry.maxAttempts,
      createdAt: new Date().toISOString(),
      history: [],
    };

    this.tasks.push(task);
    this.logger?.info('QUEUE', `Added task #${task.id}: "${task.title}" [${task.agent.toUpperCase()}]`);
    this.notifyChange();
    return task;
  }

  public parseAndAdd(rawText: string, defaultAgent?: AgentMode): Task[] {
    const parsedList = TaskQueue.parseTaskInput(rawText, defaultAgent || this.config.opencode.agent);
    const created: Task[] = [];

    for (const item of parsedList) {
      const task = this.addTask(item.title, item.prompt, item.agent);
      created.push(task);
    }

    return created;
  }

  public static parseTaskInput(rawText: string, defaultAgent: AgentMode = 'build'): ParsedTaskInput[] {
    const text = rawText.trim();
    if (!text) return [];

    // Split by lines
    const lines = text.split(/\r?\n/);
    const results: ParsedTaskInput[] = [];

    // Check if the input looks like a single multiline prompt (e.g. contains markdown headers or code blocks)
    const hasCodeBlock = text.includes('```');
    const isSingleComplexTask = hasCodeBlock || (lines.length > 1 && (lines[0].startsWith('#') || lines[1]?.startsWith('  ') || lines[1]?.startsWith('\t')));

    if (isSingleComplexTask && !lines.every((l) => /^\s*(\d+[\.\)]|[-*•])\s+/.test(l))) {
      // Treat as single multiline task
      const { agent, cleaned } = TaskQueue.extractAgentTag(text, defaultAgent);
      const title = lines[0].replace(/^#+\s*/, '').trim().slice(0, 80);
      results.push({
        title: title || 'Multiline task',
        prompt: cleaned,
        agent,
      });
      return results;
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Strip bullet points (- , * , • ) or numbered lists (1. , 1) , [1] )
      let cleanLine = line
        .replace(/^[-*•]\s+/, '')
        .replace(/^\d+[\.\)]\s+/, '')
        .replace(/^\[\d+\]\s+/, '')
        .trim();

      if (!cleanLine) continue;

      const { agent, cleaned } = TaskQueue.extractAgentTag(cleanLine, defaultAgent);
      results.push({
        title: cleaned,
        prompt: cleaned,
        agent,
      });
    }

    return results;
  }

  public static extractAgentTag(text: string, defaultAgent: AgentMode = 'build'): { agent: AgentMode; cleaned: string } {
    let agent = defaultAgent;
    let cleaned = text;

    if (/^\[PLAN\]/i.test(cleaned) || /^@plan\b/i.test(cleaned)) {
      agent = 'plan';
      cleaned = cleaned.replace(/^\[PLAN\]\s*/i, '').replace(/^@plan\s*/i, '').trim();
    } else if (/^\[BUILD\]/i.test(cleaned) || /^@build\b/i.test(cleaned)) {
      agent = 'build';
      cleaned = cleaned.replace(/^\[BUILD\]\s*/i, '').replace(/^@build\s*/i, '').trim();
    }

    return { agent, cleaned };
  }

  public updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.getTask(id);
    if (!task) return undefined;

    Object.assign(task, updates);
    this.notifyChange();
    return task;
  }

  public setActiveTaskId(id: string | null): void {
    this.activeTaskId = id;
    this.notifyChange();
  }

  public skipTask(id: string): boolean {
    const task = this.getTask(id);
    if (!task || task.status === 'RUNNING') return false;

    task.status = 'SKIPPED';
    this.logger?.info('QUEUE', `Task #${task.id} marked as SKIPPED.`);
    this.notifyChange();
    return true;
  }

  public retryTask(id: string): boolean {
    const task = this.getTask(id);
    if (!task) return false;

    task.status = 'PENDING';
    task.attempts = 0;
    task.lastError = undefined;
    task.errorCategory = undefined;
    task.exitCode = undefined;
    this.logger?.info('QUEUE', `Task #${task.id} queued for RETRY.`);
    this.notifyChange();
    return true;
  }

  public clearCompleted(): number {
    const initialCount = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'SKIPPED');
    const removed = initialCount - this.tasks.length;
    this.logger?.info('QUEUE', `Cleared ${removed} completed/skipped tasks.`);
    this.notifyChange();
    return removed;
  }

  public clearAll(): void {
    this.tasks = [];
    this.activeTaskId = null;
    this.logger?.info('QUEUE', 'Cleared all tasks from queue.');
    this.notifyChange();
  }

  private generateNextId(): string {
    const existingIds = this.tasks.map((t) => parseInt(t.id, 10)).filter((n) => !isNaN(n));
    const max = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    return String(max + 1).padStart(3, '0');
  }
}
