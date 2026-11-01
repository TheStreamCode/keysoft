#!/usr/bin/env node
/**
 * Publish the short, user-facing Play Store release notes for the version in
 * package.json. EAS Submit uploads the bundle as a draft; this script adds the
 * notes and promotes the draft to a completed production release in one edit.
 *
 * The service account needs release permissions on the app. The key is read
 * from GOOGLE_SERVICE_ACCOUNT_KEY_PATH, GOOGLE_SERVICE_ACCOUNT_JSON, or
 * --key-file. Release notes live in store/play/release-notes/<version>/ and
 * are split by Play locale, for example it-IT.txt and en-US.txt.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";

const MAX_RELEASE_NOTES_LENGTH = 500;
const DEFAULT_PACKAGE_NAME = "it.mikesoft.keysoft";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

function parseArgs(argv) {
  const result = { dryRun: false, keyFile: null, packageName: DEFAULT_PACKAGE_NAME };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--dry-run") {
      result.dryRun = true;
    } else if (value === "--key-file") {
      result.keyFile = argv[++i];
    } else if (value === "--package") {
      result.packageName = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return result;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadServiceAccount(args) {
  const keyFile =
    args.keyFile ??
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim() ??
    null;

  if (keyFile) {
    return readJson(keyFile);
  }

  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!inline) {
    throw new Error(
      "No Google service account key. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH, GOOGLE_SERVICE_ACCOUNT_JSON, or pass --key-file.",
    );
  }
  return JSON.parse(inline);
}

function loadReleaseNotes(version, rootDir) {
  const notesDir = path.join(rootDir, "store", "play", "release-notes", version);
  if (!fs.existsSync(notesDir)) {
    throw new Error(
      `Missing Play Store release notes for ${version}: expected ${path.relative(rootDir, notesDir)}.`,
    );
  }

  const files = fs
    .readdirSync(notesDir)
    .filter((file) => file.endsWith(".txt"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .txt release note files in ${path.relative(rootDir, notesDir)}.`);
  }

  const notes = files.map((file) => {
    const locale = path.basename(file, ".txt");
    const text = fs.readFileSync(path.join(notesDir, file), "utf8").replace(/\r\n/g, "\n").trim();
    const length = [...text].length;
    if (length === 0) {
      throw new Error(`Release note ${file} is empty.`);
    }
    if (length > MAX_RELEASE_NOTES_LENGTH) {
      throw new Error(
        `Release note ${file} is ${length} characters; Google Play accepts at most ${MAX_RELEASE_NOTES_LENGTH}.`,
      );
    }
    return { language: locale, text };
  });

  const languages = new Set(notes.map((note) => note.language));
  if (!languages.has("it-IT") || !languages.has("en-US")) {
    throw new Error("Play Store release notes must include it-IT.txt and en-US.txt.");
  }

  return notes;
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken(account) {
  if (!account.client_email || !account.private_key) {
    throw new Error("The service account key is missing client_email or private_key.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: account.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(account.private_key, "base64url");

  const response = await fetch(account.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("Google token exchange returned no access token.");
  }
  return payload.access_token;
}

function apiUrl(packageName, suffix) {
  return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}${suffix}`;
}

async function apiRequest(token, method, url, body) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Play API ${method} ${url} failed with HTTP ${response.status}: ${detail.slice(0, 500)}`);
  }

  if (response.status === 204) {
    return null;
  }
  return response.json().catch(() => null);
}

function versionCodeOf(release) {
  return Math.max(0, ...(release.versionCodes ?? []).map((value) => Number(value)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const version = readJson(path.join(rootDir, "package.json")).version;

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`package.json version must be stable SemVer, got ${version}.`);
  }

  const notes = loadReleaseNotes(version, rootDir);
  const account = loadServiceAccount(args);
  const token = await getAccessToken(account);

  const edit = await apiRequest(token, "POST", apiUrl(args.packageName, "/edits"), {});
  const editId = edit?.id;
  if (!editId) {
    throw new Error("Google Play did not return an edit id.");
  }

  try {
    const track = await apiRequest(
      token,
      "GET",
      apiUrl(args.packageName, `/edits/${encodeURIComponent(editId)}/tracks/production`),
    );

    const releases = Array.isArray(track?.releases) ? track.releases : [];
    const latest = releases.reduce((best, release) => {
      if (!best) return release;
      return versionCodeOf(release) > versionCodeOf(best) ? release : best;
    }, null);

    if (!latest) {
      throw new Error("No production releases found on the production track.");
    }

    const versionCode = versionCodeOf(latest);
    if (!versionCode) {
      throw new Error("The latest production release has no version code.");
    }

    const wasDraft = latest.status === "draft";
    const plan = {
      version,
      versionCode,
      statusBefore: latest.status,
      statusAfter: wasDraft ? "completed" : latest.status,
      languages: notes.map((note) => `${note.language}:${[...note.text].length}`),
      dryRun: args.dryRun,
    };

    if (args.dryRun) {
      console.log(JSON.stringify(plan, null, 2));
      await apiRequest(token, "DELETE", apiUrl(args.packageName, `/edits/${encodeURIComponent(editId)}`)).catch(
        () => undefined,
      );
      return;
    }

    latest.releaseNotes = notes;
    if (wasDraft) {
      latest.status = "completed";
    }

    // Google Play permits only one completed release per track. Replacing the
    // release list with the target release removes the previous completed
    // release when a draft is promoted.
    track.releases = [latest];
    await apiRequest(
      token,
      "PUT",
      apiUrl(args.packageName, `/edits/${encodeURIComponent(editId)}/tracks/production`),
      track,
    );
    await apiRequest(token, "POST", apiUrl(args.packageName, `/edits/${encodeURIComponent(editId)}:commit`));

    console.log(JSON.stringify(plan, null, 2));
  } catch (error) {
    await apiRequest(token, "DELETE", apiUrl(args.packageName, `/edits/${encodeURIComponent(editId)}`)).catch(
      () => undefined,
    );
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
