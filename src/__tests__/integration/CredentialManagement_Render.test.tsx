import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { render } from '../../test-utils';
import PasswordDetailScreen from '../../screens/PasswordDetailScreen';
import * as StorageService from '../../services/storage/storageService';

// Mock dependencies
jest.mock('../../services/storage/storageService', () => ({
  getAllPasswords: jest.fn(),
  savePassword: jest.fn(),
  deletePassword: jest.fn(),
  getUserPreferences: jest.fn().mockResolvedValue({}), // Needed for Contexts
  saveUserPreferences: jest.fn(),
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
let mockParams = {};
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

describe('Credential Management (Render & Validation)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    // Setup default storage mocks
    (StorageService.getAllPasswords as jest.Mock).mockResolvedValue([]);
    (StorageService.savePassword as jest.Mock).mockResolvedValue(true);
    (StorageService.deletePassword as jest.Mock).mockResolvedValue(true);
  });

  it('renders correctly in create mode', async () => {
    const { getByPlaceholderText, getByText } = render(<PasswordDetailScreen />);

    await waitFor(() => {
      expect(getByText('title')).toBeTruthy();
      expect(getByPlaceholderText('username_placeholder')).toBeTruthy();
      expect(getByText('save')).toBeTruthy();
    });
  });

  it('labels icon-only controls for assistive technologies', async () => {
    const { getByLabelText } = render(<PasswordDetailScreen />);

    await waitFor(() => {
      expect(getByLabelText('back')).toBeTruthy();
      expect(getByLabelText('copy_username')).toBeTruthy();
      expect(getByLabelText('show_password')).toBeTruthy();
      expect(getByLabelText('copy_password_card')).toBeTruthy();
    });
  });

  it('validates required fields', async () => {
    const { getByText } = render(<PasswordDetailScreen />);

    const saveButton = getByText('save');
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(StorageService.savePassword).not.toHaveBeenCalled();
    });
  });
});
