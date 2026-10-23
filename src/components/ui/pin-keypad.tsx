import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignSystem } from '../../constants/designSystem';
import { useTheme } from '../../contexts/ThemeContext';
import { useResponsiveLayout } from '../../utils/responsive';
import { MotionPressable } from './motion';

interface PinKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onBiometricPress?: () => void;
  biometricLabel: string;
  backspaceLabel: string;
  disabled?: boolean;
  maxLength?: number;
  onComplete?: (value: string) => void;
}

const rows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

export function PinKeypad({
  value,
  onChange,
  onBiometricPress,
  biometricLabel,
  backspaceLabel,
  disabled = false,
  maxLength = 6,
  onComplete,
}: PinKeypadProps) {
  const { theme } = useTheme();
  const layout = useResponsiveLayout();
  const keyHeight = layout.isShortLandscape
    ? DesignSystem.layout.touchTarget.minimum
    : layout.isTabletOrLarger
      ? 60
      : 52;

  function appendDigit(digit: string) {
    if (disabled || value.length >= maxLength) return;
    const nextValue = `${value}${digit}`;
    onChange(nextValue);
    if (nextValue.length === maxLength) {
      onComplete?.(nextValue);
    }
  }

  function removeDigit() {
    if (!disabled && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <View style={styles.keypad}>
      {rows.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((digit) => (
            <MotionPressable
              key={digit}
              accessibilityRole="button"
              accessibilityLabel={digit}
              disabled={disabled}
              onPress={() => appendDigit(digit)}
              style={[
                styles.key,
                {
                  minHeight: keyHeight,
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[DesignSystem.text('title'), { color: theme.colors.text }]}>
                {digit}
              </Text>
            </MotionPressable>
          ))}
        </View>
      ))}

      <View style={styles.row}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={biometricLabel}
          disabled={disabled || !onBiometricPress}
          onPress={onBiometricPress}
          style={[styles.utilityKey, { minHeight: keyHeight }]}
        >
          <Ionicons
            name="finger-print-outline"
            size={DesignSystem.iconSizes.lg}
            color={onBiometricPress ? theme.colors.primary : theme.colors.textTertiary}
          />
        </MotionPressable>

        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="0"
          disabled={disabled}
          onPress={() => appendDigit('0')}
          style={[
            styles.key,
            {
              minHeight: keyHeight,
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[DesignSystem.text('title'), { color: theme.colors.text }]}>0</Text>
        </MotionPressable>

        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={backspaceLabel}
          disabled={disabled || value.length === 0}
          onPress={removeDigit}
          style={[styles.utilityKey, { minHeight: keyHeight }]}
        >
          <Ionicons
            name="backspace-outline"
            size={DesignSystem.iconSizes.md}
            color={theme.colors.textSecondary}
          />
        </MotionPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keypad: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    gap: DesignSystem.spacing.s,
  },
  row: {
    flexDirection: 'row',
    gap: DesignSystem.spacing.s,
  },
  key: {
    flex: 1,
    borderRadius: DesignSystem.radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityKey: {
    flex: 1,
    borderRadius: DesignSystem.radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
