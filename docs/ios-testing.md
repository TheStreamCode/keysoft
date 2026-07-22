# iOS Testing Without Apple Hardware

Keysoft can be tested in an iOS Simulator without enrolling in the paid Apple Developer Program. This is useful for layout, navigation, localization, vault workflows, and crash discovery. App Store publication is intentionally not planned.

## EAS Simulator Build

The `ios-simulator` EAS profile sets `ios.simulator` to `true`. Expo documents that this standalone simulator build does not require an Apple Developer account.

After explicit approval for the EAS upload, run:

```powershell
bun run build:ios:simulator
```

Download the resulting simulator artifact from Expo. Appetize accepts a `.zip` or `.tar.gz` containing the `.app` bundle.

## Appetize Upload

Keep the Appetize API token outside the repository. Use an environment variable only in the shell that performs the approved upload:

```powershell
$env:APPETIZE_API_TOKEN = Read-Host -MaskInput "Appetize API token"
```

Prefer Appetize's authenticated web upload for a manual build, or configure `APPETIZE_API_TOKEN` as a masked secret in the chosen CI platform when automation is approved. Clear the process variable after use with `Remove-Item Env:APPETIZE_API_TOKEN`. Never paste the token into source code, `.env` files committed to Git, logs, issues, or support messages.

Appetize's direct upload API uses `POST https://api.appetize.io/v1/apps`, the `X-API-KEY` header, a multipart `file` field, and `platform=ios`. Updating an existing app uses its build identifier endpoint. An upload changes external state and must be explicitly approved each time.

Use synthetic test credentials only. Appetize streams a cloud simulator, so do not enter real passwords, production backups, or other personal vault secrets.

## Test Matrix

Run the core workflow in both light and dark appearance, English and Italian, and at minimum these targets:

- Current iPhone Pro size in portrait and landscape.
- Small iPhone size for clipping and keyboard behavior.
- iPad Air and iPad Pro sizes in portrait, landscape, and narrow split-view widths.
- Larger text and reduced-motion accessibility settings where the platform exposes them.

Verify:

1. First launch, master-password setup, lock, password login, incorrect-password handling, and auto-lock.
2. Create, view, edit, search, copy, and delete credentials; create and edit secure notes.
3. Vault-health weak, reused, and expired findings without revealing secret values.
4. Backup export/import using synthetic vault data and user-selected files.
5. Theme, language, keyboard, safe areas, rotation, iPad multi-window sizing, and screen-reader labels.
6. Offline startup and vault use; confirm that vault secrets are never sent over the network.
7. App background/foreground behavior, screenshot protection, local notifications, and update-channel behavior.

## Simulator Coverage Limits

- Face ID/Touch ID behavior and Secure Enclave-backed authentication.
- Clipboard behavior across real apps and automatic clearing under real lifecycle conditions.
- Camera/photo permissions, local notification prompts, memory pressure, and real background suspension.
- Release-grade Argon2 performance and cold password-login timing.
- Hardware-specific behavior that cannot be represented by an iOS Simulator.

## Distribution Cost Boundary

Simulator testing and local development can be done without paid Apple membership. The project therefore keeps iOS simulator support but does not include an App Store publication or annual membership workflow.
