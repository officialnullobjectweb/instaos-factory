"use client";

import { useCallback, useRef, useState } from "react";

import { usePostsActions } from "@/hooks/use-posts";
import {
  AiApiError,
  aiApi,
  type GenerationAccepted,
  type StartGenerationInput,
} from "@/lib/api/ai-client";
import { AI_ACTIVITY_EVENT } from "@/lib/constants";
import { toast } from "@/lib/toast";
import type { AiJob, Post } from "@/types";

export type GenerationPhase = "idle" | "queued" | "running" | "succeeded" | "failed";

export interface GenerationState {
  phase: GenerationPhase;
  job: AiJob | null;
  error: string | null;
  /** The server's own explanation, shown under the error when it has one. */
  detail: string | null;
  /** Populated when the server refused because no key is configured. */
  requiredEnvVars: string[] | null;
  post: Post | null;
  /** True when this request was matched to a run already in flight. */
  deduplicated: boolean;
  /**
   * How to continue a failed run instead of repeating it, when that is possible.
   *
   * Distinct from the `resume` action the hook returns: one is what the server says
   * can be reused, the other is the button that acts on it.
   */
  resumable: { runId: string; summary: string; tokensAlreadySpent: number } | null;
}

const INITIAL: GenerationState = {
  phase: "idle",
  job: null,
  error: null,
  detail: null,
  requiredEnvVars: null,
  post: null,
  deduplicated: false,
  resumable: null,
};

/**
 * Runs the pipeline from the browser, without pretending to own its outcome.
 *
 * The server runs the work and decides when it has failed; this hook does three
 * things and no more. It shows the run's own progress (including a queue position
 * when the run is waiting for a slot), inserts the finished post into the queue the
 * moment it exists, and turns a failure into the sentence the server recorded —
 * the step it stopped at and the provider's own message — with the option to
 * continue from the checkpoint rather than spend the same tokens twice.
 *
 * The previous version set its own five-minute deadline and reported a failure for
 * any run still working at that point. Real runs take five to ten minutes, so it
 * failed healthy runs every time, and the message — "timed out on the client" —
 * described the browser rather than the engine.
 */
export function useGeneration() {
  const { insert, openPost } = usePostsActions();
  const [state, setState] = useState<GenerationState>(INITIAL);
  /** Identifies the attempt the UI is currently following; stale updates are dropped. */
  const runId = useRef(0);

  const reset = useCallback(() => {
    runId.current += 1;
    setState(INITIAL);
  }, []);

  /**
   * Follows a run to its conclusion.
   *
   * Shared by first attempts and resumes: from here on they are the same thing —
   * an accepted job, polled until the server says what happened.
   */
  const follow = useCallback(
    async (accepted: GenerationAccepted, options: { openOnFinish?: boolean } = {}) => {
      const attempt = runId.current;

      setState({
        ...INITIAL,
        phase: accepted.queued ? "queued" : "running",
        job: accepted.job,
        deduplicated: accepted.deduplicated,
      });

      const snapshot = await aiApi.poll(accepted.job.id, {
        budgetMs: accepted.budgetMs,
        onTick: (job) => {
          if (runId.current !== attempt) return;
          setState((current) => ({
            ...current,
            job,
            phase: job.status === "queued" ? "queued" : "running",
          }));
        },
      });

      if (runId.current !== attempt) return;

      if (snapshot.job.status !== "succeeded" || !snapshot.post) {
        setState((current) => ({
          ...current,
          phase: "failed",
          job: snapshot.job,
          error: snapshot.job.error ?? "The generation engine could not finish",
          detail:
            snapshot.run?.error && snapshot.run.error !== snapshot.job.error
              ? snapshot.run.error
              : null,
          resumable: snapshot.resume,
        }));

        toast.error("Generation failed", {
          description:
            snapshot.run?.error ?? snapshot.job.error ?? "The engine could not finish.",
        });

        // The queue's runs panel is the durable record; tell it to re-read.
        window.dispatchEvent(new CustomEvent(AI_ACTIVITY_EVENT));
        return;
      }

      insert(snapshot.post);
      setState({
        phase: "succeeded",
        job: snapshot.job,
        error: null,
        detail: null,
        requiredEnvVars: null,
        post: snapshot.post,
        deduplicated: false,
        resumable: null,
      });

      if (options.openOnFinish !== false) openPost(snapshot.post.id);

      window.dispatchEvent(new CustomEvent(AI_ACTIVITY_EVENT));

      toast.success("Post generated", {
        description: `“${snapshot.post.title}” is waiting in the review queue.`,
      });
    },
    [insert, openPost],
  );

  /** Turns any thrown error into state the dialog can show. */
  const reportFailure = useCallback((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "The generation engine failed";

    setState((current) => ({
      ...current,
      phase: "failed",
      error: message,
      detail: error instanceof AiApiError ? (error.detail ?? null) : null,
      requiredEnvVars:
        error instanceof AiApiError ? (error.requiredEnvVars ?? null) : null,
    }));

    toast.error("Generation failed", { description: message });
    window.dispatchEvent(new CustomEvent(AI_ACTIVITY_EVENT));
  }, []);

  const run = useCallback(
    async (input: StartGenerationInput & { openOnFinish?: boolean }) => {
      runId.current += 1;
      setState({ ...INITIAL, phase: "queued" });

      try {
        const accepted = await aiApi.start(input);

        if (accepted.deduplicated) {
          toast.info("A run for this brand is already in flight", {
            description: "Following the existing run instead of starting a second one.",
          });
        }

        await follow(accepted, { openOnFinish: input.openOnFinish });
      } catch (error) {
        reportFailure(error);
      }
    },
    [follow, reportFailure],
  );

  /**
   * Continues a failed run from its checkpoint.
   *
   * The completed stages are not re-run, so the tokens already spent stay spent —
   * which is the entire reason to offer this rather than "try again".
   */
  const resume = useCallback(
    async (options: { openOnFinish?: boolean } = {}) => {
      const runIdToResume = state.resumable?.runId;
      if (!runIdToResume) {
        toast.error("Nothing to continue", {
          description: "This run did not finish a step, so it has to start over.",
        });
        return;
      }

      runId.current += 1;
      setState({ ...INITIAL, phase: "queued" });

      try {
        const accepted = await aiApi.resume(runIdToResume);

        if (accepted.deduplicated) {
          toast.info("A run for this brand is already in flight", {
            description: "Following the existing run instead of starting another.",
          });
        }

        await follow(accepted, { openOnFinish: options.openOnFinish });
      } catch (error) {
        reportFailure(error);
      }
    },
    [follow, reportFailure, state.resumable],
  );

  return { ...state, run, resume, reset } as const;
}
