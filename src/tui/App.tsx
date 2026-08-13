import React, { useState, useEffect } from 'react';
import { Box, useApp } from 'ink';
import path from 'node:path';
import { Header } from './components/Header.js';
import { QueuePanel } from './components/QueuePanel.js';
import { ExecutionPanel } from './components/ExecutionPanel.js';
import { StatusBar } from './components/StatusBar.js';
import { CommandInput } from './components/CommandInput.js';
import { TaskQueue } from '../queue/task-queue.js';
import { TaskRunner } from '../queue/task-runner.js';
import { CommandRegistry } from '../commands/command-registry.js';
import { TaskLogger, LogEntry } from '../logging/logger.js';
import { ConfigManager } from '../config/config-manager.js';
import { DoctorService } from '../commands/doctor.js';
import { GitManager } from '../git/git-manager.js';
import { AgentMode, Task } from '../types/task.js';

interface AppProps {
  queue: TaskQueue;
  runner: TaskRunner;
  registry: CommandRegistry;
  logger: TaskLogger;
  configManager: ConfigManager;
  doctor: DoctorService;
  git: GitManager;
  isMock?: boolean;
}

export const App: React.FC<AppProps> = ({
  queue,
  runner,
  registry,
  logger,
  configManager,
  doctor,
  git,
  isMock,
}) => {
  const { exit } = useApp();
  const [tasks, setTasks] = useState<Task[]>(queue.getTasks());
  const [activeTaskId, setActiveTaskId] = useState<string | null>(queue.getState().activeTaskId);
  const [isPaused, setIsPaused] = useState<boolean>(queue.isQueuePaused());
  const [isRunning, setIsRunning] = useState<boolean>(runner.isBusy());
  const [logs, setLogs] = useState<LogEntry[]>(logger.getRecentLogs());
  const [backoffSeconds, setBackoffSeconds] = useState<number | null>(null);
  const [totalTokens, setTotalTokens] = useState<number>(0);
  const [agentMode, setAgentMode] = useState<AgentMode>(configManager.getConfig().opencode.agent);

  const projectName = path.basename(configManager.getBaseDir());
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  useEffect(() => {
    // Subscribe to TaskQueue state updates
    const unsubQueue = queue.onStateChange((state) => {
      setTasks(state.tasks);
      setActiveTaskId(state.activeTaskId);
      setIsPaused(state.isPaused);
    });

    // Subscribe to TaskLogger log updates
    const unsubLogger = logger.onLog((entry) => {
      setLogs((prev) => [...prev.slice(-40), entry]);
    });

    // Subscribe to TaskRunner events
    const unsubRunner = runner.onEvent((event) => {
      switch (event.type) {
        case 'QUEUE_STARTED':
          setIsRunning(true);
          setBackoffSeconds(null);
          break;
        case 'QUEUE_PAUSED':
          setIsRunning(false);
          break;
        case 'QUEUE_FINISHED':
          setIsRunning(false);
          setBackoffSeconds(null);
          break;
        case 'TASK_STARTED':
          setBackoffSeconds(null);
          break;
        case 'TASK_BACKOFF':
          setBackoffSeconds(event.secondsRemaining);
          break;
        case 'TASK_EVENT':
          if (event.event.type === 'context_usage' && event.event.data.totalTokens) {
            setTotalTokens(event.event.data.totalTokens);
          }
          break;
      }
    });

    return () => {
      unsubQueue();
      unsubLogger();
      unsubRunner();
    };
  }, [queue, logger, runner]);

  const handleCommandSubmit = async (input: string) => {
    const result = await registry.execute(input, {
      queue,
      runner,
      doctor,
      git,
      logger,
      configManager,
      onQuit: () => exit(),
      onModeChange: (m) => setAgentMode(m),
    });

    if (result) {
      logger.info('SYSTEM', result);
    }
  };

  return (
    <Box flexDirection="column" padding={0}>
      <Header
        projectName={projectName}
        agentMode={agentMode}
        model={configManager.getConfig().opencode.model || 'Default'}
        isRunning={isRunning}
        isPaused={isPaused}
        isMock={isMock}
      />

      <Box flexDirection="row">
        <QueuePanel tasks={tasks} activeTaskId={activeTaskId} />
        <ExecutionPanel
          logs={logs}
          backoffSeconds={backoffSeconds}
          activeTaskTitle={activeTask?.title}
        />
      </Box>

      <StatusBar
        activeTask={activeTask}
        isRunning={isRunning}
        totalTokens={totalTokens}
      />

      <CommandInput onSubmit={handleCommandSubmit} registry={registry} />
    </Box>
  );
};
