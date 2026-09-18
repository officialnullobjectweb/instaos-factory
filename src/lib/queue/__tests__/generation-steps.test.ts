import { describe, expect, it } from "vitest";

import {
  stepsForPost,
  stepsFromLogs,
  stepsFromRun,
  summariseSteps,
} from "@/lib/queue/generation-steps";
import type { GenerationLogEntry, GenerationRun, GenerationRunStep } from "@/types";

function step(overrides: Partial<GenerationRunStep>): GenerationRunStep {
  return {
    id: "step-1",
    step: "topic",
    label: "Pick topic",
    status: "pending",
    message: null,
    model: null,
    durationMs: null,
    tokens: null,
    attempts: null,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

function run(overrides: Partial<GenerationRun> = {}): GenerationRun {
  return {
    id: "run-1",
    jobId: "job-1",
    brandId: "studio-noir",
    request: { steer: null, owner: null },
    status: "running",
    postId: null,
    provider: null,
    tokens: 0,
    failedStep: null,
    failedStepLabel: null,
    error: null,
    errorKind: null,
    resumedFrom: null,
    startedAt: "2026-09-17T10:00:00.000Z",
    finishedAt: null,
    steps: [],
    checkpoint: null,
    ...overrides,
  };
}

function log(overrides: Partial<GenerationLogEntry>): GenerationLogEntry {
  return {
    id: "log-1",
    step: "topic",
    status: "success",
    message: "Selected a topic",
    durationMs: 1200,
    timestamp: "2026-09-17T10:00:00.000Z",
    model: "Nara · laguna-s-2.1",
    tokens: 300,
    ...overrides,
  };
}

describe("stepsFromRun", () => {
  it("keeps every planned step, including the ones that never ran", () => {
    const steps = stepsFromRun(
      run({
        steps: [
          step({ id: "a", status: "success", message: "Selected a topic" }),
          step({ id: "b", step: "research", label: "Research topic", status: "running" }),
          step({ id: "c", step: "verify", label: "Verify facts", status: "pending" }),
        ],
      }),
    );

    expect(steps.map((entry) => entry.status)).toEqual([
      "success",
      "running",
      "pending",
    ]);
    expect(steps.map((entry) => entry.label)).toEqual([
      "Pick topic",
      "Research topic",
      "Verify facts",
    ]);
  });

  it("carries the failure's step, message and attempts through", () => {
    const steps = stepsFromRun(
      run({
        status: "failed",
        failedStep: "research",
        failedStepLabel: "Research topic",
        error: "All 4 provider(s) failed for the \"research\" step.",
        steps: [
          step({ id: "a", status: "success" }),
          step({
            id: "b",
            step: "research",
            label: "Research topic",
            status: "failed",
            message: "Rate limited",
            attempts: 3,
          }),
        ],
      }),
    );

    expect(steps[1].status).toBe("failed");
    expect(steps[1].message).toBe("Rate limited");
    expect(steps[1].attempts).toBe(3);
  });

  it("reports a skipped stage as skipped rather than successful", () => {
    const steps = stepsFromRun(
      run({
        steps: [
          step({
            id: "a",
            step: "verify",
            label: "Verify facts",
            status: "skipped",
            message: "Folded into the research pass.",
          }),
        ],
      }),
    );

    expect(steps[0].status).toBe("skipped");
  });
});

describe("stepsFromLogs", () => {
  it("orders the pipeline oldest first", () => {
    const steps = stepsFromLogs([
      log({ id: "2", step: "caption", timestamp: "2026-09-17T10:00:20.000Z" }),
      log({ id: "1", step: "topic", timestamp: "2026-09-17T10:00:00.000Z" }),
      log({ id: "3", step: "hashtags", timestamp: "2026-09-17T10:00:40.000Z" }),
    ]);

    expect(steps.map((entry) => entry.id)).toEqual(["1", "2", "3"]);
  });

  it("renames a logged error to the timeline's failed", () => {
    const steps = stepsFromLogs([log({ status: "error", message: "Provider refused" })]);

    expect(steps[0].status).toBe("failed");
    expect(steps[0].message).toBe("Provider refused");
  });

  it("labels the legacy brief stage as the topic step", () => {
    expect(stepsFromLogs([log({ step: "brief" })])[0].label).toBe("Pick topic");
  });
});

describe("stepsForPost", () => {
  it("prefers the run, which knows about stages the log omits", () => {
    const steps = stepsForPost(
      run({
        steps: [
          step({ id: "a", status: "success" }),
          step({ id: "b", step: "verify", label: "Verify facts", status: "skipped" }),
        ],
      }),
      [log({ step: "topic" })],
    );

    expect(steps).toHaveLength(2);
    expect(steps[1].status).toBe("skipped");
  });

  it("falls back to the post's own log when no run was recorded", () => {
    const steps = stepsForPost(null, [log({ step: "carousel", status: "warning" })]);

    expect(steps).toHaveLength(1);
    expect(steps[0].label).toBe("Generate carousel JSON");
    expect(steps[0].status).toBe("warning");
  });
});

describe("summariseSteps", () => {
  it("counts only settled steps, and sums compute and tokens", () => {
    const totals = summariseSteps(
      stepsFromRun(
        run({
          steps: [
            step({ id: "a", status: "success", durationMs: 2000, tokens: 100 }),
            step({ id: "b", step: "verify", status: "skipped" }),
            step({ id: "c", step: "carousel", status: "running", durationMs: 500 }),
            step({ id: "d", step: "caption", status: "pending" }),
          ],
        }),
      ),
    );

    expect(totals.settled).toBe(2);
    expect(totals.total).toBe(4);
    expect(totals.computeMs).toBe(2500);
    expect(totals.tokens).toBe(100);
    expect(totals.stopped).toBe(false);
  });

  it("flags a run that stopped part-way", () => {
    const totals = summariseSteps(
      stepsFromRun(
        run({
          steps: [
            step({ id: "a", status: "failed" }),
            step({ id: "b", step: "research", status: "pending" }),
          ],
        }),
      ),
    );

    expect(totals.stopped).toBe(true);
    expect(totals.settled).toBe(1);
  });
});
