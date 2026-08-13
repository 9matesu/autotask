# OpenCode Integration

Autotask interacts with OpenCode as a native supervisor.

## CLI Execution Mode

Autotask executes:
```bash
opencode run "<prompt>" --format json --agent <build|plan> [--model <model>] [--session <sessionId>]
```

## Structured NDJSON Streaming

OpenCode emits newline-delimited JSON events that Autotask translates into real-time UI events:
- `session.start`: Captures active session ID, provider, and model.
- `tool.start` / `tool.finish`: Displays active tool calls in the execution feed and sends watchdog heartbeats to prevent false timeouts.
- `message`: Captures assistant thoughts and output chunks.
- `usage`: Tracks token count and context ratio.

## Compaction Support

When a session nears token exhaustion, Autotask invokes `/compact` through the OpenCode session interface.
