import fs from 'node:fs';
import path from 'node:path';

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  source: 'SYSTEM' | 'OPENCODE' | 'QUEUE' | 'GIT' | 'RETRY';
  message: string;
  metadata?: Record<string, unknown>;
}

export class TaskLogger {
  private baseDir: string;
  private currentTaskId: string | null = null;
  private currentAttempt: number = 1;
  private currentLogFilePath: string | null = null;
  private memoryLogs: LogEntry[] = [];
  private maxMemoryLogs: number = 200;
  private listeners: ((entry: LogEntry) => void)[] = [];

  constructor(repoPath: string = process.cwd()) {
    this.baseDir = path.resolve(repoPath, '.autotask', 'logs');
  }

  public setTaskContext(taskId: string, attempt: number): string {
    this.currentTaskId = taskId;
    this.currentAttempt = attempt;
    const taskDir = path.join(this.baseDir, `task-${taskId}`);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }
    this.currentLogFilePath = path.join(taskDir, `attempt-${String(attempt).padStart(3, '0')}.log`);
    return this.currentLogFilePath;
  }

  public clearTaskContext(): void {
    this.currentTaskId = null;
    this.currentLogFilePath = null;
  }

  public getCurrentLogFilePath(): string | null {
    return this.currentLogFilePath;
  }

  public onLog(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public log(level: LogEntry['level'], source: LogEntry['source'], message: string, metadata?: Record<string, unknown>): void {
    const redacted = this.redactSensitiveInfo(message);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message: redacted,
      metadata,
    };

    // Store in memory ring-buffer
    this.memoryLogs.push(entry);
    if (this.memoryLogs.length > this.maxMemoryLogs) {
      this.memoryLogs.shift();
    }

    // Write to file if task context is active
    if (this.currentLogFilePath) {
      try {
        const line = `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}\n`;
        fs.appendFileSync(this.currentLogFilePath, line, 'utf-8');
      } catch (err) {
        console.error('[TaskLogger] Failed to write log to file:', err);
      }
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // Ignore listener failures
      }
    }
  }

  public info(source: LogEntry['source'], message: string, metadata?: Record<string, unknown>): void {
    this.log('INFO', source, message, metadata);
  }

  public warn(source: LogEntry['source'], message: string, metadata?: Record<string, unknown>): void {
    this.log('WARN', source, message, metadata);
  }

  public error(source: LogEntry['source'], message: string, metadata?: Record<string, unknown>): void {
    this.log('ERROR', source, message, metadata);
  }

  public debug(source: LogEntry['source'], message: string, metadata?: Record<string, unknown>): void {
    this.log('DEBUG', source, message, metadata);
  }

  public getRecentLogs(): LogEntry[] {
    return [...this.memoryLogs];
  }

  public redactSensitiveInfo(text: string): string {
    if (!text) return text;
    return text
      .replace(/sk-[a-zA-Z0-9_-]{20,}/g, 'sk-***REDACTED***')
      .replace(/nvapi-[a-zA-Z0-9_-]{20,}/g, 'nvapi-***REDACTED***')
      .replace(/Bearer\s+[a-zA-Z0-9_.-]{20,}/gi, 'Bearer ***REDACTED***')
      .replace(/Authorization:\s*[^\r\n]+/gi, 'Authorization: ***REDACTED***')
      .replace(/password\s*[:=]\s*["']?[^"'\s]+["']?/gi, 'password=***REDACTED***')
      .replace(/api[_-]?key\s*[:=]\s*["']?[^"'\s]+["']?/gi, 'api_key=***REDACTED***');
  }

  public getTaskLogs(taskId: string): { attempt: number; path: string; content: string }[] {
    const taskDir = path.join(this.baseDir, `task-${taskId}`);
    if (!fs.existsSync(taskDir)) {
      return [];
    }
    const files = fs.readdirSync(taskDir).filter((f) => f.endsWith('.log')).sort();
    return files.map((file) => {
      const match = file.match(/attempt-(\d+)\.log/);
      const attempt = match ? parseInt(match[1], 10) : 1;
      const fullPath = path.join(taskDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      return { attempt, path: fullPath, content };
    });
  }
}
