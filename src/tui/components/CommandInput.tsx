import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { THEME } from '../theme.js';
import { CommandRegistry } from '../../commands/command-registry.js';

interface CommandInputProps {
  onSubmit: (input: string) => void;
  registry: CommandRegistry;
}

export const CommandInput: React.FC<CommandInputProps> = ({ onSubmit, registry }) => {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const suggestions = value.startsWith('/') ? registry.getSuggestions(value) : [];
  const topSuggestion = suggestions.length > 0 ? suggestions[0] : null;

  useInput((input, key) => {
    // Handle Enter
    if (key.return) {
      if (value.trim().length > 0) {
        setHistory((prev) => [...prev, value]);
        setHistoryIndex(-1);
        onSubmit(value);
        setValue('');
        setFeedback(null);
      }
      return;
    }

    // Handle Backspace / Delete
    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    // Handle History Navigation (Up / Down)
    if (key.upArrow) {
      if (history.length > 0) {
        const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setValue(history[nextIndex] || '');
      }
      return;
    }

    if (key.downArrow) {
      if (historyIndex !== -1) {
        const nextIndex = historyIndex + 1;
        if (nextIndex >= history.length) {
          setHistoryIndex(-1);
          setValue('');
        } else {
          setHistoryIndex(nextIndex);
          setValue(history[nextIndex] || '');
        }
      }
      return;
    }

    // Handle Tab for autocomplete
    if (key.tab && topSuggestion) {
      const cmdName = topSuggestion.split(' ')[0];
      setValue(`${cmdName} `);
      return;
    }

    // Handle CTRL+C safely: clear input line without killing app
    if (key.ctrl && input === 'c') {
      if (value.length > 0) {
        setValue('');
        setFeedback('Input cleared. Type /quit to exit.');
      } else {
        setFeedback('Press /quit or /q to exit Autotask.');
      }
      return;
    }

    // Standard character input
    if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
      setFeedback(null);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={THEME.primary} paddingX={1}>
      {feedback && (
        <Box marginBottom={0}>
          <Text color={THEME.warning}>{feedback}</Text>
        </Box>
      )}

      <Box>
        <Text color={THEME.brightAmber} bold>
          {'> '}
        </Text>
        <Text color={THEME.text}>{value}</Text>
        <Text color={THEME.primary} bold>
          █
        </Text>
        {topSuggestion && value.startsWith('/') && (
          <Text color={THEME.textDim}>
            {' '}
            (Tab: {topSuggestion.split(' ')[0]})
          </Text>
        )}
      </Box>

      {topSuggestion && (
        <Box marginTop={0}>
          <Text color={THEME.textDim}>
            Hint: {topSuggestion}
          </Text>
        </Box>
      )}
    </Box>
  );
};
