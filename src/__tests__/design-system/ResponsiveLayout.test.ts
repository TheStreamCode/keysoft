import { BREAKPOINTS } from '../../constants/layout';
import { resolveLayout } from '../../utils/responsive';

describe('resolveLayout', () => {
  it('resolves a compact phone', () => {
    const layout = resolveLayout(375, 812);

    expect(layout.windowClass).toBe('compact');
    expect(layout.deviceType).toBe('phone');
    expect(layout.columns).toBe(1);
    expect(layout.gutter).toBe(16);
    expect(layout.maxContentWidth).toBe(Infinity);
    expect(layout.contentWidth).toBe(375);
    expect(layout.minTouchTarget).toBe(44);
    expect(layout.isCompact).toBe(true);
    expect(layout.isShortLandscape).toBe(false);
    expect(layout.isSplitView).toBe(false);
  });

  it('resolves a medium split-view window with two columns', () => {
    const layout = resolveLayout(800, 500);

    expect(layout.windowClass).toBe('medium');
    expect(layout.columns).toBe(2);
    expect(layout.gutter).toBe(24);
    expect(layout.maxContentWidth).toBe(720);
    expect(layout.contentWidth).toBe(720);
    expect(layout.minTouchTarget).toBe(48);
    expect(layout.isLandscape).toBe(true);
    expect(layout.isSplitView).toBe(true);
  });

  it('resolves an expanded tablet window', () => {
    const layout = resolveLayout(1024, 768);

    expect(layout.windowClass).toBe('expanded');
    expect(layout.columns).toBe(2);
    expect(layout.gutter).toBe(32);
    expect(layout.maxContentWidth).toBe(960);
    expect(layout.isExpanded).toBe(true);
    expect(layout.isTablet).toBe(true);
  });

  it('resolves a large window with three columns', () => {
    const layout = resolveLayout(1280, 800);

    expect(layout.windowClass).toBe('large');
    expect(layout.columns).toBe(3);
    expect(layout.maxContentWidth).toBe(1120);
    expect(layout.headerHeight).toBe(72);
    expect(layout.isTV).toBe(true);
  });

  it('detects short landscape phones', () => {
    const layout = resolveLayout(800, 360);

    expect(layout.isLandscape).toBe(true);
    expect(layout.isShortLandscape).toBe(true);
  });

  it('flags large accessibility text', () => {
    expect(resolveLayout(375, 812, 1).isLargeText).toBe(false);
    expect(resolveLayout(375, 812, 1.3).isLargeText).toBe(true);
  });

  it('exposes the canonical breakpoints', () => {
    expect(BREAKPOINTS).toEqual({ compact: 0, medium: 600, expanded: 840, large: 1200 });
  });
});
