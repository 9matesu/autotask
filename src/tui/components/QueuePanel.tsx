import React from 'react';
import { Box, Text } from 'ink';
import { Task } from '../../types/task.js';
import { THEME, SYMBOLS, getStatusBadge } from '../theme.js';

interface QueuePanelProps {
  tasks: Task[];
  activeTaskId: string | null;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ tasks, activeTaskId }) => {
  return (
    <Box
      flexDirection="column"
      width="45%"
      borderStyle="single"
      borderColor={THEME.dimAmber}
      paddingX={1}
    >
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={THEME.primary}>
          TASK QUEUE
        </Text>
        <Text color={THEME.textDim}>({tasks.length} total)</Text>
      </Box>

      {tasks.length === 0 ? (
        <Box flexDirection="column" paddingY={1}>
          <Text color={THEME.textDim}>Queue is empty.</Text>
          <Text color={THEME.textDim}>Type /add or paste tasks to begin.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {tasks.slice(0, 12).map((task) => {
            const isActive = task.id === activeTaskId;
            const badge = getStatusBadge(task.status);
            
            let icon = SYMBOLS.pending;
            if (task.status === 'RUNNING') icon = SYMBOLS.active;
            else if (task.status === 'COMPLETED') icon = SYMBOLS.completed;
            else if (task.status === 'FAILED') icon = SYMBOLS.failed;
            else if (task.status === 'RETRYING') icon = SYMBOLS.retrying;
            else if (task.status === 'SKIPPED') icon = SYMBOLS.skipped;
            else if (task.status === 'PAUSED') icon = SYMBOLS.paused;

            return (
              <Box key={task.id} justifyContent="space-between">
                <Box>
                  <Text color={isActive ? THEME.brightAmber : badge.color} bold={isActive}>
                    {icon} #{task.id}{' '}
                  </Text>
                  <Text
                    color={isActive ? THEME.text : THEME.textDim}
                    bold={isActive}
                    wrap="truncate"
                  >
                    {task.title.length > 22 ? `${task.title.slice(0, 20)}...` : task.title}
                  </Text>
                </Box>
                <Box>
                  <Text color={badge.color}>
                    {task.attempts > 0 ? `(${task.attempts}/${task.maxAttempts})` : ''}
                  </Text>
                </Box>
              </Box>
            );
          })}
          {tasks.length > 12 && (
            <Text color={THEME.textDim}>
              ... and {tasks.length - 12} more tasks
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};
