import { Dimensions, Platform, PixelRatio } from 'react-native';

/**
 * Breakpoints for responsive design
 * Based on common device categories
 */
export const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  tv: 1280,
} as const;

/**
 * Get current window dimensions
 */
interface WindowDimensions {
  width: number;
  height: number;
}

export function getWindowDimensions(): WindowDimensions {
  const { width, height } = Dimensions.get('window');
  return { width, height };
}

/**
 * Get current screen dimensions (including status bar, navigation bar, etc.)
 */
export function getScreenDimensions(): WindowDimensions {
  const { width, height } = Dimensions.get('screen');
  return { width, height };
}

/**
 * Determine device type based on screen width
 */
export type DeviceType = 'phone' | 'tablet' | 'tv';

export function getDeviceType(): DeviceType {
  const { width } = getWindowDimensions();

  if (width >= BREAKPOINTS.tv) {
    return 'tv';
  }

  if (width >= BREAKPOINTS.tablet) {
    return 'tablet';
  }

  return 'phone';
}

/**
 * Check if device is a phone
 */
export function isPhone(): boolean {
  return getDeviceType() === 'phone';
}

/**
 * Check if device is a tablet
 */
export function isTablet(): boolean {
  return getDeviceType() === 'tablet';
}

/**
 * Check if device is a TV
 */
export function isTV(): boolean {
  return getDeviceType() === 'tv' || Platform.isTV;
}

/**
 * Check if device is tablet or larger
 */
export function isTabletOrLarger(): boolean {
  const deviceType = getDeviceType();
  return deviceType === 'tablet' || deviceType === 'tv';
}

/**
 * Get orientation
 */
export type Orientation = 'portrait' | 'landscape';

export function getOrientation(): Orientation {
  const { width, height } = getWindowDimensions();
  return width > height ? 'landscape' : 'portrait';
}

/**
 * Check if orientation is landscape
 */
export function isLandscape(): boolean {
  return getOrientation() === 'landscape';
}

/**
 * Check if orientation is portrait
 */
export function isPortrait(): boolean {
  return getOrientation() === 'portrait';
}

/**
 * Responsive value based on device type
 * Returns different values for phone, tablet, and TV
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
 * Scale size based on device type
 * Useful for fonts, spacing, etc.
 * TV usa lo stesso scaling del tablet per consistenza visiva
 */
export function scaleSize(size: number): number {
  const deviceType = getDeviceType();

  switch (deviceType) {
    case 'tv':
      return size * 1.3; // TV usa stesso scaling del tablet
    case 'tablet':
      return size * 1.3; // 30% larger for tablet
    default:
      return size;
  }
}

/**
 * Get pixel ratio
 */
export function getPixelRatio(): number {
  return PixelRatio.get();
}

/**
 * Convert dp to px
 */
export function dpToPx(dp: number): number {
  return PixelRatio.getPixelSizeForLayoutSize(dp);
}

/**
 * Convert px to dp
 */
export function pxToDp(px: number): number {
  return px / PixelRatio.get();
}

/**
 * Get number of columns for grid layout
 * TV uses the same two-column layout as tablets for better usability
 */
export function getGridColumns(): number {
  return responsiveValue({
    phone: 1,
    tablet: 2,
    tv: 2, // TV usa layout tablet
  });
}

/**
 * Get max width for content container
 * Prevents content from being too wide on large screens
 * TV uses the same width as tablets for better readability
 */
export function getMaxContentWidth(): number {
  const deviceType = getDeviceType();

  switch (deviceType) {
    case 'tv':
      return 1024; // TV usa larghezza tablet (layout fisso centrato)
    case 'tablet':
      return 1024; // Max width for tablet
    default:
      return Infinity; // No limit for phone
  }
}

/**
 * Get horizontal padding for screen content
 * TV usa lo stesso padding del tablet
 */
export function getScreenPadding(): number {
  return responsiveValue({
    phone: 16,
    tablet: 32,
    tv: 32, // TV usa stesso padding del tablet
  });
}

/**
 * Check if screen is small (width < 375)
 */
export function isSmallScreen(): boolean {
  const { width } = getWindowDimensions();
  return width < 375;
}

/**
 * Check if screen is large (width >= tablet breakpoint)
 */
export function isLargeScreen(): boolean {
  const { width } = getWindowDimensions();
  return width >= BREAKPOINTS.tablet;
}
