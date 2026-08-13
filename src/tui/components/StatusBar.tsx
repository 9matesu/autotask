import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { THEME } from '../theme.js';
import { Task } from '../../types/task.js';

interface StatusBarProps {
  activeTask?: Task;
  isRunning: boolean;
  totalTokens?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeTask,
  isRunning,
  totalTokens,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning || !activeTask?.startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(activeTask.startedAt!).getTime();
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, activeTask]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  return (
    <Box
      borderStyle="single"
      borderColor={THEME.dimAmber}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        {activeTask ? (
          <>
            <Text color={THEME.brightAmber} bold>
              Task #{activeTask.id}
            </Text>
            <Text color={THEME.dimAmber}> │ </Text>
            <Text color={THEME.text}>
              Attempt {activeTask.attempts}/{activeTask.maxAttempts}
            </Text>
            <Text color={THEME.dimAmber}> │ </Text>
            <Text color={THEME.text}>{formatTime(elapsedSeconds)}</Text>
            {totalTokens !== undefined && totalTokens > 0 && (
              <>
                <Text color={THEME.dimAmber}> │ </Text>
                <Text color={THEME.textDim}>Tokens: {totalTokens}</Text>
              </>
            )}
          </>
        ) : (
          <Text color={THEME.textDim}>No active task</Text>
        )}
      </Box>
      <Box>
        <Text color={THEME.textDim}>
          [ /help ] [ /add ] [ /start ] [ /pause ] [ /doctor ]
        </Text>
      </Box>
    </Box>
  );
};
