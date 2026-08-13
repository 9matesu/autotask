import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TaskQueue } from '../src/queue/task-queue.js';
import { StateStore } from '../src/persistence/state-store.js';
import { DEFAULT_CONFIG } from '../src/config/config-manager.js';

describe('TaskQueue', () => {
  const testDir = path.resolve('tests/tmp-queue-test');

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

  it('should parse single line task', () => {
    const parsed = TaskQueue.parseTaskInput('Implement login endpoint');
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Implement login endpoint');
    expect(parsed[0].agent).toBe('build');
  });

  it('should parse bullet points correctly', () => {
    const raw = `
    - Task 1
    * Task 2
    • Task 3
    `;
    const parsed = TaskQueue.parseTaskInput(raw);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].title).toBe('Task 1');
    expect(parsed[1].title).toBe('Task 2');
    expect(parsed[2].title).toBe('Task 3');
  });

  it('should parse numbered list correctly', () => {
    const raw = `
    1. Fix JWT authentication
    2. Add refresh token logic
    3. Write auth tests
    `;
    const parsed = TaskQueue.parseTaskInput(raw);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].title).toBe('Fix JWT authentication');
    expect(parsed[1].title).toBe('Add refresh token logic');
    expect(parsed[2].title).toBe('Write auth tests');
  });

  it('should extract agent tags like [PLAN] and [BUILD] or @plan/@build', () => {
    const parsed1 = TaskQueue.parseTaskInput('[PLAN] Analyze architecture');
    expect(parsed1[0].agent).toBe('plan');
    expect(parsed1[0].title).toBe('Analyze architecture');

    const parsed2 = TaskQueue.parseTaskInput('@build Implement feature X');
    expect(parsed2[0].agent).toBe('build');
    expect(parsed2[0].title).toBe('Implement feature X');
  });

  it('should manage queue state and ID incrementation', () => {
    const store = new StateStore(testDir);
    const queue = new TaskQueue(store, DEFAULT_CONFIG);

    const t1 = queue.addTask('Task A');
    const t2 = queue.addTask('Task B');

    expect(t1.id).toBe('001');
    expect(t2.id).toBe('002');
    expect(queue.getTasks()).toHaveLength(2);

    queue.skipTask('001');
    expect(queue.getTask('001')?.status).toBe('SKIPPED');

    queue.retryTask('001');
    expect(queue.getTask('001')?.status).toBe('PENDING');
  });
});
