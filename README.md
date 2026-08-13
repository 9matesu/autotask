# Autotask

```text
╭─────────────────────────────────────────────────────────────────────────────╮
│                                                                             │
│   █████╗ ██╗   ██╗████████╗ ██████╗ ████████╗ █████╗ ███████╗██╗  ██╗       │
│  ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝       │
│  ███████║██║   ██║   ██║   ██║   ██║   ██║   ███████║███████╗█████╔╝        │
│  ██╔══██║██║   ██║   ██║   ██║   ██║   ██║   ██╔══██║╚════██║██╔═██╗        │
│  ██║  ██║╚██████╔╝   ██║   ╚██████╔╝   ██║   ██║  ██║███████║██║  ██╗       │
│  ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝       │
│                                                                             │
│               Autonomous Coding Queue Supervisor & Orchestrator              │
│                                                                             │
╰─────────────────────────────────────────────────────────────────────────────╯
```

Autotask is a local terminal queue supervisor and execution orchestrator for AI coding agents. Designed for unattended, production-grade engineering workflows, Autotask manages multi-task sequential execution, process tree lifecycle enforcement, intelligent git-diff-aware retries, context overflow recovery, and automated Git checkpoints.

Autotask ships with native support for the **OpenCode CLI** as its initial execution engine, backed by an extensible adapter architecture engineered for future agent engine integrations.

---

## Architectural Principles

* **Cumulative Sequential Execution (`concurrency = 1`)**: Executes queued tasks sequentially against a single working tree, guaranteeing that each subsequent task builds upon the verified state left by prior completions.
* **Intelligent Continuation & State Recovery**: Rather than blindly restarting failed tasks, Autotask computes repository state diffs and synthesizes continuation prompts that preserve completed progress.
* **Context Overflow & Token Lifecycle Supervision**: Detects token exhaustion thresholds, orchestrates compaction requests, and provisions clean continuation sessions with delta context when limits are exceeded.
* **Provider Rate-Limit Backoff**: Applies exponential backoff with randomized jitter and evaluates `Retry-After` headers to sustain long-running batches on low-RPM inference providers.
* **Process Tree Isolation (Windows & POSIX)**: Enforces hard timeouts and idle watchdog monitoring, using native tree termination to prevent orphaned language server or tool subprocesses.
* **Non-Destructive Git Checkpoints**: Runs optional pre-commit test suites and generates verified checkpoint commits without ever running destructive checkout or reset routines.
* **Terminal Interface**: High-density Amber TUI built with Ink and React, featuring split-pane task tracking, streaming telemetry feeds, autocomplete slash commands, and status diagnostics.
* **Zero-Token Mock Engine**: Built-in deterministic simulation runner for end-to-end queue and supervisor validation without API token consumption.

---

## System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      Autotask Interface                     │
│  - Ink TUI: Split Queue & Streaming Execution Panes         │
│  - Command Registry: Autocomplete Slash Commands            │
├─────────────────────────────────────────────────────────────┤
│                      Supervisor Core                        │
│  - TaskQueue: Multi-Format Parser & Priority Scheduling     │
│  - TaskRunner: Sequential State Machine & Lifecycle Hooks   │
│  - RetryManager: Jitter Backoff & Continuation Synthesis    │
│  - GitManager: Working Tree Verification & Safe Checkpoints │
│  - ProcessMonitor: Watchdog Heartbeats & Tree Termination   │
├─────────────────────────────────────────────────────────────┤
│                    Storage & Diagnostics                    │
│  - StateStore: Atomic queue.json State Persistence          │
│  - TaskLogger: Secret-Redacted Per-Attempt Telemetry Logs   │
│  - ConfigManager: Schema-Validated Configuration Store      │
│  - DoctorService: Environment & Tool Diagnostic Engine      │
├─────────────────────────────────────────────────────────────┤
│                     Adapter Layer                           │
│  - OpenCodeAdapter (Default Native Engine)                  │
│  - MockOpenCodeRunner (Zero-Token Simulation Engine)        │
│  - Future Agent Adapters (Claude Code, Codex, Custom)       │
└─────────────────────────────────────────────────────────────┘
```

---

## Installation & Quick Start

### Global Installation

```bash
npm install -g autotask
```

### Local Build & Development

```bash
git clone https://github.com/9matesu/autotask.git
cd autotask
npm install
npm run build
npm link
```

### Usage

Launch Autotask in any local repository:

```bash
autotask
```

Alias:

```bash
ocq
```

Run in offline simulation mode:

```bash
autotask --mock
```

Run environment diagnostics:

```bash
autotask --doctor
```

---

## Terminal User Interface

```text
┌──────────────────────────────────────────────────────────────┐
│ AUTOTASK │ repository-name │ BUILD │ OpenCode │ ● RUNNING    │
├───────────────────────────────┬──────────────────────────────┤
│ TASK QUEUE (5 total)          │ EXECUTION LOG                │
│                               │                              │
│ ▶ #001 [RUNNING] Auth Module  │ 20:00:15 > Reading directory │
│   #002 [PENDING] Token Refresh│ 20:00:18 > Executing tool    │
│   #003 [PENDING] Unit Tests   │ 20:00:22 > Applying patch    │
│   #004 [PENDING] Middleware   │                              │
│   #005 [PENDING] Documentation│                              │
├───────────────────────────────┴──────────────────────────────┤
│ Task #001 │ Attempt 1/3 │ 00:42 │ Tokens: 1630               │
├──────────────────────────────────────────────────────────────┤
│ > /add Implement middleware validation                        │
└──────────────────────────────────────────────────────────────┘
```

---

## Task Input & Parsing

Tasks can be entered interactively or pasted in batches. Autotask parses standard input patterns:

### Single Task Command
```text
/add Implement OAuth2 token refresh endpoint
```
Or type the instruction directly into the prompt without a prefix.

### Bulleted Lists (Clipboard Paste)
```text
- Implement OAuth2 authorization code flow
* Add JWT payload verification middleware
• Write unit tests for token expiration
```

### Numbered Action Lists
```text
1. Refactor authentication controller
2. Add rate limiting middleware to public endpoints
3. Update OpenAPI schema documentation
```

### Mode Tags
Target specific agent execution profiles per task:
```text
[PLAN] Analyze database schema migration strategy
[BUILD] Implement user registration endpoint
@plan Review API security headers
```

---

## Slash Commands

| Command | Aliases | Description |
| :--- | :--- | :--- |
| `/help` | `/?`, `/h` | Display command reference and operational hints |
| `/add <text>` | `/task`, `/paste` | Enqueue tasks from text or multiline lists |
| `/start` | `/resume`, `/run` | Start or resume queue processing |
| `/pause` | — | Pause the queue supervisor |
| `/stop` | — | Terminate active task execution tree and pause queue |
| `/queue` | `/tasks`, `/status`| Display overview of tasks, statuses, and attempts |
| `/retry <id>`| — | Requeue a specific task for re-execution (e.g., `/retry 001`) |
| `/skip <id>` | — | Mark a pending or failed task as skipped |
| `/clear` | — | Purge completed and skipped tasks from the queue |
| `/doctor` | — | Execute diagnostic checks on Node, Git, OpenCode, and storage |
| `/git` | — | Inspect working branch and uncommitted change count |
| `/diff` | — | Print working tree git diff summary |
| `/log [id]` | `/logs` | Display recent execution logs or specific attempt output |
| `/mode <plan\|build>` | — | Switch the default agent execution mode |
| `/config` | — | Output active configuration JSON |
| `/quit` | `/q`, `/exit` | Terminate session and exit Autotask |

---

## Configuration

Configuration is loaded from `.autotask/config.json`:

```json
{
  "repository": ".",
  "opencode": {
    "command": "opencode",
    "agent": "build",
    "model": null,
    "useServer": false,
    "autoApprove": false
  },
  "queue": {
    "concurrency": 1,
    "autoStart": false
  },
  "retry": {
    "enabled": true,
    "maxAttempts": 3,
    "initialBackoffSeconds": 5,
    "maxBackoffSeconds": 300,
    "backoffMultiplier": 2,
    "jitter": true,
    "respectRetryAfter": true
  },
  "monitoring": {
    "idleTimeoutSeconds": 300,
    "hardTimeoutSeconds": 1800
  },
  "context": {
    "autoCompact": true
  },
  "git": {
    "autoCommit": true,
    "commitPrefix": "agent: complete task",
    "postTaskCommand": null
  },
  "providerPolicy": {
    "rateLimitBackoff": true,
    "initialBackoffSeconds": 10,
    "maxBackoffSeconds": 300,
    "respectRetryAfter": true
  }
}
```

---

## Security & Reliability

* **Automatic Credential Redaction**: Telemetry pipelines automatically sanitize API keys, bearer tokens, and credentials (`sk-...`, `nvapi-...`, `Bearer ...`, `Authorization: ...`) prior to writing logs.
* **Non-Destructive Operations**: Working directory modifications are preserved across retries; Autotask never invokes destructive Git clean or hard resets.
* **Atomic State Persistence**: Queue state updates are committed via temporary file replacement and fsync routines to protect against power interruption or process termination.

---

## Verification & Testing

Execute the automated test suite with Vitest:

```bash
npm test
```

---

## License

MIT © Autotask Contributors
