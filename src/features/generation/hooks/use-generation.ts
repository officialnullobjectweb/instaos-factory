"use client";

import { useCallback, useRef, useState } from "react";

import { usePostsActions } from "@/hooks/use-posts";
import {
  AiApiError,
  aiApi,
  type StartGenerationInput,
} from "@/lib/api/ai-client";
import { AI_ACTIVITY_EVENT } from "@/lib/constants";
import { toast } from "@/lib/toast";
import type { AiJob, Post } from "@/types";

export type GenerationPhase = "idle" | "running" | "succeeded" | "failed";

export interface GenerationState {
  phase: GenerationPhase;
  job: AiJob | null;
  error: string | null;
  /** Populated when the server refused because no key is configured. */
  requiredEnvVars: string[] | null;
  post: Post | null;
}

const INITIAL: GenerationState = {
  phase: "idle",
  job: null,
  error: null,
  requiredEnvVars: null,
  post: null,
};

/**
 * Runs the eight-step pipeline from the browser.
 *
 * The server owns the work; this hook owns the theatre around it — polling the
 * job so the steps advance on screen, inserting the finished post into the queue
 * the moment it exists, and turning every failure mode into a message that says
 * what to do next rather than just that something broke.
 */
export function useGeneration() {
  const { insert, openPost } = usePostsActions();
  const [state, setState] = useState<GenerationState>(INITIAL);
  const runId = useRef(0);

  const reset = useCallback(() => {
    runId.current += 1;
    setState(INITIAL);
  }, []);

  const run = useCallback(
    async (input: StartGenerationInput & { openOnFinish?: boolean }) => {
      const id = runId.current + 1;
      runId.current = id;
      setState({ ...INITIAL, phase: "running" });

      try {
        const started = await aiApi.start(input);
        if (runId.current !== id) return;
        setState({ ...INITIAL, phase: "running", job: started });

        const { job, post } = await aiApi.poll(started.id, {
          onTick: (tick) => {
            if (runId.current === id) setState((current) => ({ ...current, job: tick }));
          },
        });

        if (runId.current !== id) return;

        if (job.status !== "succeeded" || !post) {
          throw new AiApiError(job.error ?? "Generation failed", 500);
        }

        // The post is already in posts.json; mirror it into the queue before the
        // next fetch so it is visible the instant the request resolves.
        insert(post);

        setState({ phase: "succeeded", job, error: null, requiredEnvVars: null, post });

        if (input.openOnFinish !== false) openPost(post.id);

        window.dispatchEvent(new CustomEvent(AI_ACTIVITY_EVENT));

        toast.success("Post generated", {
          description: `“${post.title}” is waiting in the review queue.`,
        });
      } catch (error) {
        if (runId.current !== id) return;

        const message =
          error instanceof Error ? error.message : "The generation engine failed";

        setState((current) => ({
          ...current,
          phase: "failed",
          error: message,
          requiredEnvVars:
            error instanceof AiApiError ? (error.requiredEnvVars ?? null) : null,
        }));

        toast.error("Generation failed", { description: message });
      }
    },
    [insert, openPost],
  );

  return { ...state, run, reset } as const;
}
