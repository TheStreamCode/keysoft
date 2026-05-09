import React from 'react';
import { Switch as RNSwitch } from 'react-native';
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
  return (
    <RNSwitch
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: theme.colors.switchTrackOff, true: theme.colors.switchTrackOn }}
      thumbColor={value ? theme.colors.switchThumbOn : theme.colors.switchThumbOff}
      className={className}
    />
  );
}

export default Switch;
