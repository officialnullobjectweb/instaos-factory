import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createFileDriver } from "@/lib/storage/file-driver";

const DATA_DIR = path.join(process.cwd(), "data");

describe("FileDriver", () => {
  let driver: ReturnType<typeof createFileDriver>;
  const testKeys: string[] = [];

  beforeEach(() => {
    driver = createFileDriver();
  });

  afterEach(async () => {
    // Clean up test files
    for (const key of testKeys) {
      await fs.rm(path.join(DATA_DIR, `${key}.json`), { force: true });
    }
    testKeys.length = 0;
  });

  function testKey(name: string): string {
    const key = `test-${name}-${Date.now().toString(36)}`;
    testKeys.push(key);
    return key;
  }

  it("returns null for non-existent key", async () => {
    const key = testKey("nonexistent");
    const result = await driver.get(key);
    expect(result).toBeNull();
  });

  it("writes and reads back a value", async () => {
    const key = testKey("readwrite");
    const value = { hello: "world", count: 42 };

    const writeResult = await driver.set(key, value, null);
    expect(writeResult.ok).toBe(true);
    expect(writeResult.version).toBeTruthy();

    const readResult = await driver.get(key);
    expect(readResult).not.toBeNull();
    expect(readResult!.value).toEqual(value);
    expect(readResult!.version).toBe(writeResult.version);
  });

  it("refuses to overwrite when version mismatches", async () => {
    const key = testKey("version-mismatch");
    await driver.set(key, { v: 1 }, null);

    const stale = await driver.get(key);
    await driver.set(key, { v: 2 }, stale!.version);

    // Try writing with the old version — should fail
    const result = await driver.set(key, { v: 3 }, stale!.version);
    expect(result.ok).toBe(false);
  });

  it("succeeds when expectedVersion matches current", async () => {
    const key = testKey("version-match");
    const write1 = await driver.set(key, { v: 1 }, null);
    const write2 = await driver.set(key, { v: 2 }, write1.version);
    expect(write2.ok).toBe(true);

    const read = await driver.get(key);
    expect(read!.value).toEqual({ v: 2 });
  });

  it("removes a key", async () => {
    const key = testKey("remove");
    await driver.set(key, { data: true }, null);
    await driver.remove(key);

    const result = await driver.get(key);
    expect(result).toBeNull();
  });

  it("reports health", async () => {
    const health = await driver.health();
    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("rejects unsafe keys", async () => {
    await expect(driver.set("../../etc/passwd", {}, null)).rejects.toThrow(
      "Unsafe storage key",
    );
    await expect(driver.set("key with spaces", {}, null)).rejects.toThrow(
      "Unsafe storage key",
    );
  });

  it("handles corrupted JSON gracefully", async () => {
    const key = testKey("corrupt");
    // Write raw invalid JSON directly to file
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, `${key}.json`), "NOT JSON!!!", "utf8");

    const result = await driver.get(key);
    expect(result).toBeNull();
  });
});
