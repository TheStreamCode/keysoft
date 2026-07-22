import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    <View pointerEvents="none" style={[styles.host, { paddingTop: insets.top + 10 }]}>
      <Reanimated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        entering={isReducedMotion ? undefined : FadeInDown.duration(220)}
        exiting={isReducedMotion ? undefined : FadeOutUp.duration(160)}
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
          <Ionicons color={color} name={icon} size={17} />
        </View>
        <Text numberOfLines={3} style={[styles.message, { color: theme.colors.text }]}>
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
    zIndex: 40,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    width: '100%',
    maxWidth: 440,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
