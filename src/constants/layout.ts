/**
 * Canonical layout metrics for the Keysoft mobile design system.
 *
 * Single source of truth shared by the theme tokens and `useResponsiveLayout`.
 * Based on Material 3 window size classes, adapted to an Android-first password
 * manager (compact phones, foldables, split view, tablets, landscape phones and
 * the development web target).
 */
export const BREAKPOINTS = {
  compact: 0,
  medium: 600,
  expanded: 840,
  large: 1200,
} as const;

export type WindowSizeClass = keyof typeof BREAKPOINTS;

export const WINDOW_SIZE_CLASSES: readonly WindowSizeClass[] = [
  'compact',
  'medium',
  'expanded',
  'large',
];

export interface WindowClassMetrics {
  /** Number of columns for card/list grids. */
  columns: number;
  /** Screen edge padding and section gutter. */
  gutter: number;
  /** Maximum width of centered content. */
  contentMaxWidth: number;
  /** Gap between grid items. */
  itemGap: number;
  /** Minimum height of a top bar / header row. */
  headerHeight: number;
}

export const WINDOW_METRICS: Record<WindowSizeClass, WindowClassMetrics> = {
  compact: { columns: 1, gutter: 16, contentMaxWidth: Infinity, itemGap: 12, headerHeight: 56 },
  medium: { columns: 2, gutter: 24, contentMaxWidth: 720, itemGap: 16, headerHeight: 64 },
  expanded: { columns: 2, gutter: 32, contentMaxWidth: 960, itemGap: 20, headerHeight: 64 },
  large: { columns: 3, gutter: 32, contentMaxWidth: 1120, itemGap: 20, headerHeight: 72 },
};

export const TOUCH_TARGET = {
  /** Accessibility minimum from the platform guidelines. */
  minimum: 44,
  /** Comfortable target used by primary controls. */
  comfortable: 48,
  large: 56,
} as const;

export const LAYOUT = {
  maxReadableWidth: 720,
  maxFormWidth: 560,
  maxAuthWidth: 480,
  maxConfirmationWidth: 420,
  maxToastWidth: 480,
  listItemMinHeight: 56,
  hairline: 1,
} as const;

export const DIALOG_MAX_WIDTH: Record<WindowSizeClass, number> = {
  compact: 420,
  medium: 480,
  expanded: 560,
  large: 600,
};

export const MODAL_MAX_WIDTH: Record<WindowSizeClass, number> = {
  compact: 560,
  medium: 600,
  expanded: 640,
  large: 680,
};
