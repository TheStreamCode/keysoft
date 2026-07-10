# Architecture

## Overview

Keysoft is an offline-first React Native application built with Expo. The architecture keeps user data local, separates screen concerns from service logic, and treats encryption and storage as first-class boundaries.

## Runtime Stack

| Layer           | Technology                         |
| --------------- | ---------------------------------- |
| App framework   | Expo SDK 56                        |
| UI runtime      | React Native 0.85.3                |
| Language        | TypeScript, strict mode            |
| Navigation      | React Navigation v7                |
| Package manager | Bun                                |
| Test framework  | Jest, React Native Testing Library |

## Source Layout

```text
src/
  components/        Shared UI and reusable controls
  contexts/          Auth, language, theme, and alert state
  hooks/             Complex screen behavior and orchestration
    settings/        Settings workflows split out of the screen component
  locales/           Italian and English translation dictionaries
  models/            Domain interfaces
  navigation/        Stack and tab navigation
  screens/           User-facing screens
  services/          Auth, crypto, storage, import/export, utilities
  utils/             Cross-cutting helpers
```

## Application Boundaries

### Screens

Screens own presentation state and user interactions. They should not implement cryptography, persistence rules, or business validation directly. Complex screen workflows should move into hooks or services.

### Contexts

Contexts expose app-wide state and side effects:

- `AuthContext`: authentication status and session lifecycle.
- `LanguageContext`: localization and language selection.
- `ThemeContext`: visual appearance.
- `AlertContext`: app-level alert orchestration.

Localization dictionaries live in `src/locales` and are loaded by `LanguageContext`. User-visible strings must be added to both Italian and English dictionaries.

### Hooks

Hooks contain complex screen workflows that would otherwise make screen components hard to scan. Settings-specific orchestration lives in `src/hooks/settings`, while `SettingsScreen` keeps presentation and modal composition.

### Services

Services own core behavior:

- `authService`: authentication and master password lifecycle.
- `cryptoService`: key derivation, encryption, decryption, backup payload helpers, password generation.
- `storageService`: encrypted persistence, cache management, migration, preferences.
- `import-export/backupValidation`: validation and normalization of imported backup data.
- `utils/*Service`: notifications, clipboard, auto-lock, screen capture.

### Error Boundary

A top-level error boundary (`src/components/ErrorBoundary.tsx`) wraps the navigator inside the context providers. A render error in any screen shows a recoverable, themed and localized fallback instead of a blank screen, and the failure is logged through the sanitized `Logger`.

## Data Flow

1. The user authenticates with the master password/PIN, or with biometrics if biometric unlock was previously enabled.
2. PIN login uses `CryptoService` to derive a 64-character hex vault key and verify it against the stored master-key verifier. Argon2id uses the OWASP minimum parameters (19 MiB / t = 2). Legacy vaults (PBKDF2 or the old heavy Argon2 parameters) are transparently and non-destructively upgraded to the current parameters after a successful password login.
3. Biometric login asks SecureStore for the stored biometric vault key with device authentication, verifies it against the same master-key verifier, and then loads it into memory.
4. `StorageService` initializes the encrypted vault cache with the active key.
5. `AuthContext` completes the shared post-login pipeline: authentication state, login notification, post-auth migration, notification settings, clipboard timeout, and auto-lock timeout.
6. Password and note writes are serialized, encrypted with KS1, and stored in AsyncStorage.
7. Logout and auto-lock clear authentication state and the in-memory key.

## Storage Boundaries

| Storage      | Contents                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------- |
| AsyncStorage | Encrypted passwords, encrypted notes, categories, preferences                                 |
| SecureStore  | Master key verifier metadata; optional biometric vault key protected by device authentication |
| Memory only  | Active vault key and decrypted vault cache                                                    |

The active vault key must never be written to AsyncStorage or logs. The only persistence exception is biometric unlock: when the user enables biometrics from an authenticated session, `StorageService` stores the current vault key in SecureStore with `requireAuthentication` and device-only keychain accessibility. If that SecureStore item is missing, invalidated, or stale, biometric login disables biometrics and the user must log in with PIN before re-enabling it.

## Auth Failure Diagnostics

`authService` records a sanitized last-failure reason for UI messaging and debug diagnostics. Reasons distinguish cases such as missing master-key metadata, native KDF unavailability, KDF timeout, verifier mismatch, database initialization failure, and missing or invalid biometric key.

Failure reasons must not contain PINs, vault keys, password values, note content, or encrypted payloads.

## Import and Export

Exports are user-initiated. Encrypted exports use `KS1-PW1`, which wraps:

- KDF salt and parameters.
- KS1 ciphertext.
- Version metadata.

Imports are parsed as unknown data and validated before any object reaches `StorageService`.

## Testing Strategy

The test suite covers:

- Core services.
- Integration user flows.
- Source structure rules for lowercase directories and shared settings hooks.
- Compatibility and responsive behavior.
- Internationalization dictionary parity, placeholder parity, and hardcoded fallback regressions.
- Accessibility regressions for key icon-only controls and touch behavior.
- Large-list performance.
- Security regressions for biometric key handling, backup encryption, plaintext migration, and import validation.
