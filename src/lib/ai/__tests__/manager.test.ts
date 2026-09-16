import { describe, it, expect } from "vitest";
import { backoffDelay } from "@/lib/ai/manager";

describe("backoffDelay", () => {
  it("returns a positive number", () => {
    const delay = backoffDelay(1, null);
    expect(delay).toBeGreaterThan(0);
  });

  it("increases with attempt number", () => {
    const delays = [1, 2, 3].map((attempt) => backoffDelay(attempt, null));
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[1]);
  });

  it("respects Retry-After when provided", () => {
    const delay = backoffDelay(1, 5000);
    expect(delay).toBeGreaterThanOrEqual(5000);
  });

  it("caps at a reasonable maximum", () => {
    const delay = backoffDelay(10, null);
    expect(delay).toBeLessThanOrEqual(30_000);
  });

  it("applies jitter within bounds", () => {
    // Run multiple times to check jitter variation
    const delays = Array.from({ length: 20 }, () => backoffDelay(2, null));
    const min = Math.min(...delays);
    const max = Math.max(...delays);
    // Jitter should cause some variation
    expect(max - min).toBeGreaterThan(0);
  });
});
