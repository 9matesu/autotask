# Changelog

All notable changes to Autotask will be documented in this file.

## [0.1.0] - 2026-08-13
### Added
- Initial release of **Autotask** (`autotask` / `ocq`).
- Sequential queue supervisor for OpenCode CLI (`concurrency = 1`).
- Amber-themed Ink React terminal UI (Header, QueuePanel, ExecutionPanel, StatusBar, CommandInput).
- Multi-format task input parsing (raw prompt, bulleted lists, numbered lists, agent tags `[PLAN]`/`[BUILD]`).
- Atomic JSON persistence and automatic crash recovery for interrupted tasks.
- Error classification for HTTP 429 rate limits, context window overflow, timeouts, transient outages, and auth errors.
- Intelligent retry with Git diff preservation prompts and exponential backoff with jitter.
- Post-task verification commands and automatic Git checkpoints (`agent: complete task #001 - <title>`).
- Context overflow detection and session compaction handling.
- Full `/doctor` system diagnostics and comprehensive slash commands registry.
- Offline `--mock` simulation mode for zero-token testing.
- Automated Vitest test suite with 100% test passing rate.
