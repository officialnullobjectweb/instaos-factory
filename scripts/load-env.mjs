/**
 * Minimal `.env` / `.env.local` loader for the standalone scripts.
 *
 * The scripts run outside Next, so they do not get the framework's automatic env
 * loading. They need it for two reasons: the tick has to authenticate against
 * the production guard (`SCHEDULER_SECRET`), and the autopilot needs the storage
 * credentials for the server it supervises.
 *
 * Deliberately tiny — no dependency, no interpolation, no `export` tricks. The
 * only rule that matters is precedence: a variable already present in the real
 * environment always wins, so CI-provided values are never overwritten by a
 * checked-out `.env`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root, derived from this file's location (`scripts/`). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Populates `process.env` from `.env` then `.env.local` (later files do not
 * override earlier ones, and neither overrides the real environment).
 */
export async function loadEnv(root = ROOT) {
  for (const name of [".env", ".env.local"]) {
    let raw;
    try {
      raw = await fs.readFile(path.join(root, name), "utf8");
    } catch {
      continue; // absent file is fine
    }

    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      const value = rawValue.trim().replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined && value !== "") {
        process.env[key] = value;
      }
    }
  }
}

/**
 * Base URL of the app the scripts drive.
 *
 * `||` rather than `??`: an exported-but-empty `SCHEDULER_URL` (a common shape
 * in a half-filled `.env`) must fall back too, otherwise the fetch is built from
 * a relative path and fails with "Failed to parse URL".
 */
export function appUrl() {
  return (process.env.SCHEDULER_URL || "http://localhost:3780").replace(/\/$/, "");
}

/** Shared secret header, if one is configured. */
export function secretHeaders() {
  const secret = process.env.SCHEDULER_SECRET;
  return secret ? { "x-scheduler-secret": secret } : {};
}
