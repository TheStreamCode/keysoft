# Security Architecture

## Security Goals

Keysoft is designed to protect local vault data without depending on a remote service. The primary goals are:

- Keep vault content encrypted at rest.
- Keep the derived encryption key in memory unless the user explicitly enables biometric unlock.
- Detect ciphertext tampering before decryption output is trusted.
- Avoid logging or exposing secrets.
- Keep import/export flows explicit and user-controlled.

## Threat Model

Keysoft protects against:

- Casual local data inspection.
- Plaintext leakage through app storage.
- Accidental corruption from writes after decryption failures.
- Backup import of malformed or unexpected object shapes.
- Secret exposure through logs and local notifications.

Keysoft does not protect against:

- A fully compromised device.
- Malware with access to app memory during an active unlocked session.
- Loss of master password.
- User mishandling of exported backup files.

## Key Derivation

Master-password authentication derives a vault key using:

- Argon2id in EAS/native builds where the native module is available, with the OWASP minimum parameters (`memory = 19456` KiB ≈ 19 MiB, `iterations = 2`, `parallelism = 1`). These are strong yet far lighter than the previous `64 MiB / t = 3`, so unlocking is noticeably faster on entry-level phones and tablets.
- PBKDF2 fallback in Expo Go for new development vaults and for vault metadata that explicitly uses PBKDF2 (`memory = 0`).

Each vault stores its own KDF parameters (`salt`, `iterations`, `memory`) in its metadata, so the parameters used to verify a login always match the ones the vault was created with.

Derived keys are normalized to 64-character lowercase hex strings. Invalid derived key formats are rejected. Argon2id derivation is bounded by the shared KDF timeout so a slow native release device cannot block login indefinitely. If stored vault metadata requires Argon2id (`memory > 0`) and the native Argon2 module is unavailable, login fails with a native-KDF diagnostic instead of falling back to PBKDF2 and reporting a misleading invalid PIN.

### Transparent KDF upgrade on login

Vaults created with legacy parameters — either PBKDF2 (`memory = 0`) or the old heavy Argon2id (`64 MiB / t = 3`) — are transparently upgraded to the current Argon2id parameters on the next successful password login, while the vault is decrypted in memory. The upgrade re-derives a new key (new salt and verifier) and re-encrypts the vault atomically. It is best-effort and non-destructive: on any failure the vault is left on its previous working key and the upgrade simply retries on the next login, so the user is never locked out. Biometric logins do not trigger the upgrade (no password is available); the next password login performs it.

When creating or changing the PIN, the verifier metadata and the vault key are produced from the same KDF result. This avoids a duplicate KDF pass for the same new PIN while preserving the configured KDF cost and the 64-character derived-key requirement.

Expo Go is intended for development and smoke testing. Because Expo Go cannot load the custom Argon2 native module, vaults created there store PBKDF2 KDF metadata and should not be treated as release-grade Argon2 validation data.

## Network And Updates

Vault operations are local-first and do not sync, upload, or transmit vault contents, PINs, master passwords, or encryption keys.

The Android `INTERNET` permission is retained for platform services such as Expo/EAS updates. Update connectivity must not be used as a vault transport channel.

Expo Updates may receive technical data needed to serve and operate compatible updates, including the device operating system/platform, randomized update-delivery tokens, app/build and runtime versions, IP address, request headers, errors, performance metrics, and update interactions. It must never receive vault secrets. Keysoft does not include separate analytics, advertising, remote backup, push-notification, or crash-reporting SDKs.

The in-app notice in `src/locales/it.ts` and `src/locales/en.ts` and the public policy at `mikesoft.it/{locale}/keysoft-policy/` must stay aligned with `app.config.js` and the implemented data paths. Permission, update, backup, biometric, clipboard, profile-image, KDF, or platform-distribution changes require a privacy-text review in both repositories.

Any future network feature must be documented before implementation and reviewed as a security-design change. Do not introduce analytics, remote backup, vault sync, or secret transport under the existing update-only permission rationale.

## Vault Encryption

Vault data uses the KS1 format:

- AES-256-CBC encryption.
- HMAC-SHA256 integrity check.
- Encrypt-then-MAC construction.
- Random IV generated from CSPRNG.

Decryption verifies the MAC before trusting plaintext output.

## Backup Encryption

Encrypted backup payloads use `KS1-PW1`.

The payload contains:

- `version`: payload version.
- `kdf`: salt, iterations, and memory metadata.
- `data`: KS1 ciphertext.

The export password is never used directly as a KS1 key. It is first passed through a KDF to derive a valid encryption key.

## Biometric Authentication

Biometric authentication stores the current vault key in `expo-secure-store` only after the user enables biometrics from an authenticated session.

Expected behavior:

- The stored biometric key uses `requireAuthentication: true` and `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`.
- Biometric login reads that SecureStore item, verifies it against the master-key verifier, loads vault metadata, initializes storage, and authenticates the session.
- If the SecureStore item is missing, invalidated by biometric enrollment changes, or no longer verifies, biometrics are disabled and the user must log in with PIN and re-enable biometrics.
- When the PIN changes, the biometric key is updated to the new vault key. If that update fails, biometrics are disabled and the stale key is deleted.

## Storage Rules

- Passwords and notes must be encrypted before storage.
- The storage service must reject secure writes if no encryption key is available.
- Legacy plaintext arrays are immediately re-encrypted when loaded with an active encryption key.
- Writes are blocked after decryption errors until the unsafe state is resolved.

## Randomness

All application randomness must go through `src/utils/cryptoRandom.ts`.

Do not use:

```ts
Math.random();
```

Use:

```ts
getRandomBytes();
randomInt();
bytesToHex();
```

## Logging

Use the central `Logger` service. Do not log:

- Master password or PIN.
- Derived encryption keys.
- Password values.
- Note contents.
- Raw backup payload secrets.

Authentication diagnostics may include sanitized failure reasons such as native KDF unavailable, KDF timeout, verifier mismatch, database initialization failure, or biometric key unavailable. They must not include user-entered PINs, derived keys, SecureStore values, or decrypted vault data.

## Local Secrets

Operational secrets belong in `.secrets/`, which is ignored by git. Keystores, credentials, environment files, certificates, and signing material must never be committed. Keep Android signing files locally or in the platform-provided secret store used by EAS/Play Console.

## Security Verification

Run before release:

```bash
bun run typecheck
bun run lint
bun run test
bunx expo-doctor
bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export
```

Security-sensitive changes should add or update tests in `src/__tests__/services`.
