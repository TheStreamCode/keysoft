import React from 'react';
import { Platform, Switch as RNSwitch } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
  accessibilityLabel?: string;
}

export function Switch({
  value,
  onValueChange,
  disabled,
  className,
  accessibilityLabel,
}: SwitchProps) {
  const { theme } = useTheme();
  // react-native-web uses its own teal default for the active thumb unless
  // activeThumbColor is provided; native ignores this web-only prop.
  const webProps =
    Platform.OS === 'web'
      ? ({ activeThumbColor: theme.colors.switchThumbOn } as Record<string, string>)
      : {};

  return (
    <RNSwitch
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      ios_backgroundColor={theme.colors.switchTrackOff}
      trackColor={{ false: theme.colors.switchTrackOff, true: theme.colors.switchTrackOn }}
      thumbColor={value ? theme.colors.switchThumbOn : theme.colors.switchThumbOff}
      className={className}
      {...webProps}
    />
  );
}

export default Switch;
