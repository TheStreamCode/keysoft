import type { TextStyle } from 'react-native';

import { AppTheme } from './theme';
import type { Theme } from './theme';

export type TypographyVariant = keyof typeof AppTheme.typography;

/**
 * Converts a typography token into a React Native text style.
 * Tokens intentionally store `size`/`weight` so they stay platform agnostic;
 * screens should consume this helper instead of spreading the raw token.
 */
export function textStyle(variant: TypographyVariant, color?: string): TextStyle {
  const token = AppTheme.typography[variant];

  return {
    fontSize: token.size,
    lineHeight: token.lineHeight,
    fontWeight: token.weight as TextStyle['fontWeight'],
    letterSpacing: token.letterSpacing,
    ...(color ? { color } : {}),
  };
}

export const DesignSystem = {
  spacing: AppTheme.spacing,
  typography: AppTheme.typography,
  /** Preferred way to build text styles from the type scale. */
  text: textStyle,
  fonts: AppTheme.fonts,
  borderRadius: AppTheme.borderRadius,
  radii: AppTheme.radii,
  iconSizes: AppTheme.iconSizes,
  layout: AppTheme.layout,
  motion: AppTheme.motion,
  state: AppTheme.stateLayer,
  shadows: AppTheme.shadows,
  elevation: AppTheme.elevation,
  components: AppTheme.components,
  zIndex: AppTheme.zIndex,
  accessibility: AppTheme.accessibility,
};

export type DesignSystemType = typeof DesignSystem;
export type { Theme };
