# Autotask (OpenCode Queue Wrapper)

```text
╭──────────────────────────────────────────────────────────────╮
│                                                              │
│        ██████╗ ██████╗ ███████╗███╗   ██╗                  │
│       ██╔═══██╗██╔══██╗██╔════╝████╗  ██║                  │
│       ██║   ██║██████╔╝█████╗  ██╔██╗ ██║                  │
│       ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║                  │
│       ╚██████╔╝██║     ███████╗██║ ╚████║                  │
│        ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝                  │
│                                                              │
│                   A U T O T A S K                            │
│                                                              │
│              OpenCode Terminal Supervisor                   │
│                                                              │
╰──────────────────────────────────────────────────────────────╯
```

A local terminal supervisor and orchestrator for the **OpenCode CLI**.

Autotask allows you to queue multiple coding tasks, execute them sequentially within the same working repository, monitor agent progress through structured NDJSON streams, automatically recover from failures (HTTP 429 rate limits, context overflow, timeouts, crashes), execute safe Git checkpoints, and manage everything with an amber-themed TUI.

---

## ⚡ Key Highlights

* **Sequential Execution (`concurrency = 1`)**: Executes tasks one after another in the exact working directory left by prior tasks.
* **Intelligent Retry**: On failures, inspects Git diff and prompts the agent to continue from existing progress rather than discarding work.
* **Context Overflow & Compaction**: Detects token limit warnings and triggers session compaction via `/compact` or fresh sessions with diff context.
* **Provider Rate-Limit Awareness**: Backs off with jitter on HTTP 429 and respects `Retry-After` headers for low-RPM providers.
* **Windows Tree-Kill Safety**: Employs graceful escalation and native process tree termination to prevent orphaned MCP or tool processes.
* **Safe Git Checkpoints**: Runs optional post-task verification commands (`npm test`, build scripts) and creates non-destructive commits (`agent: complete task #001 - <title>`).
* **Rich Amber TUI**: Ink-powered terminal interface with split task queue and execution feed, command autocomplete, and status bar.
* **Zero-Token Mock Mode**: Test the entire queue, TUI, and supervisor offline with `--mock`.

---

## 🚀 Installation & Quick Start

### Global Installation

```bash
npm install -g autotask
```

### Local Development / From Source

```bash
git clone <repo-url>
cd autotask
npm install
npm run build
npm link
```

### Running Autotask

Launch in any repository:

```bash
autotask
```

Or using the alias `ocq`:

```bash
ocq
```

Run in zero-token mock mode (simulates tasks and errors locally):

```bash
autotask --mock
```

Run system and tool diagnostics:

```bash
autotask --doctor
```

---

## 🖥️ Terminal User Interface (TUI) Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ AUTOTASK │ my-project │ BUILD │ Default │ ● RUNNING          │
├───────────────────────────────┬──────────────────────────────┤
│ TASK QUEUE (5 total)          │ EXECUTION LOG                │
│                               │                              │
│ ▶ #001 [RUNNING] Authentication│ 20:00:15 > Reading files     │
│   #002 [PENDING] Refresh token│ 20:00:18 ⚙ edit_file (auth.ts│
│   #003 [PENDING] Tests        │ 20:00:22 ✓ Changes applied   │
│   #004 [PENDING] Middleware   │                              │
│   #005 [PENDING] Docs         │                              │
├───────────────────────────────┴──────────────────────────────┤
│ Task #001 │ Attempt 1/3 │ 00:42 │ Tokens: 1630               │
├──────────────────────────────────────────────────────────────┤
│ > /add Implement middleware validation                        │
└──────────────────────────────────────────────────────────────┘
```

---

## ⌨️ Adding Tasks

You can add tasks by typing directly or pasting lists. Autotask automatically parses:

### 1. Direct command or typing
```text
/add Fix JWT authentication logic
```
or simply typing the prompt in the input line without `/add`.

### 2. Bulleted Lists (Pasted via clipboard)
```text
- Fix login authentication
* Add refresh token endpoint
• Write unit tests for JWT
```

### 3. Numbered Lists
```text
1. Refactor auth controller
2. Add rate limiting middleware
3. Update OpenAPI swagger docs
```

### 4. Agent Mode Tags
You can specify `[PLAN]` or `[BUILD]` per task:
```text
[PLAN] Analyze database schema migration
[BUILD] Implement user registration endpoint
@plan Review API security headers
```

---

## 🛠️ Slash Commands

| Command | Aliases | Description |
| :--- | :--- | :--- |
| `/help` | `/?`, `/h` | Show list of available commands and descriptions |
| `/add <text>` | `/task`, `/paste` | Add one or multiple tasks (supports bulleted and numbered lists) |
| `/start` | `/resume`, `/run` | Start/resume processing pending tasks in the queue |
| `/pause` | — | Pause the queue supervisor |
| `/stop` | — | Gracefully terminate the active OpenCode task and pause queue |
| `/queue` | `/tasks`, `/status`| Display full overview of tasks and attempts |
| `/retry <id>`| — | Reset and requeue a specific task (e.g. `/retry 001`) |
| `/skip <id>` | — | Skip a specific pending/failed task |
| `/clear` | — | Remove completed and skipped tasks from the queue |
| `/doctor` | — | Run comprehensive environment and tool health diagnostics |
| `/git` | — | Check git status and uncommitted changes |
| `/diff` | — | Display current git diff summary |
| `/log [id]` | `/logs` | View recent logs or specific task attempt logs |
| `/mode <plan\|build>` | — | Switch the default agent mode |
| `/config` | — | Print active configuration JSON |
| `/quit` | `/q`, `/exit` | Exit Autotask |

---

## ⚙️ Configuration

Autotask stores its configuration at `.autotask/config.json`:

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

## 🛡️ Security & Privacy

* **Secrets Redaction**: Autotask automatically redacts API keys, tokens, and authorization headers (`sk-...`, `nvapi-...`, `Bearer ...`, `Authorization: ...`) before writing logs.
* **Non-Destructive Operations**: Autotask never executes `git reset --hard` or `git clean`. All changes made by the AI agent remain safe in the working directory.

---

## 🧪 Testing

Run the automated test suite with Vitest:

```bash
npm test
```

---

## 📄 License

MIT © Autotask Contributors
