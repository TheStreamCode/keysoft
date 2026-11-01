# Play Store release notes

These notes appear on Google Play and are written for people who use the app, not for
developers. They are separate from the technical `CHANGELOG.md` on GitHub.

## Format

Create one folder per release, named exactly like the version in `package.json`:

```
store/play/release-notes/3.3.3/
  it-IT.txt
  en-US.txt
```

Both files are required. Each file must be plain text, between 1 and 500 characters,
including spaces. Google Play rejects longer notes.

## Writing rules

- Explain what changed for the user, in one or two short sentences.
- Use everyday language: no class names, APIs, build tools, version codes or commit jargon.
- Prefer concrete benefits: easier, faster, safer, clearer.
- Mention fixes only in general terms unless the fix is the main point of the release.
- Do not include links, support addresses, emoji or marketing claims.
- Keep Italian and English aligned in meaning; translate rather than rewriting separately.
- A release without valid notes fails the publishing workflow before the release leaves draft.

## Example

`it-IT.txt`

```
Questa versione rende più semplice trovare e organizzare le password. Abbiamo anche
migliorato la stabilità e corretto alcuni problemi segnalati.
```

`en-US.txt`

```
This release makes it easier to find and organize your passwords. We also improved
stability and fixed several reported issues.
```

## Where the workflow uses them

EAS Submit uploads the production bundle as a draft. The `Release` workflow then runs
`scripts/play-release-notes.mjs`, which adds these notes and promotes the draft to a
completed production release. If the notes are missing or invalid, the workflow stops
and the release remains a draft.
