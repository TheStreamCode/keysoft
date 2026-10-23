import { Dimensions, PixelRatio, Platform, useWindowDimensions } from 'react-native';

import { BREAKPOINTS, WINDOW_METRICS, type WindowSizeClass } from '../constants/layout';

/**
 * Responsive helpers for the Keysoft design system.
 *
 * `resolveLayout` is a pure function so window size classes can be unit tested
 * without mounting a component. `useResponsiveLayout` is the hook screens use.
 */
export { BREAKPOINTS };
export type { WindowSizeClass };

export type DeviceType = 'phone' | 'tablet' | 'tv';
export type Orientation = 'portrait' | 'landscape';

interface WindowDimensions {
  width: number;
  height: number;
}

export function getWindowDimensions(): WindowDimensions {
  const { width, height } = Dimensions.get('window');
  return { width, height };
}

export function getScreenDimensions(): WindowDimensions {
  const { width, height } = Dimensions.get('screen');
  return { width, height };
}

export function getWindowSizeClass(width: number): WindowSizeClass {
  if (width >= BREAKPOINTS.large) return 'large';
  if (width >= BREAKPOINTS.expanded) return 'expanded';
  if (width >= BREAKPOINTS.medium) return 'medium';
  return 'compact';
}

/**
 * Legacy device category. Kept for callers that only need a coarse bucket:
 * compact -> phone, medium/expanded -> tablet, large -> tv.
 */
export function getDeviceTypeForWidth(width: number): DeviceType {
  if (width >= BREAKPOINTS.large) return 'tv';
  if (width >= BREAKPOINTS.medium) return 'tablet';
  return 'phone';
}

export function getDeviceType(): DeviceType {
  return getDeviceTypeForWidth(getWindowDimensions().width);
}

export interface ResponsiveLayout {
  width: number;
  height: number;
  fontScale: number;
  windowClass: WindowSizeClass;
  deviceType: DeviceType;
  orientation: Orientation;
  isCompact: boolean;
  isMedium: boolean;
  isExpanded: boolean;
  isLarge: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isTV: boolean;
  isTabletOrLarger: boolean;
  isLargeScreen: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  /** Short landscape phone: reduces vertical chrome and uses wider layouts. */
  isShortLandscape: boolean;
  /** Narrow split-view / foldable window (medium width, landscape). */
  isSplitView: boolean;
  /** The user is running with a large accessibility font size. */
  isLargeText: boolean;
  columns: number;
  gridGap: number;
  gutter: number;
  horizontalPadding: number;
  contentWidth: number;
  maxContentWidth: number;
  minTouchTarget: number;
  headerHeight: number;
}

/** Pure resolver used by the hook and by tests. */
export function resolveLayout(width: number, height: number, fontScale = 1): ResponsiveLayout {
  const windowClass = getWindowSizeClass(width);
  const metrics = WINDOW_METRICS[windowClass];
  const deviceType = getDeviceTypeForWidth(width);
  const isLandscape = width > height;
  const isLargeText = fontScale >= 1.3;
  const minTouchTarget = windowClass === 'compact' ? 44 : 48;

  return {
    width,
    height,
    fontScale,
    windowClass,
    deviceType,
    orientation: isLandscape ? 'landscape' : 'portrait',
    isCompact: windowClass === 'compact',
    isMedium: windowClass === 'medium',
    isExpanded: windowClass === 'expanded',
    isLarge: windowClass === 'large',
    isPhone: deviceType === 'phone',
    isTablet: deviceType === 'tablet',
    isTV: deviceType === 'tv',
    isTabletOrLarger: deviceType !== 'phone',
    isLargeScreen: windowClass !== 'compact',
    isLandscape,
    isPortrait: !isLandscape,
    isShortLandscape: isLandscape && height < 480,
    isSplitView: isLandscape && width >= BREAKPOINTS.medium && width < BREAKPOINTS.expanded,
    isLargeText,
    columns: metrics.columns,
    gridGap: metrics.itemGap,
    gutter: metrics.gutter,
    horizontalPadding: metrics.gutter,
    contentWidth: Math.min(width, metrics.contentMaxWidth),
    maxContentWidth: metrics.contentMaxWidth,
    minTouchTarget,
    headerHeight: metrics.headerHeight,
  };
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height, fontScale } = useWindowDimensions();
  return resolveLayout(width, height, fontScale);
}

/**
 * Pick a value for the current window size class, falling back to `compact`.
 * Example: `useResponsiveValue({ compact: 16, medium: 24, expanded: 32 })`.
 */
export function useResponsiveValue<T>(
  values: { compact: T } & Partial<Record<WindowSizeClass, T>>,
) {
  const { windowClass } = useResponsiveLayout();
  return values[windowClass] ?? values.compact;
}

export function isPhone(): boolean {
  return getDeviceType() === 'phone';
}

export function isTablet(): boolean {
  return getDeviceType() === 'tablet';
}

export function isTV(): boolean {
  return getDeviceType() === 'tv' || Platform.isTV;
}

export function isTabletOrLarger(): boolean {
  const deviceType = getDeviceType();
  return deviceType === 'tablet' || deviceType === 'tv';
}

export function getOrientation(): Orientation {
  const { width, height } = getWindowDimensions();
  return width > height ? 'landscape' : 'portrait';
}

export function isLandscape(): boolean {
  return getOrientation() === 'landscape';
}

export function isPortrait(): boolean {
  return getOrientation() === 'portrait';
}

/**
 * Legacy responsive value helper.
 * Maps phone -> compact, tablet -> medium/expanded, tv -> large.
 */
export function responsiveValue<T>(values: { phone: T; tablet?: T; tv?: T }): T {
  const deviceType = getDeviceType();

  if (deviceType === 'tv' && values.tv !== undefined) {
    return values.tv;
  }
  if (deviceType === 'tablet' && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.phone;
}

/**
 * Legacy size scaling. The new design system prefers tokens over percentage
 * scaling; this helper stays for backward compatibility.
 */
export function scaleSize(size: number): number {
  const deviceType = getDeviceType();

  switch (deviceType) {
    case 'tv':
    case 'tablet':
      return size * 1.3;
    default:
      return size;
  }
}

export function getPixelRatio(): number {
  return PixelRatio.get();
}

export function dpToPx(dp: number): number {
  return PixelRatio.getPixelSizeForLayoutSize(dp);
}

export function pxToDp(px: number): number {
  return px / PixelRatio.get();
}

/** Legacy grid columns helper. The design-system value is `layout.columns`. */
export function getGridColumns(): number {
  return responsiveValue({ phone: 1, tablet: 2, tv: 2 });
}

/** Legacy content width helper. The design-system value is `layout.maxContentWidth`. */
export function getMaxContentWidth(): number {
  const deviceType = getDeviceType();

  switch (deviceType) {
    case 'tv':
    case 'tablet':
      return 1180;
    default:
      return Infinity;
  }
}

/** Legacy screen padding helper. The design-system value is `layout.gutter`. */
export function getScreenPadding(): number {
  return responsiveValue({ phone: 16, tablet: 32, tv: 32 });
}

export function isSmallScreen(): boolean {
  return getWindowDimensions().width < 375;
}

export function isLargeScreen(): boolean {
  return getWindowDimensions().width >= BREAKPOINTS.medium;
}
