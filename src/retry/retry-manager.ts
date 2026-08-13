import { AutotaskConfig } from '../types/config.js';
import { ClassifiedError } from '../detection/error-classifier.js';

export class RetryManager {
  private config: AutotaskConfig;

  constructor(config: AutotaskConfig) {
    this.config = config;
  }

  public shouldRetry(attempt: number, maxAttempts: number, classified: ClassifiedError): boolean {
    if (!this.config.retry.enabled) {
      return false;
    }
    if (!classified.isRetryable) {
      return false;
    }
    return attempt < maxAttempts;
  }

  public calculateBackoffSeconds(attempt: number, classified?: ClassifiedError): number {
    // If the provider specifically requested a Retry-After duration and config allows it
    if (this.config.retry.respectRetryAfter && classified?.suggestedBackoffSeconds) {
      return Math.min(classified.suggestedBackoffSeconds, this.config.retry.maxBackoffSeconds);
    }

    const initial = this.config.retry.initialBackoffSeconds;
    const max = this.config.retry.maxBackoffSeconds;
    const multiplier = this.config.retry.backoffMultiplier;

    // Exponential calculation: initial * (multiplier ^ (attempt - 1))
    let backoff = initial * Math.pow(multiplier, Math.max(0, attempt - 1));
    backoff = Math.min(backoff, max);

    // Add jitter: +/- 20%
    if (this.config.retry.jitter) {
      const jitterFactor = 0.8 + Math.random() * 0.4;
      backoff = Math.round(backoff * jitterFactor);
    }

    return Math.max(1, Math.round(backoff));
  }

  public buildRetryPrompt(originalPrompt: string, errorDetails: string, attempt: number): string {
    return `The previous execution of this task was interrupted or failed (attempt ${attempt}).

Continue from the CURRENT state of the repository.

Important:
- Inspect the current git diff first.
- Do not discard existing changes.
- Do not restart the implementation from scratch.
- Preserve valid work already performed.
- Determine what was completed.
- Determine what remains.
- Continue the original task.
- Verify the result before finishing.

Original task:
${originalPrompt}

Previous attempt information:
${errorDetails}`;
  }

  public buildValidationFailurePrompt(originalPrompt: string, validationCommand: string, output: string): string {
    return `The previous implementation of this task completed, but the project validation command failed: \`${validationCommand}\`.

Please inspect and fix the failing tests or build issues without breaking existing progress.

Validation Output:
${output}

Original task:
${originalPrompt}`;
  }
}
