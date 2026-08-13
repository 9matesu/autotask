# Troubleshooting Guide

## Common Issues & Solutions

### 1. `OpenCode CLI: Not installed`
- Ensure OpenCode is installed globally:
  ```bash
  npm install -g opencode-ai
  ```
- Test `opencode --version` in your terminal.

### 2. `Repository: Not a Git repository`
- Autotask requires a valid Git repository to create checkpoints and calculate diffs:
  ```bash
  git init
  ```

### 3. Orphaned processes on Windows
- Autotask uses native Windows tree killing (`taskkill /PID /T /F`). If a hung compiler or process locks a port, run:
  ```powershell
  Get-Process opencode -ErrorAction SilentlyContinue | Stop-Process
  ```

### 4. Running Doctor
- Always run `/doctor` inside Autotask or `autotask --doctor` from the terminal for automatic diagnosis.
