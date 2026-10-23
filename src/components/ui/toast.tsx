import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesignSystem } from '../../constants/designSystem';
import { LAYOUT } from '../../constants/layout';
import { useTheme } from '../../contexts/ThemeContext';
import { usePrefersReducedMotion } from './motion';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  variant: ToastVariant;
}

export function Toast({ message, variant }: ToastProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isReducedMotion = usePrefersReducedMotion();
  const color =
    variant === 'success'
      ? theme.colors.success
      : variant === 'error'
        ? theme.colors.error
        : theme.colors.primary;
  const icon = variant === 'success' ? 'checkmark' : variant === 'error' ? 'close' : 'information';

  return (
    <View style={[styles.host, { paddingTop: insets.top + DesignSystem.spacing.s }]}>
      <Reanimated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        entering={
          isReducedMotion ? undefined : FadeInDown.duration(DesignSystem.motion.durations.short)
        }
        exiting={
          isReducedMotion ? undefined : FadeOutUp.duration(DesignSystem.motion.durations.fast)
        }
        style={[
          styles.toast,
          {
            backgroundColor: theme.colors.backgroundElevated,
            borderColor: theme.colors.divider,
          },
          theme.shadows.medium,
        ]}
      >
        <View style={[styles.icon, { backgroundColor: `${color}1c` }]}>
          <Ionicons color={color} name={icon} size={DesignSystem.iconSizes.sm} />
        </View>
        <Text
          numberOfLines={3}
          style={[DesignSystem.text('bodySmall'), { color: theme.colors.text }]}
        >
          {message}
        </Text>
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: DesignSystem.zIndex.toast,
    alignItems: 'center',
    paddingHorizontal: DesignSystem.spacing.l,
    pointerEvents: 'none',
  },
  toast: {
    width: '100%',
    maxWidth: LAYOUT.maxToastWidth,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: DesignSystem.radii.medium,
    paddingHorizontal: DesignSystem.spacing.m,
    paddingVertical: DesignSystem.spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.m,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: DesignSystem.radii.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
