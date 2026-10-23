# Design System

Keysoft uses a mobile-first design system ("Nocturne v2") for the Android app. It
defines the visual language, the type and spacing scales, the responsive window
classes and the rules that keep screens consistent across phones, foldables,
split view, tablets and the development web target.

The tokens are the contract. Screens should consume semantic tokens and shared
primitives instead of hard-coded sizes, colors or per-screen breakpoints.

## Files

| File                               | Responsibility                                                        |
| ---------------------------------- | --------------------------------------------------------------------- |
| `src/constants/layout.ts`          | Window size classes, gutters, content widths, touch targets.          |
| `src/constants/theme.ts`           | Semantic light/dark themes, type scale, spacing, radii, elevation.     |
| `src/constants/designSystem.ts`    | Consumer-facing token bundle and the `DesignSystem.text()` helper.     |
| `src/utils/responsive.ts`          | `resolveLayout()` and `useResponsiveLayout()` for responsive screens.  |
| `src/components/ScreenWrapper.tsx` | Owns the horizontal gutter, centered content width and lateral insets. |
| `src/components/ui/*`              | Shared Dialog, BottomSheet, Toast, ListItem, keypad and motion rules.  |

## Principles

1. **Content first.** Calm neutral surfaces, one blue accent and generous
   spacing; no decorative layers that compete with credentials or PIN entry.
2. **Mobile-first, adaptive.** Layouts scale by window size class, not by
   device brand. Touch, typography and spacing stay comfortable on compact
   phones and do not stretch into unreadable lines on tablets.
3. **Semantic tokens.** A screen asks for `textSecondary` or `error`, never for
   a literal hex value. Both themes keep the same token names.
4. **Accessible by default.** Interactive targets are at least 44pt (48pt for
   primary controls), text pairs meet WCAG AA contrast and motion honors the
   reduced-motion preference.
5. **One primitive per job.** Dialogs, bottom sheets and toasts come from
   `src/components/ui`; screens do not build parallel modal implementations.

## Colors

`theme.colors` exposes semantic roles in both light and dark mode. The palette
is validated by unit tests (`src/__tests__/design-system`):

- Text: `text`, `textSecondary`, `textTertiary` (all ≥ 4.5:1 on the app
  background), `textDisabled` and `textLight`/`textDark` for fixed surfaces.
- Primary: `primary`, `primaryLight`, `primaryDark`, `onPrimary`,
  `primaryContainer`, `onPrimaryContainer`. Primary-filled controls use
  `onPrimary`, never plain white: in dark mode the accent is light and white
  text would fail contrast.
- Surfaces: `background`, `backgroundElevated`, `backgroundMuted`,
  `backgroundSunken`, `surfaceMuted`, `card`, `elevated` plus
  `theme.surfaces.level0..level3` and `surfaces.overlay`.
- Status: `error`, `success`, `warning`, `info` are mode-specific and pass
  normal-text contrast; `errorSoft`/`successSoft`/`warningSoft`/`infoSoft` are
  the matching low-emphasis backgrounds.
- Lines and controls: `border`, `borderStrong`, `divider`, `inputBackground`,
  `inputBorder`, `inputText`, `chip*`, `switch*`, `focusRing`.

Do not add literal colors in screens. Domain palettes (category colors, note
colors, password-strength colors) are data, not UI chrome, and stay in their
constants modules.

## Typography

`DesignSystem.text(variant, color?)` returns a valid React Native text style.
It is the only supported way to consume the type scale; the raw token stores
`size`/`weight` and must not be spread into styles.

| Variant      | Size / line height | Weight | Typical use                          |
| ------------ | ------------------ | ------ | ------------------------------------ |
| `display`    | 32 / 40            | 700    | Empty states and hero numbers.       |
| `headline`   | 26 / 32            | 600    | Auth welcome, large section titles.  |
| `titleLarge` | 22 / 28            | 600    | Screen headers.                      |
| `title`      | 20 / 28            | 600    | Dialog and sheet titles.             |
| `subtitle`   | 18 / 24            | 600    | Card headings, empty-state title.    |
| `body`       | 16 / 24            | 400    | Long-form body text.                 |
| `bodySmall`  | 14 / 20            | 400    | Dense lists and secondary content.   |
| `label`      | 14 / 20            | 500    | Form labels, list titles.            |
| `labelSmall` | 12 / 16            | 500    | Chips and compact metadata labels.   |
| `caption`    | 12 / 16            | 400    | Helper text, timestamps.             |
| `micro`      | 11 / 14            | 500    | Uppercase overlines and legal meta.  |
| `button`     | 15 / 20            | 600    | Primary/secondary button labels.     |

`DesignSystem.fonts.secure` stays available for secret/password rendering and
`DesignSystem.fonts.main` is the system UI family.

## Spacing, Radii, Elevation, Motion

- **Spacing** is a 4pt grid: `xxs 2`, `xs 4`, `s 8`, `m 12`, `l 16`, `xl 24`,
  `xxl 32`, `xxxl 48`, `huge 64`. Use `none` for explicit zero.
- **Radii**: `xs 6`, `small 8`, `medium 12`, `large 16`, `xl 20`, `xxl 28`,
  `pill 999`. Cards use `large`, sheets use `xxl` on the top edge, controls use
  `medium`.
- **Elevation**: `theme.shadows.small|medium|large` (plus the `elevation`
  alias) for cards, sheets and dialogs. Prefer borders and tonal surfaces over
  heavy shadows.
- **Motion**: `DesignSystem.motion.durations` (`fastest 80` … `long 320`) and
  `DesignSystem.motion.easing`. All entering/exiting motion must be skipped or
  reduced when `usePrefersReducedMotion()` is true.

## Layout And Responsiveness

`src/constants/layout.ts` defines the window size classes shared by the theme
and the responsive hook:

| Class      | Width (dp) | Columns | Gutter | Content max width | Header |
| ---------- | ---------- | ------- | ------ | ----------------- | ------ |
| `compact`  | 0–599      | 1       | 16     | ∞                 | 56     |
| `medium`   | 600–839    | 2       | 24     | 720               | 64     |
| `expanded` | 840–1199   | 2       | 32     | 960               | 64     |
| `large`    | 1200+      | 3       | 32     | 1120              | 72     |

Rules:

- `ScreenWrapper` owns the horizontal gutter, the centered content width and the
  lateral safe-area insets. Screens must not add their own horizontal padding
  or `Math.min(width - padding * 2, N)` width constraints on the root.
- `useResponsiveLayout()` returns the resolved layout: `windowClass`,
  `columns`, `gridGap`, `gutter`, `maxContentWidth`, `minTouchTarget`,
  `headerHeight`, plus booleans `isCompact`, `isMedium`, `isExpanded`,
  `isLarge`, `isLandscape`, `isShortLandscape`, `isSplitView` and
  `isLargeText`. Prefer these over manual `Dimensions` logic.
- Short landscape phones reduce vertical chrome and use compact paddings.
  Split-view/foldable windows use the medium class, so list grids become 2
  columns and forms stay readable.
- Large text (font scale ≥ 1.3) is exposed as `isLargeText` for screens that
  need to relax fixed heights.
- Use `useResponsiveValue({ compact, medium, expanded, large })` when a single
  value depends on the class.
- Text-heavy and form screens (vault detail, note detail/edit, notes, generator,
  settings, vault health, privacy, open source) cap the wrapper at
  `DesignSystem.layout.maxReadableWidth` (720). Home keeps the wider 960 grid
  because it renders cards, not prose.
- List-grid cells must fill their column: wrap the item with `flex: 1` and
  `maxWidth: ${100 / columns}%`, otherwise a two- or three-column FlatList
  renders cards at their intrinsic width.
- Every hairline or border must declare its color. React Native defaults a
  missing border color to black, which shows as dark separator lines on the
  dark theme. Use `theme.colors.divider` for separators and
  `theme.colors.border` for control outlines.

Legacy helpers (`getDeviceType`, `getGridColumns`, `responsiveValue`,
`scaleSize`, `horizontalPadding`) remain exported for older screens, but new
code uses the resolved layout fields.

## Components And Interaction

- Minimum touch target: 44×44 dp; primary controls and icon buttons are 48×48
  (`DesignSystem.layout.touchTarget`). Icon-only controls always carry an
  `accessibilityLabel` and an `accessibilityRole`.
- `Dialog` is the only confirmation/blocking-loading surface; it is responsive
  (420–600 wide by class), uses `onPrimary` text and 48pt actions. Its header is
  stacked: icon above the title, with title and description centered and
  wrapping the full dialog width; the close control is a 48pt button pinned to
  the top-right corner.
- `BottomSheet` is the only selection/contextual surface; it centers at 560–680
  width on larger windows and uses a modal `accessibilityViewIsModal` layer.
  Close a sheet before opening a dialog (no competing native modals).
- `Toast` is for transient success/info feedback; it never blocks and stays
  pointer-transparent through `style.pointerEvents`.
- `ListItem` is a 56pt row; `card` variant uses the `large` radius and the
  elevated surface.
- `PasswordCard` is a 72pt tile with a 48pt clipboard action and a strength
  dot; grids keep `gridGap` spacing.
- Use the shared `src/components/ui/switch` wrapper instead of importing
  React Native's `Switch` directly: it applies the theme track/thumb colors and
  the web `activeThumbColor` override consistently.
- Text inputs, buttons and segmented controls use the `md`/`lg` component
  heights from `DesignSystem.components.heights`.

## Accessibility

- Text contrast target: 4.5:1 for normal text, 3:1 for large text and icons.
  The color tokens are unit-tested against these targets.
- Do not hard-code `fontSize`; the type scale plus platform font scaling keeps
  Dynamic Type usable. Dense chrome may cap scaling with
  `maxFontSizeMultiplier` from `DesignSystem.accessibility`.
- All motion must respect reduced motion. Animations use opacity/transform only.
- Selection, disabled and pressed states must be exposed through
  `accessibilityState`.
- Verify layouts at compact phone, short landscape, medium split view and
  expanded/tablet widths, in light and dark mode.

## Testing

- `src/__tests__/design-system/DesignSystem.test.ts` checks token completeness,
  spacing/radius scales, contrast ratios, type scale and layout metrics.
- `src/__tests__/design-system/ResponsiveLayout.test.ts` checks
  `resolveLayout()` for every window class, landscape variants and text scale.
- `src/__tests__/compatibility/Responsive.test.tsx` keeps the legacy helper
  behavior covered.
