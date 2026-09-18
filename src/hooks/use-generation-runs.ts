"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { aiApi } from "@/lib/api/ai-client";
import { AI_ACTIVITY_EVENT } from "@/lib/constants";
import type { AiJob, GenerationRun } from "@/types";

/**
 * The generation runs the workspace knows about, plus the jobs still in flight.
 *
 * Polling is conditional and that matters: a run takes minutes, and a queue page
 * left open all day should not hammer the store. The hook polls only while a run
 * or job is actually active, stops the moment none is, and refreshes immediately
 * when a generation anywhere in the app settles (`AI_ACTIVITY_EVENT`) — so the
 * panel is live exactly when liveness is informative.
 */

const POLL_MS = 4_000;

export interface GenerationRunsState {
  runs: GenerationRun[];
  jobs: AiJob[];
  /** True while a run or job is in flight. */
  active: boolean;
  /** Runs that failed — the ones with something to explain. */
  failed: GenerationRun[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** The run that produced a given post, when one is on record. */
  runForPost: (postId: string) => GenerationRun | null;
}

function isActiveRun(run: GenerationRun) {
  return run.status === "running";
}

function isActiveJob(job: AiJob) {
  return job.status === "queued" || job.status === "running";
}

export function useGenerationRuns(): GenerationRunsState {
  const [runs, setRuns] = useState<GenerationRun[]>([]);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Guards against overlapping requests when a poll fires during a slow fetch. */
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const result = await aiApi.runs({ limit: 25 });
      setRuns(result.runs);
      setJobs(result.jobs);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not read the generation runs",
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const onActivity = () => void refresh();
    window.addEventListener(AI_ACTIVITY_EVENT, onActivity);
    return () => window.removeEventListener(AI_ACTIVITY_EVENT, onActivity);
  }, [refresh]);

  const active = useMemo(
    () => runs.some(isActiveRun) || jobs.some(isActiveJob),
    [runs, jobs],
  );

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, refresh]);

  const failed = useMemo(
    () => runs.filter((run) => run.status === "failed"),
    [runs],
  );

  const runForPost = useCallback(
    (postId: string) => runs.find((run) => run.postId === postId) ?? null,
    [runs],
  );

  return { runs, jobs, active, failed, loading, error, refresh, runForPost };
}
