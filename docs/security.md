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

Untrusted KDF metadata is range-checked before derivation. PBKDF2 iterations are limited to 1,000,000; Argon2 iterations to 10; and Argon2 memory to 256 MiB. This prevents a malformed local record or imported encrypted payload from requesting unbounded CPU or memory work.

Derived keys are normalized to 64-character lowercase hex strings. Invalid derived key formats are rejected. Argon2id derivation is bounded by the shared KDF timeout so a slow native release device cannot block login indefinitely. If stored vault metadata requires Argon2id (`memory > 0`) and the native Argon2 module is unavailable, login fails with a native-KDF diagnostic instead of falling back to PBKDF2 and reporting a misleading invalid PIN.

### Transparent KDF upgrade on login

Vaults created with legacy parameters — either PBKDF2 (`memory = 0`) or the old heavy Argon2id (`64 MiB / t = 3`) — are transparently upgraded to the current Argon2id parameters on the next successful password login, while the vault is decrypted in memory. The upgrade re-derives a new key (new salt and verifier), precomputes both encrypted collections, persists them in one batched storage call, and uses explicit rollback if the following verifier update fails. Recoverable failures restore the previous working key and retry on the next login. If both verifier persistence and rollback fail, Keysoft closes the authenticated session and clears the in-memory key rather than allowing further writes against uncertain storage. Biometric logins do not trigger the upgrade (no password is available); the next password login performs it.

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

### Key separation

KS1 derives a single 256-bit key and uses that same value both as the AES-256-CBC
encryption key and as the HMAC-SHA256 authentication key. Standard practice is to split
the KDF output into two independent subkeys (for example with HKDF). No practical attack
on AES-CBC + HMAC-SHA256 under a shared key is known, and encrypt-then-MAC still provides
integrity, but the construction does not follow the key-separation principle.

Changing this is a vault-format break: every existing vault and every previously exported
`KS1-PW1` backup would stop decrypting. It must not be changed without an explicit,
versioned migration that re-encrypts vault data during an authenticated session.

## Backup Encryption

Encrypted backup payloads use `KS1-PW1`.

The payload contains:

- `version`: payload version.
- `kdf`: salt, iterations, and memory metadata.
- `data`: KS1 ciphertext.

The export password is never used directly as a KS1 key. It is first passed through a KDF to derive a valid encryption key.

That KDF is PBKDF2 at 100,000 iterations with the `crypto-js` default hash (HMAC-SHA1),
recorded in the payload as `memory = 0`. It is therefore materially weaker than the
Argon2id used to unlock the vault itself, and it offers no memory hardness against
GPU or ASIC cracking of an exported file. Users should treat an encrypted export as
only as strong as the export password they choose, and should pick a long passphrase
rather than a short one. Backups are the one vault artifact that can leave the device,
so this is the weakest link in the current design.

The KDF identifier is part of the `KS1-PW1` payload, so a stronger KDF can only be
introduced as a new payload version that still reads `KS1-PW1` files.

Backup imports are limited to 10 MiB and validate collection sizes and field lengths before any object reaches storage. An import whose size cannot be established is rejected before the file is read. Valid records are merged by ID, encrypted in memory, and persisted in one batched storage operation; decrypted caches change only after persistence succeeds. Export passwords and imported ciphertext are removed from UI state on close, while temporary export files are deleted after sharing completes.

## Biometric Authentication

Biometric authentication stores the current vault key in `expo-secure-store` only after the user enables biometrics from an authenticated session.

Expected behavior:

- The stored biometric key uses `requireAuthentication: true` and `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`.
- Biometric login reads that SecureStore item, verifies it against the master-key verifier, loads vault metadata, initializes storage, and authenticates the session.
- If the SecureStore item is missing, invalidated by biometric enrollment changes, or no longer verifies, biometrics are disabled and the user must log in with PIN and re-enable biometrics.
- When the PIN changes, ciphertext and verifier metadata commit before biometric maintenance. The biometric key is then updated to the new vault key. If that update fails, biometrics are disabled and the stale key is deleted on a best-effort basis; biometric cleanup can never roll back an already committed PIN change.

## Storage Rules

- Passwords and notes must be encrypted before storage.
- The storage service must reject secure writes if no encryption key is available.
- Legacy plaintext arrays are immediately re-encrypted when loaded with an active encryption key.
- Writes are blocked after decryption errors until the unsafe state is resolved.
- Mutations persist encrypted data before changing the decrypted cache, so a failed write cannot expose an uncommitted value through later reads.
- Backup imports prepare every changed encrypted collection before one batched write and update neither cache if that write fails.
- Imported records are merged by ID and checked against post-merge collection limits before
  encryption, preventing both partial persistence and repeated quadratic writes.
- Clearing a password or note collection requires an active vault key and is blocked after a decryption error.
- Master-key verifier metadata is written to SecureStore before its in-memory cache is updated. A failed SecureStore write leaves the previously persisted and cached verifier unchanged.
- Initial PIN setup refuses to replace existing verifier metadata. If first-time database initialization fails after saving a new verifier, that verifier is removed and authentication/key state is cleared before setup reports failure.
- Reset removes only Keysoft-owned AsyncStorage keys; it must not call the process-wide `AsyncStorage.clear()` API.

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

Authentication diagnostics may include sanitized failure reasons such as native KDF unavailable, KDF timeout, verifier mismatch, database initialization failure, or biometric key unavailable. Debug output is message-only: structured preferences, vault records, generated passwords, derived keys, SecureStore values, and decrypted vault data must never be passed to logging sinks.

Production error logs contain only the sanitized message. Error objects and structured diagnostic context are emitted only in development because native errors can include file paths or platform details.

## Local Secrets

Operational secrets belong in `.secrets/`, which is ignored by git. Keystores, credentials, environment files, certificates, and signing material must never be committed. Keep Android signing files locally or in the platform-provided secret store used by EAS/Play Console.

## Known Limitations

These are accepted, documented properties of the current design rather than defects to be
silently patched. Each one is a deliberate trade-off; changing any of them requires a
security-design review, and the first two additionally require a versioned data migration.

- **Shared encryption/authentication key.** See "Key separation" above.
- **Backup KDF is PBKDF2-SHA1, not Argon2id.** See "Backup Encryption" above.
- **The master secret is a 6-digit PIN.** The onboarding and unlock flows accept exactly
  six digits, so the keyspace is 10^6. Argon2id makes each guess expensive, but an
  attacker who extracts both the SecureStore metadata (salt and verifier) and the
  encrypted AsyncStorage vault from a compromised or rooted device can mount an offline
  search. Supporting a longer or alphanumeric master password would raise this ceiling
  and can be added without breaking existing vaults, because each vault already stores
  its own KDF parameters.
- **No failed-attempt throttling or lockout.** Unlock attempts are limited only by the
  cost of Argon2id; there is no attempt counter, backoff, or wipe-after-N-failures.
- **Screenshot protection is opt-in.** `screenshotProtectionEnabled` defaults to `false`,
  so by default vault screens can be screenshotted and appear in the Android recents
  preview. The setting is exposed in Settings.
- **Auto-lock is transition-based.** The vault locks when the app returns to the
  foreground after spending longer than the configured timeout in the background. There is
  no idle timer while the app stays in the foreground, so a session left open on an
  unattended unlocked device stays unlocked.
- **Clipboard previews on Android 13+.** Copied secrets are cleared automatically after
  the configured timeout, but the system clipboard preview can still display the value at
  copy time. Suppressing it requires the ClipData "is sensitive" extra, which the
  `expo-clipboard` version bundled with Expo SDK 57 does not expose through
  `SetStringOptions`. Re-evaluate when upgrading `expo-clipboard`.
- **Over-the-air updates are trusted.** `expo-updates` can replace application JavaScript
  after install. The update channel is therefore part of the trusted computing base: an
  attacker controlling it could ship code that reads an unlocked vault. Vault data itself
  is never transmitted.

## Security Verification

Run before release:

```bash
bun run verify
bun run deps:audit
bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export
```

Security-sensitive changes should add or update tests in `src/__tests__/services`.

The latest repository-wide review is recorded in
[`security-audit-2026-08-08.md`](security-audit-2026-08-08.md).
Its release follow-up is documented in the Keysoft 3.3.1 release notes.
