# Queue & Task Lifecycle

## Task States

A task flows through a strict state machine:

```text
       ┌───────────┐
       │  PENDING  │ ──► [ SKIPPED ]
       └─────┬─────┘
             │
             ▼
       ┌───────────┐
  ┌──► │  RUNNING  │ ──► [ PAUSED / CANCELLED ]
  │    └─────┬─────┘
  │          │
  │     (On Failure)
  │          │
  │          ▼
  │    ┌───────────┐
  └─── │ RETRYING  │
       └─────┬─────┘
             │ (Exhausted attempts / fatal)
             ▼
       ┌───────────┐       ┌───────────┐
       │  FAILED   │       │ COMPLETED │
       └───────────┘       └───────────┘
```

## Atomic State Persistence

Queue state is persisted into `.autotask/queue.json` using atomic temporary file write and replacement, safeguarding against system crashes or unexpected shutdowns.
