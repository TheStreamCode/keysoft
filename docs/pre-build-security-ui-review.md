# Pre-Build Security And UI Review

Original review date: 2026-06-17
Latest update: 2026-07-22

Release target: Keysoft 3.0.1, Android versionCode 125 through EAS remote auto-increment, with iOS simulator readiness.

## Executive Summary

The codebase passes local static and test verification, and the Android JS bundle exports successfully for Expo/Metro. I did not find evidence of plaintext vault writes in the current storage path, encryption-key logging, `Math.random` in app source, or obvious DOM/code-injection sinks. Biometric unlock intentionally stores the vault key only in SecureStore with device authentication.

The release-blocking privacy/config mismatch and the main accessibility issues were accepted for remediation after this review. Keep this file as the audit trail for the pre-build review.

### 3.0.1 Update

The 3.0.1 target completes the Nocturne redesign across onboarding, PIN unlock, vault, credential and note workflows, generator, settings, shared overlays, and navigation. It adds responsive phone/tablet layouts, semantic light/dark themes, reduced-motion-aware effects, local vault-health analysis, an iOS simulator build profile, and a shared Mikesoft support URL. Alerts, destructive confirmations, loading states, selection sheets, notification history, and transient feedback now use shared dialog, bottom-sheet, and toast primitives. The original Keysoft shield-and-eye artwork remains the canonical app and onboarding identity.

Profile images now use one avatar renderer across unlock, vault, and settings. Native picker files are copied into application-owned storage only when the profile is saved, preventing temporary image URIs from disappearing after reload or login. Password unlock batches native storage reads and performs category migration with at most one encrypted vault write instead of rewriting the vault once per credential. The KS1 envelope and configured Argon2/PBKDF2 derivation costs are unchanged.

The visible compact Settings layout again exposes GitHub Sponsors in addition to the shared generic Mikesoft support hub. The in-app and public Keysoft privacy notices are synchronized to the 3.0 implementation and now use a fixed effective date, the dedicated `keysoft@mikesoft.it` privacy contact, accurate Expo Updates technical traffic, Argon2id/PBKDF2 wording, camera/photo-picker and clipboard behavior, and the Android-release/iOS-simulator-only boundary.

Final release review extended shared dialog dimming beneath the Android navigation bar and reserved responsive space for the Vault Health percentage so it remains inside the summary card at compact widths. Focused Vault Health tests cover healthy credentials, empty-password reuse handling, and expiry boundaries. A mobile-viewport web smoke covered onboarding, credential creation and detail, Vault Health findings and filters, password generation, notes, light/dark themes, Italian/English language switching, logout, and PIN login; native-only biometrics, notifications, file pickers, and Argon2 remain release-build checks.

### 2.4 Update

The 2.4 release target migrates to Expo SDK 57 and React Native 0.86. Android build properties now use the supported SDK 57 plugin fields, and optional camera/biometric hardware declarations are applied through a tested manifest config plugin.

### 2.2 Update

The 2.2 release is documentation- and content-only on top of 2.1: the settings support entry now points to GitHub Sponsors, 492 unreferenced translation keys were removed from both dictionaries (no user-facing string changed), and device-language detection now resolves synchronously on first render. No new release blockers were identified; the 2.1 findings above remain remediated. Verification (typecheck, lint, 22 suites / 158 tests) still passes.

## Release Blockers

### SEC-1: Privacy Text Conflicts With Network Configuration

- Severity: High
- Location: `app.config.js:7`, `app.config.js:54`, `src/contexts/LanguageContext.tsx:1041`, `src/contexts/LanguageContext.tsx:2127`
- Evidence: `app.config.js` configures `expo-updates` with `https://u.expo.dev/...` and explicitly includes `INTERNET`, while the privacy text says Keysoft does not require or use internet connectivity.
- Impact: Release privacy/compliance mismatch. Users and reviewers may see a network permission and OTA update URL while the in-app policy says network access is not used.
- Fix: Keep EAS Updates/Internet and update privacy/release docs to disclose update connectivity.
- Status: Remediated in the in-app and public Mikesoft privacy notices by declaring the limited Expo Updates technical traffic and confirming that it is not used for vault sync or secret transport. Regression coverage also rejects a dynamic policy date and checks current KDF and optional-feature disclosures.

### UX-1: Icon-Only Buttons Missing Accessibility Labels

- Severity: High
- Location: `src/components/NotificationBell.tsx:152`, `src/components/NotificationBell.tsx:213`, `src/components/NotificationBell.tsx:216`, `src/components/NotificationBell.tsx:221`, `src/components/NotificationBell.tsx:272`, `src/screens/PasswordDetailScreen.tsx:359`, `src/screens/PasswordDetailScreen.tsx:381`, `src/screens/PasswordDetailScreen.tsx:422`, `src/screens/PasswordDetailScreen.tsx:444`, `src/screens/PasswordDetailScreen.tsx:451`, `src/screens/HomeScreen.tsx:181`
- Evidence: Several `TouchableOpacity` controls only contain icons and do not provide `accessibilityLabel` / `accessibilityRole`.
- Impact: Screen reader users cannot reliably understand notification, delete, back, copy, reveal password, or refresh actions.
- Fix: Add localized `accessibilityLabel`, `accessibilityRole="button"`, and `hitSlop`/minimum dimensions where needed.
- Status: Remediated for the identified icon-only controls and custom modal controls.

## Important Findings

### SEC-2: Expo Go PBKDF2 Vaults Do Not Auto-Upgrade To Argon2

- Severity: Medium
- Location: `src/services/crypto/cryptoService.ts:21`, `src/services/crypto/cryptoService.ts:143`
- Evidence: Expo Go intentionally uses PBKDF2 fallback. `createMasterKeyInfo` stores the KDF metadata used at setup time.
- Impact: Vaults created in Expo Go remain PBKDF2-backed even when later opened in an EAS/native build with Argon2 available.
- Fix: Document that Expo Go is development-only for real vault creation, or add a post-login KDF upgrade/rekey flow when Argon2 becomes available.
- Status: Remediated. A best-effort, non-destructive post-login KDF upgrade now rekeys legacy vaults (PBKDF2 or the old heavy Argon2 parameters) to the current Argon2id OWASP parameters (`memory = 19456` KiB, `iterations = 2`, `parallelism = 1`) on the next successful password login; on any failure the vault is left on its previous working key, so the user is never locked out. Expo Go remains development/smoke-test only for KDF validation.

### UX-2: Several Touch Targets Are Below The 44px Mobile Minimum

- Severity: Medium
- Location: `src/components/NotificationBell.tsx:296`, `src/components/NotificationBell.tsx:357`, `src/components/NotificationBell.tsx:394`, `src/screens/PasswordDetailScreen.tsx:620`, `src/screens/PasswordDetailScreen.tsx:627`
- Evidence: Notification bell and delete/back/action icon buttons are 40px or icon-size + 8px padding.
- Impact: Harder tapping on mobile and weaker accessibility/store review posture.
- Fix: Standardize icon buttons to at least 44x44, preferably 48x48, with visible pressed states.
- Status: Remediated for the identified notification and password detail icon controls.

### UX-3: Notification Strings Bypass Localization

- Severity: Medium
- Location: `src/services/utils/notificationService.ts:751`, `src/services/utils/notificationService.ts:773`, `src/services/utils/notificationService.ts:792`
- Evidence: Periodic weak/duplicate/expired password notifications use hardcoded Italian strings instead of `t('key')`.
- Impact: English users receive Italian notifications; violates the project i18n rule.
- Fix: Move these strings to both dictionaries and call existing translated notification helpers.
- Status: Remediated with localized summary notification bodies in both Italian and English, plus i18n regression coverage for dictionary parity and hardcoded fallback regressions.

### UX-4: Custom Modal Accessibility Is Incomplete

- Severity: Medium
- Location: `src/components/CustomAlert.tsx:65`, `src/components/CustomAlert.tsx:73`, `src/components/CustomAlert.tsx:115`, `src/components/NotificationBell.tsx:183`
- Evidence: Custom modal/backdrop containers do not declare modal semantics or accessible labels for dismiss/actions.
- Impact: Screen readers may traverse background content or announce unlabeled controls.
- Fix: Add `accessibilityViewIsModal`, clear dismiss labels, and localized button/accessibility text.
- Status: Remediated for `CustomAlert`, notification modal, and bottom sheet close controls.

## Verification Passed

- `bun run typecheck`
- `bun run lint`
- `bun run test`: 28 suites, 176 tests
- `bunx expo-doctor`: 20/20 checks
- `bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export`
- `bunx expo export --platform ios --output-dir C:\tmp\keysoft-ios-export`

## Remaining Manual Checks

- Expo Go smoke test on a physical Android device:
  - onboarding
  - login/logout
  - create/edit/delete password
  - copy/clipboard timeout
  - backup export/import
  - cold-start biometric unlock and PIN fallback after biometric invalidation
  - dark mode and language switch
  - original launcher/adaptive icon and splash rendering
  - profile-photo persistence across save, reload, lock, and login
  - dialog, destructive confirmation, bottom-sheet, notification, and toast layering
- EAS preview build only after local checks pass and explicit upload approval is given.
