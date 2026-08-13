import { describe, it, expect } from 'vitest';
import { ErrorClassifier } from '../src/detection/error-classifier.js';

describe('ErrorClassifier', () => {
  it('should detect 429 rate limit and extract Retry-After seconds', () => {
    const errorMsg = 'HTTP 429: Too Many Requests. Rate limit exceeded. Retry-After: 45';
    const classified = ErrorClassifier.classify(errorMsg);

    expect(classified.category).toBe('RATE_LIMIT_429');
    expect(classified.isRetryable).toBe(true);
    expect(classified.suggestedBackoffSeconds).toBe(45);
  });

  it('should detect context overflow keywords', () => {
    const errorMsg = 'Error: context length exceeded maximum tokens (128000)';
    const classified = ErrorClassifier.classify(errorMsg);

    expect(classified.category).toBe('CONTEXT_OVERFLOW');
    expect(classified.isRetryable).toBe(true);
  });

  it('should detect transient network failures', () => {
    const errorMsg = 'fetch failed: ECONNRESET connection reset by peer';
    const classified = ErrorClassifier.classify(errorMsg);

    expect(classified.category).toBe('TRANSIENT');
    expect(classified.isRetryable).toBe(true);
  });

  it('should classify authentication errors as non-retryable fatal', () => {
    const errorMsg = '401 Unauthorized: Invalid API key provided';
    const classified = ErrorClassifier.classify(errorMsg);

    expect(classified.category).toBe('AUTH');
    expect(classified.isRetryable).toBe(false);
  });
});
