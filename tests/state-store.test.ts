import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { StateStore } from '../src/persistence/state-store.js';
import { QueueState } from '../src/types/task.js';

describe('StateStore', () => {
  const testDir = path.resolve('tests/tmp-state-test');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should save and load queue state atomically', () => {
    const store = new StateStore(testDir);
    const state: QueueState = {
      version: '1.0.0',
      activeTaskId: '001',
      isPaused: false,
      tasks: [
        {
          id: '001',
          title: 'Test Task',
          prompt: 'Test Prompt',
          agent: 'build',
          status: 'RUNNING',
          attempts: 1,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
          history: [],
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    store.saveState(state);
    const loaded = store.loadState();

    expect(loaded.tasks).toHaveLength(1);
    expect(loaded.tasks[0].id).toBe('001');
    expect(loaded.activeTaskId).toBe('001');
  });

  it('should recover interrupted RUNNING tasks to PAUSED on crash restart', () => {
    const store = new StateStore(testDir);
    const state: QueueState = {
      version: '1.0.0',
      activeTaskId: '001',
      isPaused: false,
      tasks: [
        {
          id: '001',
          title: 'Interrupted Task',
          prompt: 'Interrupted Prompt',
          agent: 'build',
          status: 'RUNNING',
          attempts: 1,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
          history: [],
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    store.saveState(state);

    const { wasInterrupted, recoveredTasks } = store.checkAndRecoverInterruptedTasks(false);
    expect(wasInterrupted).toBe(true);
    expect(recoveredTasks).toHaveLength(1);

    const reloaded = store.loadState();
    expect(reloaded.tasks[0].status).toBe('PAUSED');
    expect(reloaded.activeTaskId).toBeNull();
  });
});
