import NotificationService from '../../services/utils/notificationService';
import * as Notifications from 'expo-notifications';

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NotificationService.setTranslator((key, params) => {
      const serializedParams = params ? `:${JSON.stringify(params)}` : '';
      return `translated:${key}${serializedParams}`;
    });
  });

  it('should be defined', () => {
    expect(NotificationService).toBeDefined();
  });

  it('should have initialize method', () => {
    expect(typeof NotificationService.initialize).toBe('function');
  });

  it('should have cancelNotification method', () => {
    expect(typeof NotificationService.cancelNotification).toBe('function');
  });

  it('should have cancelAllNotifications method', () => {
    expect(typeof NotificationService.cancelAllNotifications).toBe('function');
  });

  it('uses localized strings for periodic password notifications', async () => {
    await NotificationService.initialize();

    await NotificationService.checkPeriodicNotifications(
      [
        {
          id: '1',
          title: 'First',
          username: 'one',
          password: 'abc',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiryDate: Date.now() - 1000,
        },
        {
          id: '2',
          title: 'Second',
          username: 'two',
          password: 'abc',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      undefined,
    );

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'translated:notification_weak_password_warning_title',
          body: 'translated:notification_weak_password_summary_body:{"weakCount":2}',
        }),
      }),
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'translated:notification_duplicate_password_warning_title',
          body: 'translated:notification_duplicate_password_summary_body:{"duplicateCount":2}',
        }),
      }),
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'translated:notification_password_expiry_warning_title',
          body: 'translated:notification_password_expiry_summary_body:{"expiredCount":1}',
        }),
      }),
    );
  });
});
