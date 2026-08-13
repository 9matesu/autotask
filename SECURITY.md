# Security Policy

## Secrets Protection

Autotask runs entirely on the local machine and communicates directly with the local OpenCode CLI.
- No external telemetry or cloud servers are contacted.
- API keys, tokens, and Authorization headers are automatically redacted from logs before persistence.
- Sensitive environment variables are not written to `.autotask/` logs.

## Reporting Security Issues

If you discover a security vulnerability, please open a private security advisory on GitHub or contact the maintainers directly.
