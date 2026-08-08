# Public Repository Checklist

Use this checklist before making the repository public or before announcing it as
publicly reviewable.

## Required Before Public Visibility

- Confirm no signing material is present in the current tree:
  ```bash
  git ls-files keystore .secrets .env* '*.jks' '*.keystore' '*.jksp8' '*.p12' '*.pem'
  ```
- Confirm no local secrets are staged:
  ```bash
  git status --short
  ```
- Review `.gitignore` and `.easignore` for keystores, certificates, env files,
  build artifacts, local agent state, and temporary folders.
- Confirm license consistency across `LICENSE`, `package.json`, README, and
  contributor guidance.
- Confirm first-party assets and dependencies have documented, compatible
  provenance and license terms.
- Review `README.md`, `LICENSE`, `COPYRIGHT.md`, `TRADEMARKS.md`,
  `SECURITY.md`, and `CONTRIBUTING.md`.
- Confirm the README leads with a clear product promise, a working store call to action,
  current production screenshots, and links to privacy, security, and the latest release.
- Keep exact test/dependency snapshots in dated audits or releases instead of duplicating
  fast-stale counters in the product overview.
- Configure a repository social preview using a first-party image of at least 640x320 and
  point the repository homepage to the most useful current product destination.
- Run release verification:
  ```bash
  bun run verify
  bun run deps:audit
  bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export
  ```

## Historical Secret Exposure

Removing a secret from the current tree does not remove it from Git history.
If a keystore, certificate, token, or private config was ever committed before
the repository becomes public, do one of the following before publication:

- Rewrite repository history to remove the sensitive file and force-push the
  cleaned history after coordination with collaborators.
- Rotate or revoke the exposed signing material or credential.

Do not rely on a normal delete commit as the only remediation for a file that
was already committed.

- Scan repository history for secrets before publication and remediate any
  findings.

## Apache-2.0 Distribution

Before distributing an Android release binary or an iOS simulator test artifact:

- Create and retain a release tag that identifies the exact source used for the binary.
- Include the complete Apache-2.0 license in the repository and offline legal screen.
- Preserve applicable copyright, patent, trademark, attribution, and dependency notices.
- Review `THIRD_PARTY_NOTICES.md` against the resolved lockfile and packaged native dependencies.
- Ensure modified third-party files carry any notices required by their licenses.
- Verify **Settings > Open source and legal** works offline and links to the official repository and trademark policy.
- Verify the localized public Keysoft privacy notice matches current permissions, Expo Updates behavior, data handling, Android distribution, and the iOS simulator-only boundary.

## GitHub Repository Settings

Recommended settings:

- Enable branch protection on `main`.
- Require CI to pass before merge.
- Enable Dependabot alerts and security updates.
- Enable private vulnerability reporting if available.
- Verify vulnerability reporting and dependency-vulnerability settings are
  enabled and have an owner.
- Disable force pushes on protected branches after any required history cleanup.
- Keep GitHub Actions permissions at read-only by default unless a workflow
  requires write access.
- Disable blank issues when structured bug, feature, and private vulnerability-reporting
  paths are available.

## Current Public Configuration

The public repository is `TheStreamCode/keysoft` and uses `main` as the default
branch. The current branch protection policy requires:

- the `Validate` CI status check to pass;
- one approving pull request review;
- stale reviews to be dismissed after new commits;
- conversation resolution before merge;
- linear history;
- force pushes and branch deletion to remain disabled.

GitHub personal repositories do not support user/team push restrictions in the
classic branch protection API. The repository is therefore configured with
administrator bypass disabled for non-admin collaborators by permission model:
`TheStreamCode` is the only collaborator with push/admin access, and all other
contributors must use pull requests.
