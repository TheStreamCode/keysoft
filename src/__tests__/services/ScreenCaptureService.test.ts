import * as ScreenCapture from 'expo-screen-capture';
import { ScreenCaptureService } from '../../services/utils/screenCaptureService';

// Mock expo-screen-capture
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(() => Promise.resolve()),
  allowScreenCaptureAsync: jest.fn(() => Promise.resolve()),
  addScreenshotListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

describe('ScreenCaptureService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('preventScreenCapture', () => {
    it('should call preventScreenCaptureAsync', async () => {
      await ScreenCaptureService.preventScreenCapture();
      expect(ScreenCapture.preventScreenCaptureAsync).toHaveBeenCalled();
    });
  });

  describe('allowScreenCapture', () => {
    it('should call allowScreenCaptureAsync', async () => {
      await ScreenCaptureService.allowScreenCapture();
      expect(ScreenCapture.allowScreenCaptureAsync).toHaveBeenCalled();
    });
  });

  describe('addScreenshotListener', () => {
    it('should add a screenshot listener with identifier', () => {
      const callback = jest.fn();
      ScreenCaptureService.addScreenshotListener('test-id', callback);
      expect(ScreenCapture.addScreenshotListener).toHaveBeenCalledWith(callback);
    });

    it('should replace existing listener with same identifier', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      ScreenCaptureService.addScreenshotListener('same-id', callback1);
      ScreenCaptureService.addScreenshotListener('same-id', callback2);
      expect(ScreenCapture.addScreenshotListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeScreenshotListener', () => {
    it('should remove a registered listener', () => {
      const callback = jest.fn();
      ScreenCaptureService.addScreenshotListener('to-remove', callback);
      expect(() => ScreenCaptureService.removeScreenshotListener('to-remove')).not.toThrow();
    });

    it('should handle removing non-existent listener', () => {
      expect(() => ScreenCaptureService.removeScreenshotListener('non-existent')).not.toThrow();
    });
  });

  describe('removeAllScreenshotListeners', () => {
    it('should remove all listeners without error', () => {
      ScreenCaptureService.addScreenshotListener('id1', jest.fn());
      ScreenCaptureService.addScreenshotListener('id2', jest.fn());
      expect(() => ScreenCaptureService.removeAllScreenshotListeners()).not.toThrow();
    });

    it('should be safe to call when no listeners exist', () => {
      expect(() => ScreenCaptureService.removeAllScreenshotListeners()).not.toThrow();
    });
  });
});
