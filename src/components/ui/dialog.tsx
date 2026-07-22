import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MotionPressable, usePrefersReducedMotion } from './motion';

type IoniconName = keyof typeof Ionicons.glyphMap;

export interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
}

interface DialogProps {
  visible: boolean;
  title: string;
  description?: string;
  icon?: IoniconName;
  iconElement?: React.ReactNode;
  tone?: 'default' | 'destructive' | 'success';
  actions?: DialogAction[];
  children?: React.ReactNode;
  dismissible?: boolean;
  onClose: () => void;
}

export function Dialog({
  visible,
  title,
  description,
  icon = 'information-circle-outline',
  iconElement,
  tone = 'default',
  actions = [],
  children,
  dismissible = true,
  onClose,
}: DialogProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const isReducedMotion = usePrefersReducedMotion();
  const accentColor =
    tone === 'destructive'
      ? theme.colors.error
      : tone === 'success'
        ? theme.colors.success
        : theme.colors.primary;
  const hasHorizontalActions = actions.length === 2 && width >= 340;

  return (
    <Modal
      accessibilityViewIsModal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={dismissible ? onClose : undefined}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { backgroundColor: theme.surfaces.overlay }]}
      >
        {dismissible ? (
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onResponderRelease={onClose}
            onStartShouldSetResponder={() => true}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        <Reanimated.View
          accessibilityLabel={title}
          accessibilityRole="alert"
          entering={isReducedMotion ? undefined : FadeIn.duration(180)}
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.backgroundElevated,
              borderColor: theme.colors.divider,
              maxHeight: Math.min(height - 48, 680),
            },
            theme.shadows.large,
          ]}
        >
          <View style={styles.header}>
            <View
              style={[
                styles.icon,
                { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}55` },
              ]}
            >
              {iconElement ?? <Ionicons color={accentColor} name={icon} size={21} />}
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
            {dismissible ? (
              <MotionPressable
                accessibilityLabel={t('close')}
                accessibilityRole="button"
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: theme.colors.backgroundMuted }]}
              >
                <Ionicons color={theme.colors.textSecondary} name="close" size={19} />
              </MotionPressable>
            ) : (
              <View style={styles.closeButton} />
            )}
          </View>

          <View style={styles.body}>
            {description ? (
              <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                {description}
              </Text>
            ) : null}
            {children}
          </View>

          {actions.length > 0 ? (
            <View
              style={[
                styles.actions,
                hasHorizontalActions ? styles.actionsHorizontal : styles.actionsVertical,
                { borderTopColor: theme.colors.divider },
              ]}
            >
              {actions.map((action) => {
                const variant = action.variant ?? 'primary';
                const color = variant === 'destructive' ? theme.colors.error : theme.colors.primary;
                return (
                  <MotionPressable
                    accessibilityLabel={action.label}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: action.disabled }}
                    disabled={action.disabled}
                    key={action.label}
                    onPress={action.onPress}
                    style={[
                      styles.action,
                      hasHorizontalActions && styles.actionHorizontal,
                      {
                        backgroundColor:
                          variant === 'primary' ? theme.colors.primary : 'transparent',
                        borderColor: variant === 'secondary' ? theme.colors.border : color,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        {
                          color:
                            variant === 'primary'
                              ? theme.colors.textLight
                              : variant === 'secondary'
                                ? theme.colors.text
                                : theme.colors.error,
                        },
                      ]}
                    >
                      {action.label}
                    </Text>
                  </MotionPressable>
                );
              })}
            </View>
          ) : null}
        </Reanimated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 11,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 18,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  actionsHorizontal: { flexDirection: 'row' },
  actionsVertical: { flexDirection: 'column' },
  action: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionHorizontal: { flex: 1 },
  actionText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
