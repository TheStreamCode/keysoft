import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { render } from '../../test-utils';
import NoteDetailScreen from '../../screens/NoteDetailScreen';
import * as StorageService from '../../services/storage/storageService';
import { Note } from '../../models/Note';

// Mock dependencies
jest.mock('../../services/storage/storageService', () => ({
  saveNote: jest.fn(),
  getNoteById: jest.fn(),
  deleteNote: jest.fn(),
  getUserPreferences: jest.fn().mockResolvedValue({}), // Needed for Contexts
  saveUserPreferences: jest.fn(),
}));

jest.mock('react-native-keyboard-aware-scroll-view', () => {
  const KeyboardAwareScrollView = ({ children }: { children: React.ReactNode }) => children;
  return { KeyboardAwareScrollView };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// Define stable mock contexts
const mockLanguageContext = {
  t: jest.fn((key: string) => key),
  language: 'it',
};

const mockThemeContext = {
  theme: {
    colors: {
      background: '#ffffff',
      text: '#000000',
      primary: '#007aff',
      success: '#34c759',
      error: '#ff3b30',
      backgroundElevated: '#f0f0f0',
      border: '#e0e0e0',
      textSecondary: '#8e8e93',
    },
  },
  isDarkMode: false,
};

const mockAlertContext = {
  alert: jest.fn(),
};

const mockAuthContext = {
  isAuthenticated: true,
  user: { id: 'test-user' },
};

// Mock Context hooks
jest.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => mockLanguageContext,
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockThemeContext,
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../contexts/AlertContext', () => ({
  useAlert: () => mockAlertContext,
  AlertProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Navigation with dynamic params
let mockParams: any = {};
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: mockParams,
    }),
  };
});

describe('User Features - Notes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    (StorageService.saveNote as jest.Mock).mockResolvedValue(true);
    (StorageService.getNoteById as jest.Mock).mockResolvedValue(null);
    (StorageService.deleteNote as jest.Mock).mockResolvedValue(true);
  });

  it('renders correctly in create mode', async () => {
    mockParams = { mode: 'create' };
    const { getByTestId, getByText } = render(<NoteDetailScreen />);

    await waitFor(() => {
      expect(getByText('new_note')).toBeTruthy();
      expect(getByTestId('note-title-input')).toBeTruthy();
      expect(getByTestId('note-content-input')).toBeTruthy();
      expect(getByTestId('note-save-button')).toBeTruthy();
    });
  });

  it('creates a new note', async () => {
    mockParams = { mode: 'create' };
    const { getByTestId } = render(<NoteDetailScreen />);

    const titleInput = getByTestId('note-title-input');
    const contentInput = getByTestId('note-content-input');

    fireEvent.changeText(titleInput, 'My Note');
    fireEvent.changeText(contentInput, 'This is a test note');

    const saveButton = getByTestId('note-save-button');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(StorageService.saveNote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Note',
          content: 'This is a test note',
        }),
      );
    });
  });

  it('loads and edits an existing note', async () => {
    const mockNote: Note = {
      id: 'note_123',
      title: 'Existing Note',
      content: 'Old content',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      color: 'default',
      isPinned: false,
    };

    mockParams = { noteId: 'note_123', mode: 'edit' };
    (StorageService.getNoteById as jest.Mock).mockResolvedValue(mockNote);

    const { getByTestId, getByDisplayValue } = render(<NoteDetailScreen />);

    await waitFor(() => {
      expect(getByDisplayValue('Existing Note')).toBeTruthy();
    });

    const titleInput = getByTestId('note-title-input');
    fireEvent.changeText(titleInput, 'Updated Note');

    const saveButton = getByTestId('note-save-button');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(StorageService.saveNote).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'note_123',
          title: 'Updated Note',
        }),
      );
    });
  });
});
