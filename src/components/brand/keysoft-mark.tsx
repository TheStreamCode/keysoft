import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface KeysoftMarkProps {
  size?: number;
}

export function KeysoftMark({ size = 76 }: KeysoftMarkProps) {
  return (
    <Image
      accessible={false}
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={require('../../../assets/splash-icon.png')}
      style={[styles.mark, { width: size, height: size }]}
    />
  );
}

const styles = StyleSheet.create({
  mark: { flexShrink: 0 },
});
