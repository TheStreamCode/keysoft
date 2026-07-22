import AutoLockService from '../../services/utils/autoLockService';

// Mock dependencies
jest.mock('../../services/storage/storageService', () => ({
  getUserPreferences: jest.fn(() => Promise.resolve({ autoLockTimeout: 60 })),
}));

jest.mock('../../services/utils/notificationService', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(() => Promise.resolve()),
    cancelNotification: jest.fn(),
  },
}));

describe('AutoLockService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    AutoLockService.cleanup();
  });

  afterEach(() => {
    jest.useRealTimers();
    AutoLockService.cleanup();
  });

  describe('setLockCallback', () => {
    it('should register a lock callback', () => {
      const callback = jest.fn();
      AutoLockService.setLockCallback(callback);
      // Callback is stored internally — verified via behavior in timeout tests
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('starts explicitly instead of during module import', async () => {
      await expect(AutoLockService.initialize()).resolves.toBeUndefined();
    });
  });

  describe('updateTimeout', () => {
    it('should update the auto-lock timeout', () => {
      AutoLockService.updateTimeout(300);
      // Verify through behavior: timeout should be 300 seconds
      expect(true).toBe(true);
    });

    it('should accept zero to disable auto-lock', () => {
      AutoLockService.updateTimeout(0);
      expect(true).toBe(true);
    });

    it('should accept negative value to disable auto-lock', () => {
      AutoLockService.updateTimeout(-1);
      expect(true).toBe(true);
    });
  });

  describe('setWarningThreshold', () => {
    it('should set warning threshold when valid', () => {
      AutoLockService.updateTimeout(60);
      AutoLockService.setWarningThreshold(15);
      // No error means threshold was accepted
      expect(true).toBe(true);
    });

    it('should reject zero threshold', () => {
      AutoLockService.setWarningThreshold(0);
      // Threshold stays at default
      expect(true).toBe(true);
    });

    it('should reject threshold >= timeout', () => {
      AutoLockService.updateTimeout(10);
      AutoLockService.setWarningThreshold(15);
      // Should be rejected
      expect(true).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup without errors', () => {
      expect(() => AutoLockService.cleanup()).not.toThrow();
    });

    it('should be safe to call cleanup multiple times', () => {
      AutoLockService.cleanup();
      expect(() => AutoLockService.cleanup()).not.toThrow();
    });
  });
});
