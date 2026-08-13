export type TaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'RETRYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAUSED'
  | 'CANCELLED'
  | 'SKIPPED';

export type AgentMode = 'build' | 'plan';

export interface TaskAttempt {
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  exitCode?: number | null;
  error?: string;
  errorCategory?: string;
  durationMs?: number;
  logFile?: string;
}

export interface Task {
  id: string;
  title: string;
  prompt: string;
  agent: AgentMode;
  status: TaskStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  errorCategory?: string;
  sessionId?: string;
  exitCode?: number | null;
  durationMs?: number;
  history: TaskAttempt[];
}

export interface QueueState {
  version: string;
  activeTaskId: string | null;
  isPaused: boolean;
  tasks: Task[];
  updatedAt: string;
}
