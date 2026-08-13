export type ErrorCategory =
  | 'SUCCESS'
  | 'TRANSIENT'
  | 'RATE_LIMIT_429'
  | 'CONTEXT_OVERFLOW'
  | 'AUTH'
  | 'VALIDATION_FAILED'
  | 'TIMEOUT'
  | 'FATAL';

export interface ClassifiedError {
  category: ErrorCategory;
  isRetryable: boolean;
  message: string;
  suggestedBackoffSeconds?: number;
  details?: Record<string, unknown>;
}

export class ErrorClassifier {
  public static classify(errorText: string, exitCode?: number | null): ClassifiedError {
    const text = (errorText || '').toLowerCase();

    // 1. Check Rate Limit (429)
    if (
      text.includes('429') ||
      text.includes('rate limit') ||
      text.includes('too many requests') ||
      text.includes('rpm limit') ||
      text.includes('tpm limit') ||
      text.includes('quota exceeded')
    ) {
      const retryAfterSeconds = this.extractRetryAfter(errorText);
      return {
        category: 'RATE_LIMIT_429',
        isRetryable: true,
        message: 'Provider rate limit or temporary quota restriction encountered (HTTP 429)',
        suggestedBackoffSeconds: retryAfterSeconds,
      };
    }

    // 2. Check Context Overflow
    const contextKeywords = [
      'context length',
      'context window',
      'maximum tokens',
      'token limit',
      'input tokens',
      'output tokens',
      'combined input and output',
      'too many tokens',
      'context overflow',
      'maximum context',
      'exceeds model context',
      'prompt is too long',
    ];

    if (contextKeywords.some((keyword) => text.includes(keyword))) {
      return {
        category: 'CONTEXT_OVERFLOW',
        isRetryable: true,
        message: 'Context window or token limit exceeded',
      };
    }

    // 3. Check Authentication / Authorization
    if (
      text.includes('401') ||
      text.includes('unauthorized') ||
      text.includes('invalid api key') ||
      text.includes('invalid token') ||
      text.includes('authentication failed') ||
      text.includes('403 forbidden')
    ) {
      return {
        category: 'AUTH',
        isRetryable: false,
        message: 'Authentication error or invalid credentials',
      };
    }

    // 4. Check Timeout
    if (
      text.includes('idle timeout') ||
      text.includes('hard timeout') ||
      text.includes('timed out') ||
      text.includes('etimedout')
    ) {
      return {
        category: 'TIMEOUT',
        isRetryable: true,
        message: 'Execution timed out',
      };
    }

    // 5. Check Transient Server/Network Errors
    const transientKeywords = [
      '500 internal server error',
      '502 bad gateway',
      '503 service unavailable',
      '504 gateway timeout',
      '408 request timeout',
      'econnreset',
      'econnrefused',
      'enotfound',
      'socket hang up',
      'network error',
      'stream interrupted',
      'connection reset',
      'fetch failed',
    ];

    if (transientKeywords.some((keyword) => text.includes(keyword))) {
      return {
        category: 'TRANSIENT',
        isRetryable: true,
        message: 'Transient network or provider outage',
      };
    }

    // 6. Non-zero exit code or generic failure
    if (exitCode !== undefined && exitCode !== 0 && exitCode !== null) {
      return {
        category: 'TRANSIENT',
        isRetryable: true,
        message: `Process exited with code ${exitCode}`,
      };
    }

    return {
      category: 'FATAL',
      isRetryable: false,
      message: errorText || 'Unknown unrecoverable error',
    };
  }

  public static extractRetryAfter(text: string): number | undefined {
    if (!text) return undefined;

    // Search for "retry-after: 30" or "retry after 30 seconds"
    const headerMatch = text.match(/retry-after:\s*(\d+)/i);
    if (headerMatch) {
      return parseInt(headerMatch[1], 10);
    }

    const secMatch = text.match(/try again in\s*(\d+)\s*(?:s|sec|seconds)/i);
    if (secMatch) {
      return parseInt(secMatch[1], 10);
    }

    const minMatch = text.match(/try again in\s*(\d+)\s*(?:m|min|minutes)/i);
    if (minMatch) {
      return parseInt(minMatch[1], 10) * 60;
    }

    return undefined;
  }
}
