import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskLogger } from '../logging/logger.js';
import { Task } from '../types/task.js';

const execAsync = promisify(exec);

export interface GitStatusResult {
  isGitRepo: boolean;
  hasChanges: boolean;
  changedFilesCount: number;
  branch?: string;
  error?: string;
}

export interface ValidationResult {
  success: boolean;
  command: string;
  exitCode: number;
  output: string;
}

export class GitManager {
  private repoDir: string;
  private logger?: TaskLogger;

  constructor(repoDir: string = process.cwd(), logger?: TaskLogger) {
    this.repoDir = repoDir;
    this.logger = logger;
  }

  public async checkStatus(): Promise<GitStatusResult> {
    try {
      const { stdout: isRepo } = await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.repoDir });
      if (isRepo.trim() !== 'true') {
        return { isGitRepo: false, hasChanges: false, changedFilesCount: 0 };
      }

      const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd: this.repoDir }).catch(() => ({ stdout: '' }));
      const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: this.repoDir });

      const lines = statusOut.split('\n').filter((l) => l.trim().length > 0);
      return {
        isGitRepo: true,
        hasChanges: lines.length > 0,
        changedFilesCount: lines.length,
        branch: branchOut.trim() || 'HEAD',
      };
    } catch (err) {
      return {
        isGitRepo: false,
        hasChanges: false,
        changedFilesCount: 0,
        error: String(err),
      };
    }
  }

  public async getDiffSummary(): Promise<string> {
    try {
      const { stdout } = await execAsync('git diff --stat', { cwd: this.repoDir });
      return stdout.trim();
    } catch {
      return '';
    }
  }

  public async runValidationCommand(command: string): Promise<ValidationResult> {
    this.logger?.info('GIT', `Running post-task validation command: ${command}`);
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.repoDir, timeout: 120000 });
      const combined = `${stdout}\n${stderr}`.trim();
      return {
        success: true,
        command,
        exitCode: 0,
        output: combined,
      };
    } catch (err: any) {
      const output = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`.trim();
      this.logger?.warn('GIT', `Validation command failed with exit code ${err.code || 1}: ${output}`);
      return {
        success: false,
        command,
        exitCode: err.code || 1,
        output,
      };
    }
  }

  public async createCheckpoint(task: Task, commitPrefix: string = 'agent: complete task'): Promise<{ committed: boolean; commitMessage?: string }> {
    const status = await this.checkStatus();
    if (!status.isGitRepo) {
      this.logger?.info('GIT', 'Not a git repository, skipping git checkpoint.');
      return { committed: false };
    }

    if (!status.hasChanges) {
      this.logger?.info('GIT', `No uncommitted changes detected for task #${task.id}.`);
      return { committed: false };
    }

    const message = `${commitPrefix} #${task.id} - ${task.title}`;
    try {
      this.logger?.info('GIT', `Creating checkpoint commit: "${message}"`);
      await execAsync('git add -A', { cwd: this.repoDir });
      // Escape commit message for Windows/PowerShell/sh safety
      const escaped = message.replace(/"/g, '\\"');
      await execAsync(`git commit -m "${escaped}"`, { cwd: this.repoDir });
      return { committed: true, commitMessage: message };
    } catch (err) {
      this.logger?.error('GIT', `Failed to create git checkpoint: ${String(err)}`);
      return { committed: false };
    }
  }
}
