import { describe, expect, it } from "vitest";

import { attemptTimeoutMs } from "@/lib/ai/manager";
import { stallReason } from "@/lib/ai/scheduler";

/**
 * The two rules that decide whether a run keeps its slot.
 *
 * Both are pure functions of timestamps and budgets on purpose: getting them wrong
 * either kills healthy runs or lets a wedged one hold the queue forever, and a rule
 * that has to be tested with a real clock, a real provider and a real store is a
 * rule that will not be tested.
 */

const BUDGET_MS = 20 * 60_000;
const STALL_MS = 3 * 60_000;

function verdict(input: Partial<Parameters<typeof stallReason>[0]> & { now: number }) {
  return stallReason({
    startedAt: new Date(input.now - 60_000).toISOString(),
    updatedAt: new Date(input.now - 5_000).toISOString(),
    budgetMs: BUDGET_MS,
    stallMs: STALL_MS,
    ...input,
  });
}

describe("stallReason", () => {
  it("leaves a run that is making progress alone", () => {
    const now = Date.now();
    expect(verdict({ now })).toBeNull();
  });

  it("stops a run that has exceeded its wall-clock budget", () => {
    const now = Date.now();
    const result = verdict({
      now,
      startedAt: new Date(now - BUDGET_MS - 1_000).toISOString(),
    });

    expect(result?.kind).toBe("timeout");
    expect(result?.reason).toContain("20-minute budget");
  });

  it("stops a run whose last step has not moved", () => {
    const now = Date.now();
    const result = verdict({
      now,
      startedAt: new Date(now - 4 * 60_000).toISOString(),
      updatedAt: new Date(now - STALL_MS - 1_000).toISOString(),
    });

    expect(result?.kind).toBe("timeout");
    expect(result?.reason).toContain("No step completed for 3 minutes");
  });

  it("does not stop a run that is merely close to its budget", () => {
    const now = Date.now();
    expect(
      verdict({
        now,
        startedAt: new Date(now - BUDGET_MS + 60_000).toISOString(),
        updatedAt: new Date(now - 5_000).toISOString(),
      }),
    ).toBeNull();
  });

  it("ignores unparseable timestamps rather than stopping the run", () => {
    const now = Date.now();
    expect(verdict({ now, startedAt: "not-a-date" })).toBeNull();
    expect(verdict({ now, updatedAt: "not-a-date" })).toBeNull();
  });
});

describe("attemptTimeoutMs", () => {
  it("gives a full timeout when the run has no deadline", () => {
    expect(
      attemptTimeoutMs({ now: 1_000, defaultTimeoutMs: 180_000 }),
    ).toBe(180_000);
  });

  it("shrinks the timeout to what is left of the budget", () => {
    expect(
      attemptTimeoutMs({
        deadlineAt: 100_000,
        now: 40_000,
        defaultTimeoutMs: 180_000,
      }),
    ).toBe(60_000);
  });

  it("never exceeds the provider's own timeout", () => {
    expect(
      attemptTimeoutMs({
        deadlineAt: 10_000_000,
        now: 0,
        defaultTimeoutMs: 180_000,
      }),
    ).toBe(180_000);
  });

  it("refuses an attempt with too little budget left to succeed", () => {
    expect(
      attemptTimeoutMs({
        deadlineAt: 15_000,
        now: 0,
        defaultTimeoutMs: 180_000,
      }),
    ).toBeNull();
  });
});
