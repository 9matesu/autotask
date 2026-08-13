import fs from 'node:fs';
import path from 'node:path';
import { QueueState, Task, TaskStatus } from '../types/task.js';
import { TaskLogger } from '../logging/logger.js';

const CURRENT_SCHEMA_VERSION = '1.0.0';

export class StateStore {
  private baseDir: string;
  private queueFilePath: string;
  private logger?: TaskLogger;

  constructor(repoPath: string = process.cwd(), logger?: TaskLogger) {
    this.baseDir = path.resolve(repoPath, '.autotask');
    this.queueFilePath = path.join(this.baseDir, 'queue.json');
    this.logger = logger;
  }

  public getQueueFilePath(): string {
    return this.queueFilePath;
  }

  public loadState(): QueueState {
    try {
      if (fs.existsSync(this.queueFilePath)) {
        const content = fs.readFileSync(this.queueFilePath, 'utf-8');
        if (content.trim().length > 0) {
          const parsed = JSON.parse(content) as QueueState;
          if (Array.isArray(parsed.tasks)) {
            return parsed;
          }
        }
      }
    } catch (err) {
      this.logger?.error('SYSTEM', `Failed to load state from ${this.queueFilePath}. Backing up corrupted file.`, { error: String(err) });
      this.backupCorruptedState();
    }

    return this.createEmptyState();
  }

  public saveState(state: QueueState): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }

      state.updatedAt = new Date().toISOString();
      const serialized = JSON.stringify(state, null, 2);

      // Atomic write: write to temp file then rename
      const tempPath = path.join(this.baseDir, `queue.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`);
      fs.writeFileSync(tempPath, serialized, 'utf-8');

      try {
        fs.renameSync(tempPath, this.queueFilePath);
      } catch {
        // Fallback for Windows cross-device or file locking: copy and unlink
        fs.copyFileSync(tempPath, this.queueFilePath);
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // ignore unlink error
        }
      }
    } catch (err) {
      this.logger?.error('SYSTEM', `Failed to save state to ${this.queueFilePath}: ${String(err)}`);
      throw err;
    }
  }

  public checkAndRecoverInterruptedTasks(autoStart: boolean = false): { recoveredTasks: Task[]; wasInterrupted: boolean } {
    const state = this.loadState();
    const interrupted = state.tasks.filter((t) => t.status === 'RUNNING' || t.status === 'RETRYING');

    if (interrupted.length === 0) {
      return { recoveredTasks: [], wasInterrupted: false };
    }

    this.logger?.warn('SYSTEM', `Found ${interrupted.length} interrupted tasks from previous session.`);

    for (const task of interrupted) {
      task.lastError = task.lastError || 'Interrupted by application crash or shutdown';
      if (autoStart) {
        task.status = 'PENDING';
        this.logger?.info('SYSTEM', `Task #${task.id} automatically recovered to PENDING for restart.`);
      } else {
        task.status = 'PAUSED';
        this.logger?.info('SYSTEM', `Task #${task.id} set to PAUSED. Use /resume or /retry to continue.`);
      }
    }

    state.activeTaskId = null;
    this.saveState(state);

    return { recoveredTasks: interrupted, wasInterrupted: true };
  }

  private createEmptyState(): QueueState {
    return {
      version: CURRENT_SCHEMA_VERSION,
      activeTaskId: null,
      isPaused: false,
      tasks: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private backupCorruptedState(): void {
    try {
      if (fs.existsSync(this.queueFilePath)) {
        const backupPath = path.join(this.baseDir, `queue.corrupted.${Date.now()}.bak`);
        fs.renameSync(this.queueFilePath, backupPath);
        this.logger?.warn('SYSTEM', `Corrupted queue state saved to ${backupPath}`);
      }
    } catch (err) {
      this.logger?.error('SYSTEM', `Failed to backup corrupted state: ${String(err)}`);
    }
  }
}
