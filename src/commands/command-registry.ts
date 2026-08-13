import { TaskQueue } from '../queue/task-queue.js';
import { TaskRunner } from '../queue/task-runner.js';
import { DoctorService } from './doctor.js';
import { GitManager } from '../git/git-manager.js';
import { TaskLogger } from '../logging/logger.js';
import { ConfigManager } from '../config/config-manager.js';
import { AgentMode } from '../types/task.js';

export interface CommandContext {
  queue: TaskQueue;
  runner: TaskRunner;
  doctor: DoctorService;
  git: GitManager;
  logger: TaskLogger;
  configManager: ConfigManager;
  onQuit?: () => void;
  onModeChange?: (mode: AgentMode) => void;
}

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  execute: (args: string[], ctx: CommandContext) => Promise<string> | string;
}

export class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();
  private aliasMap: Map<string, string> = new Map();

  constructor() {
    this.registerDefaults();
  }

  public register(cmd: CommandDefinition): void {
    this.commands.set(cmd.name.toLowerCase(), cmd);
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.aliasMap.set(alias.toLowerCase(), cmd.name.toLowerCase());
      }
    }
  }

  public getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  public getSuggestions(input: string): string[] {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return [];

    const query = trimmed.slice(1).toLowerCase();
    const suggestions: string[] = [];

    for (const [name, def] of this.commands.entries()) {
      if (name.startsWith(query)) {
        suggestions.push(`/${name} - ${def.description}`);
      }
    }

    return suggestions;
  }

  public async execute(rawInput: string, ctx: CommandContext): Promise<string> {
    const trimmed = rawInput.trim();
    if (!trimmed) return '';

    if (!trimmed.startsWith('/')) {
      // Direct task addition
      const tasks = ctx.queue.parseAndAdd(trimmed);
      return `Added ${tasks.length} task${tasks.length > 1 ? 's' : ''} to queue.`;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const canonicalName = this.aliasMap.get(cmdName) || cmdName;
    const def = this.commands.get(canonicalName);

    if (!def) {
      return `Unknown command: /${cmdName}. Type /help for available commands.`;
    }

    try {
      return await def.execute(args, ctx);
    } catch (err: any) {
      return `Command error: ${err.message || String(err)}`;
    }
  }

  private registerDefaults(): void {
    this.register({
      name: 'help',
      aliases: ['?', 'h'],
      description: 'Show available commands and usage',
      usage: '/help',
      execute: () => {
        const lines = [
          'Autotask Available Commands:',
          '  /add <task>        - Add one or multiple tasks (supports bullet/numbered lists)',
          '  /start             - Start/resume executing the queue',
          '  /pause             - Pause queue processing',
          '  /stop              - Stop active OpenCode run and pause queue',
          '  /queue, /tasks     - Show all tasks in queue',
          '  /retry <id>        - Reset and retry a specific task (e.g. /retry 001)',
          '  /skip <id>         - Skip a specific task (e.g. /skip 002)',
          '  /clear             - Remove completed and skipped tasks',
          '  /doctor            - Run full environment & tool diagnostics',
          '  /diff              - Show git diff summary',
          '  /git               - Check git repository status',
          '  /log [id]          - View logs for current or specific task',
          '  /mode <plan|build> - Switch default agent mode',
          '  /config            - View current configuration',
          '  /quit, /q          - Exit Autotask',
        ];
        return lines.join('\n');
      },
    });

    this.register({
      name: 'add',
      aliases: ['task', 'paste'],
      description: 'Add tasks to queue (paste multiple lines or type)',
      usage: '/add <task text or pasted list>',
      execute: (args, ctx) => {
        const text = args.join(' ').trim();
        if (!text) {
          return 'Usage: /add <task description or pasted list>';
        }
        const created = ctx.queue.parseAndAdd(text);
        return `Added ${created.length} task${created.length > 1 ? 's' : ''} to queue.`;
      },
    });

    this.register({
      name: 'queue',
      aliases: ['tasks', 'status'],
      description: 'Display queue overview and active tasks',
      usage: '/queue',
      execute: (_, ctx) => {
        const tasks = ctx.queue.getTasks();
        if (tasks.length === 0) return 'The queue is currently empty. Use /add to queue tasks.';
        
        const lines = [`Queue Status (${tasks.length} total tasks):`];
        for (const t of tasks) {
          const badge = `[${t.status}]`.padEnd(11);
          lines.push(`  #${t.id} ${badge} [${t.agent.toUpperCase()}] ${t.title} (${t.attempts}/${t.maxAttempts} attempts)`);
        }
        return lines.join('\n');
      },
    });

    this.register({
      name: 'start',
      aliases: ['resume', 'run'],
      description: 'Start or resume queue execution',
      usage: '/start',
      execute: async (_, ctx) => {
        if (ctx.runner.isBusy()) {
          return 'Queue is already running.';
        }
        // Run asynchronously
        setTimeout(() => {
          ctx.runner.start().catch((err) => ctx.logger.error('QUEUE', `Runner error: ${err.message}`));
        }, 50);
        return 'Queue execution started.';
      },
    });

    this.register({
      name: 'pause',
      description: 'Pause queue execution',
      usage: '/pause',
      execute: (_, ctx) => {
        ctx.runner.pause();
        return 'Queue paused.';
      },
    });

    this.register({
      name: 'stop',
      description: 'Stop active task execution and pause queue',
      usage: '/stop',
      execute: async (_, ctx) => {
        await ctx.runner.stopCurrentTask();
        return 'Active task execution stopped and queue paused.';
      },
    });

    this.register({
      name: 'retry',
      description: 'Retry a specific task by ID',
      usage: '/retry <task_id>',
      execute: (args, ctx) => {
        const id = args[0]?.padStart(3, '0');
        if (!id) return 'Usage: /retry <task_id> (e.g. /retry 001)';
        const ok = ctx.queue.retryTask(id);
        return ok ? `Task #${id} queued for retry.` : `Task #${id} not found.`;
      },
    });

    this.register({
      name: 'skip',
      description: 'Skip a specific task by ID',
      usage: '/skip <task_id>',
      execute: (args, ctx) => {
        const id = args[0]?.padStart(3, '0');
        if (!id) return 'Usage: /skip <task_id> (e.g. /skip 002)';
        const ok = ctx.queue.skipTask(id);
        return ok ? `Task #${id} marked as SKIPPED.` : `Task #${id} not found or currently RUNNING.`;
      },
    });

    this.register({
      name: 'clear',
      description: 'Remove completed and skipped tasks from queue',
      usage: '/clear',
      execute: (_, ctx) => {
        const count = ctx.queue.clearCompleted();
        return `Cleared ${count} completed/skipped tasks.`;
      },
    });

    this.register({
      name: 'doctor',
      description: 'Run comprehensive environment and tool health checks',
      usage: '/doctor',
      execute: async (_, ctx) => {
        const report = await ctx.doctor.runDiagnostics();
        const lines = ['System Doctor Diagnostic Report:'];
        for (const item of report.items) {
          const symbol = item.ok ? '✓' : '✗';
          lines.push(`  ${symbol} ${item.name.padEnd(24)}: ${item.message}`);
        }
        lines.push(report.overallOk ? '\nOverall Status: ALL CHECKS PASSED ✓' : '\nOverall Status: WARNINGS/ERRORS DETECTED ✗');
        return lines.join('\n');
      },
    });

    this.register({
      name: 'git',
      description: 'Check git working tree status',
      usage: '/git',
      execute: async (_, ctx) => {
        const status = await ctx.git.checkStatus();
        if (!status.isGitRepo) return 'Not a Git repository.';
        return `Branch: ${status.branch} | Uncommitted changes: ${status.changedFilesCount} file(s)`;
      },
    });

    this.register({
      name: 'diff',
      description: 'Show git diff summary',
      usage: '/diff',
      execute: async (_, ctx) => {
        const diff = await ctx.git.getDiffSummary();
        return diff || 'Working tree clean (no git changes).';
      },
    });

    this.register({
      name: 'mode',
      description: 'Switch default agent mode (plan or build)',
      usage: '/mode <plan|build>',
      execute: (args, ctx) => {
        const mode = args[0]?.toLowerCase();
        if (mode !== 'plan' && mode !== 'build') {
          return 'Usage: /mode plan OR /mode build';
        }
        ctx.configManager.saveConfig({ opencode: { ...ctx.configManager.getConfig().opencode, agent: mode } });
        ctx.onModeChange?.(mode);
        return `Default agent mode set to: ${mode.toUpperCase()}`;
      },
    });

    this.register({
      name: 'log',
      aliases: ['logs'],
      description: 'View execution logs for a task',
      usage: '/log [task_id]',
      execute: (args, ctx) => {
        const id = args[0]?.padStart(3, '0');
        if (!id) {
          const recent = ctx.logger.getRecentLogs().slice(-10);
          return recent.map((l) => `[${l.level}] [${l.source}] ${l.message}`).join('\n') || 'No logs recorded yet.';
        }
        const logs = ctx.logger.getTaskLogs(id);
        if (logs.length === 0) return `No logs found for Task #${id}.`;
        const last = logs[logs.length - 1];
        return `=== Log for Task #${id} (Attempt ${last.attempt}) ===\n${last.content.slice(-1500)}`;
      },
    });

    this.register({
      name: 'config',
      description: 'Display current configuration',
      usage: '/config',
      execute: (_, ctx) => {
        const cfg = ctx.configManager.getConfig();
        return JSON.stringify(cfg, null, 2);
      },
    });

    this.register({
      name: 'quit',
      aliases: ['q', 'exit'],
      description: 'Exit Autotask',
      usage: '/quit',
      execute: (_, ctx) => {
        ctx.onQuit?.();
        return 'Exiting Autotask...';
      },
    });
  }
}
