# Contributing

Thanks for taking the time to improve Keysoft.

Keysoft is security-sensitive software. Changes should be small, reviewable, and
backed by tests when they affect authentication, cryptography, storage,
biometrics, import/export, notifications, or release configuration.

## Development Setup

```bash
bun install
bun run start
```

Android development uses Expo Go for day-to-day work. Release-grade validation
for Argon2 and native modules requires an EAS/native Android build.

## Before Opening A Pull Request

Run:

```bash
bun run typecheck
bun run lint
bun run test
bunx expo-doctor
```

For Android release-related changes, also run:

```bash
bunx expo export --platform android --output-dir C:\tmp\keysoft-android-export
```

## Security Rules

- Do not commit keystores, certificates, passwords, tokens, `.env` files, or
  anything from `.secrets/`.
- Do not log PINs, vault keys, passwords, note content, backup payloads, or
  biometric SecureStore values.
- Use `src/utils/cryptoRandom.ts` for randomness.
- Keep user-visible strings in both `src/locales/it.ts` and
  `src/locales/en.ts`.
- Treat changes to KDF parameters, vault encryption, biometric unlock, and
  backup formats as security-sensitive.

## Pull Request Style

Use focused PRs with:

- A concise summary of behavior changes.
- Tests run and their results.
- Screenshots only for UI changes.
- Explicit notes for migrations, release config, permissions, or security
  tradeoffs.
