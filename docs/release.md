# Release Guide

## Release Readiness Checklist

Current release target: Keysoft 1.9, Android versionCode 90.

Before preparing a release:

- `bun run typecheck` passes.
- `bun run lint` passes.
- `bun run test` passes.
- `bunx expo-doctor` passes.
- `bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export` passes.
- Architecture and i18n regression tests are included in the passing test run.
- Android permissions match `app.config.js` and native Android configuration.
- No local secrets, keystores, certificates, or environment files are staged or tracked.
- Public repository checklist has been reviewed when preparing public GitHub visibility.
- Backup import/export still works with encrypted payloads.
- Biometric login behavior is verified on a physical Android device when possible.
- Privacy text discloses that `INTERNET` is used for Expo/EAS updates only, not vault sync.
- Pre-build security/UI review is current and all blocking findings are remediated or explicitly accepted.

## Versioning

Application version data is maintained in:

- `package.json`
- `app.config.js`
- Android native configuration where applicable

For the 1.9 Android production release, `app.config.js` uses `version: "1.9"` and `android.versionCode: 90`.

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

Production submission:

```bash
bun run submit:android:production
```

Release validation for the KDF path must be performed on an EAS/native build. Expo Go uses the PBKDF2 fallback because it cannot load the Argon2 native module.

Before approving a release build that touches KDF or native dependency configuration, confirm the generated Android project includes the Argon2 ProGuard keep rules inserted by `plugins/withArgon2ProGuard.js`, especially `com.poowf.argon2` for `react-native-argon2` v4.

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
- Open and dismiss notification, alert, and bottom-sheet modals.
- Navigate icon-only controls with TalkBack where possible.
- Confirm touch targets remain comfortable on smaller Android screens.
- Switch Italian/English/system language and confirm core notification, alert, and settings labels remain localized.

## Documentation Updates

For significant changes, update:

- `README.md`
- `CHANGELOG.md`
- Relevant files under `docs/`
- `AGENTS.md` when contributor workflow, release, security, or tooling rules change.
