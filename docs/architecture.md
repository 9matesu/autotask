# Autotask Architecture

Autotask is designed as a modular, local-first terminal supervisor and orchestrator for autonomous coding agents.

## Architectural Layers

```text
┌─────────────────────────────────────────────────────────────┐
│                       Ink TUI Layer                         │
│  - App: Root container & split-pane layout                  │
│  - Header, QueuePanel, ExecutionPanel, StatusBar            │
│  - CommandInput: History navigation & autocomplete          │
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
│  - Extensible Engine Adapters (Future agent integrations)   │
└─────────────────────────────────────────────────────────────┘
```

## Sequential Execution Guarantee

Autotask enforces `concurrency = 1`. Each task runs in sequence against the live working tree, ensuring subsequent tasks find the exact code and state created by earlier tasks.

## Extensible Agent Adapter Pattern

Execution is abstracted through the `OpenCodeAdapter` interface. While OpenCode CLI is the primary initial engine, the supervisor core (queue, retry loop, watchdog, git manager, state persistence) operates independently of the underlying coding agent.
