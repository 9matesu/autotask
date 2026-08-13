import React from 'react';
import { Box, Text } from 'ink';
import { THEME } from '../theme.js';
import { AgentMode } from '../../types/task.js';

interface HeaderProps {
  projectName: string;
  agentMode: AgentMode;
  model: string;
  isRunning: boolean;
  isPaused: boolean;
  isMock?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  agentMode,
  model,
  isRunning,
  isPaused,
  isMock,
}) => {
  let statusText = 'IDLE';
  let statusColor = THEME.textDim;

  if (isRunning) {
    statusText = '● RUNNING';
    statusColor = THEME.brightAmber;
  } else if (isPaused) {
    statusText = '⏸ PAUSED';
    statusColor = THEME.warning;
  }

  return (
    <Box
      borderStyle="single"
      borderColor={THEME.primary}
      paddingX={1}
      justifyContent="space-between"
      marginBottom={0}
    >
      <Box>
        <Text bold color={THEME.brightAmber}>
          AUTOTASK
        </Text>
        <Text color={THEME.dimAmber}> │ </Text>
        <Text color={THEME.text} bold>
          {projectName}
        </Text>
        <Text color={THEME.dimAmber}> │ </Text>
        <Text color={agentMode === 'build' ? THEME.primary : THEME.purple} bold>
          {agentMode.toUpperCase()}
        </Text>
        <Text color={THEME.dimAmber}> │ </Text>
        <Text color={THEME.textDim}>{model || 'OpenCode'}</Text>
        {isMock && (
          <>
            <Text color={THEME.dimAmber}> │ </Text>
            <Text color={THEME.info} bold>
              [MOCK MODE]
            </Text>
          </>
        )}
      </Box>
      <Box>
        <Text color={statusColor} bold>
          {statusText}
        </Text>
      </Box>
    </Box>
  );
};
