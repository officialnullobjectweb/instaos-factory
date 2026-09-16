import loadSeed from "@/lib/storage/seeds";
import type { StorageDriver, Version } from "@/lib/storage/types";

/**
 * A whole JSON document in the store.
 *
 * This is the component that used to be copy-pasted into all twelve
 * repositories: a module cache, a promise chain so writes could not interleave,
 * an mtime check to avoid re-reading unchanged files, an atomic write, and a
 * fallback for "no file yet". Written once, it removes roughly seven hundred
 * lines of duplicated machinery and gives every document the same guarantees.
 *
 * Three behaviours are worth stating precisely, because they are the ones that
 * differ from the old per-file code.
 *
 * **Reads are cached briefly, and writes go straight through.** A mutation
 * updates the cache with the value it just persisted, so a read after a write
 * in the same instance is always the written value. What the cache can serve
 * stale is another instance's write, for at most `ttlMs`. Documents where that
 * matters set `ttlMs: 0`.
 *
 * **Mutations retry instead of interleaving.** `mutate` takes a function from
 * the current document to the next one, applies it under an in-process lock,
 * and writes against the revision it read. If the revision moved, the mutation
 * is re-applied to the fresh document. Because the function must be pure, that
 * is always safe — and unlike the old code, a second process writing at the
 * same time is detected rather than silently overwritten.
 *
 * **A missing document heals from the committed fixture.** `data/<key>.json` is
 * the seed, not the store. On a fresh deployment the first read finds nothing in
 * Redis and falls back to the fixture shipped with the build, writing it back so
 * the dataset is stable from then on. This is what lets the app come up in
 * production with a populated queue and analytics instead of a wall of empty
 * states, and it deliberately does *not* re-seed a document that exists but has
 * been emptied.
 */

const MAX_WRITE_ATTEMPTS = 5;

export interface DocumentConfig<T> {
  /** Storage key; also the fixture file name (`data/<key>.json`). */
  key: string;
  /** Shapes whatever was in the store, or returns null to treat it as absent. */
  parse: (raw: unknown) => T | null;
  /** Value to fall back to when neither the store nor the fixture has anything. */
  fallback: () => T;
  /**
   * In-process read cache lifetime. The default suits small, occasionally
   * written documents; `0` forces a read-through for anything where another
   * instance's write must be seen immediately.
   */
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 2_000;

interface CacheEntry<T> {
  value: T;
  version: Version;
  expiresAt: number;
}

export class JsonDocument<T> {
  private cache: CacheEntry<T> | null = null;
  private lock: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly driver: StorageDriver,
    private readonly config: DocumentConfig<T>,
  ) {}

  /** Runs `task` after every previously queued task for this document. */
  private serialise<R>(task: () => Promise<R>): Promise<R> {
    const run = this.lock.then(task, task);
    this.lock = run.catch(() => undefined);
    return run;
  }

  private ttl(): number {
    return this.config.ttlMs ?? DEFAULT_TTL_MS;
  }

  /**
   * The committed fixture for this key, if the build has one.
   *
   * Imported rather than read from disk so it is guaranteed to be part of the
   * deployed bundle; see `lib/storage/seeds.ts` for why that matters. A key
   * with no fixture is normal and yields null.
   */
  private async readSeed(): Promise<T | null> {
    const raw = await loadSeed(this.config.key);
    if (raw === null || raw === undefined) return null;
    return this.config.parse(raw);
  }

  /** Reads the document, healing from the fixture or writing a first seed. */
  async read(options: { fresh?: boolean } = {}): Promise<T> {
    const now = Date.now();
    if (!options.fresh && this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }

    const record = await this.driver.get(this.config.key);
    if (record) {
      const parsed = this.config.parse(record.value);
      if (parsed !== null) {
        this.setCache(parsed, record.version);
        return parsed;
      }
    }

    // Nothing usable in the store. Take the fixture when there is one, so a
    // fresh deployment starts from the committed dataset.
    const seeded = await this.readSeed();
    const value = seeded ?? this.config.fallback();

    // Publish the seed so every later read and every other instance sees it.
    // `expectedVersion: null` means "only if still absent", so a concurrent
    // starter writes nothing rather than clobbering.
    const written = await this.driver.set(this.config.key, value, null);
    if (written.ok) {
      this.setCache(value, written.version);
      return value;
    }

    // Someone else seeded first. Their copy is authoritative.
    const after = await this.driver.get(this.config.key);
    const parsedAfter = after ? this.config.parse(after.value) : null;
    if (after && parsedAfter !== null) {
      this.setCache(parsedAfter, after.version);
      return parsedAfter;
    }

    return value;
  }

  /** Overwrites the document. */
  async write(value: T): Promise<T> {
    return this.serialise(async () => {
      const record = await this.driver.get(this.config.key);
      const result = await this.driver.set(
        this.config.key,
        value,
        record?.version ?? null,
      );

      // The file driver can only refuse when another process changed the file
      // between the read and the write, which is rare enough to surface rather
      // than retry blindly — a caller passing a value it did not read is a bug.
      if (!result.ok) {
        this.invalidate();
        throw new Error(
          `Refusing to overwrite "${this.config.key}": it changed while writing. ` +
            "Re-read and retry.",
        );
      }

      this.setCache(value, result.version);
      return value;
    });
  }

  /**
   * Applies `mutate` to the current document and persists the result.
   *
   * The function must be pure with respect to the document it is given — it is
   * re-applied to fresh state when another writer wins the race, so relying on
   * anything captured outside its argument produces a result that is right only
   * when there is no contention.
   */
  async mutate(mutate: (current: T) => T | Promise<T>): Promise<T> {
    return this.serialise(async () => {
      for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
        const record = await this.driver.get(this.config.key);

        /*
         * A present-but-unreadable document is never re-seeded.
         *
         * `read` treats an unparseable document as absent so that a fresh
         * deployment can heal from the fixture. Doing that here would turn a
         * corrupt write into silent data loss: the mutation would apply to the
         * seed and then overwrite whatever was there. Mutations therefore fail
         * instead, which is recoverable; a discarded dataset is not.
         */
        let current: T;
        if (record) {
          const parsed = this.config.parse(record.value);
          if (parsed === null) {
            throw new Error(
              `Refusing to modify "${this.config.key}": the stored document could ` +
                "not be read. Inspect or clear it before writing again.",
            );
          }
          current = parsed;
        } else {
          current = await this.read({ fresh: true });
        }

        const version = record?.version ?? null;
        const next = await mutate(current);
        const result = await this.driver.set(this.config.key, next, version);

        if (result.ok) {
          this.setCache(next, result.version);
          return next;
        }

        // Another instance wrote between our read and our write. Back off
        // briefly so two retrying writers do not collide in lockstep.
        await new Promise((resolve) =>
          setTimeout(resolve, 5 * attempt + Math.random() * 10),
        );
      }

      throw new Error(
        `Could not update "${this.config.key}" after ${MAX_WRITE_ATTEMPTS} attempts: ` +
          "another process is writing to it continuously.",
      );
    });
  }

  /** Drops the in-process cache, forcing the next read to hit the driver. */
  invalidate(): void {
    this.cache = null;
  }

  /** Removes the document from the store entirely; the next read re-seeds. */
  async reset(): Promise<void> {
    return this.serialise(async () => {
      await this.driver.remove(this.config.key);
      this.invalidate();
    });
  }

  private setCache(value: T, version: Version): void {
    this.cache = {
      value,
      version,
      expiresAt: this.ttl() === 0 ? 0 : Date.now() + this.ttl(),
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  Array documents                                                           */
/* -------------------------------------------------------------------------- */

export interface ArrayDocumentConfig<T> extends Omit<DocumentConfig<T[]>, "parse" | "fallback"> {
  /** Per-item guard; anything failing it is dropped rather than trusted. */
  isItem?: (raw: unknown) => raw is T;
  /** Keeps newest-first documents bounded; oldest entries drop first. */
  maxItems?: number;
}

/**
 * A document that is always an array.
 *
 * Most of the store is a list — posts, audit entries, published media — and the
 * old code repeated the same `Array.isArray(parsed) ? parsed : []` guard and the
 * same cap in each place. Item-level guards matter because these documents are
 * read from a store that a human can edit.
 */
export class JsonArrayDocument<T> extends JsonDocument<T[]> {
  private readonly maxItems?: number;

  constructor(
    driver: StorageDriver,
    config: ArrayDocumentConfig<T>,
  ) {
    const isItem = config.isItem;
    super(driver, {
      key: config.key,
      ttlMs: config.ttlMs,
      parse: (raw) => {
        if (!Array.isArray(raw)) return null;
        return isItem ? raw.filter((entry) => isItem(entry)) : (raw as T[]);
      },
      fallback: () => [],
    });
    this.maxItems = config.maxItems;
  }

  /** Prepends one entry, keeping the document within its cap. */
  async prepend(entry: T): Promise<T[]> {
    return this.mutate((current) =>
      [entry, ...current].slice(0, this.maxItems ?? Number.POSITIVE_INFINITY),
    );
  }

  /** Replaces the document, applying the cap. */
  async replaceAll(entries: T[]): Promise<T[]> {
    return this.write(
      this.maxItems ? entries.slice(0, this.maxItems) : entries,
    );
  }
}
