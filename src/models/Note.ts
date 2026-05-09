export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  color?: string;
  isPinned?: boolean;
}

export const NOTE_COLORS = {
  light: {
    default: '#FFFFFF',
    yellow: '#FFF59D',
    orange: '#FFCC80',
    pink: '#F48FB1',
    purple: '#CE93D8',
    blue: '#90CAF9',
    green: '#A5D6A7',
    gray: '#E0E0E0',
  },
  dark: {
    default: '#1A1A1A',
    yellow: '#C17900',
    orange: '#C65100',
    pink: '#AD1457',
    purple: '#6A1B9A',
    blue: '#0D47A1',
    green: '#1B5E20',
    gray: '#424242',
  },
};

// Color names used for mapping
export type NoteColorName =
  | 'default'
  | 'yellow'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'blue'
  | 'green'
  | 'gray';
