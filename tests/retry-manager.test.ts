import { describe, it, expect } from 'vitest';
import { RetryManager } from '../src/retry/retry-manager.js';
import { DEFAULT_CONFIG } from '../src/config/config-manager.js';
import { ErrorClassifier } from '../src/detection/error-classifier.js';

describe('RetryManager', () => {
  it('should calculate exponential backoff within configured bounds', () => {
    const config = {
      ...DEFAULT_CONFIG,
      retry: {
        ...DEFAULT_CONFIG.retry,
        initialBackoffSeconds: 5,
        maxBackoffSeconds: 100,
        backoffMultiplier: 2,
        jitter: false,
      },
    };

    const manager = new RetryManager(config);

    const b1 = manager.calculateBackoffSeconds(1);
    const b2 = manager.calculateBackoffSeconds(2);
    const b3 = manager.calculateBackoffSeconds(3);

    expect(b1).toBe(5);
    expect(b2).toBe(10);
    expect(b3).toBe(20);
  });

  it('should prioritize Retry-After when available', () => {
    const manager = new RetryManager(DEFAULT_CONFIG);
    const classified = ErrorClassifier.classify('429 Too Many Requests. Retry-After: 60');

    const backoff = manager.calculateBackoffSeconds(1, classified);
    expect(backoff).toBe(60);
  });

  it('should build intelligent retry prompt instructing to inspect git diff', () => {
    const manager = new RetryManager(DEFAULT_CONFIG);
    const prompt = manager.buildRetryPrompt('Original Task Prompt', 'Connection timeout', 2);

    expect(prompt).toContain('Continue from the CURRENT state of the repository');
    expect(prompt).toContain('Inspect the current git diff first');
    expect(prompt).toContain('Original Task Prompt');
    expect(prompt).toContain('Connection timeout');
  });
});
