import React from 'react';
import { Box, Text } from 'ink';
import { THEME } from '../theme.js';
import { LogEntry } from '../../logging/logger.js';

interface ExecutionPanelProps {
  logs: LogEntry[];
  backoffSeconds?: number | null;
  activeTaskTitle?: string;
}

export const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  logs,
  backoffSeconds,
  activeTaskTitle,
}) => {
  const visibleLogs = logs.slice(-10);

  return (
    <Box
      flexDirection="column"
      width="55%"
      borderStyle="single"
      borderColor={THEME.dimAmber}
      paddingX={1}
    >
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={THEME.primary}>
          EXECUTION LOG
        </Text>
        {activeTaskTitle && (
          <Text color={THEME.textDim} wrap="truncate">
            {activeTaskTitle.length > 25 ? `${activeTaskTitle.slice(0, 23)}...` : activeTaskTitle}
          </Text>
        )}
      </Box>

      {backoffSeconds !== null && backoffSeconds !== undefined && backoffSeconds > 0 && (
        <Box
          borderStyle="single"
          borderColor={THEME.warning}
          paddingX={1}
          marginBottom={1}
        >
          <Text color={THEME.warning} bold>
            ↺ Backoff in progress: Retrying next attempt in {backoffSeconds}s...
          </Text>
        </Box>
      )}

      {visibleLogs.length === 0 ? (
        <Box flexDirection="column" paddingY={1}>
          <Text color={THEME.textDim}>Waiting for task execution...</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {visibleLogs.map((log, idx) => {
            let color = THEME.text;
            if (log.level === 'ERROR') color = THEME.error;
            else if (log.level === 'WARN') color = THEME.warning;
            else if (log.source === 'OPENCODE') color = THEME.brightAmber;
            else if (log.source === 'GIT') color = THEME.success;

            return (
              <Box key={idx}>
                <Text color={THEME.textDim}>
                  {log.timestamp.slice(11, 19)}{' '}
                </Text>
                <Text color={color} wrap="truncate">
                  {log.message.length > 45 ? `${log.message.slice(0, 42)}...` : log.message}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
