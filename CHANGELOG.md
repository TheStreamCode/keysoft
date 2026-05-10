# Changelog

All notable project changes are documented here.

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
