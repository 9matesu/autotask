#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import path from 'node:path';
import { App } from './tui/App.js';
import { ConfigManager } from './config/config-manager.js';
import { TaskLogger } from './logging/logger.js';
import { StateStore } from './persistence/state-store.js';
import { TaskQueue } from './queue/task-queue.js';
import { TaskRunner } from './queue/task-runner.js';
import { OpenCodeCliRunner } from './opencode/cli-runner.js';
import { MockOpenCodeRunner } from './opencode/mock-runner.js';
import { OpenCodeAdapter } from './opencode/adapter.js';
import { CommandRegistry } from './commands/command-registry.js';
import { DoctorService } from './commands/doctor.js';
import { GitManager } from './git/git-manager.js';

const program = new Command();

program
  .name('autotask')
  .description('Terminal queue supervisor and orchestrator for OpenCode CLI')
  .version('0.1.0')
  .option('-p, --project <path>', 'Working directory repository path', '.')
  .option('-m, --mock', 'Run with simulated OpenCode mock runner (zero tokens)', false)
  .option('-d, --doctor', 'Run system and environment diagnostic checks', false)
  .option('--auto-start', 'Automatically start executing queued tasks on launch', false);

program.parse(process.argv);

const options = program.opts();
const workingDir = path.resolve(options.project || '.');

async function main() {
  // Initialize Core Services
  const configManager = new ConfigManager(workingDir);
  configManager.ensureExampleConfig();
  const config = configManager.getConfig();

  const logger = new TaskLogger(workingDir);
  const stateStore = new StateStore(workingDir, logger);

  // Crash Recovery: check for interrupted tasks
  const autoStart = options.autoStart || config.queue.autoStart;
  const { wasInterrupted, recoveredTasks } = stateStore.checkAndRecoverInterruptedTasks(autoStart);
  if (wasInterrupted) {
    logger.warn('SYSTEM', `Recovered ${recoveredTasks.length} interrupted tasks from previous session.`);
  }

  // Adapter selection
  let adapter: OpenCodeAdapter;
  if (options.mock) {
    adapter = new MockOpenCodeRunner(logger);
  } else {
    adapter = new OpenCodeCliRunner(config, logger);
  }

  const doctor = new DoctorService(adapter, config, workingDir);
  const git = new GitManager(workingDir, logger);

  // If --doctor flag passed, run doctor directly to stdout and exit
  if (options.doctor) {
    console.log('\nRunning Autotask Doctor...\n');
    const report = await doctor.runDiagnostics();
    for (const item of report.items) {
      const sym = item.ok ? '✓' : '✗';
      console.log(`  ${sym} ${item.name.padEnd(24)}: ${item.message}`);
    }
    console.log(report.overallOk ? '\nAll checks passed!\n' : '\nDiagnostics completed with issues.\n');
    process.exit(report.overallOk ? 0 : 1);
  }

  const queue = new TaskQueue(stateStore, config, logger);
  const runner = new TaskRunner(queue, adapter, config, logger, workingDir);
  const registry = new CommandRegistry();

  if (autoStart) {
    setTimeout(() => {
      runner.start().catch((err) => logger.error('QUEUE', `Startup run error: ${err.message}`));
    }, 200);
  }

  // Render Ink TUI
  const appInstance = render(
    React.createElement(App, {
      queue,
      runner,
      registry,
      logger,
      configManager,
      doctor,
      git,
      isMock: options.mock,
    })
  );

  await appInstance.waitUntilExit();
}

main().catch((err) => {
  console.error('Fatal Autotask Error:', err);
  process.exit(1);
});
