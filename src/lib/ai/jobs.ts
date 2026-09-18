import { randomUUID } from "node:crypto";

import type { AiJob, AiJobStep, AiStepId, BrandId } from "@/types";

/**
 * In-memory job registry for generation runs.
 *
 * An eight-step pipeline takes tens of seconds, which is too long to hold a
 * single HTTP request open. The POST starts a job, the client polls it, and
 * progress is real: each step reports its own status and a human-readable
 * detail line.
 *
 * The registry is pinned to `globalThis` so every route handler in the process
 * sees the same jobs (Next can instantiate route modules more than once). Jobs
 * are deliberately not persisted — a server restart loses progress, not data:
 * anything that reached the queue is already in `posts.json`.
 */

export const STEP_LABELS: Record<AiStepId, string> = {
  topic: "Pick topic",
  research: "Research topic",
  verify: "Verify facts",
  carousel: "Generate carousel JSON",
  design: "Select design",
  caption: "Generate caption",
  hashtags: "Generate hashtags",
  alt_text: "Generate alt text",
  quality: "Score quality",
};

/**
 * The pipeline, in the order it runs.
 *
 * One declaration, read by the job registry, the run tracker and the queue's step
 * list, so the plan a reviewer sees before a run and the steps the run reports
 * afterwards cannot drift apart.
 */
export const PIPELINE_STEPS = Object.keys(STEP_LABELS) as AiStepId[];

const MAX_JOBS = 40;

interface JobRegistry {
  jobs: Map<string, AiJob>;
  order: string[];
}

const globalForJobs = globalThis as unknown as { __factoryAiJobs?: JobRegistry };

function registry(): JobRegistry {
  if (!globalForJobs.__factoryAiJobs) {
    globalForJobs.__factoryAiJobs = { jobs: new Map(), order: [] };
  }
  return globalForJobs.__factoryAiJobs;
}

function newStep(id: AiStepId): AiJobStep {
  return {
    id,
    label: STEP_LABELS[id],
    status: "pending",
    detail: null,
    attempts: 0,
    startedAt: null,
    finishedAt: null,
  };
}

export function createJob(brandId: BrandId): AiJob {
  const now = new Date().toISOString();

  const job: AiJob = {
    id: `job-${randomUUID().slice(0, 8)}`,
    brandId,
    status: "queued",
    steps: (Object.keys(STEP_LABELS) as AiStepId[]).map(newStep),
    postId: null,
    error: null,
    queuePosition: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };

  const store = registry();
  store.jobs.set(job.id, job);
  store.order.unshift(job.id);

  // Oldest jobs fall off the end so a long session cannot grow unbounded.
  while (store.order.length > MAX_JOBS) {
    const evicted = store.order.pop();
    if (evicted) store.jobs.delete(evicted);
  }

  return job;
}

export function getJob(id: string): AiJob | null {
  return registry().jobs.get(id) ?? null;
}

export function listJobs(limit = 10): AiJob[] {
  const store = registry();
  return store.order
    .map((id) => store.jobs.get(id))
    .filter((job): job is AiJob => Boolean(job))
    .slice(0, limit);
}

export function updateJob(id: string, patch: Partial<AiJob>): AiJob | null {
  const store = registry();
  const job = store.jobs.get(id);
  if (!job) return null;

  const next: AiJob = { ...job, ...patch, updatedAt: new Date().toISOString() };
  store.jobs.set(id, next);
  return next;
}

export function updateStep(
  id: string,
  stepId: AiStepId,
  patch: Partial<AiJobStep>,
): AiJob | null {
  const store = registry();
  const job = store.jobs.get(id);
  if (!job) return null;

  const now = new Date().toISOString();
  const steps = job.steps.map((step) =>
    step.id === stepId
      ? {
          ...step,
          ...patch,
          startedAt:
            patch.status === "running" ? (patch.startedAt ?? now) : step.startedAt,
          finishedAt:
            patch.status && patch.status !== "running" && patch.status !== "pending"
              ? (patch.finishedAt ?? now)
              : step.finishedAt,
        }
      : step,
  );

  return updateJob(id, { steps });
}
