# Autotask Architecture

Autotask is designed as a modular, local-first terminal supervisor for the OpenCode CLI.

## Architectural Layers

```text
┌─────────────────────────────────────────────────────────────┐
│                       Ink TUI Layer                         │
│  - App: Root container & layout                             │
│  - Header, QueuePanel, ExecutionPanel, StatusBar            │
│  - CommandInput: Keyboard hooks & autocomplete              │
├─────────────────────────────────────────────────────────────┤
│                      Supervisor Core                        │
│  - TaskQueue: In-memory task list & input parser            │
│  - TaskRunner: Sequential loop supervisor & state machine   │
│  - RetryManager: Backoff calculation & prompt synthesis     │
│  - GitManager: Diff detection, test runner & checkpoints    │
│  - ProcessMonitor: Watchdog heartbeats & tree-kill safety   │
├─────────────────────────────────────────────────────────────┤
│                    Storage & Diagnostics                    │
│  - StateStore: Atomic queue.json persistence                │
│  - TaskLogger: Per-attempt logs & secret redaction          │
│  - ConfigManager: Zod schema & config.json loading          │
│  - DoctorService: Environment readiness diagnostic          │
├─────────────────────────────────────────────────────────────┤
│                     Adapter Layer                           │
│  - OpenCodeAdapter (Interface)                              │
│  - OpenCodeCliRunner: NDJSON parser & subprocess manager    │
│  - MockOpenCodeRunner: Deterministic test engine            │
└─────────────────────────────────────────────────────────────┘
```

## Sequential Execution Guarantee

Autotask enforces `concurrency = 1`. Each task runs in sequence against the live working directory, ensuring subsequent tasks find the exact code and state created by earlier tasks.
