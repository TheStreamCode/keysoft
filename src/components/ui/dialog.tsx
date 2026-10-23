import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesignSystem } from '../../constants/designSystem';
import { DIALOG_MAX_WIDTH } from '../../constants/layout';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MotionPressable, usePrefersReducedMotion } from './motion';
import { useResponsiveLayout } from '../../utils/responsive';

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
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const isReducedMotion = usePrefersReducedMotion();
  const accentColor =
    tone === 'destructive'
      ? theme.colors.error
      : tone === 'success'
        ? theme.colors.success
        : theme.colors.primary;
  const hasHorizontalActions = actions.length === 2 && layout.width >= 340;
  const maxHeight = Math.min(
    layout.height - Math.max(insets.top, 12) - Math.max(insets.bottom, 12),
    720,
  );

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
          entering={
            isReducedMotion ? undefined : FadeIn.duration(DesignSystem.motion.durations.short)
          }
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.backgroundElevated,
              borderColor: theme.colors.divider,
              maxHeight,
              maxWidth: DIALOG_MAX_WIDTH[layout.windowClass],
            },
            theme.shadows.large,
          ]}
        >
          <View style={styles.header}>
            {dismissible ? (
              <MotionPressable
                accessibilityLabel={t('close')}
                accessibilityRole="button"
                onPress={onClose}
                style={[
                  styles.closeButton,
                  styles.closeButtonPositioned,
                  { backgroundColor: theme.colors.backgroundMuted },
                ]}
              >
                <Ionicons color={theme.colors.textSecondary} name="close" size={20} />
              </MotionPressable>
            ) : null}
            <View
              style={[
                styles.icon,
                { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}55` },
              ]}
            >
              {iconElement ?? (
                <Ionicons color={accentColor} name={icon} size={DesignSystem.iconSizes.lg} />
              )}
            </View>
            <Text style={[DesignSystem.text('title'), styles.title, { color: theme.colors.text }]}>
              {title}
            </Text>
            {description ? (
              <Text
                style={[
                  DesignSystem.text('bodySmall'),
                  styles.description,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {description}
              </Text>
            ) : null}
          </View>

          {children ? <View style={styles.body}>{children}</View> : null}

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
                        DesignSystem.text('button'),
                        {
                          color:
                            variant === 'primary'
                              ? theme.colors.onPrimary
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
    padding: DesignSystem.spacing.l,
  },
  dialog: {
    width: '100%',
    borderRadius: DesignSystem.radii.large,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: DesignSystem.spacing.l,
    paddingTop: DesignSystem.spacing.xxl,
    paddingBottom: DesignSystem.spacing.l,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: DesignSystem.radii.large,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DesignSystem.spacing.m,
  },
  title: {
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  closeButton: {
    width: DesignSystem.layout.touchTarget.comfortable,
    height: DesignSystem.layout.touchTarget.comfortable,
    borderRadius: DesignSystem.radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPositioned: {
    position: 'absolute',
    top: DesignSystem.spacing.s,
    right: DesignSystem.spacing.s,
  },
  body: {
    paddingHorizontal: DesignSystem.spacing.l,
    paddingBottom: DesignSystem.spacing.l,
  },
  description: {
    alignSelf: 'stretch',
    marginTop: DesignSystem.spacing.s,
    textAlign: 'center',
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: DesignSystem.spacing.m,
    gap: DesignSystem.spacing.s,
  },
  actionsHorizontal: { flexDirection: 'row' },
  actionsVertical: { flexDirection: 'column' },
  action: {
    minHeight: DesignSystem.layout.touchTarget.comfortable,
    borderRadius: DesignSystem.radii.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DesignSystem.spacing.l,
  },
  actionHorizontal: { flex: 1 },
});
