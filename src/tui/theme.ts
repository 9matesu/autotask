import chalk from 'chalk';
import { TaskStatus } from '../types/task.js';

export const THEME = {
  // Amber palette
  primary: '#FFB000',
  brightAmber: '#FFC857',
  dimAmber: '#B87800',
  darkAmber: '#5C3C00',
  
  // Background & Text
  text: '#F5E6B3',
  textDim: '#8A8068',
  bgDark: '#12100C',
  bgPanel: '#1C1914',

  // Statuses
  success: '#A8C97F',
  error: '#E06C75',
  warning: '#FFB000',
  info: '#61AFEF',
  purple: '#C678DD',
};

export const SYMBOLS = {
  active: '▶',
  pending: '○',
  completed: '✓',
  failed: '✗',
  retrying: '↺',
  paused: '⏸',
  skipped: '⊘',
  bullet: '•',
  spinner: '⠋',
  clock: '◷',
  gear: '⚙',
  box: '■',
};

export function getStatusBadge(status: TaskStatus): { text: string; color: string } {
  switch (status) {
    case 'PENDING':
      return { text: '[PENDING]', color: THEME.textDim };
    case 'RUNNING':
      return { text: '[RUNNING]', color: THEME.brightAmber };
    case 'RETRYING':
      return { text: '[RETRYING]', color: THEME.warning };
    case 'COMPLETED':
      return { text: '[COMPLETED]', color: THEME.success };
    case 'FAILED':
      return { text: '[FAILED]', color: THEME.error };
    case 'PAUSED':
      return { text: '[PAUSED]', color: THEME.textDim };
    case 'SKIPPED':
      return { text: '[SKIPPED]', color: THEME.textDim };
    case 'CANCELLED':
      return { text: '[CANCELLED]', color: THEME.error };
    default:
      return { text: `[${status}]`, color: THEME.textDim };
  }
}
