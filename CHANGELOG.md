# Changelog

All notable project changes are documented here.

## [Unreleased]

## [3.3.0] - 2026-08-01

### Release

- Set the application version to 3.3.0 and aligned the local Android manifest value to versionCode 129. The completed 3.1.0 build 128 was not submitted; EAS remote auto-increment targets build 129 for this production release.

### Security

- Bounded untrusted KDF parameters and backup file, collection, and field sizes to prevent resource-exhaustion during login or import.
- Kept error details out of production logs, cleared backup secrets from UI state, removed temporary export files after sharing, and switched verifier comparisons to the constant-time helper.
- Changed storage mutations to persist before updating the decrypted cache and limited reset to Keysoft-owned AsyncStorage keys.

### Fixed

- Prevented failed preference writes from applying screenshot, auto-lock, or clipboard behavior that was not persisted, and removed a saving state that could leave profile actions disabled.
- Preserved nested preference defaults and returned defensive preference copies so callers cannot mutate the storage cache accidentally.
- Removed the Settings timer that temporarily monkey-patched the global backup-notification method; periodic reminders and explicit import success notifications now retain stable service behavior.
- Removed the fully rendered but hidden legacy Settings tree and its unused styles, plus stale Tailwind, password-counter, and accessibility-hook files.

### Tooling

- Aligned Expo SDK 57 packages, React Native, Jest Expo, and native modules to compatible patch releases; removed four unused direct dependencies and patched the critical transitive `shell-quote` advisory.
- Added one-command verification, coverage-enabled CI tests, dependency auditing, deterministic Bun/Node versions, SHA-pinned GitHub Actions, concurrency limits, timeouts, CODEOWNERS, EditorConfig, and documented environment handling.

### Tests

- Added regression coverage for storage write failures and scoped reset, defensive preferences, KDF bounds, secure random bounds, and backup size limits.

## [3.1.0] - 2026-07-26

### Changed

- Product support now runs over email instead of the shared Mikesoft support page. Settings opens a pre-addressed `mailto:` message to `keysoft@mikesoft.it` and falls back to copying the address when no mail client handles the intent.
- Defined the support address and the Mikesoft site once in `src/constants/contact.ts`. Screens and translated strings no longer keep their own copies of either value.
- Documented data deletion as privacy-policy section 9 (in-app reset, uninstall, device settings) and renumbered the following sections. The instructions now name the real Settings path and describe actual Android and iOS behavior instead of development builds and simulators.
- Tracked the privacy notice as document version 3.1, decoupled from the application build number, so shipping a release no longer requires editing the policy.
- Generated the privacy-section numbering in `PrivacyPolicyScreen` from its heading order, so inserting a section no longer renumbers every translated title in both dictionaries.

### Fixed

- Copied the support address through a clipboard path without the password auto-clear timer, so the address is no longer wiped about a minute after the user asked for it. On iOS that timer clears the clipboard unconditionally, which also destroyed unrelated content copied in the meantime.
- Stopped gating the mail client behind `Linking.canOpenURL`. Starting a URL intent needs no `<queries>` declaration, while `canOpenURL` resolves through `queryIntentActivities` and therefore reports false (or rejects) on Android 11 and later unless the `mailto` scheme is declared, which left the clipboard fallback as the only reachable path.
- Reported clipboard failures in Settings and in the privacy notice as an error toast instead of leaving an unhandled promise rejection.

### Release

- Set application version 3.1.0 and aligned the local Android manifest value to versionCode 127. EAS production builds keep the remote version source and auto-increment from published build 126.
- Aligned `expo-updates` with the patch version required by Expo SDK 57 so `expo-doctor` passes 20 of 20 checks again.

### Documentation

- Updated the public overview, architecture notes, release guide, pre-build review, contributor guide, citation metadata, third-party inventory, and 3.1.0 release notes for the email support path, the data-deletion policy section, and the current verification results.

### Tests

- Added ClipboardService coverage for the non-secret copy path: no auto-clear is scheduled, and a pending clear is dropped once the clipboard no longer holds a secret.
- Tightened the legal regression test. Contact details are asserted against the shared constants instead of markup that could hold a stale copy, the document version is checked in isolation rather than by scanning a whole dictionary, and translated titles must not carry section numbers.

## [3.0.2] - 2026-07-22

### Android

- Enabled release resource shrinking and switched R8 from the compatibility-oriented `proguard-android.txt` defaults to `proguard-android-optimize.txt`.
- Enabled the AGP 8.12 optimized resource shrinker through `android.r8.optimizedResourceShrinking=true` without forcing an unsupported Android Gradle Plugin upgrade outside the Expo SDK 57 / React Native 0.86 toolchain.
- Added a fail-fast Expo config plugin so changes to the generated Gradle template cannot silently disable the optimized R8 configuration.
- Retained the existing Argon2 keep rules required for native password login after minification.

### Google Play

- Documented that the reported edge-to-edge API references originate in React Native compatibility code; Keysoft does not set status or navigation bar colors on Android 15 and later.
- Confirmed that Keysoft does not download profile images from the network. Profile photos use the system picker, local application storage, and the existing React Native image pipeline, so adding another image loader would not remove the Fresco/Glide classes identified by static analysis.

### Release

- Updated the application to version 3.0.2 and aligned the local Android manifest value to versionCode 126.

### Tests

- Added regression coverage for optimized ProGuard selection, unexpected Gradle templates, idempotent resource-shrinker properties, and Expo plugin registration.

## [3.0.1] - 2026-07-22

### Changed

- Completed the Nocturne redesign across onboarding, PIN unlock, vault, credential view/edit, password generator, notes, note detail, settings, and bottom navigation. The new UI uses compact semantic surfaces, responsive content bounds, light/dark palettes, accessible touch targets, reduced-motion-aware entrance transitions, and copy-first credential details.
- Added category-specific colored icons beside every Home vault filter label, including a theme-aware icon for the aggregate view.
- Unified alerts, destructive confirmations, selection sheets, notification history, loading dialogs, and transient feedback under shared Nocturne dialog, bottom-sheet, and toast primitives.
- Restored the original Keysoft shield-and-eye artwork and reused it consistently for launcher, adaptive, splash, web, and onboarding branding.
- Replaced the unlock text field with a dedicated PIN keypad that starts verification immediately after the sixth digit while retaining biometric access and sanitized failure feedback.
- Prepared Keysoft 3.0.1 for Android release and iPhone/iPad cloud-simulator testing with responsive light/dark UI, native-stack navigation, a local vault-health view, and shared Mikesoft support links. App Store publication is not part of the release plan.
- Reduced password-login work by batching storage reads and replacing per-password category migration writes with a single encrypted vault write.
- Relicensed Keysoft under the Apache License 2.0 (`Apache-2.0`) and retained a separate trademark policy for the Keysoft and Mikesoft brands.
- Upgraded to Expo SDK 57 and React Native 0.86. Aligned Expo modules, React Native native dependencies, Jest Expo, and ESLint config through `expo install --fix`; moved Android build settings to supported SDK 57 fields and added tested optional hardware manifest declarations. `expo-doctor` passes 20/20 checks and the Android export completes locally.
- Set application version 3.0.1 and Android versionCode 125. EAS production builds use the remote version source and auto-increment from the previously published build number.
- Aligned the Expo SDK 57 patch releases and `react-native-screens` with the versions required by the installed Expo SDK.

### Fixed

- Removed invalid nested credential actions on web and corrected post-save/delete navigation so the vault refreshes without deprecated or unhandled routes.
- Fixed profile photos disappearing from the unlock, vault, and settings avatars by rendering one shared avatar component and persisting selected image files only when profile changes are saved.
- Removed broad React Native Web CSS overrides that forced every clipped surface to viewport height, restoring compact dialogs and correct nested scrolling.
- Restored the GitHub Sponsors action to the visible compact Settings layout after the redesign left it only in the hidden legacy layout.
- Synchronized the in-app and public Keysoft privacy notices with version 3.0 behavior: fixed effective date, Android distribution and iOS simulator status, Expo Updates technical traffic, Argon2id/PBKDF2 key derivation, camera/photo picker, clipboard, the dedicated Keysoft privacy contact, and user-controlled backups.
- Extended shared dialog overlays beneath the Android navigation bar so loading and confirmation states dim the complete screen.
- Prevented the Vault Health percentage from overflowing on narrow screens and large translations by reserving score space and allowing the summary copy to wrap.

### Documentation

- Updated the public overview, architecture, security model, development standards, iOS testing boundary, publication checklist, release checklist, pre-build review, and 3.0.1 release notes for the completed redesign, privacy-policy synchronization, visible support/sponsorship paths, persistent profile avatar, responsive light/dark behavior, canonical app-icon assets, final responsive fixes, and current verification results.

### Tests

- Suite: 28 suites, 176 tests.
- Added Vault Health coverage for healthy credentials, duplicate empty passwords, and expiry boundaries; completed a mobile-viewport web smoke covering onboarding, credential creation and detail, Vault Health findings and filters, password generation, notes, themes, languages, logout, and PIN login.

## [2.3] - 2026-07-10

### Tooling

- Added Jest preload setup (`jest.preload.js`) to install Expo's global polyfill and provide a no-op `ExpoModulesCoreJSLogger` before jest-expo's bootstrap, preventing async "Cannot log after tests are done" warnings without `--forceExit` or console suppression.
- Upgraded to Expo SDK 56 (React Native 0.85, React 19.2, TypeScript 6). Aligned all `expo-*` packages and compatible native dependencies via `expo install --fix`. `expo-doctor` passes 21/21 checks.
- Migrated `tsconfig.json` path aliases to relative paths (TypeScript 6 deprecates `baseUrl` with non-relative `paths`). Added explicit `types` for jest and node globals.
- Disabled new React Compiler lint rules (`react-hooks/refs`, `react-hooks/set-state-in-effect`, etc.) introduced by `eslint-config-expo` SDK 56; the project does not use the React Compiler yet and these rules would require broad refactoring of existing working code.
- Replaced removed `StyleSheet.absoluteFillObject` with `StyleSheet.absoluteFill` (React Native 0.85). Replaced `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` for TypeScript 6 compatibility.
- Replaced the imperative `NavigationBar.setStyle()` call in `ThemeContext` with the declarative `<NavigationBar style={...} />` component from `expo-navigation-bar`. Configured the `expo-navigation-bar` plugin in `app.config.js` with `enforceContrast: false` so the declarative `style` prop takes effect on three-button navigation bars.
- Removed the unjustified `--forceExit` flag from the test script; `jest --runInBand --detectOpenHandles` exits cleanly without it.
- Dependabot still ignores semver-major updates for Expo SDK, `expo-*`, React Native, and `react-native-*` packages; Expo SDK upgrades require a coordinated manual migration and cannot be handled through automated pull requests.
- Corrected the EAS production workflow definition so the manual `workflow_dispatch` trigger is an empty object, fixing the EAS parser rejection of the previous empty node.

### Release

- Updated application version to 2.3 and Android versionCode to 121.

## 2.2 (versionCode 120)

### Changed

- The settings support entry now links to GitHub Sponsors (`github.com/sponsors/TheStreamCode`) instead of Buy Me a Coffee, relabeled "Sponsor on GitHub" / "Sponsorizza su GitHub" with a heart icon.

### Internationalization

- Device-language detection is now resolved synchronously on the first render, so an Italian device shows Italian from the first frame with no English flash. Italian devices use Italian; every other language falls back to English. The initialization fallback now defers to system detection instead of forcing Italian.
- Removed 492 unreferenced translation keys from the Italian and English dictionaries (generic networking/cloud/sync/upload/file filler plus other unused keys), roughly halving both files from 1065 to 573 keys. No user-facing string changed; the i18n parity, used-key, and placeholder tests still pass.

### Release

- Updated application version to 2.2 and Android versionCode to 120.

### Documentation

- Updated README, release guide, and pre-build review docs for Keysoft 2.2 / Android versionCode 120, and added release notes.

### Tests

- Suite: 22 suites, 158 tests.

## 2.1 (versionCode 110)

### Performance

- Faster password unlock on all devices: Argon2id now uses the OWASP minimum parameters (19 MiB / t = 2 / p = 1) instead of the heavier 64 MiB / t = 3.
- Eliminated cascading re-renders by memoizing every context value (`Auth`, `Theme`, `Language`, `Alert`). In particular, the `Alert` provider no longer reloads the whole password list whenever a dialog opens or closes.
- Rewrote the Notes screen around React 19 `useDeferredValue` and derived `useMemo` state (removed three redundant state arrays, the per-keystroke filter, and the artificial pagination delay).
- Memoized the Home screen adaptive category list (was rebuilt three times per render).

### Security

- Legacy vaults (PBKDF2 or the old heavy Argon2id parameters) are transparently and non-destructively upgraded to the current Argon2id parameters on the next successful password login.

### UI/UX & Accessibility

- Replaced hardcoded colors with theme tokens and two fragile dark-mode checks (`background === '#121212'`) with the theme `isDarkMode` flag, fixing dark-mode contrast on the password detail and card views.
- Added accessibility roles/labels to the password card, password counter, bottom-sheet options/buttons, and the search field; enlarged action touch targets.
- Added a top-level error boundary so a single screen crash shows a recoverable, themed fallback instead of a blank screen.

### Tooling & Dependencies

- Aligned all `expo-*` packages to the exact Expo SDK 55 pins (expo-doctor: 19/19 checks passing).
- Migrated linting to ESLint 9 with a flat config (`eslint.config.js`); ESLint 8 is end-of-life.
- Added an EAS Workflow (`.eas/workflows/build-android-production.yml`) for Android production builds from GitHub, triggered on a version tag push (`v*`) or manual dispatch.

### Release

- Updated application version to 2.1 and Android versionCode to 110.

### Documentation

- Updated README, security, architecture, release, and pre-build review docs for Keysoft 2.1 / Android versionCode 110, including the new Argon2id OWASP parameters and the transparent KDF upgrade-on-login.

### Tests

- Added coverage for the KDF configuration helpers and the transparent KDF upgrade-on-login flow.
- Suite: 22 suites, 158 tests.

## 2.0 (versionCode 100)

### Fixed

- Restored visible PIN login feedback by letting React Native render the loading state before password verification starts.
- Kept the PIN login loader visible after successful verification until authenticated navigation replaces the login screen.

### Release

- Updated application version to 2.0 and Android versionCode to 100.

### Documentation

- Updated README status, release guide, pre-build review, and release notes for Keysoft 2.0 / Android versionCode 100.

### Tests

- Added regression coverage for PIN loading visibility before verification and during the successful auth handoff.
- Suite: 22 suites, 151 tests.

## 1.9 (versionCode 90)

### Performance

- PIN login now starts immediately after tapping the login button, without the previous artificial 100 ms delay.
- Non-critical post-login work, including category migration, notification sync, and password-limit checks, now runs after authentication succeeds instead of blocking the PIN login result.

### Release

- Updated application version to 1.9 and Android versionCode to 90.
- Updated GitHub Actions runtime versions to remove the Node.js 20 action-runtime deprecation warning while keeping the project Node.js version unchanged.

### Documentation

- Updated README status, release guide, and pre-build review references for Keysoft 1.9 / Android versionCode 90.

### Tests

- Added regression coverage for immediate PIN login dispatch and for resolving PIN login before deferred post-auth work completes.
- Suite: 22 suites, 149 tests.

## 1.8 (versionCode 80)

### Performance

- PIN setup and PIN change now reuse the vault key derived while creating the master-key verifier, removing a duplicate KDF pass without lowering Argon2/PBKDF2 parameters.
- PIN change remains security-bound by current-PIN verification, new-key derivation, vault re-encryption, and biometric key replacement when biometrics are enabled.

### Security

- The master-key metadata helper can now return both the verifier metadata and the already-derived 64-character vault key, keeping the authentication model unchanged while avoiding redundant sensitive computation.
- Biometric unlock behavior remains unchanged: it uses the SecureStore-protected vault key after device authentication and still verifies that key against the current master-key verifier.

### Documentation

- Updated release target, README status, security notes, and pre-build review references for Keysoft 1.8 / Android versionCode 80.

### Tests

- Added regression coverage ensuring PIN/master-key updates reuse the key from verifier creation instead of running an extra derivation.
- Suite: 22 suites, 147 tests.

## 1.7 (versionCode 71)

### Security

- `cryptoService.decrypt` now throws `CryptoError` on failure instead of silently returning `''`. Fail-fast prevents corrupted decryption from being mistaken for legitimate empty input.
- `cryptoService.encrypt` and `decrypt` unified as `Promise<string>` for consistent async semantics with all callers.
- MAC verification in `decrypt` now uses constant-time comparison to mitigate theoretical timing attacks.
- `authService.updateMasterPassword` now performs an atomic rollback when `saveMasterKeyInfo` fails after `reEncryptAllData` succeeded. Rollback restores the previous encryption key on AsyncStorage. If the rollback itself fails, a forced logout clears in-memory auth state to prevent silent vault corruption.
- New `authService.verifyMasterPassword` exposes credential verification without side-effects on `isAuthenticated` or storage initialization. PIN-change flow now uses this path so that a re-confirmation after auto-lock cannot silently re-authenticate the user.
- Biometric unlock again works after app restart by storing the vault key in SecureStore with device authentication. Missing, invalidated, or stale biometric keys now disable biometrics and require PIN login before re-enablement.
- Argon2id KDF now wrapped with a 60s `withTimeout` helper to prevent indefinite UI blocks on slow release devices.
- Vault metadata that requires Argon2id (`memory > 0`) no longer falls back to PBKDF2 when the native module is unavailable; login now reports a native-KDF diagnostic instead of a misleading invalid PIN.
- Android release builds now keep the `react-native-argon2` v4 package (`com.poowf.argon2`) during R8 minification so Argon2 vaults do not fail as invalid PINs in production.

### Stability

- `AuthContext` post-login periodic checks now run inside a tracked timeout that is cleared on logout/unmount, with `isMountedRef` re-checks after every `await` to prevent state writes on unmounted components.
- `AuthContext.updateMasterPassword` now detects the forced-logout path and synchronizes React state so the UI cannot remain in a "logged in" state with an empty encryption key.
- `useHomeLogic.searchCache` capped at 50 entries with explicit LRU eviction (excluding the just-inserted key).

### Architecture

- `LanguageContext` translation dictionaries extracted to `src/locales/{it,en}.ts`. The orchestrator file shrank from 2347 to 167 lines while preserving the existing `t(key, params?)` API.
- `SettingsScreen` decomposed via four custom hooks under `src/hooks/settings/`: `usePinManagement`, `useNotificationSettings`, `useProfileForm`, `useExportImport`. Net effect: -586 lines from the screen plus isolated, testable units.
- `AuthContext` deduplicated `loadUserPreferencesAndSyncServices` (previously inlined three times across `login`, `setupMasterPassword`, `updateMasterPassword`).
- Navigation wrappers (`StackNavigator`, `TabNavigator`) typed with `StackScreenProps`/`BottomTabBarProps`. Removed `dangerouslyGetParent` (deprecated API).
- TypeScript path aliases (`@components/*`, `@services/*`, `@contexts/*`, …) configured via `tsconfig.json` paths and `babel-plugin-module-resolver`.

### Tooling

- Prettier 3 configured with `.prettierrc.json` and `.prettierignore`. New scripts: `bun run format`, `bun run format:check`.
- `eas.json`: production profile now includes a placeholder iOS configuration.
- Repository hygiene for public GitHub publication now excludes signing material, local agent state, env files, and build artifacts from git/EAS uploads.
- Removed the Android signing keystore from repository tracking.
- UI components: removed remaining `any` from `bottom-sheet` and `list-item` props.

### Documentation

- Updated architecture, security, development, release, and contributor docs for SecureStore-backed biometric unlock, sanitized auth failure diagnostics, Argon2 native failure handling, public repository policy, and the focused auth regression suite.

### Tests

- Added regression coverage for `updateMasterPassword` rollback (success + double-failure forced-logout), `verifyMasterPassword` no-side-effect contract, `CryptoError` on MAC tampering, and `withTimeout` (success/timeout/error propagation).
- Added regression coverage for SecureStore biometric key save/read, cold-start biometric login, biometric key invalidation, native KDF unavailability, Argon2 ProGuard rules, and expired-session PIN change messaging.
- Updated i18n parity test for the new `src/locales/{it,en}.ts` structure.
- Added source structure regression coverage for lowercase directories and shared settings hook placement.
- Suite: 22 suites, 146 tests (was 122).

## 1.5.0

### Security

- Removed biometric encryption-key persistence. Biometric authentication now gates only sessions where the vault key is already present in memory.
- Added password-encrypted backup envelopes using `KS1-PW1`, KDF metadata, and authenticated KS1 ciphertext.
- Added structured backup import validation before saving password and note objects.
- Added automatic migration for legacy plaintext password and note arrays when an encryption key is available.
- Removed `Math.random` usage from application source in favor of cryptographically secure randomness.

### Internationalization

- Local notification titles and bodies now use the app translation system.
- Added Italian and English notification translation keys.
- Added regression checks for Italian/English translation key parity, interpolation placeholder parity, static `t(...)` usage, and legacy hardcoded UI fallbacks.
- Removed hardcoded localized fallbacks from default category names, custom alert buttons, and the settings username fallback.
- Updated biometric privacy copy to reflect session-only biometric gating and no stored biometric hashes or encryption keys.
- Updated network privacy copy to disclose Expo/EAS update connectivity without vault sync or secret transport.
- Localized periodic weak, duplicate, and expired password notification summaries.

### Tooling

- Aligned Expo SDK 55 dependencies to patch-compatible versions.
- Updated compatible package ranges for React Navigation, React Native Gesture Handler, Zod, and ts-jest.
- Switched the default development workflow to Expo Go and documented EAS cloud builds on expo.dev.
- Regenerated `node_modules` after dependency alignment to resolve duplicate native module checks.
- `expo-doctor` now passes all 18 checks.

### Accessibility

- Added labels, roles, modal semantics, and larger touch targets to key icon-only controls.
- Added documentation for UI/accessibility release checks before EAS builds.

### Tests

- Added regression coverage for biometric key handling, password-encrypted backup payloads, legacy plaintext migration, and import validation.
- Added regression coverage for localized periodic notification summaries and password detail icon accessibility.
- Current suite: 17 test suites, 122 tests.

## 1.3.5

### Platform

- Upgraded to Expo SDK 55.
- Migrated to React Navigation v7.
- Updated React Native and React for SDK 55 compatibility.

### Code Quality

- Removed obsolete TypeScript suppressions.
- Cleaned declaration files and type augmentation.
- Modernized GitHub Actions and Bun workflow.

### Tests

- Added service test coverage for auto-lock, clipboard, screen capture, crypto randomness, password utilities, and notifications.

## 1.3.4

### Accessibility

- Added accessibility labels and roles to icon-only buttons.
- Improved authentication input metadata for password manager compatibility.
- Added reduced-motion support for animated UI elements.

### Quality

- Fixed TypeScript return type inference in crypto randomness utilities.
- Added missing password visibility translations.

## 1.3.2

### Security

- Centralized cryptographic randomness for salt, IV, ID, and password generation.
- Normalized Argon2/PBKDF2 output to 256-bit hex keys.
- Added write guards after decryption errors.
- Sanitized local notification content.

### Android

- Aligned camera and notification permissions.
- Enabled Expo Updates configuration.

## 1.2.1

### Cryptography

- Enforced KS1 authenticated encryption for new vault writes.
- Removed insecure legacy encryption paths.
- Preserved compatible legacy read support where needed for migration.

### Architecture

- Refactored the home screen logic into dedicated hooks.
- Improved maintainability of core credential flows.

## 1.2.0

### Storage

- Hardened storage writes to fail when the encryption key is missing.
- Prevented plaintext fallback writes for password and note data.

### Logging

- Migrated application logging to the central `Logger` service.
- Suppressed production debug logs.
