import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Password } from '../models/Password';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import ClipboardService from '../services/utils/clipboardService';
import Logger from '../utils/logger';
import { calculatePasswordStrength } from '../utils/passwordUtils';
import { MotionPressable } from './ui/motion';

interface PasswordCardProps {
  password: Password;
  onPress: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  categoryColor?: string;
}

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  favorites: 'star-outline',
  email: 'mail-outline',
  social: 'people-outline',
  business: 'briefcase-outline',
  banking: 'card-outline',
  shopping: 'cart-outline',
  gaming: 'game-controller-outline',
  music: 'musical-notes-outline',
  other: 'key-outline',
};

const PasswordCard = React.memo(({ password, onPress }: PasswordCardProps) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { notify } = useAlert();
  const strength = useMemo(() => calculatePasswordStrength(password.password), [password.password]);
  const icon = categoryIcons[password.category || 'other'] || categoryIcons.other;

  const handleCopyToClipboard = useCallback(async () => {
    try {
      await ClipboardService.copyToClipboard(
        password.password,
        t('password_copied_custom', { title: password.title }),
        30,
      );
      notify(t('password_copied_custom', { title: password.title }), 'success');
    } catch (error) {
      Logger.error('Unable to copy credential password', error);
      notify(t('copy_error_generic'), 'error');
    }
  }, [notify, password.password, password.title, t]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.backgroundElevated,
          borderColor: theme.colors.divider,
        },
      ]}
    >
      <MotionPressable
        accessibilityLabel={`${password.title}, ${password.username}`}
        accessibilityRole="button"
        onPress={() => onPress(password.id)}
        style={styles.cardMain}
      >
        <View style={[styles.icon, { backgroundColor: theme.colors.backgroundMuted }]}>
          <Ionicons name={icon} size={17} color={theme.colors.primary} />
        </View>

        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.text }]}>
            {password.title}
          </Text>
          <Text numberOfLines={1} style={[styles.username, { color: theme.colors.textSecondary }]}>
            {password.username}
          </Text>
        </View>

        <View
          accessibilityLabel={strength.label ? t(strength.label) : t('strength')}
          style={[styles.strengthDot, { backgroundColor: strength.color }]}
        />
      </MotionPressable>
      <MotionPressable
        accessibilityLabel={t('copy_password_card')}
        accessibilityRole="button"
        onPress={() => void handleCopyToClipboard()}
        style={styles.copyButton}
      >
        <Ionicons name="copy-outline" size={17} color={theme.colors.textTertiary} />
      </MotionPressable>
    </View>
  );
});

PasswordCard.displayName = 'PasswordCard';

const styles = StyleSheet.create({
  card: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    paddingLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  username: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  strengthDot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 8 },
  copyButton: { width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
});

export default PasswordCard;
