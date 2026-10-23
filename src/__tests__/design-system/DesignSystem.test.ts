import {
  DIALOG_MAX_WIDTH,
  LAYOUT,
  MODAL_MAX_WIDTH,
  TOUCH_TARGET,
  WINDOW_METRICS,
  WINDOW_SIZE_CLASSES,
} from '../../constants/layout';
import { DesignSystem, textStyle } from '../../constants/designSystem';
import { DarkTheme, LightTheme } from '../../constants/theme';

function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const channels = [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('design system tokens', () => {
  it('keeps the spacing scale on the 4pt grid and strictly increasing', () => {
    const values = Object.values(DesignSystem.spacing);
    expect(DesignSystem.spacing.s).toBe(8);
    expect(DesignSystem.spacing.m).toBe(12);
    expect(DesignSystem.spacing.l).toBe(16);
    expect(DesignSystem.spacing.xl).toBe(24);

    const ordered = values.filter((value) => value > 0).sort((a, b) => a - b);
    expect(new Set(ordered).size).toBe(ordered.length);
    ordered.forEach((value) => expect(value % 2).toBe(0));
  });

  it('keeps the radius scale increasing and non-negative', () => {
    const values = Object.values(DesignSystem.radii);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    values.forEach((value) => expect(value).toBeGreaterThanOrEqual(0));
  });

  it('provides a readable type scale', () => {
    const variants = Object.entries(DesignSystem.typography);
    expect(variants.length).toBeGreaterThanOrEqual(10);

    variants.forEach(([, token]) => {
      expect(token.size).toBeGreaterThanOrEqual(11);
      expect(token.lineHeight).toBeGreaterThanOrEqual(token.size);
      expect(['400', '500', '600', '700']).toContain(token.weight);
    });

    expect(DesignSystem.typography.body.size).toBe(16);
    expect(DesignSystem.typography.caption.size).toBe(12);
  });

  it('exposes a valid text style helper', () => {
    expect(textStyle('body')).toEqual({
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400',
      letterSpacing: 0,
    });
    expect(textStyle('title', '#123456')).toMatchObject({ fontSize: 20, color: '#123456' });
  });

  it('keeps touch targets at accessible sizes', () => {
    expect(TOUCH_TARGET.minimum).toBeGreaterThanOrEqual(44);
    expect(TOUCH_TARGET.comfortable).toBeGreaterThanOrEqual(48);
    expect(DesignSystem.layout.touchTarget.comfortable).toBeGreaterThanOrEqual(48);
    expect(LAYOUT.listItemMinHeight).toBeGreaterThanOrEqual(44);
  });

  it('defines ordered breakpoints and monotonic layout metrics', () => {
    const widths = WINDOW_SIZE_CLASSES.map((sizeClass) => WINDOW_METRICS[sizeClass].gutter);
    expect(widths).toEqual([16, 24, 32, 32]);

    const contentMaxWidths = WINDOW_SIZE_CLASSES.map(
      (sizeClass) => WINDOW_METRICS[sizeClass].contentMaxWidth,
    );
    expect(contentMaxWidths).toEqual([Infinity, 720, 960, 1120]);

    const columns = WINDOW_SIZE_CLASSES.map((sizeClass) => WINDOW_METRICS[sizeClass].columns);
    expect(columns).toEqual([1, 2, 2, 3]);

    const dialogWidths = WINDOW_SIZE_CLASSES.map((sizeClass) => DIALOG_MAX_WIDTH[sizeClass]);
    expect(dialogWidths).toEqual([...dialogWidths].sort((a, b) => a - b));
    const modalWidths = WINDOW_SIZE_CLASSES.map((sizeClass) => MODAL_MAX_WIDTH[sizeClass]);
    expect(modalWidths).toEqual([...modalWidths].sort((a, b) => a - b));
  });

  it('ships identical semantic color roles in both themes', () => {
    expect(Object.keys(LightTheme.colors).sort()).toEqual(Object.keys(DarkTheme.colors).sort());
  });

  it.each([
    ['text', 'background'],
    ['textSecondary', 'background'],
    ['textTertiary', 'background'],
    ['textTertiary', 'backgroundElevated'],
    ['error', 'background'],
    ['success', 'background'],
    ['warning', 'background'],
    ['info', 'background'],
    ['onPrimary', 'primary'],
  ] as const)('meets WCAG AA contrast for %s on %s in both themes', (foreground, background) => {
    [LightTheme, DarkTheme].forEach((theme) => {
      const ratio = contrast(theme.colors[foreground], theme.colors[background]);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
