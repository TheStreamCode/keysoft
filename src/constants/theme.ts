import { Platform } from 'react-native';

// === Palette ==============================================================
// Modern Color Palette (Tailwind-inspired Slate & Blue)
const palette = {
  // Brand Colors (Safety Blue)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Main Brand Light
    600: '#2563eb', // Main Brand Dark
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  // Accent (Teal/Emerald for Security)
  accent: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },
  // Neutrals (Slate - Cool Gray with Blue undertones)
  slate: {
    25: '#fcfcfc',
    50: '#f8fafc', // Light Bg
    100: '#f1f5f9', // Light Surface
    200: '#e2e8f0', // Light Border
    300: '#cbd5e1',
    400: '#94a3b8', // Dark Text Secondary
    500: '#64748b', // Light Text Secondary
    600: '#475569',
    700: '#334155', // Dark Border
    800: '#1e293b', // Dark Surface (Card)
    900: '#0f172a', // Dark Bg
    950: '#020617', // Deep Dark
  },
  success: '#10b981', // Emerald 500
  error: '#ef4444', // Red 500
  warning: '#f59e0b', // Amber 500
  info: '#3b82f6', // Blue 500
};

const baseFonts = {
  main: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  secure: Platform.select({ ios: 'Courier', android: 'monospace', default: 'Courier' }),
  sizes: {
    xsmall: 11,
    small: 13,
    medium: 15,
    large: 17,
    xlarge: 20,
    xxlarge: 24,
    display: 32,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

const typography = {
  display: { size: 32, lineHeight: 40, weight: '700' },
  headline: { size: 24, lineHeight: 32, weight: '600' },
  title: { size: 20, lineHeight: 28, weight: '600' },
  subtitle: { size: 18, lineHeight: 24, weight: '500' },
  body: { size: 16, lineHeight: 24, weight: '400' },
  label: { size: 14, lineHeight: 20, weight: '500' },
  caption: { size: 12, lineHeight: 16, weight: '500' },
  micro: { size: 11, lineHeight: 14, weight: '500' },
};

const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

const borderRadius = {
  small: 8, // Modern standard
  medium: 16, // Smooth cards
  large: 24, // Modals
  pill: 999,
};

const iconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

const layout = {
  contentMaxWidth: 640,
  horizontalGutter: 24,
  sectionGap: 32,
  cardGap: 16,
  breakpoints: {
    phone: 0,
    tablet: 768,
    tv: 1280,
  },
  maxWidths: {
    phone: Infinity,
    tablet: 1024,
    tv: 1024,
  },
  gridColumns: {
    phone: 1,
    tablet: 2,
    tv: 2,
  },
  horizontalPadding: {
    phone: 16,
    tablet: 32,
    tv: 32,
  },
  itemGap: {
    phone: 16,
    tablet: 24,
    tv: 24,
  },
};

const motion = {
  durations: {
    shortest: 150,
    short: 200,
    medium: 300,
    long: 400,
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)', // Material Standard
    emphasized: 'cubic-bezier(0.05, 0.7, 0.1, 1.0)', // Snappy
  },
};

const stateLayer = {
  hover: 0.04,
  focus: 0.12,
  pressed: 0.1,
  dragged: 0.16,
  disabled: 0.38,
};

const componentHeights = {
  button: { sm: 40, md: 48, lg: 56 }, // Standardized touch targets
  input: { sm: 40, md: 48, lg: 56 },
  chip: 32,
  topBar: 64,
};

const zIndex = {
  header: 10,
  floatingAction: 20,
  modal: 30,
  toast: 40,
};

// === Surfaces Definition (The Core of the Look) ===========================

const darkSurfaces = {
  level0: palette.slate[900], // #0f172a - Main Bg (Deep Navy)
  level1: palette.slate[800], // #1e293b - Secondary/Cards
  level2: '#334155', // #334155 - Slate 700 (Elevated/Modals)
  level3: '#475569', // #475569 - Slate 600 (High elevation)
  overlay: 'rgba(15, 23, 42, 0.85)', // Darker overlay
};

const lightSurfaces = {
  level0: palette.slate[50], // #f8fafc - Main Bg (Very light gray, NOT white)
  level1: '#ffffff', // #ffffff - Cards/Surfaces (Pop against gray)
  level2: '#ffffff', // Elevated cards usually keep white with shadow
  level3: '#f1f5f9', // Alternative highlight
  overlay: 'rgba(15, 23, 42, 0.4)', // Slate overlay
};

const gradientsDark = {
  hero: [palette.slate[900], palette.slate[800]],
  accent: [palette.primary[600], palette.accent[500]],
};

const gradientsLight = {
  hero: [palette.slate[50], palette.slate[100]],
  accent: [palette.primary[500], palette.accent[400]],
};

// Modern Shadows (Softer, diffused)
const darkShadows =
  Platform.OS === 'web'
    ? {
        small: { boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.3)', elevation: 2 },
        medium: {
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)',
          elevation: 6,
        },
        large: {
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
          elevation: 12,
        },
      }
    : {
        small: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 2,
          elevation: 2,
        },
        medium: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 6,
        },
        large: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 12,
        },
      };

const lightShadows =
  Platform.OS === 'web'
    ? {
        small: { boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', elevation: 1 },
        medium: {
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          elevation: 3,
        },
        large: {
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          elevation: 10,
        },
      }
    : {
        small: {
          shadowColor: palette.slate[500],
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        },
        medium: {
          shadowColor: palette.slate[600],
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 3,
        },
        large: {
          shadowColor: palette.slate[700],
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.1,
          shadowRadius: 15,
          elevation: 10,
        },
      };

const createTheme = (mode: 'dark' | 'light') => {
  const isDark = mode === 'dark';
  const surfaces = isDark ? darkSurfaces : lightSurfaces;
  const gradients = isDark ? gradientsDark : gradientsLight;
  const shadows = isDark ? darkShadows : lightShadows;

  const colors = {
    // Brand
    primary: isDark ? palette.primary[400] : palette.primary[600], // Lighter in dark mode for contrast
    primaryLight: isDark ? palette.primary[300] : palette.primary[400],
    primaryDark: isDark ? palette.primary[500] : palette.primary[700],

    accent: isDark ? palette.accent[400] : palette.accent[600],
    accentLight: isDark ? palette.accent[300] : palette.accent[500],
    accentDark: isDark ? palette.accent[500] : palette.accent[700],

    // Backgrounds
    background: surfaces.level0, // Main App Background
    backgroundMuted: isDark ? palette.slate[800] : palette.slate[100],
    backgroundLight: isDark ? palette.slate[800] : '#ffffff', // For input fields etc
    backgroundElevated: surfaces.level1, // Cards

    // Typography
    text: isDark ? palette.slate[50] : palette.slate[900], // Main text
    textSecondary: isDark ? palette.slate[400] : palette.slate[500], // Subtitles
    textTertiary: isDark ? palette.slate[500] : palette.slate[400], // Hints
    textLight: '#ffffff',
    textDark: palette.slate[900],

    // Status
    error: palette.error,
    success: palette.success,
    warning: palette.warning,
    info: palette.info,

    // Components
    card: surfaces.level1,
    border: isDark ? palette.slate[700] : palette.slate[200],
    divider: isDark ? palette.slate[800] : palette.slate[200],

    // Inputs
    inputBackground: isDark ? palette.slate[800] : '#ffffff',
    inputBorder: isDark ? palette.slate[600] : palette.slate[300],
    inputText: isDark ? palette.slate[50] : palette.slate[900],

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
    chipBackground: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
    chipBorder: isDark ? 'rgba(96, 165, 250, 0.3)' : '#bfdbfe',
    chipText: isDark ? '#dbeafe' : '#1e40af',
    chipSelectedBackground: palette.primary[500],
    chipSelectedText: '#ffffff',

    // Lists
    listItemBackground: isDark ? palette.slate[800] : '#ffffff',
    listItemSelected: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',

    // Elevation (Manual override)
    elevated: surfaces.level2,
  };

  return {
    colors,
    surfaces,
    gradients,
    fonts: baseFonts,
    typography,
    spacing,
    borderRadius,
    shadows,
    layout,
    motion,
    iconSizes,
    stateLayer,
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
