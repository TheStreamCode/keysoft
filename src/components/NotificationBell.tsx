import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import NotificationService, { NotificationType } from '../services/utils/notificationService';
import { responsiveValue, getMaxContentWidth } from '../utils/responsive';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  data?: any;
}

interface NotificationBellProps {
  onPress?: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onPress }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Ottieni le notifiche recenti
  useEffect(() => {
    const loadNotifications = async () => {
      const recentNotifications = await NotificationService.getRecentNotifications();

      // Use a Map to track notifications by ID
      // This ensures there are no duplicates
      const notificationsMap = new Map<string, Notification>();

      // Add notifications to the Map, overwriting duplicate entries
      recentNotifications.forEach((notification) => {
        notificationsMap.set(notification.id, notification);
      });

      // Convert the Map to an array and sort by timestamp, newest first
      const uniqueNotifications = Array.from(notificationsMap.values()).sort(
        (a, b) => b.timestamp - a.timestamp,
      );

      // Use requestAnimationFrame to ensure the update
      // dello stato avvenga durante il prossimo frame di rendering
      requestAnimationFrame(() => {
        setNotifications(uniqueNotifications);
      });
    };

    loadNotifications();

    // Update notifications when a new one arrives
    const subscription = NotificationService.addNotificationReceivedListener((_notification) => {
      // Update notifications asynchronously to avoid concurrency issues
      setTimeout(() => {
        loadNotifications();
      }, 100);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Conta le notifiche non lette
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Gestisce il tocco sulla campanella
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      setShowNotifications(true);
    }
  };

  // Mark a notification as read
  const markAsRead = async (id: string) => {
    await NotificationService.markNotificationAsRead(id);
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  // Segna tutte le notifiche come lette
  const markAllAsRead = async () => {
    await NotificationService.markAllNotificationsAsRead();
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  // Delete a notification
  const deleteNotification = async (id: string) => {
    await NotificationService.deleteNotification(id);
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  // Elimina tutte le notifiche
  const deleteAllNotifications = async () => {
    await NotificationService.deleteAllNotifications();
    setNotifications([]);
    setShowNotifications(false);
  };

  // Format the notification date
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins < 60) {
      return t('minutes_ago', { count: diffMins });
    } else if (diffHours < 24) {
      return t('hours_ago', { count: diffHours });
    } else if (diffDays < 7) {
      return t('days_ago', { count: diffDays });
    } else {
      return date.toLocaleDateString();
    }
  };

  // Resolve the icon from the notification type
  const getNotificationIcon = (type: NotificationType) => {
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
        return 'cloud-upload-outline';
      default:
        return 'information-circle-outline';
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.primary + '20',
            borderRadius: 12,
          },
        ]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('open_notifications')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="notifications-outline" size={24} color={theme.colors.primary} />
        {unreadCount > 0 && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.error,
                borderWidth: 1.5,
                borderColor: theme.colors.backgroundElevated,
                // Use more horizontal space for two-digit counts
                paddingHorizontal: unreadCount > 9 ? 3 : 0,
                minWidth: unreadCount > 9 ? 22 : 18,
              },
            ]}
          >
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
        accessibilityViewIsModal
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setShowNotifications(false)}
            accessible={false}
          />
          <View
            style={[
              styles.notificationsContainer,
              {
                backgroundColor: theme.colors.card,
                // Add a subtle border in dark mode to better define the boundaries
                borderWidth: theme.colors.background === '#121212' ? 1 : 0,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.notificationsHeader,
                {
                  borderBottomWidth: 1,
                  borderBottomColor:
                    theme.colors.background === '#121212'
                      ? theme.colors.border
                      : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
            >
              <Text style={[styles.notificationsTitle, { color: theme.colors.text }]}>
                {t('notifications_title')}
              </Text>
              <View style={styles.notificationsActions}>
                {notifications.length > 0 && (
                  <>
                    <TouchableOpacity
                      onPress={markAllAsRead}
                      style={styles.actionButton}
                      accessibilityRole="button"
                      accessibilityLabel={t('mark_all_read')}
                    >
                      <Ionicons name="checkmark-done-outline" size={20} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={deleteAllNotifications}
                      style={styles.actionButton}
                      accessibilityRole="button"
                      accessibilityLabel={t('delete_all_notifications')}
                    >
                      <Ionicons name="trash-outline" size={20} color={theme.colors.text} />
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  onPress={() => setShowNotifications(false)}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('close_notifications')}
                >
                  <Ionicons name="close-outline" size={20} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="notifications-off-outline" size={48} color={theme.colors.border} />
                <Text style={[styles.emptyText, { color: theme.colors.border }]}>
                  {t('no_notifications')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item: Notification) => item.id}
                renderItem={({ item }: { item: Notification }) => (
                  <TouchableOpacity
                    style={[
                      styles.notificationItem,
                      !item.read && {
                        backgroundColor:
                          theme.colors.background === '#121212'
                            ? `${theme.colors.primary}25` // Meno saturo in dark mode
                            : `${theme.colors.primary}15`,
                      },
                      {
                        borderBottomColor:
                          theme.colors.background === '#121212'
                            ? theme.colors.border
                            : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                    onPress={() => markAsRead(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                  >
                    <View
                      style={[
                        styles.notificationIcon,
                        {
                          backgroundColor:
                            theme.colors.background === '#121212'
                              ? 'rgba(255, 255, 255, 0.1)'
                              : 'rgba(0, 0, 0, 0.05)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={getNotificationIcon(item.type)}
                        size={24}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={[styles.notificationTitle, { color: theme.colors.text }]}>
                        {item.title}
                      </Text>
                      <Text
                        style={[styles.notificationBody, { color: theme.colors.textSecondary }]}
                      >
                        {item.body}
                      </Text>
                      <Text
                        style={[styles.notificationTime, { color: theme.colors.textSecondary }]}
                      >
                        {formatTimestamp(item.timestamp)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteNotification(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t('delete_notification')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={24}
                        color={theme.colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                style={styles.notificationsList}
                removeClippedSubviews={true}
                initialNumToRender={8}
                maxToRenderPerBatch={6}
                windowSize={7}
                updateCellsBatchingPeriod={100}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  notificationsContainer: {
    width: '90%',
    // Max width responsive per tablet/TV
    maxWidth: responsiveValue({
      phone: 500,
      tablet: getMaxContentWidth(),
      tv: getMaxContentWidth(),
    }),
    maxHeight: '80%',
    marginTop: 80,
    borderRadius: 10,
    overflow: 'hidden',
    // Removed shadows
  },
  notificationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  notificationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  notificationsActions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 16,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationsList: {
    maxHeight: '100%',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  notificationIcon: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  emptyContainer: {
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  },
});

export default NotificationBell;
