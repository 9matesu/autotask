import { OpenCodeAdapter } from './adapter.js';
import { OpenCodeEvent, OpenCodeHealth, OpenCodeRunOptions, OpenCodeRunResult } from './types.js';
import { TaskLogger } from '../logging/logger.js';

export class MockOpenCodeRunner implements OpenCodeAdapter {
  private logger?: TaskLogger;
  private isCancelled: boolean = false;

  constructor(logger?: TaskLogger) {
    this.logger = logger;
  }

  public async checkHealth(): Promise<OpenCodeHealth> {
    return {
      installed: true,
      version: '1.18.18-mock',
      executablePath: 'mock-opencode',
    };
  }

  public async runTask(
    options: OpenCodeRunOptions,
    onEvent?: (event: OpenCodeEvent) => void
  ): Promise<OpenCodeRunResult> {
    this.isCancelled = false;
    const startTime = Date.now();
    const sessionId = options.sessionId || `mock-session-${Math.random().toString(36).slice(2, 8)}`;
    const prompt = options.prompt;

    this.logger?.info('OPENCODE', `[MOCK] Starting mock task execution with prompt: "${prompt.slice(0, 60)}..."`);

    // Emit session start
    this.emit(onEvent, {
      type: 'session_started',
      timestamp: new Date().toISOString(),
      data: {
        sessionId,
        model: options.model || 'mock/glm-4',
        provider: 'MockProvider',
      },
    });

    await this.delay(300);

    // Scenario 1: Force Rate Limit
    if (prompt.includes('[MOCK_429]') || prompt.includes('simular rate limit')) {
      this.logger?.warn('OPENCODE', '[MOCK] Simulating HTTP 429 Rate Limit error');
      this.emit(onEvent, {
        type: 'error',
        timestamp: new Date().toISOString(),
        data: { error: 'HTTP 429: Too Many Requests. Rate limit exceeded. Retry-After: 3 seconds.' },
      });
      return {
        success: false,
        exitCode: 1,
        sessionId,
        output: '',
        error: 'HTTP 429: Rate limit exceeded. Retry-After: 3 seconds.',
        durationMs: Date.now() - startTime,
      };
    }

    // Scenario 2: Force Context Overflow
    if (prompt.includes('[MOCK_CONTEXT]') || prompt.includes('simular context overflow')) {
      this.logger?.warn('OPENCODE', '[MOCK] Simulating Context Overflow error');
      this.emit(onEvent, {
        type: 'error',
        timestamp: new Date().toISOString(),
        data: { error: 'Error: Context length exceeded maximum tokens (128000 tokens).' },
      });
      return {
        success: false,
        exitCode: 1,
        sessionId,
        output: '',
        error: 'Error: Context length exceeded maximum tokens.',
        durationMs: Date.now() - startTime,
      };
    }

    // Scenario 3: Force Generic Failure / Crash
    if (prompt.includes('[MOCK_FAIL]') || prompt.includes('simular erro')) {
      this.logger?.error('OPENCODE', '[MOCK] Simulating Unhandled Exception crash');
      this.emit(onEvent, {
        type: 'error',
        timestamp: new Date().toISOString(),
        data: { error: 'Panic: internal worker process crashed unexpectedly' },
      });
      return {
        success: false,
        exitCode: 1,
        sessionId,
        output: '',
        error: 'Process crashed with exit code 1',
        durationMs: Date.now() - startTime,
      };
    }

    // Default: Simulate Realistic Successful Agent Workflow
    const steps = [
      { tool: 'read_dir', args: { path: options.workingDir }, msg: 'Inspecting repository directory tree...' },
      { tool: 'read_file', args: { path: 'package.json' }, msg: 'Analyzing project dependencies and config...' },
      { tool: 'edit_file', args: { path: 'src/index.ts' }, msg: 'Applying requested code changes...' },
      { tool: 'run_command', args: { cmd: 'git status' }, msg: 'Checking git working directory diff...' },
    ];

    for (const step of steps) {
      if (this.isCancelled) break;

      this.emit(onEvent, {
        type: 'tool_start',
        timestamp: new Date().toISOString(),
        data: { toolName: step.tool, toolArgs: step.args },
      });

      this.emit(onEvent, {
        type: 'assistant_message',
        timestamp: new Date().toISOString(),
        data: { message: step.msg },
      });

      await this.delay(400);

      this.emit(onEvent, {
        type: 'tool_finish',
        timestamp: new Date().toISOString(),
        data: { toolName: step.tool, toolResult: 'OK' },
      });

      await this.delay(200);
    }

    // Emit token usage
    this.emit(onEvent, {
      type: 'context_usage',
      timestamp: new Date().toISOString(),
      data: { inputTokens: 1250, outputTokens: 380, totalTokens: 1630, contextRatio: 0.15 },
    });

    this.emit(onEvent, {
      type: 'session_completed',
      timestamp: new Date().toISOString(),
      data: { sessionId, message: 'All changes successfully completed and verified.' },
    });

    const durationMs = Date.now() - startTime;
    return {
      success: true,
      exitCode: 0,
      sessionId,
      output: 'Task successfully completed by Mock OpenCode Runner.',
      durationMs,
      tokens: { input: 1250, output: 380, total: 1630 },
    };
  }

  public async compactSession(sessionId: string, workingDir: string, onEvent?: (event: OpenCodeEvent) => void): Promise<boolean> {
    this.logger?.info('OPENCODE', `[MOCK] Compacted session ${sessionId} successfully.`);
    this.emit(onEvent, {
      type: 'assistant_message',
      timestamp: new Date().toISOString(),
      data: { message: `[MOCK] Compaction complete for session ${sessionId}. Context reduced by 60%.` },
    });
    return true;
  }

  public async cancelActiveRun(): Promise<void> {
    this.isCancelled = true;
    this.logger?.info('OPENCODE', '[MOCK] Cancelled active run.');
  }

  private emit(onEvent?: (event: OpenCodeEvent) => void, event?: OpenCodeEvent): void {
    if (onEvent && event) {
      onEvent(event);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
