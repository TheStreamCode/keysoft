import * as ExpoClipboard from 'expo-clipboard';
import { ClipboardService } from '../../services/utils/clipboardService';

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('test-clipboard-content')),
}));

// Mock notification service module
jest.mock('../../services/utils/notificationService', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(() => Promise.resolve()),
    cancelNotification: jest.fn(),
  },
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

describe('ClipboardService', () => {
  const mockSetStringAsync = ExpoClipboard.setStringAsync as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    ClipboardService.clearAllTimeouts();
  });

  afterEach(() => {
    jest.useRealTimers();
    ClipboardService.clearAllTimeouts();
  });

  describe('copyToClipboard', () => {
    it('should copy text to clipboard', async () => {
      await ClipboardService.copyToClipboard('secret-password');
      expect(mockSetStringAsync).toHaveBeenCalledWith('secret-password');
    });

    it('should use default identifier when not specified', async () => {
      await ClipboardService.copyToClipboard('test');
      expect(mockSetStringAsync).toHaveBeenCalledWith('test');
    });

    it('should support custom identifiers', async () => {
      await ClipboardService.copyToClipboard('test', 'custom-id');
      expect(mockSetStringAsync).toHaveBeenCalledWith('test');
    });

    it('should clear existing timer when copying with same identifier', async () => {
      await ClipboardService.copyToClipboard('first', 'same-id');
      await ClipboardService.copyToClipboard('second', 'same-id');
      expect(mockSetStringAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('copyPlainText', () => {
    it('should copy text without scheduling an auto-clear', async () => {
      await ClipboardService.copyPlainText('keysoft@mikesoft.it');

      expect(mockSetStringAsync).toHaveBeenCalledWith('keysoft@mikesoft.it');
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should drop a pending auto-clear, since the secret is no longer on the clipboard', async () => {
      await ClipboardService.copyToClipboard('secret-password');
      expect(jest.getTimerCount()).toBe(1);

      await ClipboardService.copyPlainText('keysoft@mikesoft.it');

      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('clearTimeout', () => {
    it('should clear a specific timer without error', () => {
      expect(() => ClipboardService.clearTimeout('test-id')).not.toThrow();
    });

    it('should handle clearing non-existent timer', () => {
      expect(() => ClipboardService.clearTimeout('non-existent')).not.toThrow();
    });
  });

  describe('clearAllTimeouts', () => {
    it('should clear all timers without error', () => {
      expect(() => ClipboardService.clearAllTimeouts()).not.toThrow();
    });

    it('should be safe to call when no timers exist', () => {
      expect(() => ClipboardService.clearAllTimeouts()).not.toThrow();
    });
  });

  describe('updateDefaultTimeout', () => {
    it('should update the default timeout', () => {
      expect(() => ClipboardService.updateDefaultTimeout(120)).not.toThrow();
    });
  });

  describe('readFromClipboard', () => {
    it('should read from clipboard', async () => {
      const result = await ClipboardService.readFromClipboard();
      expect(result).toBe('test-clipboard-content');
    });
  });
});
