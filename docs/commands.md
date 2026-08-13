# Commands Reference

Autotask provides a comprehensive suite of slash commands in the TUI.

## Command List

- `/help` or `/?`: Shows command overview and hints.
- `/add <text>`: Adds tasks to the queue. Supports single prompt, bulleted lists, numbered lists, and `[PLAN]` / `[BUILD]` tags.
- `/start` or `/run`: Starts executing the next pending task.
- `/pause`: Pauses processing after the current task finishes.
- `/stop`: Immediately terminates the active task process tree and pauses the queue.
- `/queue` or `/tasks`: Displays the full list of tasks, status, and attempt counts.
- `/retry <id>`: Resets a failed or completed task back to PENDING.
- `/skip <id>`: Skips a task.
- `/clear`: Clears completed and skipped tasks.
- `/doctor`: Runs full diagnostic checks on Node, Git, OpenCode, and storage.
- `/git`: Displays current Git branch and uncommitted files count.
- `/diff`: Prints current working tree git diff summary.
- `/log [id]`: Displays logs for recent events or a specific task attempt.
- `/mode <plan|build>`: Changes default agent mode.
- `/config`: Prints active configuration JSON.
- `/quit` or `/q`: Exits Autotask safely.
