import { describe, it, expect } from 'vitest';
import { MockOpenCodeRunner } from '../src/opencode/mock-runner.js';
import { OpenCodeEvent } from '../src/opencode/types.js';

describe('MockOpenCodeRunner', () => {
  it('should run a simulated task emitting events and completing successfully', async () => {
    const runner = new MockOpenCodeRunner();
    const events: OpenCodeEvent[] = [];

    const result = await runner.runTask(
      {
        prompt: 'Build user authentication module',
        workingDir: process.cwd(),
      },
      (ev) => events.push(ev)
    );

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(events.length).toBeGreaterThan(3);
    expect(events.some((e) => e.type === 'tool_start')).toBe(true);
    expect(events.some((e) => e.type === 'session_completed')).toBe(true);
  });

  it('should simulate 429 rate limit when triggered', async () => {
    const runner = new MockOpenCodeRunner();
    const result = await runner.runTask({
      prompt: '[MOCK_429] Trigger rate limit error',
      workingDir: process.cwd(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('429');
  });

  it('should simulate context overflow when triggered', async () => {
    const runner = new MockOpenCodeRunner();
    const result = await runner.runTask({
      prompt: '[MOCK_CONTEXT] Trigger context limit error',
      workingDir: process.cwd(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Context length exceeded');
  });
});
