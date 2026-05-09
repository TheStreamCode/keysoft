import { AppTheme } from './theme';

export const DesignSystem = {
  spacing: AppTheme.spacing,
  typography: AppTheme.typography,
  fonts: AppTheme.fonts,
  borderRadius: AppTheme.borderRadius,
  iconSizes: AppTheme.iconSizes,
  layout: AppTheme.layout,
  motion: AppTheme.motion,
  state: AppTheme.stateLayer,
  components: AppTheme.components,
  zIndex: AppTheme.zIndex,
};

export type DesignSystemType = typeof DesignSystem;
