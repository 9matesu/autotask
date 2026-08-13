# Intelligent Retries & Error Handling

Autotask avoids blind retries. When a task fails, it categorizes the failure and builds a continuation context.

## Error Categories

1. **`RATE_LIMIT_429`**: Backs off respecting `Retry-After` headers and jitter.
2. **`CONTEXT_OVERFLOW`**: Triggers session compaction (`/compact`) or starts a fresh session passing the Git diff.
3. **`TRANSIENT`**: Applies exponential backoff (`initial * (multiplier ^ attempt)`).
4. **`VALIDATION_FAILED`**: When post-task tests fail, test errors are injected into the retry prompt so the agent fixes failing tests before committing.
5. **`AUTH` / `FATAL`**: Marked non-retryable immediately to prevent token exhaustion loops.

## Continuation Prompt Format

```text
The previous execution of this task was interrupted or failed.

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
{TASK_PROMPT}

Previous attempt information:
{ERROR_INFORMATION}
```
