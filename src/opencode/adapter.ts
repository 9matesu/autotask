import { OpenCodeEvent, OpenCodeHealth, OpenCodeRunOptions, OpenCodeRunResult } from './types.js';

export interface OpenCodeAdapter {
  runTask(
    options: OpenCodeRunOptions,
    onEvent?: (event: OpenCodeEvent) => void
  ): Promise<OpenCodeRunResult>;

  compactSession(
    sessionId: string,
    workingDir: string,
    onEvent?: (event: OpenCodeEvent) => void
  ): Promise<boolean>;

  checkHealth(): Promise<OpenCodeHealth>;

  cancelActiveRun(): Promise<void>;
}
