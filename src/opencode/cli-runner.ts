import { ChildProcess, spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';
import readline from 'node:readline';
import { OpenCodeAdapter } from './adapter.js';
import { OpenCodeEvent, OpenCodeHealth, OpenCodeRunOptions, OpenCodeRunResult } from './types.js';
import { ProcessMonitor } from '../process/process-monitor.js';
import { TaskLogger } from '../logging/logger.js';
import { AutotaskConfig } from '../types/config.js';

const execAsync = promisify(exec);

export class OpenCodeCliRunner implements OpenCodeAdapter {
  private config: AutotaskConfig;
  private logger?: TaskLogger;
  private activeChild: ChildProcess | null = null;
  private activeMonitor: ProcessMonitor | null = null;

  constructor(config: AutotaskConfig, logger?: TaskLogger) {
    this.config = config;
    this.logger = logger;
  }

  public async checkHealth(): Promise<OpenCodeHealth> {
    const cmd = this.config.opencode.command || 'opencode';
    try {
      const { stdout } = await execAsync(`${cmd} --version`);
      const version = stdout.trim();
      return {
        installed: true,
        version,
        executablePath: cmd,
      };
    } catch (err: any) {
      return {
        installed: false,
        error: `Could not execute '${cmd}': ${err.message || String(err)}`,
      };
    }
  }

  public async runTask(
    options: OpenCodeRunOptions,
    onEvent?: (event: OpenCodeEvent) => void
  ): Promise<OpenCodeRunResult> {
    const startTime = Date.now();
    const cmd = this.config.opencode.command || 'opencode';
    const args: string[] = ['run', options.prompt, '--format', 'json'];

    // Agent mode
    const agent = options.agent || this.config.opencode.agent || 'build';
    args.push('--agent', agent);

    // Model override
    const model = options.model || this.config.opencode.model;
    if (model) {
      args.push('--model', model);
    }

    // Auto approve permissions if configured
    if (options.autoApprove || this.config.opencode.autoApprove) {
      args.push('--auto');
    }

    // Session continuation
    if (options.sessionId && options.continueSession) {
      args.push('--session', options.sessionId);
      if (options.forkSession) {
        args.push('--fork');
      }
    }

    this.logger?.info('OPENCODE', `Launching OpenCode with agent: ${agent}`);
    this.logger?.debug('OPENCODE', `Command: ${cmd} ${args.join(' ')}`);

    let collectedOutput = '';
    let collectedError = '';
    let detectedSessionId: string | undefined = options.sessionId;
    let inputTokens = 0;
    let outputTokens = 0;

    return new Promise<OpenCodeRunResult>((resolve) => {
      let isSettled = false;

      const monitor = new ProcessMonitor({
        idleTimeoutSeconds: this.config.monitoring.idleTimeoutSeconds,
        hardTimeoutSeconds: this.config.monitoring.hardTimeoutSeconds,
        logger: this.logger,
        onIdleTimeout: () => {
          this.emitEvent(onEvent, {
            type: 'error',
            timestamp: new Date().toISOString(),
            data: { error: 'Process idle timeout exceeded' },
          });
        },
        onHardTimeout: () => {
          this.emitEvent(onEvent, {
            type: 'error',
            timestamp: new Date().toISOString(),
            data: { error: 'Process hard execution timeout exceeded' },
          });
        },
      });

      this.activeMonitor = monitor;

      // Spawn subprocess (use shell: true for Windows .cmd/.ps1 batch wrapper resolution)
      const child = spawn(cmd, args, {
        cwd: options.workingDir,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.activeChild = child;
      monitor.attach(child);

      // Handle stdout stream
      if (child.stdout) {
        const rl = readline.createInterface({ input: child.stdout });
        rl.on('line', (line) => {
          monitor.recordHeartbeat('stdout');
          collectedOutput += line + '\n';
          this.parseAndEmitJsonLine(line, onEvent, (sessionId) => {
            if (sessionId) detectedSessionId = sessionId;
          });
        });
      }

      // Handle stderr stream
      if (child.stderr) {
        const rlErr = readline.createInterface({ input: child.stderr });
        rlErr.on('line', (line) => {
          monitor.recordHeartbeat('stderr');
          collectedError += line + '\n';
          this.emitEvent(onEvent, {
            type: 'raw_stderr',
            timestamp: new Date().toISOString(),
            data: { raw: line },
          });
        });
      }

      // Handle abort signal
      if (options.abortSignal) {
        options.abortSignal.addEventListener('abort', () => {
          this.logger?.warn('OPENCODE', 'Abort signal received. Terminating process...');
          monitor.terminateProcessTree();
        });
      }

      // Process close handler
      child.on('close', (code) => {
        if (isSettled) return;
        isSettled = true;
        monitor.detach();
        this.activeChild = null;
        this.activeMonitor = null;

        const durationMs = Date.now() - startTime;
        const success = code === 0;

        this.emitEvent(onEvent, {
          type: 'session_completed',
          timestamp: new Date().toISOString(),
          data: {
            sessionId: detectedSessionId,
            message: success ? 'Task completed successfully' : `Process exited with code ${code}`,
          },
        });

        resolve({
          success,
          exitCode: code,
          sessionId: detectedSessionId,
          output: collectedOutput.trim(),
          error: success ? undefined : (collectedError.trim() || collectedOutput.trim()),
          durationMs,
          tokens: {
            input: inputTokens,
            output: outputTokens,
            total: inputTokens + outputTokens,
          },
        });
      });

      child.on('error', (err) => {
        if (isSettled) return;
        isSettled = true;
        monitor.detach();
        this.activeChild = null;
        this.activeMonitor = null;

        const durationMs = Date.now() - startTime;
        this.logger?.error('OPENCODE', `Subprocess spawn error: ${err.message}`);

        resolve({
          success: false,
          exitCode: null,
          sessionId: detectedSessionId,
          output: collectedOutput.trim(),
          error: err.message,
          durationMs,
        });
      });
    });
  }

  public async compactSession(
    sessionId: string,
    workingDir: string,
    onEvent?: (event: OpenCodeEvent) => void
  ): Promise<boolean> {
    this.logger?.info('OPENCODE', `Requesting session compaction for session ${sessionId}...`);
    this.emitEvent(onEvent, {
      type: 'session_started',
      timestamp: new Date().toISOString(),
      data: { sessionId, message: 'Compacting session context...' },
    });

    const result = await this.runTask(
      {
        prompt: '/compact',
        sessionId,
        continueSession: true,
        workingDir,
      },
      onEvent
    );

    return result.success;
  }

  public async cancelActiveRun(): Promise<void> {
    if (this.activeMonitor) {
      await this.activeMonitor.terminateProcessTree();
    }
  }

  private parseAndEmitJsonLine(
    line: string,
    onEvent?: (event: OpenCodeEvent) => void,
    onSessionId?: (id: string) => void
  ): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const obj = JSON.parse(trimmed);
        
        // Extract session ID if available
        const sid = obj.sessionId || obj.session_id || obj.id || (obj.data && obj.data.sessionId);
        if (sid) {
          onSessionId?.(String(sid));
        }

        // Map events
        const eventType = obj.type || obj.event || 'raw_stdout';

        if (eventType === 'session.start' || eventType === 'session_start' || eventType === 'init') {
          this.emitEvent(onEvent, {
            type: 'session_started',
            timestamp: new Date().toISOString(),
            data: {
              sessionId: sid,
              model: obj.model || obj.data?.model,
              provider: obj.provider || obj.data?.provider,
            },
          });
          return;
        }

        if (eventType === 'tool.start' || eventType === 'tool_call' || obj.tool) {
          this.emitEvent(onEvent, {
            type: 'tool_start',
            timestamp: new Date().toISOString(),
            data: {
              toolName: obj.tool || obj.toolName || obj.data?.name,
              toolArgs: obj.args || obj.arguments || obj.data?.args,
            },
          });
          return;
        }

        if (eventType === 'tool.finish' || eventType === 'tool_result') {
          this.emitEvent(onEvent, {
            type: 'tool_finish',
            timestamp: new Date().toISOString(),
            data: {
              toolName: obj.tool || obj.toolName || obj.data?.name,
              toolResult: obj.result || obj.data?.result,
            },
          });
          return;
        }

        if (eventType === 'error' || obj.error) {
          this.emitEvent(onEvent, {
            type: 'error',
            timestamp: new Date().toISOString(),
            data: {
              error: typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error),
            },
          });
          return;
        }

        if (eventType === 'message' || eventType === 'assistant' || obj.content) {
          this.emitEvent(onEvent, {
            type: 'assistant_message',
            timestamp: new Date().toISOString(),
            data: {
              message: obj.content || obj.message || obj.text || JSON.stringify(obj.data),
            },
          });
          return;
        }

        if (eventType === 'usage' || eventType === 'tokens') {
          this.emitEvent(onEvent, {
            type: 'context_usage',
            timestamp: new Date().toISOString(),
            data: {
              inputTokens: obj.inputTokens || obj.input_tokens,
              outputTokens: obj.outputTokens || obj.output_tokens,
              totalTokens: obj.totalTokens || obj.total_tokens,
              contextRatio: obj.ratio,
            },
          });
          return;
        }

        // Generic json event
        this.emitEvent(onEvent, {
          type: 'assistant_message',
          timestamp: new Date().toISOString(),
          data: {
            message: obj.message || obj.text || trimmed,
            raw: trimmed,
          },
        });
        return;
      } catch {
        // Fallthrough to raw text
      }
    }

    // Plain text line
    this.emitEvent(onEvent, {
      type: 'raw_stdout',
      timestamp: new Date().toISOString(),
      data: { raw: trimmed, message: trimmed },
    });
  }

  private emitEvent(onEvent?: (event: OpenCodeEvent) => void, event?: OpenCodeEvent): void {
    if (onEvent && event) {
      try {
        onEvent(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}
