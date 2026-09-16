"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchInsights,
  fetchLearning,
  fetchPostAnalytics,
  runLearningAnalysis,
  type InsightsDashboard,
} from "@/lib/api/insights-client";
import { toast } from "@/lib/toast";
import type { Granularity, LearningState, PostAnalytics } from "@/types";

/** The analytics dashboard, re-fetched whenever the window or granularity changes. */
export function useInsights(days: number, granularity: Granularity) {
  const [data, setData] = useState<InsightsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!options?.quiet) setLoading(true);
      try {
        setData(await fetchInsights({ days, granularity }));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not load analytics",
        );
      } finally {
        setLoading(false);
      }
    },
    [days, granularity],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, reload: load };
}

/**
 * Post detail analytics.
 *
 * Kept separate from the dashboard hook because opening the panel should not
 * refetch the charts, and the analytics route resolves the id server-side —
 * which means the panel works for warehouse posts that are not in the queue.
 */
export function usePostAnalytics(postId: string | null) {
  const [analytics, setAnalytics] = useState<PostAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) {
      setAnalytics(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchPostAnalytics(postId)
      .then((result) => {
        if (!cancelled) setAnalytics(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Could not load the post",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  return { analytics, loading, error };
}

/** The learning report plus its manual trigger. */
export function useLearning() {
  const [state, setState] = useState<LearningState | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const { state: next } = await fetchLearning();
      setState(next);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load the learning report",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(async (windowDays?: number) => {
    setRunning(true);
    try {
      const result = await runLearningAnalysis(windowDays);
      await load();
      toast.success("Weekly analysis complete", {
        description: `${result.weightsUpdated} topic weights updated from ${result.report.sampleSize} posts.`,
      });
      return result.report;
    } catch (error) {
      toast.error("Analysis failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    } finally {
      setRunning(false);
    }
  }, [load]);

  return { state, loading, running, run, reload: load };
}
