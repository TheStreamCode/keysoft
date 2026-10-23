import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAlert } from '../contexts/AlertContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { DesignSystem } from '../constants/designSystem';
import NotificationService, { NotificationType } from '../services/utils/notificationService';
import { BottomSheet } from './ui/bottom-sheet';
import { MotionPressable } from './ui/motion';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  data?: unknown;
}

interface NotificationBellProps {
  onPress?: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onPress }) => {
  const { theme } = useTheme();
  const { t, effectiveLanguage } = useLanguage();
  const { alert, notify } = useAlert();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const confirmationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNotifications = React.useCallback(async () => {
    const recentNotifications = await NotificationService.getRecentNotifications();
    const uniqueNotifications = Array.from(
      new Map(recentNotifications.map((notification) => [notification.id, notification])).values(),
    ).sort((a, b) => b.timestamp - a.timestamp);
    setNotifications(uniqueNotifications);
  }, []);

  React.useEffect(() => {
    const initialLoad = setTimeout(() => void loadNotifications(), 0);
    const subscription = NotificationService.addNotificationReceivedListener(() => {
      void loadNotifications();
    });
    return () => {
      clearTimeout(initialLoad);
      if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
      subscription.remove();
    };
  }, [loadNotifications]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  async function markAsRead(id: string) {
    await NotificationService.markNotificationAsRead(id);
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
  }

  async function markAllAsRead() {
    await NotificationService.markAllNotificationsAsRead();
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    notify(t('mark_all_read'), 'success');
  }

  async function deleteNotification(id: string) {
    await NotificationService.deleteNotification(id);
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }

  function confirmDeleteAll() {
    setIsOpen(false);
    confirmationTimeoutRef.current = setTimeout(() => {
      alert(t('notifications_delete_all_title'), t('notifications_delete_all_message'), [
        { text: t('cancel'), onPress: () => setIsOpen(true), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            void NotificationService.deleteAllNotifications().then(() => {
              setNotifications([]);
              setIsOpen(false);
            });
          },
        },
      ]);
      confirmationTimeoutRef.current = null;
    }, 0);
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString(effectiveLanguage === 'it' ? 'it-IT' : 'en-US', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <>
      <MotionPressable
        accessibilityLabel={t('open_notifications')}
        accessibilityRole="button"
        hitSlop={4}
        onPress={() => {
          onPress?.();
          if (!onPress) setIsOpen(true);
        }}
        style={styles.bell}
      >
        <Ionicons
          color={theme.colors.textSecondary}
          name="notifications-outline"
          size={DesignSystem.iconSizes.md}
        />
        {unreadCount > 0 ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.background,
              },
            ]}
          />
        ) : null}
      </MotionPressable>

      <BottomSheet
        height="full"
        onClose={() => setIsOpen(false)}
        title={t('notifications_title')}
        visible={isOpen}
      >
        {notifications.length > 0 ? (
          <View style={styles.tools}>
            <MotionPressable
              accessibilityLabel={t('mark_all_read')}
              accessibilityRole="button"
              onPress={() => void markAllAsRead()}
              style={[styles.toolButton, { borderColor: theme.colors.border }]}
            >
              <Ionicons
                color={theme.colors.primary}
                name="checkmark-done-outline"
                size={DesignSystem.iconSizes.sm}
              />
              <Text style={[styles.toolText, { color: theme.colors.text }]}>
                {t('mark_all_read')}
              </Text>
            </MotionPressable>
            <MotionPressable
              accessibilityLabel={t('delete_all_notifications')}
              accessibilityRole="button"
              onPress={confirmDeleteAll}
              style={[styles.toolIcon, { borderColor: theme.colors.border }]}
            >
              <Ionicons
                color={theme.colors.error}
                name="trash-outline"
                size={DesignSystem.iconSizes.sm}
              />
            </MotionPressable>
          </View>
        ) : null}

        {notifications.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.backgroundMuted }]}>
              <Ionicons
                color={theme.colors.textTertiary}
                name="notifications-off-outline"
                size={DesignSystem.iconSizes.lg}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {t('no_notifications')}
            </Text>
            <Text style={[styles.emptyBody, { color: theme.colors.textSecondary }]}>
              {t('notifications_empty_body')}
            </Text>
          </View>
        ) : (
          <View style={[styles.list, { borderColor: theme.colors.divider }]}>
            {notifications.map((notification, index) => (
              <View
                key={notification.id}
                style={[
                  styles.notification,
                  {
                    backgroundColor: notification.read
                      ? theme.colors.backgroundElevated
                      : theme.colors.chipBackground,
                    borderBottomColor: theme.colors.divider,
                    borderBottomWidth:
                      index === notifications.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <MotionPressable
                  accessibilityLabel={notification.title}
                  accessibilityRole="button"
                  onPress={() => void markAsRead(notification.id)}
                  style={styles.notificationMain}
                >
                  <View
                    style={[
                      styles.notificationIcon,
                      { backgroundColor: theme.colors.backgroundMuted },
                    ]}
                  >
                    <Ionicons
                      color={theme.colors.primary}
                      name={getNotificationIcon(notification.type)}
                      size={DesignSystem.iconSizes.sm}
                    />
                  </View>
                  <View style={styles.notificationCopy}>
                    <Text
                      numberOfLines={1}
                      style={[styles.notificationTitle, { color: theme.colors.text }]}
                    >
                      {notification.title}
                    </Text>
                    <Text
                      numberOfLines={3}
                      style={[styles.notificationBody, { color: theme.colors.textSecondary }]}
                    >
                      {notification.body}
                    </Text>
                    <Text style={[styles.notificationTime, { color: theme.colors.textTertiary }]}>
                      {formatTimestamp(notification.timestamp)}
                    </Text>
                  </View>
                </MotionPressable>
                <MotionPressable
                  accessibilityLabel={t('delete_notification')}
                  accessibilityRole="button"
                  hitSlop={4}
                  onPress={() => void deleteNotification(notification.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons
                    color={theme.colors.textTertiary}
                    name="close"
                    size={DesignSystem.iconSizes.sm}
                  />
                </MotionPressable>
              </View>
            ))}
          </View>
        )}
      </BottomSheet>
    </>
  );
};

function getNotificationIcon(type: NotificationType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case NotificationType.PASSWORD_EXPIRY:
    case NotificationType.WEAK_PASSWORD:
    case NotificationType.DUPLICATE_PASSWORD:
      return 'key-outline';
    case NotificationType.AUTO_LOCK_WARNING:
      return 'lock-closed-outline';
    case NotificationType.CLIPBOARD_CLEAR_WARNING:
      return 'clipboard-outline';
    case NotificationType.LOGIN_SUCCESS:
    case NotificationType.LOGIN_FAILURE:
      return 'log-in-outline';
    case NotificationType.BACKUP_REMINDER:
    case NotificationType.BACKUP_SUCCESS:
      return 'archive-outline';
    default:
      return 'information-circle-outline';
  }
}

const styles = StyleSheet.create({
  bell: {
    width: DesignSystem.layout.touchTarget.comfortable,
    height: DesignSystem.layout.touchTarget.comfortable,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 11,
    top: 10,
    width: 8,
    height: 8,
    borderRadius: DesignSystem.radii.pill,
    borderWidth: 1,
  },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.s,
    marginBottom: DesignSystem.spacing.m,
  },
  toolButton: {
    flex: 1,
    minHeight: DesignSystem.layout.touchTarget.comfortable,
    borderWidth: 1,
    borderRadius: DesignSystem.radii.medium,
    paddingHorizontal: DesignSystem.spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.s,
  },
  toolIcon: {
    width: DesignSystem.layout.touchTarget.comfortable,
    height: DesignSystem.layout.touchTarget.comfortable,
    borderWidth: 1,
    borderRadius: DesignSystem.radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { ...DesignSystem.text('labelSmall'), fontWeight: '600' },
  empty: {
    alignItems: 'center',
    paddingHorizontal: DesignSystem.spacing.xl,
    paddingVertical: DesignSystem.spacing.xxxl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: DesignSystem.radii.large,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DesignSystem.spacing.l,
  },
  emptyTitle: { ...DesignSystem.text('subtitle'), textAlign: 'center' },
  emptyBody: {
    ...DesignSystem.text('bodySmall'),
    marginTop: DesignSystem.spacing.s,
    textAlign: 'center',
    maxWidth: 320,
  },
  list: {
    borderWidth: 1,
    borderRadius: DesignSystem.radii.medium,
    overflow: 'hidden',
  },
  notification: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationMain: {
    flex: 1,
    minWidth: 0,
    paddingLeft: DesignSystem.spacing.m,
    paddingVertical: DesignSystem.spacing.m,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DesignSystem.spacing.m,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: DesignSystem.radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCopy: { flex: 1, minWidth: 0 },
  notificationTitle: { ...DesignSystem.text('bodySmall'), fontWeight: '600' },
  notificationBody: {
    ...DesignSystem.text('caption'),
    marginTop: DesignSystem.spacing.xxs,
  },
  notificationTime: {
    ...DesignSystem.text('micro'),
    marginTop: DesignSystem.spacing.xs,
  },
  deleteButton: {
    width: DesignSystem.layout.touchTarget.comfortable,
    height: DesignSystem.layout.touchTarget.comfortable,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default NotificationBell;
