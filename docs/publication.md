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
- Run release verification:
  ```bash
  bun run typecheck
  bun run lint
  bun run test
  bunx expo-doctor
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

## GPL Binary Distribution

Before distributing an Android binary, select and follow a GPLv3 section 6
object-code distribution method. For the normal store-download case, make the
Corresponding Source for the exact released version available from the same
place or through an equally accessible source link at no further charge. Keep
that exact Corresponding Source publicly accessible at no charge for as long as
the corresponding binary is distributed under the selected section 6 method.

- Create and retain a release tag that identifies the exact source used for the
  binary.
- Make the full Corresponding Source available: source files plus the scripts,
  configuration, and other material needed to generate, install, and run the
  distributed work.
- Ship a complete copy of GPLv3 with the binary or make the complete license
  text accessible inside the distributed app; a store-listing or app-notice URL
  alone is not sufficient.
- Include a GPL and Corresponding Source link in the store listing or app legal
  notice, as appropriate for the distribution channel.
- Preserve required copyright, license, and dependency notices with the
  distribution.
- Before release, verify the dependency license inventory and required notices;
  do not assume a package-manager dependency is notice-free.

If using a GPLv3 section 6 written-offer method instead, give anyone who
possesses the binary a written offer to provide the complete Corresponding
Source on a durable physical medium or from a network server. The offer must be
valid for at least three years and for as long as spare parts or customer
support are offered for that product model. Retain the source, offer, and
release records for the applicable period. Follow the specific section 6
method's conditions; different rules apply to noncommercial individual
transfers and peer-to-peer distribution.

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
