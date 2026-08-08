# Security and Code Audit — 2026-08-08

## Executive Summary

The repository was reviewed across application code, cryptography and storage boundaries,
tests, dependencies, Expo/Android configuration, CI, GitHub security signals,
documentation, and release readiness. Nine actionable findings were remediated without
changing the KS1/KS1-PW1 formats, storage keys, existing-vault KDF parameters, UI, icons,
or visual assets.

No unresolved critical vulnerability was found in application code or the dependency
audit. The remaining package advisories are transitive findings in the Expo, React Native,
Jest, Babel, and ESLint toolchain and are tracked as accepted release debt until compatible
upstream versions are available. The documented KS1 key-sharing and KS1-PW1 PBKDF2-SHA1
trade-offs remain intentionally unchanged because an in-place change would make existing
vaults or backups unreadable.

## Scope and Method

The audit covered:

- authentication, KDF migration, biometric key lifecycle, encryption, storage, import and
  export, clipboard/logging boundaries, and untrusted-input validation;
- React Native hooks, contexts, screens, service mocks, and test isolation;
- package manifests and lockfile, Expo Doctor, dependency advisories, and Android export;
- generated Android permissions, release minification/resource shrinking, and Argon2 keep
  rules;
- GitHub Actions, Dependabot, branch-protection evidence, CodeQL alerts, documentation, and
  release checklists.

Static searches also checked for committed secrets, unsafe randomness, direct secret
clipboard paths, raw console logging, dynamic code execution, and broad AsyncStorage
clears. No high-confidence secret or dynamic-code-execution finding was identified.

## Remediated Findings

### KSA-001 — High — PIN/KDF transaction could split ciphertext and verifier state

**Location:** `src/services/auth/authService.ts`

After encrypted vault data and the new verifier were persisted, a later preference or
biometric failure could enter the general rollback path. That rollback restored ciphertext
to the old key without restoring the already persisted verifier, risking a vault that no
PIN could open.

**Resolution:** preference state is read before vault mutation. Ciphertext re-encryption
and verifier persistence now form the core transaction; in-memory authentication state is
committed immediately afterward. Biometric refresh and cleanup are isolated best-effort
work and cannot initiate a vault rollback. Pre-commit verifier failures still roll back
encrypted data, and a failed rollback clears authentication and the in-memory key.

### KSA-002 — Medium — Backup import allowed partial persistence and quadratic work

**Location:** `src/hooks/settings/useExportImport.ts`,
`src/services/storage/storageService.ts`

The import hook previously saved every password and note separately. A failure midway
left a partial import, and repeatedly encrypting a growing collection made large valid
backups unnecessarily expensive.

**Resolution:** validated records are merged by ID, limits are evaluated against the final
password set, both collections are encrypted before persistence, and one `multiSet` batch
is issued. Caches update only after that batch succeeds. The development web mock implements
the same merge and batch contract.

### KSA-003 — Medium — Unknown backup size bypassed the pre-read bound

**Location:** `src/services/import-export/backupValidation.ts`,
`src/hooks/settings/useExportImport.ts`

An absent picker size was previously accepted, allowing the complete selected file to be
read before the 10 MiB content check.

**Resolution:** native imports recover size from file metadata when necessary; unknown,
unsafe, negative, non-integer, or oversized values are rejected before file contents are
loaded.

### KSA-004 — Low — KS1 framing accepted impossible CBC payload lengths

**Location:** `src/services/crypto/cryptoService.ts`

The previous word-count check allowed a payload containing only IV and MAC, or ciphertext
whose byte length was not aligned to an AES block.

**Resolution:** KS1 decryption now requires IV + at least one 16-byte ciphertext block +
32-byte MAC and requires the ciphertext length to be divisible by 16 before MAC or AES
processing.

### KSA-005 — Medium — Collection clears did not require an authenticated vault key

**Location:** `src/services/storage/storageService.ts`

Individual password/note clear methods checked decryption errors but not whether the vault
key was active.

**Resolution:** both methods now use the same active-key/decryption-safety guard as other
secure mutations. The deliberate full-reset flow remains separately available and removes
only Keysoft-owned keys.

### KSA-006 — Medium — CI weakened lockfile enforcement for dependency automation

**Location:** `.github/workflows/ci.yml`, `.github/dependabot.yml`

CI used a non-frozen install for Dependabot, so dependency PR validation could test a
resolver-generated graph that was not represented by the committed lockfile.

**Resolution:** every CI actor now uses `bun install --frozen-lockfile`, and weekly Bun
Dependabot updates are configured to maintain the Bun manifest/lockfile pair.

### KSA-007 — Low — SDK patch drift and duplicate ESLint plugin registration

**Location:** `package.json`, `bun.lock`, `eslint.config.js`

Nine Expo packages were behind the versions selected for SDK 57. A separately installed
TypeScript ESLint plugin duplicated the plugin already registered by the Expo flat preset
after compatible updates.

**Resolution:** Expo-aligned patches and compatible navigation/tooling patches were
installed, the redundant plugin dependency/configuration was removed, and the frozen
install plus Expo Doctor checks pass.

### KSA-008 — Low — Unneeded overlay permission appeared in generated Android metadata

**Location:** `app.config.js`

The generated manifest included `SYSTEM_ALERT_WINDOW`, although Keysoft has no overlay
feature.

**Resolution:** the permission is explicitly blocked. A fresh prebuild emits a
`tools:node="remove"` directive alongside the existing blocked media/audio permissions.

### KSA-009 — Medium — Failed first-time setup left partial authentication state

**Location:** `src/services/auth/authService.ts`,
`src/services/storage/storageService.ts`

If initial database setup failed after the new verifier had been saved, setup returned
failure while the vault key remained in memory and the partial verifier remained
configured. A repeated setup call could also replace an existing verifier.

**Resolution:** setup now refuses to overwrite existing verifier metadata. If failure
occurs after saving a genuinely new verifier, it removes that verifier, clears the
in-memory vault key and authentication state, and reports failure. SecureStore deletion
still follows the persist-before-cache rule.

## Accepted and Monitored Risk

### Dependency advisories

`bun audit` reports 58 transitive advisories: 42 high, 14 moderate, and 2 low; none are
critical, so `bun audit --audit-level=critical` passes. Affected transitive packages include
`ajv`, `@xmldom/xmldom`, `brace-expansion`, `lodash`, `uuid`, `minimatch`, `form-data`,
`yaml`, `flatted`, `js-yaml`, `nanoid`, `node-forge`, `postcss`, `@babel/core`, `ws`,
`image-size`, and `picomatch`.

Most paths are build, lint, test, Metro, code-generation, or Expo CLI dependencies rather
than code shipped as a direct Keysoft runtime API. Forcing incompatible major overrides
would conflict with the supported Expo SDK 57 graph. The release gate therefore blocks
critical advisories and requires human review of lower severities on each update.

### CodeQL alerts

Three open `js/insufficient-password-hash` alerts were reviewed:

- `cryptoServiceMock.ts`: SHA-256 receives an already PBKDF2-derived key to create a
  compatibility verifier; it does not hash a raw password.
- `cryptoService.ts`: AES encrypts password-manager records with a KDF-derived vault key;
  this is data encryption, not password hashing.
- `CryptoService.test.ts`: the test invokes the production verifier creation path and
  contains no independent password-storage implementation.

These are scanner classification false positives. They were not remotely dismissed as
part of this local implementation.

### Format compatibility and device assumptions

The accepted limitations in `docs/security.md` remain in force: one key is shared between
KS1 AES and HMAC operations, KS1-PW1 uses PBKDF2-SHA1, the current master secret is six
digits, unlock has no attempt throttling, screenshot protection is opt-in, auto-lock is
transition-based, Android clipboard previews cannot be fully suppressed, and the OTA
update channel is trusted. Format changes require a new version and authenticated
migration.

## Verification Evidence

| Check                          | Result                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Frozen Bun install             | Passed; no lockfile changes                                                                   |
| Formatting, TypeScript, ESLint | Passed                                                                                        |
| Jest with coverage             | 30 suites, 212 tests passed                                                                   |
| Expo Doctor                    | 20/20 checks passed                                                                           |
| Critical dependency audit      | Passed; zero critical advisories                                                              |
| Full dependency audit          | 58 transitive advisories: 42 high, 14 moderate, 2 low                                         |
| Android JS bundle export       | Passed; 1,652 modules bundled                                                                 |
| Generated Android permissions  | Expected permissions present; blocked media/audio/overlay directives present                  |
| Release shrinking              | `minifyEnabled`, `shrinkResources`, `proguard-android-optimize.txt`, and optimized R8 present |
| Argon2 native rules            | `com.poowf.argon2` and `com.reactnativeargon2` keep rules present                             |

The initial baseline run had one isolated timeout in the authentication integration suite;
the focused suite passed immediately afterward and the final full coverage run passed all
212 tests. No timeout suppression or increased global timeout was introduced.

## Release Boundary

This audit performed local source changes, dependency resolution, tests, an Android bundle
export, and a temporary native prebuild. It did not start an EAS build, submit to Google
Play, create a tag or release, push commits, change secrets, dismiss GitHub alerts, or
deploy anything.

## Post-Audit Publication Follow-Up — 2026-08-09

The audited changes were subsequently published for review in GitHub PR #35 with green CI
and CodeQL analysis. The existing `js/insufficient-password-hash` alert on the KS1 encryption
call was dismissed as a false positive with a repository-visible technical justification:
the operation reversibly encrypts vault records under an already KDF-derived key and is not
password-authentication hashing. Keysoft 3.3.1 packages the audited changes without altering
the KS1/KS1-PW1 formats or accepted compatibility boundaries.
