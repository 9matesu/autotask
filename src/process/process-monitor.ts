import { ChildProcess, exec } from 'node:child_process';
import treeKill from 'tree-kill';
import { TaskLogger } from '../logging/logger.js';

export interface ProcessMonitorOptions {
  idleTimeoutSeconds: number;
  hardTimeoutSeconds: number;
  onIdleTimeout?: () => void;
  onHardTimeout?: () => void;
  logger?: TaskLogger;
}

export class ProcessMonitor {
  private childProcess: ChildProcess | null = null;
  private lastActivityTimestamp: number = Date.now();
  private startTimestamp: number = Date.now();
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private hardTimeoutTimer: NodeJS.Timeout | null = null;
  private options: ProcessMonitorOptions;
  private isTerminated: boolean = false;

  constructor(options: ProcessMonitorOptions) {
    this.options = options;
  }

  public attach(child: ChildProcess): void {
    this.childProcess = child;
    this.lastActivityTimestamp = Date.now();
    this.startTimestamp = Date.now();
    this.isTerminated = false;

    // Hard timeout timer
    const hardMs = this.options.hardTimeoutSeconds * 1000;
    this.hardTimeoutTimer = setTimeout(() => {
      if (!this.isTerminated) {
        this.options.logger?.warn('SYSTEM', `Hard execution timeout of ${this.options.hardTimeoutSeconds}s exceeded. Terminating process tree.`);
        this.options.onHardTimeout?.();
        this.terminateProcessTree();
      }
    }, hardMs);

    // Periodic idle watchdog check
    const idleCheckPeriodMs = 3000;
    this.idleCheckInterval = setInterval(() => {
      if (this.isTerminated) return;
      const elapsedIdle = (Date.now() - this.lastActivityTimestamp) / 1000;
      if (elapsedIdle >= this.options.idleTimeoutSeconds) {
        this.options.logger?.warn('SYSTEM', `Idle timeout of ${this.options.idleTimeoutSeconds}s without activity exceeded. Terminating process tree.`);
        this.options.onIdleTimeout?.();
        this.terminateProcessTree();
      }
    }, idleCheckPeriodMs);
  }

  public recordHeartbeat(source: string = 'activity'): void {
    this.lastActivityTimestamp = Date.now();
  }

  public getElapsedTimeMs(): number {
    return Date.now() - this.startTimestamp;
  }

  public getIdleTimeSeconds(): number {
    return (Date.now() - this.lastActivityTimestamp) / 1000;
  }

  public detach(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    if (this.hardTimeoutTimer) {
      clearTimeout(this.hardTimeoutTimer);
      this.hardTimeoutTimer = null;
    }
    this.childProcess = null;
  }

  public async terminateProcessTree(signal: string = 'SIGTERM'): Promise<void> {
    if (this.isTerminated) return;
    this.isTerminated = true;

    this.detach();

    if (!this.childProcess || !this.childProcess.pid) {
      return;
    }

    const pid = this.childProcess.pid;
    this.options.logger?.info('SYSTEM', `Terminating process tree for PID ${pid} with signal ${signal}...`);

    return new Promise<void>((resolve) => {
      // For Windows, try graceful tree kill
      if (process.platform === 'win32') {
        // Run taskkill /PID <pid> /T /F
        exec(`taskkill /PID ${pid} /T /F`, (err) => {
          if (err) {
            // Fallback to tree-kill module
            treeKill(pid, 'SIGKILL', () => resolve());
          } else {
            resolve();
          }
        });
      } else {
        treeKill(pid, signal, (err) => {
          if (err) {
            treeKill(pid, 'SIGKILL', () => resolve());
          } else {
            resolve();
          }
        });
      }
    });
  }
}
