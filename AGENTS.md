# AGENTS.md - Keysoft Contributor Guide

## Project Snapshot

- Offline-first Android password manager built with Expo SDK 55, React Native, TypeScript.
- Security model: KS1 (AES-256-CBC + HMAC-SHA256) with Argon2/PBKDF2 key derivation.
- Android-first, iOS paused.

## Workflow And Commands

- Install: `bun install`
- Dev server for Expo Go: `bun run start`
- Android with Expo Go: `bun run android`
- Expo Go tunnel: `bun run start:tunnel`
- Web: `bun run web`
- Preview cloud build: `bun run build:android:preview`
- Production cloud build: `bun run build:android:production`
- Production submit: `bun run submit:android:production`
- Android bundle export check: `bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export`
- Lint: `bun run lint`
- Typecheck: `bun run typecheck`
- Tests: `bun run test`
- Health check: `bunx expo-doctor`

## Code Style

- Use TypeScript with strict mode and interfaces over types.
- Use functional components and hooks; avoid classes.
- Use the `function` keyword for pure functions.
- Prefer named exports.
- Use descriptive boolean names like `isLoading`, `hasError`.
- Keep files structured as: exported component, subcomponents, helpers, static content, types.
- Use lowercase-with-dashes for directory names.

## Architecture

- UI in `src/screens` and `src/components`.
- Business logic in `src/services`.
- Shared state in `src/contexts`.
- Complex screen logic in `src/hooks`.

## Security Rules

- Use `src/utils/cryptoRandom.ts` for any randomness. Do not use `Math.random` for security-sensitive operations.
- Always derive keys via `CryptoService.deriveKey` and verify with `CryptoService.verifyDerivedKey`.
- Derived keys must be 64-char hex strings.
- Keep the active vault key in memory by default. The only allowed persistence exception is SecureStore-backed biometric unlock via `StorageService.saveBiometricKey/getBiometricKey/deleteBiometricKey`, with device authentication required and no logging.
- Update or delete the biometric SecureStore key when biometrics are disabled or the PIN changes.
- Do not log secrets. Use `Logger` with sanitized messages.
- Local secrets live in `.secrets/` and must never be committed.

## Internationalization

- All user-visible strings must use `t('key')`.
- No fallbacks like `t('key') || 'Fallback'`.
- Add keys in both Italian and English dictionaries.

## Android Permissions And Updates

- Day-to-day Android development uses Expo Go.
- Build artifacts are produced on expo.dev through EAS, not local Gradle.
- EAS build commands upload the project to expo.dev and require explicit approval before running.
- Keep `app.config.js`, EAS profiles, and generated native configuration in sync when permissions or updates change.
- `INTERNET` is allowed only for Expo/EAS update delivery; do not add vault sync or remote secret transport.
- Camera feature requires `CAMERA`.
- `READ_MEDIA_*` permissions are blocked.
- `POST_NOTIFICATIONS` is required on Android 13+ for local notifications.
- `expo-updates` is enabled; update manifest and config together if changing.

## Testing Notes

- Update Jest mocks when AuthService, CryptoService, or StorageService surfaces change.
- Prefer unit tests in `src/__tests__/services`.
- Use `src/__tests__/contexts` for provider lifecycle tests and `src/__tests__/hooks` for hook workflow tests.
- Expo Go uses the PBKDF2 fallback because custom native modules are not available there; EAS/native builds may use Argon2.
- Use EAS/native builds for release-grade Argon2 validation; Expo Go vaults are development data.

## Documentation

- `README.md` is the public project overview and setup guide.
- `CHANGELOG.md` tracks notable release and unreleased changes.
- `docs/architecture.md` documents system structure and data flow.
- `docs/security.md` documents the cryptographic and storage model.
- `docs/development.md` documents local workflow, coding standards, and verification.
- `docs/release.md` documents release readiness, Android permissions, and security checks.
- Update `README.md`, `CHANGELOG.md`, and the relevant `docs/` file for significant changes.
- Do not recreate `memory-bank`; it has been retired in favor of the `docs/` directory.
