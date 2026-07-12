![Keysoft secure private offline password manager banner](docs/assets/keysoft-banner.png)

# Keysoft

[![CI](https://github.com/TheStreamCode/keysoft/actions/workflows/ci.yml/badge.svg)](https://github.com/TheStreamCode/keysoft/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](LICENSE)

Keysoft is an offline-first password manager for Android, built with Expo, React Native, and TypeScript. It stores vault data locally and protects user content with authenticated encryption.

The application is designed around a local-only operating model: the PIN/master password is never persisted, vault data is encrypted at rest, and the app does not require a backend service to operate.

Keysoft works offline for vault management. Network access is limited to platform services such as Expo/EAS updates and is not used to sync, upload, or transmit vault contents, PINs, master passwords, or encryption keys.

## Current Status

| Area                | Status                    |
| ------------------- | ------------------------- |
| Platform focus      | Android-first, iOS paused |
| App version         | 2.3                       |
| Android versionCode | 121                       |
| Expo SDK            | 56.0.15                   |
| React Native        | 0.85.3                    |
| TypeScript          | 6.0.3, strict mode        |
| Test suite          | 22 suites, 158 tests      |
| Health check        | `expo-doctor` 21/21       |

## Core Capabilities

- Password vault with create, read, update, delete, search, pagination, and categories.
- Secure notes stored with the same vault encryption model.
- Local password generator backed by cryptographically secure randomness.
- Optional biometric unlock backed by SecureStore with device authentication.
- Local notifications for security reminders and backup prompts.
- Encrypted import/export workflow for user-managed backups.
- Italian and English localization with system-language detection.
- Automated i18n checks for Italian/English key parity, placeholder parity, and user-facing fallback regressions.
- Source-structure regression checks for lowercase directories and shared settings hook placement.
- Light and dark themes, Android-focused layout, and responsive test coverage.

## Security Model

Keysoft uses the KS1 envelope for vault data:

- AES-256-CBC for encryption.
- HMAC-SHA256 for integrity verification.
- Argon2id in EAS/native builds when available, PBKDF2 fallback in Expo Go or where required.
- Expo Go is a development workflow. Vaults created in Expo Go use PBKDF2 fallback metadata; use EAS/native builds for release-grade Argon2 validation.
- 64-character hex derived keys.
- CSPRNG-backed salts, IVs, IDs, and password generation.
- The vault key stays in memory by default. If biometrics are enabled, the vault key is stored in SecureStore with device authentication required and is updated or removed when the PIN changes.
- PIN setup and PIN changes reuse the vault key derived during verifier creation to avoid duplicate KDF work while preserving the configured Argon2/PBKDF2 cost.

Backup files use a password-encrypted payload format (`KS1-PW1`) with KDF metadata and authenticated KS1 ciphertext.

See [Security Architecture](docs/security.md) for the full model, operational assumptions, and storage rules.

## Documentation

- [Architecture](docs/architecture.md)
- [Security Architecture](docs/security.md)
- [Development Guide](docs/development.md)
- [Release Guide](docs/release.md)
- [Public Repository Checklist](docs/publication.md)
- [First-Party Copyright And Scope Record](COPYRIGHT.md)
- [Pre-Build Security/UI Review](docs/pre-build-security-ui-review.md)
- [Changelog](CHANGELOG.md)

## Requirements

- Bun
- Node.js compatible with the Expo toolchain
- Expo Go installed on the Android device used for development
- Expo account access for EAS builds on expo.dev
- Expo CLI via `bunx expo`

## Installation

```bash
bun install
```

## Development

Start the Expo development server for Expo Go:

```bash
bun run start
```

Open on Android with Expo Go:

```bash
bun run android
```

Use a tunnel when the phone cannot reach the local machine over LAN:

```bash
bun run start:tunnel
```

Run web for development/testing:

```bash
bun run web
```

Build artifacts are produced on expo.dev through EAS:

```bash
bun run build:android:preview
bun run build:android:production
```

EAS builds upload the project to expo.dev. Start them only after the release checklist is complete and the upload has been explicitly approved.

### Build from GitHub

The repository is linked to EAS Build. An EAS Workflow (`.eas/workflows/build-android-production.yml`) builds the Android production app-bundle. To keep build-credit usage low, it runs only on a version tag push (`v*`) or manual dispatch — not on every push. iOS is excluded while it is paused, so the missing-iOS-credentials warning does not apply. Trigger a release build by pushing a tag (`git tag v2.3 && git push origin v2.3`) or by running the workflow from the Expo dashboard. Google Play submission is performed manually.

## Verification

Run the full local verification suite before shipping changes:

```bash
bun run typecheck
bun run lint
bun run test
bunx expo-doctor
bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export
```

Current verified state:

- `bun run typecheck`: passing
- `bun run lint`: passing
- `bun run test`: passing, 22 suites and 158 tests
- `bunx expo-doctor`: passing, 21/21 checks
- `bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export`: passing

## Project Structure

```text
src/
  components/        Shared UI components
  contexts/          Application state providers
  hooks/             Complex screen and behavior logic
    settings/        Settings workflows extracted from SettingsScreen
                     (usePinManagement, useNotificationSettings,
                      useProfileForm, useExportImport)
  locales/           i18n dictionaries (it.ts, en.ts) consumed by LanguageContext
  models/            TypeScript domain models
  navigation/        Navigation configuration (typed via NativeStackScreenProps)
  screens/           User-facing screens
  services/          Business, crypto, storage, auth, and utility services
  utils/             Shared platform and security helpers (incl. withTimeout)
```

Path aliases (`@/*`, `@components/*`, `@services/*`, …) are configured in
`tsconfig.json` and `babel.config.js` for use in new code.

## Data Ownership

Keysoft is local-first. The user owns their vault data and is responsible for keeping backup files and the master password secure. The app cannot recover a lost master password because no server-side recovery material exists.

## Support

If Keysoft's local-first security work is useful to you, support continued development through GitHub Sponsors: [github.com/sponsors/TheStreamCode](https://github.com/sponsors/TheStreamCode).

## License

This project is licensed under the [GNU General Public License version 3.0 only](LICENSE) (`GPL-3.0-only`). See the [first-party copyright and scope record](COPYRIGHT.md) and [TRADEMARKS.md](TRADEMARKS.md) for ownership scope and the separate policy governing the Keysoft and Mikesoft brands.

## Responsible Disclosure

Please do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md) for private reporting guidance.
