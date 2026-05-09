import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { render } from '../../test-utils';
import PasswordDetailScreen from '../../screens/PasswordDetailScreen';
import * as StorageService from '../../services/storage/storageService';
import { Password } from '../../models/Password';

// Mock dependencies
jest.mock('../../services/storage/storageService', () => ({
  getAllPasswords: jest.fn(),
  savePassword: jest.fn(),
  deletePassword: jest.fn(),
  getUserPreferences: jest.fn().mockResolvedValue({}), // Needed for Contexts
  saveUserPreferences: jest.fn(),
  getPassword: jest.fn(),
}));
jest.mock('../../services/utils/clipboardService', () => ({
  copyToClipboard: jest.fn(),
}));

jest.mock('react-native-keyboard-aware-scroll-view', () => {
  const KeyboardAwareScrollView = ({ children }: { children: React.ReactNode }) => children;
  return { KeyboardAwareScrollView };
});

jest.mock('../../components/ui/bottom-sheet', () => ({
  BottomSheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../components/ui/list-item', () => ({
  ListItem: () => null,
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// Define stable mock contexts
const mockLanguageContext = {
  t: jest.fn((key: string) => key),
  language: 'it',
};

const mockThemeContext = {
  theme: { colors: { background: '#ffffff', text: '#000000' } },
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

describe('Credential Management (Actions)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    // Setup default storage mocks
    (StorageService.getAllPasswords as jest.Mock).mockResolvedValue([]);
    (StorageService.savePassword as jest.Mock).mockResolvedValue(true);
    (StorageService.deletePassword as jest.Mock).mockResolvedValue(true);
  });

  it('adds a new password successfully', async () => {
    const { getByTestId } = render(<PasswordDetailScreen />);

    const titleInput = getByTestId('password-title-input');
    const usernameInput = getByTestId('password-username-input');
    const passwordInput = getByTestId('password-password-input');

    fireEvent.changeText(titleInput, 'My Bank');
    fireEvent.changeText(usernameInput, 'myuser');
    fireEvent.changeText(passwordInput, 'Secret123!');

    const saveButton = getByTestId('password-save-button');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(StorageService.savePassword).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Bank',
          username: 'myuser',
          password: 'Secret123!',
        }),
      );
      // Note: We might want to check for navigate/goBack instead if save redirects
    });
  });

  it('edits an existing password', async () => {
    const mockPassword: Password = {
      id: '123',
      title: 'Existing Site',
      username: 'olduser',
      password: 'oldpassword',
      category: 'other',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockParams = { passwordId: '123' };
    (StorageService.getPassword as jest.Mock).mockResolvedValue(mockPassword);

    const { getByTestId, getByDisplayValue } = render(<PasswordDetailScreen />);

    await waitFor(() => {
      expect(getByDisplayValue('Existing Site')).toBeTruthy();
    });

    const titleInput = getByTestId('password-title-input');
    fireEvent.changeText(titleInput, 'Updated Site');

    const saveButton = getByTestId('password-save-button');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(StorageService.savePassword).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
          title: 'Updated Site',
        }),
      );
    });
  });

  it('deletes a password', async () => {
    const mockPassword: Password = {
      id: '123',
      title: 'Delete Me',
      username: 'user',
      password: 'pass',
      category: 'other',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockParams = { passwordId: '123' };
    (StorageService.getPassword as jest.Mock).mockResolvedValue(mockPassword);

    const { getByTestId } = render(<PasswordDetailScreen />);

    await waitFor(() => {
      expect(getByTestId('password-delete-button')).toBeTruthy();
    });

    const deleteButton = getByTestId('password-delete-button');
    fireEvent.press(deleteButton);

    // Alert handling is mocked via context, but we need to see how it's implemented in component
    // In PasswordDetailScreen, it calls alert(...) with buttons.
    // Since alert is mocked as jest.fn(), we can check if it was called.
    // But we need to simulate the "Delete" button press in the alert.

    await waitFor(() => {
      expect(mockAlertContext.alert).toHaveBeenCalled();
    });

    // To simulate the alert button press, we need to capture the arguments passed to alert
    const alertCalls = mockAlertContext.alert.mock.calls;
    const deleteCall = alertCalls[0];
    // alert(title, message, buttons)
    const buttons = deleteCall[2];
    const confirmButton = buttons.find(
      (b: any) => b.style === 'destructive' || b.text === 'delete',
    );

    // Execute the onPress handler of the confirm button
    await confirmButton.onPress();

    await waitFor(() => {
      expect(StorageService.deletePassword).toHaveBeenCalledWith('123');
    });
  });
});
