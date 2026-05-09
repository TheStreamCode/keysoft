# Security Policy

Keysoft is an offline-first password manager. Please report vulnerabilities
privately and avoid sharing exploit details in public issues.

## Supported Versions

The actively maintained version is the latest version on `main` and the latest
production Android release.

## Reporting A Vulnerability

Send a private report to the repository owner through GitHub private contact
channels or another private channel already agreed with the maintainer.

Include:

- Affected version or commit.
- Device/platform details.
- Reproduction steps.
- Expected and observed behavior.
- Impact assessment.
- Any proof of concept that does not expose real user data.

Do not include real vault contents, PINs, exported backups, signing material, or
personal credentials in reports.

## Scope

In scope:

- Authentication bypass.
- Vault encryption, decryption, or integrity failures.
- Secret leakage through logs, storage, notifications, clipboard, or backups.
- Biometric unlock flaws.
- Import/export validation issues.
- Release or signing material exposure.

Out of scope:

- Issues requiring a fully compromised device with access to app memory during
  an unlocked session.
- Social engineering.
- Vulnerabilities in unsupported forks or modified binaries.
- Reports without a reproducible security impact.

## Disclosure

Please allow time for triage, fix preparation, and release. Public disclosure
should be coordinated with the maintainer after a patched version is available.
