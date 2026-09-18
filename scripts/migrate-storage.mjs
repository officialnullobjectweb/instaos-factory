#!/usr/bin/env node
/**
 * Moves the workspace's JSON documents from the local files into Upstash Redis.
 *
 * Why this exists: the storage driver is a deployment choice (`STORAGE_DRIVER`),
 * but the *data* is not — switching drivers on a running workspace must not look
 * like every post, audit entry and AI log vanished. This copies the documents
 * the file driver is serving into the Redis driver's key space, writing the same
 * versioned envelope (`{ v, d }`) the driver itself writes, so the app cannot
 * tell the difference between a migrated document and one it wrote.
 *
 * Usage:
 *   node scripts/migrate-storage.mjs             # dry run — report only
 *   node scripts/migrate-storage.mjs --apply     # perform the copy
 *   node scripts/migrate-storage.mjs --apply --force   # overwrite non-empty keys
 *
 * Safety rules, in order of importance:
 *
 *  - **Empty documents are skipped.** `data/` holds empty arrays for every key
 *    the app does not have real data for (that is what makes a fresh store boot
 *    to a defined empty state). Copying those would be harmless in Redis but
 *    writing `[]` over a key that already holds real data would not, so they are
 *    left alone and the app re-seeds them from the fixtures on first read.
 *  - **A non-empty key is never overwritten without `--force`**, and anything it
 *    does replace is written to `logs/redis-backup-<timestamp>.json` first. Re-
 *    running this after the factory has been writing to Redis is the common
 *    case, so the tool has to be safe to run twice *and* recoverable if the
 *    direction of the copy turns out to be the other way round.
 *  - **Nothing is deleted.** The local `data/*.json` files are left exactly as
 *    they were, so the file driver remains a working fallback and this remains
 *    reversible by setting `STORAGE_DRIVER=file` again.
 *
 * The transport is the Upstash REST API via `fetch` rather than the SDK: this is
 * a one-shot maintenance tool, and a plain HTTP call has no client-construction
 * or serialisation behaviour to reason about.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { ROOT, loadEnv } from "./load-env.mjs";

/** Every document the app stores — kept in step with `DOCUMENT_KEYS`. */
const DOCUMENT_KEYS = [
  "posts",
  "generation-runs",
  "schedule",
  "audit",
  "ai-logs",
  "telegram-log",
  "instagram-accounts",
  "instagram-history",
  "experiments",
  "design-templates",
  "learning",
  "insights",
];

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

await loadEnv();

const url = (process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/$/, "");
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const prefix = process.env.STORAGE_PREFIX || "factory";

if (!url || !token) {
  console.error(
    "Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — set them in .env first.",
  );
  process.exit(1);
}

/** Runs one Upstash REST command. */
async function command(...args) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

/** Item count for the summary line: arrays and objects both report meaningfully. */
function sizeOf(value) {
  if (Array.isArray(value)) return `${value.length} items`;
  if (value && typeof value === "object") return `${Object.keys(value).length} keys`;
  return typeof value;
}

/** True for the fixtures that exist only to define an empty starting state. */
function isEmpty(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") return Object.keys(value).length === 0;
  return value === null || value === undefined;
}

const results = [];
/** Raw envelopes replaced under `--force`, so the overwrite is recoverable. */
const overwritten = {};

for (const key of DOCUMENT_KEYS) {
  const file = path.join(ROOT, "data", `${key}.json`);
  const storeKey = `${prefix}:${key}`;

  let value;
  try {
    value = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    results.push([key, "no local file", "skipped"]);
    continue;
  }

  if (isEmpty(value)) {
    results.push([key, "empty", "skipped (re-seeds itself)"]);
    continue;
  }

  const existingRaw = await command("GET", storeKey);
  const existing = existingRaw
    ? typeof existingRaw === "string"
      ? JSON.parse(existingRaw)
      : existingRaw
    : null;

  if (existing && !force) {
    results.push([
      key,
      sizeOf(value),
      `kept Redis copy (${sizeOf(existing.d ?? existing)}) — use --force to replace`,
    ]);
    continue;
  }

  if (!apply) {
    results.push([
      key,
      sizeOf(value),
      existing
        ? `would replace Redis copy (${sizeOf(existing.d ?? existing)})`
        : `would write ${storeKey} (v1)`,
    ]);
    continue;
  }

  // Keep the version the app is currently on when replacing, so a running
  // instance's expected revision still matches after the swap.
  const nextVersion =
    existing && typeof existing.v === "number" ? existing.v + 1 : 1;
  if (existing) overwritten[key] = existing;

  await command("SET", storeKey, JSON.stringify({ v: nextVersion, d: value }));
  results.push([
    key,
    sizeOf(value),
    existing
      ? `replaced Redis copy (v${nextVersion})`
      : `wrote ${storeKey} (v1)`,
  ]);
}

const width = Math.max(...results.map(([key]) => key.length));
console.log(`${apply ? "Migrating" : "Dry run —"} local documents → Redis (${prefix}:*)\n`);
for (const [key, detail, action] of results) {
  console.log(`  ${key.padEnd(width)}  ${detail.padEnd(12)}  ${action}`);
}
const backedUp = Object.keys(overwritten);
if (backedUp.length > 0) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(ROOT, "logs", `redis-backup-${stamp}.json`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(overwritten, null, 2));
  console.log(
    `\nReplaced values backed up to logs/${path.basename(file)} (${backedUp.join(", ")}).`,
  );
}

console.log(
  apply
    ? "\nDone. Set STORAGE_DRIVER=redis and restart the server."
    : "\nNothing was written. Re-run with --apply to perform the copy.",
);
