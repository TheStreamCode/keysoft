import { Easing, Platform } from 'react-native';
import { BREAKPOINTS, LAYOUT, TOUCH_TARGET, WINDOW_METRICS } from './layout';

// === Palette ==============================================================
// Nocturne: one quiet blue accent over cool neutral surfaces.
const palette = {
  // Brand Colors (Safety Blue)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#4f8fe8',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  // Compatibility alias: interactive accents intentionally stay in one blue family.
  accent: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#4f8fe8',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  // Neutrals (Slate - Cool Gray with Blue undertones)
  slate: {
    25: '#fcfcfc',
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

const baseFonts = {
  main: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  secure: Platform.select({ ios: 'Courier', android: 'monospace', default: 'Courier' }),
  sizes: {
    xsmall: 11,
    small: 12,
    medium: 14,
    large: 16,
    xlarge: 20,
    xxlarge: 26,
    display: 32,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

/**
 * Type scale. `lineHeight` values are aligned to the 4pt grid and `letterSpacing`
 * is negative for display sizes and slightly positive for small labels.
 */
const typography = {
  display: { size: 32, lineHeight: 40, weight: '700', letterSpacing: -0.6 },
  headline: { size: 26, lineHeight: 32, weight: '600', letterSpacing: -0.4 },
  title: { size: 20, lineHeight: 28, weight: '600', letterSpacing: -0.2 },
  titleLarge: { size: 22, lineHeight: 28, weight: '600', letterSpacing: -0.3 },
  subtitle: { size: 18, lineHeight: 24, weight: '600', letterSpacing: -0.1 },
  body: { size: 16, lineHeight: 24, weight: '400', letterSpacing: 0 },
  bodySmall: { size: 14, lineHeight: 20, weight: '400', letterSpacing: 0 },
  label: { size: 14, lineHeight: 20, weight: '500', letterSpacing: 0.1 },
  labelSmall: { size: 12, lineHeight: 16, weight: '500', letterSpacing: 0.2 },
  caption: { size: 12, lineHeight: 16, weight: '400', letterSpacing: 0.2 },
  micro: { size: 11, lineHeight: 14, weight: '500', letterSpacing: 0.3 },
  button: { size: 15, lineHeight: 20, weight: '600', letterSpacing: 0.1 },
};

/** 4pt spacing grid. Legacy names are preserved for existing screens. */
const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
};

const borderRadius = {
  none: 0,
  xs: 6,
  small: 8,
  medium: 12,
  large: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

const iconSizes = {
  xs: 16,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
};

const layout = {
  breakpoints: {
    ...BREAKPOINTS,
    // Legacy aliases kept for callers that still speak in device categories.
    phone: BREAKPOINTS.compact,
    tablet: BREAKPOINTS.medium,
    tv: BREAKPOINTS.large,
  },
  windowMetrics: WINDOW_METRICS,
  contentMaxWidth: WINDOW_METRICS.large.contentMaxWidth,
  horizontalGutter: WINDOW_METRICS.compact.gutter,
  sectionGap: spacing.xxl,
  cardGap: spacing.m,
  maxReadableWidth: LAYOUT.maxReadableWidth,
  maxFormWidth: LAYOUT.maxFormWidth,
  maxAuthWidth: LAYOUT.maxAuthWidth,
  listItemMinHeight: LAYOUT.listItemMinHeight,
  touchTarget: TOUCH_TARGET,
};

const motion = {
  durations: {
    instant: 0,
    fastest: 80,
    fast: 120,
    short: 160,
    medium: 220,
    long: 320,
  },
  easing: {
    standard: Easing.bezier(0.2, 0, 0, 1),
    emphasized: Easing.bezier(0.05, 0.7, 0.1, 1),
    decelerate: Easing.out(Easing.cubic),
  },
};

const stateLayer = {
  hover: 0.04,
  focus: 0.12,
  pressed: 0.1,
  dragged: 0.16,
  disabled: 0.38,
};

/** Minimum interactive sizes; compact controls must still reach 44pt. */
const componentHeights = {
  button: { sm: TOUCH_TARGET.minimum, md: TOUCH_TARGET.comfortable, lg: TOUCH_TARGET.large },
  input: { md: TOUCH_TARGET.comfortable, lg: TOUCH_TARGET.large },
  iconButton: TOUCH_TARGET.comfortable,
  listItem: LAYOUT.listItemMinHeight,
  chip: 36,
  topBar: 64,
};

const zIndex = {
  header: 10,
  floatingAction: 20,
  modal: 30,
  toast: 40,
};

const accessibility = {
  minimumTouchTarget: TOUCH_TARGET.minimum,
  comfortableTouchTarget: TOUCH_TARGET.comfortable,
  normalTextContrast: 4.5,
  largeTextContrast: 3,
  /** Cap used for dense chrome where unbounded font scaling breaks layout. */
  maxFontSizeMultiplier: 1.35,
};

// === Surfaces Definition (The Core of the Look) ===========================

const darkSurfaces = {
  level0: '#161826',
  level1: '#232532',
  level2: '#292c3b',
  level3: '#323647',
  overlay: 'rgba(10, 12, 22, 0.88)',
};

const lightSurfaces = {
  level0: '#f5f5f8',
  level1: '#ffffff',
  level2: '#f0f1f6',
  level3: '#e8eaf1',
  overlay: 'rgba(20, 23, 38, 0.42)',
};

const gradientsDark = {
  hero: ['#161826', '#1c1f30'],
  accent: ['#4f8fe8', '#60a5fa'],
};

const gradientsLight = {
  hero: ['#f4f6fa', '#ffffff'],
  accent: ['#2563eb', '#60a5fa'],
};

// Modern Shadows (softer and more diffused than the previous elevation set)
const darkShadows =
  Platform.OS === 'web'
    ? {
        small: { boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.28)', elevation: 2 },
        medium: {
          boxShadow: '0 6px 16px -4px rgba(0, 0, 0, 0.36), 0 2px 6px -2px rgba(0, 0, 0, 0.2)',
          elevation: 6,
        },
        large: {
          boxShadow: '0 16px 32px -8px rgba(0, 0, 0, 0.42), 0 6px 12px -4px rgba(0, 0, 0, 0.24)',
          elevation: 12,
        },
      }
    : {
        small: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.28,
          shadowRadius: 2,
          elevation: 2,
        },
        medium: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.34,
          shadowRadius: 16,
          elevation: 6,
        },
        large: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.42,
          shadowRadius: 32,
          elevation: 12,
        },
      };

const lightShadows =
  Platform.OS === 'web'
    ? {
        small: { boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.06)', elevation: 1 },
        medium: {
          boxShadow:
            '0 6px 16px -4px rgba(15, 23, 42, 0.12), 0 2px 6px -2px rgba(15, 23, 42, 0.06)',
          elevation: 3,
        },
        large: {
          boxShadow:
            '0 16px 32px -8px rgba(15, 23, 42, 0.16), 0 6px 12px -4px rgba(15, 23, 42, 0.08)',
          elevation: 10,
        },
      }
    : {
        small: {
          shadowColor: palette.slate[700],
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
          elevation: 1,
        },
        medium: {
          shadowColor: palette.slate[700],
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 3,
        },
        large: {
          shadowColor: palette.slate[700],
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.16,
          shadowRadius: 32,
          elevation: 10,
        },
      };

const createTheme = (mode: 'dark' | 'light') => {
  const isDark = mode === 'dark';
  const surfaces = isDark ? darkSurfaces : lightSurfaces;
  const gradients = isDark ? gradientsDark : gradientsLight;
  const shadows = isDark ? darkShadows : lightShadows;
  const onPrimary = isDark ? '#0b1220' : '#ffffff';

  const colors = {
    // Brand
    primary: isDark ? palette.primary[400] : palette.primary[600],
    primaryLight: isDark ? palette.primary[300] : palette.primary[400],
    primaryDark: isDark ? palette.primary[500] : palette.primary[700],
    onPrimary,
    primaryContainer: isDark ? 'rgba(96, 165, 250, 0.16)' : '#dfe9fd',
    onPrimaryContainer: isDark ? '#dbeafe' : '#172554',

    accent: isDark ? palette.accent[400] : palette.accent[600],
    accentLight: isDark ? palette.accent[300] : palette.accent[500],
    accentDark: isDark ? palette.accent[500] : palette.accent[700],

    // Backgrounds
    background: surfaces.level0,
    backgroundMuted: isDark ? '#202230' : '#eceef4',
    backgroundLight: isDark ? '#232532' : '#ffffff',
    backgroundElevated: surfaces.level1,
    backgroundSunken: isDark ? '#12141f' : '#eceef4',
    surfaceMuted: isDark ? '#1c1f30' : '#f0f1f6',

    // Typography
    text: isDark ? '#e9e9ed' : '#171925',
    textSecondary: isDark ? '#a3a5b2' : '#5d6070',
    textTertiary: isDark ? '#8b8ea0' : '#6a6e7d',
    textDisabled: isDark ? '#6b6e7d' : '#9a9eab',
    textLight: '#ffffff',
    textDark: palette.slate[900],

    // Status (mode-specific so text stays readable on both themes)
    error: isDark ? '#f87171' : '#d21f1f',
    success: isDark ? '#34d399' : '#047857',
    warning: isDark ? '#fbbf24' : '#b45309',
    info: isDark ? '#60a5fa' : '#1d4ed8',
    errorSoft: isDark ? 'rgba(248, 113, 113, 0.14)' : 'rgba(210, 31, 31, 0.1)',
    successSoft: isDark ? 'rgba(52, 211, 153, 0.14)' : 'rgba(4, 120, 87, 0.1)',
    warningSoft: isDark ? 'rgba(251, 191, 36, 0.16)' : 'rgba(180, 83, 9, 0.1)',
    infoSoft: isDark ? 'rgba(96, 165, 250, 0.14)' : 'rgba(29, 78, 216, 0.08)',
    focusRing: isDark ? '#93c5fd' : '#2563eb',

    // Components
    card: surfaces.level1,
    border: isDark ? '#3b3e4b' : '#d7d9e2',
    borderStrong: isDark ? '#4b4f60' : '#b9bdca',
    divider: isDark ? '#30333f' : '#e1e2e8',
    skeleton: isDark ? '#262938' : '#e6e8ef',

    // Inputs
    inputBackground: isDark ? '#232532' : '#ffffff',
    inputBorder: isDark ? '#3b3e4b' : '#cfd2dd',
    inputText: isDark ? '#e9e9ed' : '#171925',

    // Alerts/Modals
    alertBackground: isDark ? palette.slate[800] : '#ffffff',
    alertText: isDark ? palette.slate[50] : palette.slate[900],
    alertInputBackground: isDark ? palette.slate[900] : palette.slate[50],
    alertInputText: isDark ? palette.slate[50] : palette.slate[900],
    alertInputPlaceholder: isDark ? palette.slate[500] : palette.slate[400],

    // System
    statusBar: isDark ? 'light-content' : 'dark-content',
    navigationBar: surfaces.level0,
    splashBackground: surfaces.level0,

    // Controls
    switchTrackOn: palette.primary[500],
    switchTrackOff: isDark ? palette.slate[600] : palette.slate[300],
    switchThumbOn: '#ffffff',
    switchThumbOff: '#ffffff',

    // Chips/Tags
    chipBackground: isDark ? 'rgba(96, 165, 250, 0.12)' : '#eff6ff',
    chipBorder: isDark ? 'rgba(96, 165, 250, 0.45)' : '#bfdbfe',
    chipText: isDark ? '#dbeafe' : '#1e40af',
    chipSelectedBackground: palette.primary[500],
    chipSelectedText: onPrimary,

    // Lists
    listItemBackground: isDark ? '#1c1f30' : '#ffffff',
    listItemSelected: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',

    // Elevation (Manual override)
    elevated: surfaces.level2,
  };

  return {
    mode,
    isDark,
    colors,
    surfaces,
    gradients,
    fonts: baseFonts,
    typography,
    spacing,
    borderRadius,
    radii: borderRadius,
    shadows,
    elevation: shadows,
    layout,
    motion,
    iconSizes,
    stateLayer,
    accessibility,
    components: {
      heights: componentHeights,
      focusRing: `0 0 0 3px ${palette.primary[500]}40`,
    },
    zIndex,
  };
};

export const DarkTheme = createTheme('dark');
export const LightTheme = createTheme('light');
export const AppTheme = DarkTheme; // Default export

export type Theme = typeof AppTheme;
export { palette };
