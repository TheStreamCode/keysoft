# Release Guide

## Release Readiness Checklist

Current production rebuild target: Keysoft 3.1.0, Android versionCode 128 through EAS remote auto-increment. The latest completed production artifact is build 127. iOS remains a cloud-simulator compatibility target and is not an App Store release target.

Before preparing a release:

- `bun run verify` passes (format, typecheck, lint, coverage-enabled tests, and `expo-doctor`).
- `bun run deps:audit` has no critical finding; remaining lower-severity transitive advisories are reviewed against the supported Expo toolchain.
- `bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export` passes.
- `bunx expo export --platform ios --output-dir C:\tmp\keysoft-ios-export` passes.
- Architecture and i18n regression tests are included in the passing test run.
- Android permissions match `app.config.js` and native Android configuration.
- The generated release build uses `proguard-android-optimize.txt`, `minifyEnabled true`, `shrinkResources true`, and `android.r8.optimizedResourceShrinking=true`.
- The generated release build still includes the Argon2 keep rules required by native password login.
- No local secrets, keystores, certificates, or environment files are staged or tracked.
- Public repository checklist has been reviewed when preparing public GitHub visibility.
- Backup import/export still works with encrypted payloads.
- Biometric login behavior is verified on a physical Android device when possible.
- Privacy text discloses that `INTERNET` is used for Expo/EAS updates only, not vault sync.
- The in-app and public Mikesoft Keysoft policies show the same fixed effective date, dedicated `keysoft@mikesoft.it` contact, implemented permissions/features, Android release status, and iOS simulator-only boundary.
- The published policy carries the same data-deletion section as the in-app notice. Google Play mandates a deletion path only for apps that create accounts, which Keysoft does not, so this disclosure is voluntary and easy to drop by accident.
- Contact details are read from `src/constants/contact.ts`; no screen or dictionary carries its own copy of the support address or the site.
- The compact Settings layout exposes email Support, Privacy Policy, Open source and legal, and GitHub Sponsors.
- Settings > Support opens a `mailto:` intent directly and copies the address when the intent is refused. Do not reintroduce a `Linking.canOpenURL` gate: package visibility makes it report false on Android 11+ unless the `mailto` scheme is declared in `<queries>`.
- Launcher, Android adaptive, splash, web favicon, and onboarding all use the original Keysoft shield-and-eye artwork; no obsolete alternate logo is packaged.
- Verify Settings > Open source and legal while offline: it identifies Keysoft as Apache-2.0 and displays the complete bundled license. Confirm source, notices, and trademark links.
- Validate password login, iPad split view, Dynamic Type, VoiceOver, backup import/export, and auto-lock in the iOS cloud simulator. Face ID and other hardware-backed behavior remain outside simulator coverage.
- Pre-build security/UI review is current and all blocking findings are remediated or explicitly accepted.

## Versioning

Application version data is maintained in:

- `package.json`
- `app.config.js`
- Android native configuration where applicable

For the current 3.1.0 production rebuild, `app.config.js` uses `version: "3.1.0"`, `android.versionCode: 127`, and an iOS simulator baseline of `ios.buildNumber: "1"`. The Android EAS production profile uses the remote version source, whose latest completed baseline is build 127, so `autoIncrement` produces store build 128. The local value remains visible through `expo-constants` but does not control EAS production builds. Because EAS Update uses the `appVersion` runtime policy, the rebuild remains on native runtime 3.1.0.

Read the current remote value with `bunx eas-cli build:version:get --platform android` instead of assuming the baseline.

When changing Android permissions or update behavior, keep `app.config.js`, EAS profiles, and generated native configuration in sync.

## Android Build

Development uses Expo Go:

```bash
bun run android
```

Expo health check:

```bash
bunx expo-doctor
```

Build artifacts are created on expo.dev through EAS, not through local Gradle:

```bash
bun run build:android:preview
bun run build:android:production
```

These commands upload the project to expo.dev. Do not start them until the release checklist is complete and the upload has been explicitly approved.

### Build from GitHub

The Android workflow runs for a matching version tag or manual dispatch. It uploads the project to Expo and therefore requires explicit approval before it is run.

## iOS Cloud Simulator Testing

Run the local JavaScript bundle check before using EAS:

```bash
bunx expo export --platform ios --output-dir C:\tmp\keysoft-ios-export
```

For browser-based simulator validation without paid Apple enrollment, follow [iOS Testing Without Apple Hardware](ios-testing.md). After explicit approval for the external upload, create the simulator artifact with:

```powershell
bun run build:ios:simulator
```

The artifact can then be tested in Appetize. App Store signing, submission metadata, and publication are intentionally outside the release workflow.

### Google Play Submission

Google Play submission is currently performed manually (upload the app-bundle in the Play Console). To automate it later, configure a Google service-account key in `eas.json` (`submit.production`) and run:

```bash
bun run submit:android:production
```

Release validation for the KDF path must be performed on an EAS/native build. Expo Go uses the PBKDF2 fallback because it cannot load the Argon2 native module.

Before approving a release build that touches KDF or native dependency configuration, confirm the generated Android project includes the Argon2 ProGuard keep rules inserted by `plugins/withArgon2ProGuard.js`, especially `com.poowf.argon2` for `react-native-argon2` v4.

### Android Release Optimization

`expo-build-properties` enables release minification and resource shrinking. `plugins/withAndroidReleaseOptimization.js` then selects `proguard-android-optimize.txt` and enables the optimized resource shrinker available in AGP 8.12. Do not force AGP 9 independently of Expo and React Native; upgrade it only through a supported Expo SDK toolchain.

The Google Play edge-to-edge and bitmap recommendations are dependency-level static findings in the current React Native/Fresco/Glide binary. Keysoft already avoids status/navigation bar color setters on Android 15+, uses safe-area layouts, and does not download profile images from the network. Reassess these findings after supported Expo/React Native upgrades, but do not fork native dependencies or add another image loader solely to hide a scanner recommendation.

For release validation, generate Android native files in a temporary copy and confirm:

- `android/app/build.gradle` selects `proguard-android-optimize.txt`.
- Release minification and resource shrinking are enabled.
- `android/gradle.properties` contains `android.r8.optimizedResourceShrinking=true` once.
- `android/app/proguard-rules.pro` retains the Argon2 package rules.
- The EAS build produces `mapping.txt` and completes native PIN login in an internal-test installation.

## Permissions Policy

Allowed/expected:

- `INTERNET` for Expo/EAS update delivery only.
- `CAMERA` for camera-based features.
- `POST_NOTIFICATIONS` for Android 13+ local notifications.

Blocked:

- `READ_MEDIA_IMAGES`
- `READ_MEDIA_VIDEO`
- `READ_MEDIA_AUDIO`

Prefer Android Photo Picker or explicit user-selected file access instead of broad media permissions.

## Backup Compatibility

Encrypted backups use `KS1-PW1`. Release testing should cover:

- Export encrypted backup.
- Import encrypted backup with the correct password.
- Reject encrypted backup with the wrong password.
- Reject malformed JSON backup.
- Reject backup objects with invalid password or note shape.

## Security Regression Checks

Before release, confirm these invariants:

- `saveBiometricKey` and `getBiometricKey` are used only for SecureStore-backed biometric unlock and never logged.
- Argon2 vault metadata (`memory > 0`) fails with an explicit native-KDF error if the native module is unavailable.
- Argon2 timeout surfaces as a KDF timeout diagnostic, not as a generic invalid PIN.
- PIN setup and PIN change reuse the key derived while creating the master-key verifier instead of running an extra KDF pass for the same new PIN.
- No `Math.random` usage exists under `src`.
- Backup export does not call `Crypto.encrypt(jsonData, exportPassword)`.
- Backup import does not decrypt with `Crypto.decrypt(parsedData.data, importPassword)`.
- Plaintext legacy arrays are re-encrypted when loaded with an active key.

Suggested command:

```bash
rg "Math\.random|Crypto\.encrypt\(jsonData|Crypto\.decrypt\(parsedData\.data" src
```

The command should return no matches.

## UI/UX Regression Checks

Before release, manually smoke test on Expo Go and on the EAS preview build:

- Unlock, auto-lock, logout, cold-start biometric unlock, biometric invalidation fallback, and PIN change after biometrics are enabled.
- Create, edit, delete, search, and copy password records.
- Create, edit, delete, and search secure notes.
- Open and dismiss notification history, alerts, destructive confirmations, loading dialogs, bottom sheets, and toasts. Confirm a dialog opened from a sheet appears above the interface and that canceling restores the expected workflow.
- Confirm loading and confirmation dialog dimming extends beneath the Android navigation bar with no undimmed strip at the bottom of the screen.
- Pick a profile photo, save it, reload the app, lock/log out, and confirm the same avatar is visible on unlock, vault, and settings screens. Canceling profile edits must keep the previously saved image.
- Verify automatic light/dark appearance and responsive layout at compact-phone, tall-phone, landscape/tablet, and narrow split-view sizes without clipped content or full-height compact dialogs.
- Open Vault Health at compact widths and with long translations; confirm the percentage remains inside the summary card and weak, reused, and expired findings match the stored credentials.
- Confirm the original Keysoft shield appears without distortion on onboarding, launcher/adaptive icon, splash, and favicon.
- Navigate icon-only controls with TalkBack where possible.
- Confirm touch targets remain comfortable on smaller Android screens.
- Switch Italian/English/system language and confirm core notification, alert, and settings labels remain localized.
- Enable reduced motion and confirm transitions remain usable without relying on animation to convey state.

## Documentation Updates

For significant changes, update:

- `README.md`
- `CHANGELOG.md`
- Relevant files under `docs/`
- `AGENTS.md` when contributor workflow, release, security, or tooling rules change.
