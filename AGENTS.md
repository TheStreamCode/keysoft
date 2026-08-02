# AGENTS.md - Keysoft Contributor Guide

## Project Snapshot

- Offline-first Android password manager built with Expo SDK 57, React Native, TypeScript.
- Security model: KS1 (AES-256-CBC + HMAC-SHA256) with Argon2/PBKDF2 key derivation.
- Android-first, iOS paused.

## Workflow And Commands

- Required toolchain: Bun 1.3.14 and Node.js 22.13 or newer
- Install: `bun install`; clean validation/CI: `bun install --frozen-lockfile`
- Dev server for Expo Go: `bun run start`
- Android with Expo Go: `bun run android`
- Expo Go tunnel: `bun run start:tunnel`
- Web: `bun run web`
- Preview cloud build: `bun run build:android:preview`
- Production cloud build: `bun run build:android:production`
- Production submit: `bun run submit:android:production` (Google Play submission is currently performed manually)
- Build from GitHub: EAS Workflow `.eas/workflows/build-android-production.yml` (Android production), triggered on a version tag push (`v*`) or manual dispatch only
- Android bundle export check: `bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export`
- Lint: `bun run lint`
- Typecheck: `bun run typecheck`
- Tests: `bun run test`
- Coverage CI tests: `bun run test:ci`
- Health check: `bunx expo-doctor`
- Full local checks: `bun run verify`
- Dependency audit: `bun run deps:audit`

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
- Keep debug logging message-only. Do not pass preference objects, vault records, generated passwords, or other structured user data to logging sinks.
- Copy secrets with `ClipboardService.copyToClipboard`, which schedules the auto-clear. Use `ClipboardService.copyPlainText` only for non-secret text such as a contact address; never route a password through it.
- Local secrets live in `.secrets/` and must never be committed.
- The project requires no local environment variables. Keep `.env.example` non-secret, never put credentials in `EXPO_PUBLIC_*`, and use EAS/GitHub secret stores for automation credentials.
- Treat imported files and KDF metadata as untrusted. Preserve backup/file-size and KDF-cost bounds when changing validation or crypto code.
- Password generation must apply every enabled option to every character set. The set that guarantees one character per class is the easy place to reintroduce an excluded character; keep it filtered and keep `src/__tests__/services/CryptoService.test.ts` generator coverage green.
- The development-only web crypto mock has separate generator coverage in `CryptoServiceMock.test.ts`; keep its special-character membership check based on the canonical alphabet rather than an ambiguous regular-expression range.
- Read `docs/security.md` "Known Limitations" before touching crypto. The shared AES/HMAC key and the PBKDF2 backup KDF are known, documented trade-offs, **not** bugs to fix in place: changing either silently makes every existing vault and every exported `KS1-PW1` backup undecryptable. Any change there needs a new format version plus a migration that runs in an authenticated session.
- Do not alter the KS1/KS1-PW1 payload layout, the storage keys in `storageService.ts`, or the default KDF parameters of an existing vault. Vaults carry their own KDF parameters, so new capabilities (a longer master password, for instance) can be added without breaking old data — prefer that route.
- Persist encrypted storage mutations and master-key verifier metadata before updating their decrypted/in-memory caches. If both a KDF metadata update and its vault rollback fail, clear authentication state and the in-memory key; never continue the session with uncertain storage. Reset only Keysoft-owned keys; do not use `AsyncStorage.clear()`.
- Clear backup passwords/ciphertext from UI state and remove temporary export files after sharing.

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
- Release builds must keep minification and resource shrinking enabled through `expo-build-properties`.
- `plugins/withAndroidReleaseOptimization.js` must keep `proguard-android-optimize.txt` and `android.r8.optimizedResourceShrinking=true` in generated Android projects.

## Testing Notes

- Update Jest mocks when AuthService, CryptoService, or StorageService surfaces change.
- Prefer unit tests in `src/__tests__/services`.
- Use `src/__tests__/contexts` for provider lifecycle tests and `src/__tests__/hooks` for hook workflow tests.
- Expo Go uses the PBKDF2 fallback because custom native modules are not available there; EAS/native builds may use Argon2.
- Use EAS/native builds for release-grade Argon2 validation; Expo Go vaults are development data.
- When R8 or native build configuration changes, verify optimized shrinking and the Argon2 keep rules in a temporary generated Android project before starting EAS.
- Dependency removals or native-package changes require `bun run verify` and a local Android export.

## Repository And CI

- Keep `bun.lock` committed and frozen in normal CI runs.
- Pin third-party GitHub Actions to full commit SHAs and keep workflow permissions minimal.
- Do not weaken the required `Validate` branch-protection check or bypass human review for dependency updates.
- Do not modify design, icons, or visual assets unless the task explicitly requests it. Lossless size optimization must preserve format, proportions, transparency, and visual quality.
- Never run EAS build, submit, deployment, tag, push, or release commands without explicit approval; these create external changes or consume cloud resources.

## Documentation

- `README.md` is the public project overview and setup guide.
- `CHANGELOG.md` tracks notable release and unreleased changes.
- `docs/architecture.md` documents system structure and data flow.
- `docs/security.md` documents the cryptographic and storage model, plus the accepted trade-offs under "Known Limitations".
- `docs/development.md` documents local workflow, coding standards, and verification.
- `docs/release.md` documents release readiness, Android permissions, and security checks.
- Update `README.md`, `CHANGELOG.md`, and the relevant `docs/` file for significant changes.
- Do not recreate `memory-bank`; it has been retired in favor of the `docs/` directory.
