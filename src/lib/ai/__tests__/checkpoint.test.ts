import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  canResume,
  emptyCheckpoint,
  pendingSteps,
  readArtifact,
  reusableSteps,
  resumeCheckpoint,
  resumeSummary,
  withArtifact,
} from "@/lib/ai/checkpoint";
import type { GenerationRun, GenerationRunStep } from "@/types";

/**
 * A resumed run must never pay for a stage twice, and must never trust a payload
 * it cannot validate. Those two guarantees are the whole safety story, so they get
 * the tests.
 */

const researchSchema = z.object({
  facts: z.array(z.object({ claim: z.string() })).min(1),
});

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

function runWith(overrides: Partial<GenerationRun>): GenerationRun {
  return {
    id: "run-1",
    jobId: "job-1",
    brandId: "midnight-ritual",
    request: { steer: null, owner: null },
    status: "failed",
    postId: null,
    provider: "nara · laguna-s-2.1",
    tokens: 4_200,
    failedStep: "caption",
    failedStepLabel: "Generate caption",
    error: "Provider returned 503",
    errorKind: "server",
    resumedFrom: null,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    steps: [step({})],
    checkpoint: null,
    ...overrides,
  };
}

describe("withArtifact", () => {
  it("records a stage and its payload", () => {
    const next = withArtifact(emptyCheckpoint(), "topic", { candidates: [] });

    expect(next.completed).toEqual(["topic"]);
    expect(next.artifacts.topic).toEqual({ candidates: [] });
  });

  it("does not mutate the checkpoint it was given", () => {
    const before = emptyCheckpoint();
    withArtifact(before, "topic", { candidates: [] });

    expect(before.completed).toEqual([]);
    expect(before.artifacts).toEqual({});
  });

  it("replaces a stage's payload without duplicating the completion record", () => {
    const first = withArtifact(emptyCheckpoint(), "topic", { v: 1 });
    const second = withArtifact(first, "topic", { v: 2 });

    expect(second.completed).toEqual(["topic"]);
    expect(second.artifacts.topic).toEqual({ v: 2 });
  });
});

describe("readArtifact", () => {
  it("returns a payload that satisfies its schema", () => {
    const checkpoint = withArtifact(emptyCheckpoint(), "research", {
      facts: [{ claim: "Rotterdam expanded Maasvlakte 2 in 2026" }],
    });

    const value = readArtifact(checkpoint, "research", researchSchema);
    expect(value?.facts).toHaveLength(1);
  });

  it("discards a payload that no longer matches its schema", () => {
    const checkpoint = withArtifact(emptyCheckpoint(), "research", {
      facts: [],
    });

    // The schema demands at least one fact: the stage must be re-run rather than
    // fed a payload no stage actually validated.
    expect(readArtifact(checkpoint, "research", researchSchema)).toBeNull();
  });

  it("returns null for a stage that was never stored", () => {
    expect(readArtifact(emptyCheckpoint(), "topic", researchSchema)).toBeNull();
    expect(readArtifact(null, "topic", researchSchema)).toBeNull();
  });
});

describe("resumeCheckpoint", () => {
  it("falls back to an empty checkpoint when the run has none", () => {
    expect(resumeCheckpoint(null).completed).toEqual([]);
    expect(resumeCheckpoint(runWith({})).completed).toEqual([]);
  });

  it("carries a run's checkpoint forward", () => {
    const checkpoint = withArtifact(emptyCheckpoint(), "topic", { a: 1 });
    expect(resumeCheckpoint(runWith({ checkpoint })).completed).toEqual(["topic"]);
  });
});

describe("canResume", () => {
  it("is true for a failed run that finished at least one stage", () => {
    const checkpoint = withArtifact(emptyCheckpoint(), "research", { facts: [] });
    expect(canResume(runWith({ checkpoint }))).toBe(true);
  });

  it("is false when nothing was checkpointed", () => {
    expect(canResume(runWith({ checkpoint: emptyCheckpoint() }))).toBe(false);
    expect(canResume(runWith({ checkpoint: null }))).toBe(false);
  });

  it("is false for a run that succeeded, so a resume cannot produce a second post", () => {
    const checkpoint = withArtifact(emptyCheckpoint(), "caption", { caption: "x" });
    expect(canResume(runWith({ status: "succeeded", checkpoint }))).toBe(false);
  });

  it("is false for a run still in flight", () => {
    const checkpoint = withArtifact(emptyCheckpoint(), "topic", {});
    expect(canResume(runWith({ status: "running", checkpoint }))).toBe(false);
  });
});

describe("resumeSummary", () => {
  it("states what is reused and what still has to run", () => {
    const checkpoint = [
      "topic",
      "research",
      "carousel",
    ].reduce(
      (current, stage) => withArtifact(current, stage as never, {}),
      emptyCheckpoint(),
    );

    const run = runWith({ checkpoint });
    const summary = resumeSummary(run);

    expect(reusableSteps(run)).toEqual(["topic", "research", "carousel"]);
    expect(pendingSteps(run)).toEqual([
      "design",
      "quality",
      "hashtags",
      "caption",
    ]);
    expect(summary).toContain("Reuses 3 finished steps");
    expect(summary).toContain("runs 4 remaining steps");
  });

  it("says so plainly when there is nothing to reuse", () => {
    expect(resumeSummary(runWith({}))).toContain("whole pipeline again");
  });
});
