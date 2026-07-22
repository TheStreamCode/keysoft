import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
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
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.keyText, { color: theme.colors.text }]}>{digit}</Text>
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
          style={styles.utilityKey}
        >
          <Ionicons
            name="finger-print-outline"
            size={23}
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
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.keyText, { color: theme.colors.text }]}>0</Text>
        </MotionPressable>

        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={backspaceLabel}
          disabled={disabled || value.length === 0}
          onPress={removeDigit}
          style={styles.utilityKey}
        >
          <Ionicons name="backspace-outline" size={22} color={theme.colors.textSecondary} />
        </MotionPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keypad: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityKey: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
  },
});
