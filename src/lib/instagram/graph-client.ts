import type { IgErrorKind, IgPublishResult } from "@/types";

/**
 * Instagram Graph API client — the only module that talks to instagram.com /
 * graph.facebook.com.
 *
 * Publish flow (official API, no scraping):
 *   1. one media container per image (`POST /{ig-user-id}/media`, image_url)
 *   2. one carousel container (`media_type=CAROUSEL`, children listed)
 *      — or a single-image container, or a VIDEO container for reels
 *   3. poll `GET /{container-id}?fields=status_code` until FINISHED
 *   4. `POST /{ig-user-id}/media_publish` with the container id
 *
 * Image URLs must be publicly reachable by Instagram's crawler. In this
 * workspace the design engine serves renders at /api/design/preview; the
 * publish call passes the workspace's APP_BASE_URL so containers can resolve.
 */

const GRAPH_BASE =
  process.env.INSTAGRAM_GRAPH_URL ?? "https://graph.facebook.com/v21.0";

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 120_000;

export class GraphApiError extends Error {
  kind: IgErrorKind;
  httpStatus: number | null;

  constructor(
    message: string,
    kind: IgErrorKind,
    httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "GraphApiError";
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

interface GraphErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/** Maps Graph API error payloads onto the app's failure classes. */
export function classifyGraphError(
  status: number,
  payload: GraphErrorPayload | null,
): { kind: IgErrorKind; message: string } {
  const message =
    payload?.error?.message ?? `Graph API request failed (HTTP ${status})`;
  const code = payload?.error?.code;
  const subcode = payload?.error?.error_subcode;

  // OAuth / token problems.
  if (code === 190 || status === 401) {
    // 190 subcode 460 means the session is invalid; anything token-shaped
    // becomes expired_token so the caller can offer a refresh.
    return { kind: "expired_token", message };
  }
  // Application request rate limits and per-account publishing throttles.
  if (code === 4 || code === 17 || code === 32 || status === 429) {
    return { kind: "rate_limit", message };
  }
  // The account-level "unpublished content" throttle.
  if (subcode === 2207051 || code === 9007) {
    return { kind: "rate_limit", message };
  }
  // Container errors surfaced at publish time.
  if (code === 9004 || code === 9005) {
    return { kind: "container_error", message };
  }

  return { kind: "unknown", message };
}

async function graphRequest<T>(
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "GET",
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  if (method === "GET") {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method,
    ...(method === "POST"
      ? {
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(params).toString(),
        }
      : {}),
    signal: AbortSignal.timeout(30_000),
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & GraphErrorPayload)
    | null;

  if (!response.ok) {
    const classified = classifyGraphError(response.status, payload);
    throw new GraphApiError(classified.message, classified.kind, response.status);
  }

  return payload as T;
}

export interface MediaContainerInput {
  igUserId: string;
  accessToken: string;
  /** Publicly reachable image URL for carousels and single images. */
  imageUrl?: string;
  /** Publicly reachable video URL for reels. */
  videoUrl?: string;
  /** Carousel: child container ids, in slide order. */
  children?: string[];
  caption?: string;
  isReel?: boolean;
}

interface ContainerResponse {
  id: string;
}

/** Creates one media container. Carousel images get `is_carousel_item=true`. */
export async function createMediaContainer(
  input: MediaContainerInput,
): Promise<string> {
  const params: Record<string, string> = {
    access_token: input.accessToken,
  };

  if (input.children) {
    params.media_type = "CAROUSEL";
    params.children = input.children.join(",");
    if (input.caption) params.caption = input.caption;
  } else if (input.isReel && input.videoUrl) {
    params.media_type = "REELS";
    params.video_url = input.videoUrl;
    if (input.caption) params.caption = input.caption;
  } else if (input.imageUrl) {
    params.image_url = input.imageUrl;
    if (input.caption) params.caption = input.caption;
  } else {
    throw new GraphApiError(
      "Container needs an image_url, video_url or children",
      "container_error",
    );
  }

  const result = await graphRequest<ContainerResponse>(
    `/${input.igUserId}/media`,
    params,
    "POST",
  );
  return result.id;
}

interface ContainerStatusResponse {
  status_code: "EXPIRED" | "ERROR" | "IN_PROGRESS" | "FINISHED";
  status?: string;
}

/** Polls a container until it finishes processing (or times out). */
export async function waitForContainer(
  containerId: string,
  accessToken: string,
): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await graphRequest<ContainerStatusResponse>(
      `/${containerId}`,
      { fields: "status_code,status", access_token: accessToken },
    );

    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new GraphApiError(
        status.status ?? "Container failed to process",
        "container_error",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new GraphApiError(
    "Container processing timed out after 2 minutes",
    "container_error",
  );
}

interface PublishResponse {
  id: string;
}

/** Publishes a finished container and returns the new media id. */
export async function publishContainer(
  igUserId: string,
  containerId: string,
  accessToken: string,
): Promise<string> {
  const result = await graphRequest<PublishResponse>(
    `/${igUserId}/media_publish`,
    { creation_id: containerId, access_token: accessToken },
    "POST",
  );
  return result.id;
}

interface PermalinkResponse {
  permalink: string;
}

export async function fetchPermalink(
  mediaId: string,
  accessToken: string,
): Promise<string> {
  try {
    const result = await graphRequest<PermalinkResponse>(
      `/${mediaId}`,
      { fields: "permalink", access_token: accessToken },
    );
    return result.permalink;
  } catch {
    // A permalink lookup failure must not fail an already-successful publish.
    return `https://www.instagram.com/` as string;
  }
}

/* -------------------------------------------------------------------------- */
/*  Tokens                                                                    */
/* -------------------------------------------------------------------------- */

interface LongLivedTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

/** Exchanges a short-lived token for a long-lived one (~60 days). */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<{ accessToken: string; expiresAt: string | null }> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    throw new GraphApiError(
      "INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET are not configured",
      "unknown",
    );
  }

  const result = await graphRequest<LongLivedTokenResponse>(
    "/oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    },
  );

  return {
    accessToken: result.access_token,
    expiresAt: result.expires_in
      ? new Date(Date.now() + result.expires_in * 1000).toISOString()
      : null,
  };
}

/** Refreshes a long-lived token that is still valid (≥24h remaining). */
export async function refreshLongLivedToken(
  accessToken: string,
): Promise<{ accessToken: string; expiresAt: string | null }> {
  const result = await graphRequest<LongLivedTokenResponse>(
    "/refresh_access_token",
    { grant_type: "ig_refresh_token", access_token: accessToken },
  );

  return {
    accessToken: result.access_token,
    expiresAt: result.expires_in
      ? new Date(Date.now() + result.expires_in * 1000).toISOString()
      : null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Publish pipeline                                                          */
/* -------------------------------------------------------------------------- */

export interface PublishInput {
  igUserId: string;
  accessToken: string;
  /** Publicly reachable URLs, one per slide, in deck order. */
  imageUrls: string[];
  videoUrl?: string;
  isReel?: boolean;
  caption: string;
}

export interface PublishPipelineHooks {
  onStep?: (detail: string, ok: boolean) => void;
}

/**
 * The full pipeline: containers → poll → publish → permalink. Each stage is
 * recorded so failures carry their stage in the stored reason.
 */
export async function publishMedia(
  input: PublishInput,
  hooks: PublishPipelineHooks = {},
): Promise<IgPublishResult> {
  const steps: IgPublishResult["steps"] = [];
  const startedAt = Date.now();
  const step = (detail: string, ok = true) => {
    steps.push({ at: new Date().toISOString(), detail, ok });
    hooks.onStep?.(detail, ok);
  };

  try {
    let containerId: string;

    if (input.isReel && input.videoUrl) {
      step("Creating video container (REELS)");
      containerId = await createMediaContainer({
        igUserId: input.igUserId,
        accessToken: input.accessToken,
        videoUrl: input.videoUrl,
        caption: input.caption,
        isReel: true,
      });
    } else if (input.imageUrls.length === 1) {
      step("Creating image container");
      containerId = await createMediaContainer({
        igUserId: input.igUserId,
        accessToken: input.accessToken,
        imageUrl: input.imageUrls[0],
        caption: input.caption,
      });
    } else {
      step(`Creating ${input.imageUrls.length} image containers`);
      const children: string[] = [];
      for (const imageUrl of input.imageUrls) {
        children.push(
          await createMediaContainer({
            igUserId: input.igUserId,
            accessToken: input.accessToken,
            imageUrl,
          }),
        );
      }

      step("Creating carousel container");
      containerId = await createMediaContainer({
        igUserId: input.igUserId,
        accessToken: input.accessToken,
        children,
        caption: input.caption,
      });
    }

    step(`Waiting for container ${containerId} to finish processing`);
    await waitForContainer(containerId, input.accessToken);
    step("Container finished");

    step("Publishing media");
    const mediaId = await publishContainer(
      input.igUserId,
      containerId,
      input.accessToken,
    );

    step("Fetching permalink");
    const permalink = await fetchPermalink(mediaId, input.accessToken);

    return {
      ok: true,
      mediaId,
      permalink,
      steps,
      elapsedMs: Date.now() - startedAt,
    } satisfies IgPublishResult;
  } catch (error) {
    const message =
      error instanceof GraphApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown publish error";
    const kind =
      error instanceof GraphApiError
        ? error.kind
        : error instanceof Error && error.name === "AbortError"
          ? "network"
          : "unknown";

    step(`Publish failed: ${message}`, false);
    return { ok: false, error: message, errorKind: kind, steps };
  }
}

/** All container/poll/publish helpers in one place for the history route. */
export { POLL_INTERVAL_MS, POLL_TIMEOUT_MS };
