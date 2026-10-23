import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DesignSystem } from '../constants/designSystem';
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
          <Ionicons name={icon} size={DesignSystem.iconSizes.sm} color={theme.colors.primary} />
        </View>

        <View style={styles.copy}>
          <Text
            numberOfLines={1}
            style={[DesignSystem.text('label'), styles.title, { color: theme.colors.text }]}
          >
            {password.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[DesignSystem.text('caption'), { color: theme.colors.textSecondary }]}
          >
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
        style={[styles.copyButton, { backgroundColor: theme.colors.backgroundMuted }]}
      >
        <Ionicons
          name="copy-outline"
          size={DesignSystem.iconSizes.sm}
          color={theme.colors.textTertiary}
        />
      </MotionPressable>
    </View>
  );
});

PasswordCard.displayName = 'PasswordCard';

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: DesignSystem.radii.large,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: DesignSystem.spacing.s,
    overflow: 'hidden',
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    paddingLeft: DesignSystem.spacing.m,
    paddingVertical: DesignSystem.spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: DesignSystem.radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: DesignSystem.spacing.m,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontWeight: '600' },
  strengthDot: {
    width: 6,
    height: 6,
    borderRadius: DesignSystem.radii.pill,
    marginHorizontal: DesignSystem.spacing.s,
  },
  copyButton: {
    width: DesignSystem.layout.touchTarget.comfortable,
    height: DesignSystem.layout.touchTarget.comfortable,
    borderRadius: DesignSystem.radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PasswordCard;
