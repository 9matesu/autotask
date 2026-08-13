# Configuration Guide

Autotask creates and manages `.autotask/config.json` inside the working directory.

## Configuration Schema

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

### Options Explained
- `opencode.command`: Path or binary name for the OpenCode CLI.
- `opencode.agent`: Default agent mode (`build` or `plan`).
- `opencode.model`: Model override (e.g. `nvidia/glm-4`, `openrouter/anthropic/claude-3.5-sonnet`).
- `git.autoCommit`: When `true`, automatically commits changes upon successful task completion.
- `git.postTaskCommand`: Optional test command (e.g. `npm test` or `npm run build`). If it fails, error output is fed into the retry prompt.
