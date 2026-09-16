import { getPost } from "@/lib/repositories/posts-repository";
import {
  readCachedSlide,
  renderCleanSlide,
  slideCountOf,
} from "@/lib/instagram/media";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Serves the metadata-cleaned slide PNGs at a public URL.
 *
 * Instagram's crawler fetches `image_url` from its own servers, so the URL
 * handed to container creation must be reachable without a session — this route
 * is that URL: `/api/instagram/media/{postId}/{slide}`.
 *
 * The image is rendered on demand rather than read from a file the publish flow
 * wrote. That write only worked on a host with a durable disk: on a serverless
 * deployment the bundle is read-only, and even `/tmp` is per-instance, so the
 * process serving the crawler would not have the file the publishing process
 * created and would answer 404 to Instagram. Rendering here removes the shared
 * filesystem from the contract entirely — the response is a pure function of
 * the post, so the same URL always yields the same bytes. A locally cached copy
 * is used when one exists, purely as a warm-up.
 *
 * This route is intentionally unauthenticated: Instagram fetches it
 * server-to-server with no credentials to offer. It is therefore predictable by
 * design — a post id and a slide number, both validated — and exposes only
 * artwork that is destined for a public feed anyway.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ postId: string; slide: string }> },
) {
  const { postId, slide } = await context.params;

  // Both segments are constrained to the shapes this app generates, which also
  // rules out any path-like input before it reaches the renderer.
  if (!/^[\w-]+$/.test(postId) || !/^\d{1,2}$/.test(slide)) {
    return new Response("Not found", { status: 404 });
  }

  const slideNumber = Number.parseInt(slide, 10);
  if (slideNumber < 1) {
    return new Response("Not found", { status: 404 });
  }

  const post = await getPost(postId);
  if (!post) {
    return new Response("Not found", { status: 404 });
  }

  if (slideNumber > slideCountOf(post)) {
    return new Response("Not found", { status: 404 });
  }

  // Warm path: a cached render from an earlier request on this instance.
  const cached = await readCachedSlide(postId, slideNumber);
  if (cached) {
    return pngResponse(cached);
  }

  try {
    return pngResponse(renderCleanSlide(post, slideNumber));
  } catch (error) {
    // A post whose slides cannot be rendered would otherwise surface to
    // Instagram as an opaque crawler failure; say what happened instead.
    console.error(
      `[media] Failed to render slide ${slideNumber} of ${postId}:`,
      error instanceof Error ? error.message : error,
    );
    return new Response("Slide could not be rendered", { status: 500 });
  }
}

function pngResponse(data: Buffer): Response {
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": "image/png",
      // Instagram fetches each URL once per publish, so a long cache costs
      // nothing and keeps a repeat crawl from re-rendering the deck.
      "cache-control": "public, max-age=86400, immutable",
      "content-length": String(data.byteLength),
    },
  });
}
