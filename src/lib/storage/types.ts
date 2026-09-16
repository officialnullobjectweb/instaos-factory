/**
 * The persistence seam.
 *
 * Every repository used to open `data/<name>.json` itself, which meant the
 * read/cache/serialise/write dance was copied twelve times and the whole app
 * could only run on a host with a writable disk. A driver is the narrow
 * interface underneath those repositories so the *storage* can change without
 * the domain code noticing — files for local development, Redis in production,
 * an in-memory stub in tests.
 *
 * The interface is deliberately small: whole-document reads and writes. Every
 * document in this app is small (the largest is well under a megabyte) and is
 * always written as a unit, so a document API is a truthful description of the
 * access pattern. Pretending otherwise with a partial-update API would invite
 * read-modify-write bugs it cannot actually prevent.
 */

/** An opaque token identifying a document revision. */
export type Version = string;

export interface StoredRecord {
  value: unknown;
  /**
   * Changes whenever the document changes. Compared to detect a concurrent
   * write between a read and the write that follows it.
   */
  version: Version;
}

export interface WriteResult {
  /** False when another writer got there first and `expectedVersion` was stale. */
  ok: boolean;
  version: Version;
}

export interface StorageDriver {
  readonly id: "file" | "redis" | "memory";

  get(key: string): Promise<StoredRecord | null>;

  /**
   * Writes `value`, but only if the document still matches `expectedVersion`.
   *
   * `null` means "only if the document does not exist yet", which is how a seed
   * is written exactly once even when several instances start together.
   */
  set(
    key: string,
    value: unknown,
    expectedVersion: Version | null,
  ): Promise<WriteResult>;

  remove(key: string): Promise<void>;

  /** Whether `set` can enforce `expectedVersion` rather than merely checking it. */
  readonly conditionalWrite: boolean;

  health(): Promise<DriverHealth>;
}

export interface DriverHealth {
  ok: boolean;
  /** Human-readable, safe to show in the UI. Never contains credentials. */
  detail: string;
  /** Round-trip time of the health probe, when measurable. */
  latencyMs?: number;
}
