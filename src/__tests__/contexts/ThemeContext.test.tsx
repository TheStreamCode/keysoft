import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { NavigationBar } from 'expo-navigation-bar';

jest.mock('expo-navigation-bar', () => ({
  NavigationBar: jest.fn(() => null),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../services', () => ({
  Storage: {
    getUserPreferences: jest.fn().mockResolvedValue({}),
    saveUserPreferences: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Control useColorScheme return value without mocking the entire react-native module.
let mockColorScheme: 'light' | 'dark' | null = 'light';
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return Object.setPrototypeOf(
    {
      useColorScheme: () => mockColorScheme,
    },
    RN,
  );
});

function TestConsumer() {
  const { isDarkMode, themeMode } = useTheme();
  return (
    <>
      <Text testID="dark-mode">{isDarkMode ? 'true' : 'false'}</Text>
      <Text testID="theme-mode">{themeMode}</Text>
    </>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockColorScheme = 'light';
  });

  it('renders NavigationBar with style="dark" for light theme', async () => {
    mockColorScheme = 'light';

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(NavigationBar).toHaveBeenCalledWith(
        expect.objectContaining({ style: 'dark' }),
        undefined,
      );
    });
  });

  it('renders NavigationBar with style="light" for dark theme', async () => {
    mockColorScheme = 'dark';

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(NavigationBar).toHaveBeenCalledWith(
        expect.objectContaining({ style: 'light' }),
        undefined,
      );
    });
  });
});
