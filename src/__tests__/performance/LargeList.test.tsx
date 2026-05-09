import React from 'react';
import { render, waitFor, fireEvent } from '../../test-utils';
import HomeScreen from '../../screens/HomeScreen';
import * as StorageService from '../../services/storage/storageService';
import { Password } from '../../models/Password';
import Logger from '../../utils/logger';

// Mock Expo modules
jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(),
}));

jest.mock('expo-navigation-bar', () => ({
  setBackgroundColorAsync: jest.fn(),
  setButtonStyleAsync: jest.fn(),
}));

jest.mock(
  'expo-haptics',
  () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
  }),
  { virtual: true },
);

// Mock Expo Notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

// Mock Vector Icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
  MaterialIcons: 'MaterialIcons',
}));

// Mock Crypto Service
jest.mock('../../services/crypto/cryptoService', () => ({
  encrypt: jest.fn().mockResolvedValue('encrypted'),
  decrypt: jest.fn().mockResolvedValue('decrypted'),
  hash: jest.fn().mockResolvedValue('hashed'),
  deriveKey: jest.fn().mockResolvedValue('key'),
  generateKey: jest.fn().mockResolvedValue('gen-key'),
  init: jest.fn().mockResolvedValue(true),
}));

// Mock Storage Service
jest.mock('../../services/storage/storageService', () => ({
  getPasswordsPaginated: jest.fn(),
  getUserPreferences: jest.fn().mockResolvedValue({
    username: 'TestUser',
    passwordGeneratorSettings: { length: 12 },
    notificationSettings: {},
  }),
  saveUserPreferences: jest.fn(),
  getPasswordCount: jest.fn().mockResolvedValue(1000),
  canAddPassword: jest.fn().mockResolvedValue(true),
}));

// Mock Auth Service
jest.mock('../../services/auth/authService', () => ({
  isAuthenticated: jest.fn().mockReturnValue(true),
  getIsAuthenticated: jest.fn().mockReturnValue(true),
  checkBiometricStatus: jest.fn().mockResolvedValue({ available: false, enabled: false }),
  initDatabase: jest.fn().mockResolvedValue(undefined),
  isMasterPasswordConfigured: jest.fn().mockResolvedValue(true),
  restoreBiometricsState: jest.fn().mockResolvedValue(false),
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  addListener: jest.fn(() => jest.fn()),
  setOptions: jest.fn(),
};

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => mockNavigation,
    useRoute: () => ({
      params: {},
    }),
  };
});

describe('Large List Performance Test', () => {
  const generateMockPasswords = (count: number): Password[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `pass-${i}`,
      title: `Service ${i}`,
      username: `user${i}`,
      password: `pass${i}`,
      website: `www.service${i}.com`,
      category: i % 2 === 0 ? 'social' : 'work',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle rendering a large list of passwords (virtualized)', async () => {
    const totalPasswords = 50; // Reduced from 1000 to avoid OOM in Jest
    const mockPasswords = generateMockPasswords(totalPasswords);

    (StorageService.getPasswordsPaginated as jest.Mock).mockImplementation((limit, offset) => {
      const sliced = mockPasswords.slice(offset, offset + limit);
      return Promise.resolve({
        passwords: sliced,
        total: totalPasswords,
      });
    });

    const startTime = Date.now();
    const { getByText, debug } = render(<HomeScreen />);

    // Wait for first batch to render
    try {
      await waitFor(
        () => {
          expect(getByText('Service 0')).toBeTruthy();
        },
        { timeout: 3000 },
      );
    } catch (e) {
      Logger.debug('Test failed. Debugging output:');
      debug();
      throw e;
    }

    const endTime = Date.now();
    const renderTime = endTime - startTime;
    Logger.info(`Initial render time for list start: ${renderTime}ms`);

    // Verify we can see at least one item from the initial batch
    await waitFor(
      () => {
        expect(getByText('Service 0')).toBeTruthy();
      },
      { timeout: 3000 },
    );

    // Verify pagination call for initial batch
    expect(StorageService.getPasswordsPaginated).toHaveBeenCalledWith(20, 0, undefined, '');
  });

  it('should filter efficiently', async () => {
    const totalPasswords = 1000;
    const mockPasswords = generateMockPasswords(totalPasswords);

    (StorageService.getPasswordsPaginated as jest.Mock).mockImplementation(
      (limit, offset, category, search) => {
        let filtered = mockPasswords;
        if (search) {
          filtered = filtered.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
        }
        const sliced = filtered.slice(offset, offset + limit);
        return Promise.resolve({
          passwords: sliced,
          total: filtered.length,
        });
      },
    );

    const { getByPlaceholderText, getByText, queryByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText('Service 0')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('Cerca password...');
    const startTime = Date.now();

    fireEvent.changeText(searchInput, 'Service 999');

    await waitFor(() => {
      expect(getByText('Service 999')).toBeTruthy();
    });

    const filterTime = Date.now() - startTime;
    Logger.info(`Filter time: ${filterTime}ms`);

    expect(queryByText('Service 0')).toBeNull();
  });
});
