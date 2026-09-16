import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  DriverHealth,
  StorageDriver,
  StoredRecord,
  Version,
  WriteResult,
} from "@/lib/storage/types";

/**
 * File-system driver: one JSON document per file, under `data/`.
 *
 * This is the driver for local development, CI and any host with a real disk,
 * and it is behaviourally identical to what the repositories did before they
 * were refactored — same file names, same two-space formatting, same atomic
 * write-then-rename — so the on-disk fixtures stay readable and keep their
 * diffs small.
 *
 * The one thing it must not do is assume `data/` can be written to. On a
 * serverless host it cannot: the bundle is read-only and only `/tmp` is
 * writable. Silently failing there loses data, so the write root is probed once
 * and `/tmp` is used as a fallback with a warning. That fallback is *not* a
 * production story — `/tmp` is per-instance and ephemeral — but it keeps a
 * misconfigured deployment observable instead of broken.
 */

const PREFIX = "data";
const FALLBACK_PREFIX = "factory-data";

let writeRoot: string | null = null;

function candidateRoot(): string {
  return path.join(process.cwd(), PREFIX);
}

function fallbackRoot(): string {
  return path.join(tmpdir(), FALLBACK_PREFIX);
}

/**
 * Resolves where writes go, once per process.
 *
 * A probe write is the only reliable test: `fs.access` reports the mode bits,
 * which on a read-only mount can still claim writability.
 */
async function resolveWriteRoot(): Promise<string> {
  if (writeRoot) return writeRoot;

  const primary = candidateRoot();

  try {
    await fs.mkdir(primary, { recursive: true });
    const probe = path.join(primary, `.write-probe-${process.pid}`);
    await fs.writeFile(probe, "", "utf8");
    await fs.rm(probe, { force: true });
    writeRoot = primary;
    return writeRoot;
  } catch {
    const fallback = fallbackRoot();
    await fs.mkdir(fallback, { recursive: true });

    console.warn(
      `[storage] ${primary} is not writable — falling back to ${fallback}.\n` +
        "  State will NOT survive a restart and is not shared between instances.\n" +
        "  Configure Upstash Redis for durable storage (see .env.example).",
    );

    writeRoot = fallback;
    return writeRoot;
  }
}

/**
 * Keys are internal constants, but they become path segments, so they are
 * validated anyway: a key arriving from a route must never be able to escape
 * the data directory.
 */
function assertSafeKey(key: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(key)) {
    throw new Error(
      `Unsafe storage key "${key}". Keys must be alphanumeric with dashes.`,
    );
  }
}

async function readFileFor(key: string): Promise<{ text: string; mtimeMs: number; size: number } | null> {
  assertSafeKey(key);

  const roots = [await resolveWriteRoot(), candidateRoot()];
  const seen = new Set<string>();

  for (const root of roots) {
    if (seen.has(root)) continue;
    seen.add(root);

    const file = path.join(root, `${key}.json`);
    try {
      // The seed fixture is read from `data/` even when writes land in /tmp:
      // a freshly started instance must still see the committed dataset.
      const [text, stats] = await Promise.all([
        fs.readFile(file, "utf8"),
        fs.stat(file),
      ]);
      return { text, mtimeMs: stats.mtimeMs, size: stats.size };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") continue;
      throw error;
    }
  }

  return null;
}

/** Version token: the same file, byte for byte, has the same version. */
function versionOf(stats: { mtimeMs: number; size: number }): Version {
  return `${stats.mtimeMs}:${stats.size}`;
}

export function createFileDriver(): StorageDriver {
  /** Per-key promise chain: the in-process equivalent of a write lock. */
  const locks = new Map<string, Promise<unknown>>();

  function serialise<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve();
    const run = previous.then(task, task);
    locks.set(
      key,
      run.catch(() => undefined),
    );
    return run;
  }

  return {
    id: "file",
    conditionalWrite: true,

    async get(key) {
      const found = await readFileFor(key);
      if (!found) return null;

      try {
        return {
          value: JSON.parse(found.text) as unknown,
          version: versionOf(found),
        } satisfies StoredRecord;
      } catch {
        // A truncated or hand-edited document must not take the app down. It is
        // reported as absent so the caller can heal it from the seed.
        return null;
      }
    },

    async set(key, value, expectedVersion) {
      return serialise(key, async () => {
        const current = await readFileFor(key);
        const currentVersion = current ? versionOf(current) : null;

        if (currentVersion !== expectedVersion) {
          return {
            ok: false,
            version: currentVersion ?? "",
          } satisfies WriteResult;
        }

        const root = await resolveWriteRoot();
        const file = path.join(root, `${key}.json`);
        // Matches the committed fixtures: two-space indent, trailing newline.
        const payload = `${JSON.stringify(value, null, 2)}\n`;

        await fs.mkdir(path.dirname(file), { recursive: true });
        // Write-then-rename so a reader never observes a partial file.
        const temp = `${file}.${process.pid}.tmp`;
        await fs.writeFile(temp, payload, "utf8");
        await fs.rename(temp, file);

        const stats = await fs.stat(file);
        return { ok: true, version: versionOf(stats) } satisfies WriteResult;
      });
    },

    async remove(key) {
      assertSafeKey(key);
      const root = await resolveWriteRoot();
      await fs.rm(path.join(root, `${key}.json`), { force: true });
    },

    async health(): Promise<DriverHealth> {
      const started = Date.now();
      try {
        const root = await resolveWriteRoot();
        const ephemeral = root === fallbackRoot();
        return {
          ok: true,
          latencyMs: Date.now() - started,
          detail: ephemeral
            ? `Ephemeral fallback (${root}). State is lost on restart and not shared between instances.`
            : `Writable (${root}).`,
        };
      } catch (error) {
        return {
          ok: false,
          detail: error instanceof Error ? error.message : "Unavailable.",
        };
      }
    },
  };
}
