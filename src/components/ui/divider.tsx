import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface DividerProps {
  className?: string;
  style?: any;
}

export function Divider({ className, style }: DividerProps) {
  const { theme } = useTheme();
  return (
    <View
      className={`h-px ${className ?? ''}`}
      style={[{ backgroundColor: theme.colors.divider }, style]}
    />
  );
}

export default Divider;
