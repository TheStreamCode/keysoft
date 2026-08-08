# Development Guide

## Environment

Use Bun 1.3.14 and Node.js 22.13 or newer. The package-manager version is pinned in `package.json` and CI.

Install dependencies:

```bash
bun install
```

Keysoft requires no environment variables for local development. `.env.example` records that boundary; `.env*`, `.secrets/`, signing files, and generated native projects stay untracked. Never put credentials in `EXPO_PUBLIC_*` variables because they are bundled into the application. Use EAS secrets and GitHub Actions secrets for external automation credentials.

Start Expo for Expo Go:

```bash
bun run start
```

Open on Android with Expo Go:

```bash
bun run android
```

Use a tunnel when LAN discovery is not reliable:

```bash
bun run start:tunnel
```

Run web:

```bash
bun run web
```

## Verification Commands

Run all checks:

```bash
bun run verify
```

The aggregate command runs formatting checks, TypeScript, ESLint, coverage-enabled Jest tests, and `expo-doctor`. Use `bun run deps:audit` separately to inspect dependency advisories; CI blocks critical findings.

Before requesting an EAS preview build, also validate the Android bundle export:

```bash
bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export
```

Run only tests:

```bash
bun run test
```

Run a focused test file:

```bash
bun run test -- src/__tests__/services/CryptoService.test.ts
```

## Coding Standards

- Use TypeScript strict mode.
- Prefer interfaces for structured data.
- Use functional components and hooks.
- Prefer named exports for services and helpers.
- Keep user-visible strings in the localization dictionaries.
- Do not add fallback UI strings such as `t('key') || 'Fallback'`.
- Keep business logic in `src/services`.
- Keep complex screen orchestration in `src/hooks`.
- Keep feature-specific hooks in lowercase subdirectories, such as `src/hooks/settings`.
- Keep UI in `src/screens` and `src/components`.

## Internationalization

All user-visible strings must use `t('key')`.

When adding a new key:

1. Add it to the Italian dictionary.
2. Add it to the English dictionary.
3. Use named parameters for dynamic values.

Example:

```ts
t('notification_backup_reminder_body', { daysAgo });
```

The i18n regression test in `src/__tests__/i18n` verifies:

- Italian and English dictionaries contain the same keys.
- Translation keys are not duplicated.
- Statically referenced `t('key')` and `this.t('key')` calls exist in both dictionaries.
- Interpolation placeholders such as `{count}` and `{daysAgo}` match across languages.
- Known user-facing fallback strings do not return as hardcoded UI text.

Names that are not localization content, such as route names, icon names, brand names, email addresses, URLs, and technical labels like `AES-256`, can remain literal.

## Security-Sensitive Development

Use `src/utils/cryptoRandom.ts` for randomness.

Do not:

- Persist the encryption key.
- Store plaintext password or note data.
- Log secrets.
- Use `Math.random`.
- Accept imported backup objects without validation.

## Test Placement

| Test type                  | Location                      |
| -------------------------- | ----------------------------- |
| Service unit tests         | `src/__tests__/services`      |
| Context tests              | `src/__tests__/contexts`      |
| Hook tests                 | `src/__tests__/hooks`         |
| Integration tests          | `src/__tests__/integration`   |
| Architecture tests         | `src/__tests__/architecture`  |
| Internationalization tests | `src/__tests__/i18n`          |
| Performance tests          | `src/__tests__/performance`   |
| Compatibility tests        | `src/__tests__/compatibility` |

## Dependency Updates

Use Expo tooling for SDK-aligned native dependencies:

```bash
bunx expo install --fix
```

Then verify:

```bash
bun install --frozen-lockfile
bun run verify
```

Dependabot uses the Bun ecosystem on a weekly schedule and must update both
`package.json` and `bun.lock`. CI never relaxes the lockfile check for automation:
all actors run `bun install --frozen-lockfile`.

Keep Expo-native packages on the versions selected by `expo install`. Major upgrades of Expo, React Native, React, Jest, ESLint, or TypeScript require a coordinated migration and must not be forced through transitive overrides. Remove a direct dependency only after confirming it has no source, configuration, script, or native-plugin consumer and completing the full verification plus Android export.

If `expo-doctor` reports duplicate native modules after a valid dependency update, regenerate `node_modules` and reinstall from the lockfile.

## Documentation And Privacy Synchronization

For significant behavior or release changes, update `README.md`, `CHANGELOG.md`, and the relevant file under `docs/`. Historical release notes under `docs/releases/` remain snapshots and should not be rewritten to describe later behavior.

Each release adds a new `docs/releases/<version>.md` snapshot and synchronizes
`package.json`, `app.config.js`, `CITATION.cff`, `THIRD_PARTY_NOTICES.md`, the README current
release section, and `docs/release.md`. Distinguish the source/GitHub release, EAS build,
Google Play submission, and Play Store publication; none of those states implies the next.

When a change affects permissions, networking, updates, backups, biometrics, clipboard handling, profile images, key derivation, data retention, support contacts, or supported platforms, also review:

- the Italian and English privacy keys in `src/locales/`;
- `PrivacyPolicyScreen.tsx`;
- the localized public Keysoft policy in the Mikesoft website repository;
- the release and privacy regression tests in both repositories.

Use a fixed policy effective date. Do not calculate “last updated” from the device clock, because opening an unchanged notice must not make it appear newly revised.

## Expo Go And Cloud Builds

Day-to-day development uses Expo Go. Do not use local Gradle builds as the default workflow.

Build artifacts are produced on expo.dev through EAS:

```bash
bun run build:android:preview
bun run build:android:production
```

The repository is also linked to EAS Build, and the EAS Workflow `.eas/workflows/build-android-production.yml` can build the Android production app-bundle from GitHub. It is triggered only by a version tag push (`v*`) or manual dispatch to limit build-credit usage; it does not run on every push. iOS remains available only through the explicitly approved cloud-simulator workflow; App Store publication is outside the project workflow.

When publishing an approved release, push and verify `main` first, wait for the GitHub
`Validate` and CodeQL checks, then create the version tag on that exact commit. The tag push
already starts the EAS production workflow; do not also run `bun run
build:android:production` unless the tag-triggered workflow failed to start and a deliberate
replacement build is approved.

Expo Go cannot load custom native modules. Keysoft therefore uses the PBKDF2 KDF fallback in Expo Go and keeps Argon2 for EAS/native builds where `react-native-argon2` is available.

Use Expo Go for development and smoke testing only. Create release-test vaults in an EAS/native build when validating Argon2 behavior. Vault metadata that requires Argon2 (`memory > 0`) must fail with the native-KDF diagnostic if the native module is unavailable; do not reintroduce PBKDF2 fallback for that path.

The `withArgon2ProGuard` config plugin patches the native Argon2 dependency during prebuild and appends ProGuard keep rules for release builds, including `com.poowf.argon2` for `react-native-argon2` v4. When changing the Argon2 dependency or EAS prebuild behavior, verify that the generated Android project still contains those keep rules.

The `withAndroidReleaseOptimization` config plugin switches the generated release build to `proguard-android-optimize.txt` and writes `android.r8.optimizedResourceShrinking=true`. Together with the `expo-build-properties` minify and shrink-resources options, this enables optimized R8 and resource shrinking on the AGP version supported by Expo SDK 57. Its transformations are intentionally fail-fast and must remain covered by the config regression tests.

Google Play may report edge-to-edge or network-bitmap APIs that are present inside React Native, Fresco, or Glide even when application code does not call them. Verify app behavior and the generated native project before changing dependencies. Keysoft profile images are user-selected local files; do not add a network image library unless a measured application workload requires it.

When changing authentication, biometric unlock, KDF behavior, or PIN-change flows, run the focused regression suite before the full checks:

```bash
bun run test -- src/__tests__/services/AuthService.test.ts src/__tests__/services/StorageService.test.ts src/__tests__/services/CryptoService.test.ts src/__tests__/integration/Authentication.test.tsx src/__tests__/hooks/usePinManagement.test.tsx src/__tests__/contexts/AuthContext.test.tsx src/__tests__/config/Argon2ProGuard.test.ts --runInBand
```

EAS build commands upload the project to expo.dev. Run them only after the release checks pass and the upload has been explicitly approved.

## UI And Accessibility Standards

- Use semantic tokens from `ThemeContext`; do not branch on literal background colors or introduce screen-local light/dark palettes.
- Keep main content within responsive bounds from `useResponsiveLayout`, including narrow phones, landscape, tablets, and split-view widths.
- Icon-only controls must have `accessibilityRole`, `accessibilityLabel`, and a stable hit area.
- Interactive targets should be at least 44x44 points.
- Use the shared `Dialog` for alerts and confirmations, `BottomSheet` for selection workflows, and `Toast` for non-blocking feedback. Do not add a parallel modal implementation without a platform requirement.
- Custom modals and bottom sheets must expose modal semantics and keep decorative backdrops inaccessible. Close a bottom sheet before opening a global confirmation dialog.
- Animate only opacity and transforms, and keep `useReducedMotion` behavior intact.
- Category filters and segmented choices should expose selected state.
- User-visible notification content must use localization keys in both Italian and English.
- Keep profile-photo selection temporary until Save. Native photos must be copied into application-owned storage before their URI is written to preferences.

### Visual Regression Matrix

For a significant UI change, verify at least:

- 390x667 and 390x844 phone viewports in light and dark appearance.
- 1024x768 tablet/landscape width and a narrow split-view width.
- Onboarding, PIN unlock, vault, detail/edit, generator, notes, settings, dialogs, bottom sheets, and toasts.
- Original Keysoft shield artwork on onboarding, launcher/adaptive icon, splash, and web favicon.
- Avatar pick, preview, Save, reload, logout, and subsequent login.
- Reduced motion, keyboard avoidance, long Italian/English labels, and icon-only accessibility labels.

## Git Hygiene

- Do not commit local secrets.
- Do not commit generated temporary extraction folders.
- Keep unrelated worktree changes separate.
- Keep GitHub Actions at minimum permissions and pin third-party actions to full commit SHAs.
- Keep `bun.lock` committed and use frozen installs outside intentional dependency updates.
- Run `git diff --check` before handing off changes.
