import { AgentMode } from '../types/task.js';

export interface OpenCodeRunOptions {
  prompt: string;
  agent?: AgentMode;
  model?: string | null;
  sessionId?: string;
  continueSession?: boolean;
  forkSession?: boolean;
  workingDir: string;
  autoApprove?: boolean;
  abortSignal?: AbortSignal;
}

export type OpenCodeEventType =
  | 'session_started'
  | 'assistant_message'
  | 'tool_start'
  | 'tool_finish'
  | 'context_usage'
  | 'error'
  | 'session_completed'
  | 'raw_stdout'
  | 'raw_stderr';

export interface OpenCodeEvent {
  type: OpenCodeEventType;
  timestamp: string;
  data: {
    sessionId?: string;
    model?: string;
    provider?: string;
    message?: string;
    toolName?: string;
    toolArgs?: unknown;
    toolResult?: unknown;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    contextRatio?: number;
    error?: string;
    raw?: string;
  };
}

export interface OpenCodeRunResult {
  success: boolean;
  exitCode: number | null;
  sessionId?: string;
  output: string;
  error?: string;
  durationMs: number;
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
}

export interface OpenCodeHealth {
  installed: boolean;
  version?: string;
  executablePath?: string;
  error?: string;
}
