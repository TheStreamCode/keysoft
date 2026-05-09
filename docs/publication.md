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
- Review `README.md`, `LICENSE`, `SECURITY.md`, and `CONTRIBUTING.md`.
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

## GitHub Repository Settings

Recommended settings:

- Enable branch protection on `main`.
- Require CI to pass before merge.
- Enable Dependabot alerts and security updates.
- Enable private vulnerability reporting if available.
- Disable force pushes on protected branches after any required history cleanup.
- Keep GitHub Actions permissions at read-only by default unless a workflow
  requires write access.
