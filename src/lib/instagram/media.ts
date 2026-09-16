import { promises as fs } from "node:fs";
import path from "node:path";

import { renderSlidePng } from "@/design/server/export";
import { resolveTemplate } from "@/design/templates";
import type { SlideSpec, TemplateId } from "@/design/types";
import { appBaseUrl } from "@/lib/env";
import { buildCleanPayload, cleanImageMetadata } from "@/lib/instagram/metadata";
import type { Post, SlideKind } from "@/types";

/**
 * Slide images: how a queue post becomes the PNGs Instagram actually fetches.
 *
 * This lives in its own module because two very different callers need it. The
 * publish flow renders the whole deck up front so the URL it hands the Graph API
 * is ready before the container is created. The public media route renders a
 * single slide on demand, because Instagram's crawler fetches `image_url` from
 * its own servers at a moment this app does not control.
 *
 * That second caller is why nothing here writes to disk on Vercel's behalf. The
 * previous implementation rendered the deck, wrote the cleaned bytes into
 * `data/ig-media/<postId>/`, and served those files back. On a serverless host
 * that fails twice over: the bundle is read-only, and even `/tmp` is
 * per-instance, so the instance that served the crawler's request would not be
 * the one that wrote the file. Rendering on demand makes the URL stateless and
 * correct, and the bytes are identical because the design engine is a pure
 * function of the post — the same input cannot produce a different image.
 */

const MEDIA_DIR = path.join(process.cwd(), "data", "ig-media");

/** Maps a queue slide kind onto the design engine's layouts. */
function layoutOf(kind: SlideKind): SlideSpec["layout"] {
  switch (kind) {
    case "cover":
      return "cover";
    case "cta":
      return "closing";
    case "statistic":
      return "data";
    default:
      return "statement";
  }
}

function templateIdFor(post: Post): TemplateId {
  switch (post.category) {
    case "Psychology":
      return "psychology";
    case "Branding":
      return "branding";
    default:
      return "geography";
  }
}

/**
 * Maps queue slides onto design-engine slides.
 *
 * Two details matter here. Queue slides index from 0 while the design engine
 * numbers from 1 (the renderer draws the number on the slide), and a queue
 * slide may legitimately omit `body` — passing both through untouched numbered
 * a published carousel from zero and crashed the renderer on any slide without
 * body copy.
 */
export function slideSpecsFor(post: Post): SlideSpec[] {
  return post.slides.map((slide, position) => ({
    index: position + 1,
    layout: layoutOf(slide.kind),
    kicker: slide.kicker ?? "",
    headline: slide.headline ?? "",
    body: slide.body ?? "",
    footnote: slide.footnote,
  }));
}

export function templateFor(post: Post) {
  return resolveTemplate(templateIdFor(post), {});
}

export function slideCountOf(post: Post): number {
  return post.slides.length;
}

/**
 * Renders one slide and strips its metadata.
 *
 * The cleaning is not optional: a PNG that carries a `tEXt` chunk with the
 * generator's name, or an ICC profile identifying the workstation, leaks
 * information about how the account is run. What this returns is what is
 * published.
 */
export function renderCleanSlide(post: Post, slideNumber: number): Buffer {
  const spec = slideSpecsFor(post)[slideNumber - 1];
  if (!spec) {
    throw new Error(
      `Slide ${slideNumber} does not exist on post ${post.id} (it has ${post.slides.length}).`,
    );
  }

  const rendered = renderSlidePng(spec, templateFor(post));
  return cleanImageMetadata(rendered).data;
}

export interface StoredMedia {
  count: number;
  bytesRemoved: number;
}

/**
 * Renders the whole deck and caches the cleaned bytes locally.
 *
 * On a host with a writable disk this is a warm cache the media route can serve
 * from. Where the write fails — a read-only bundle, which is the normal case in
 * production — it is skipped: the caller still has the rendered bytes, and the
 * media route will re-render on demand.
 */
export async function storeCleanSlideImages(post: Post): Promise<StoredMedia> {
  const specs = slideSpecsFor(post);
  const template = templateFor(post);
  const rendered = specs.map((spec) => renderSlidePng(spec, template));
  const payload = buildCleanPayload(rendered, post.caption);

  try {
    const dir = path.join(MEDIA_DIR, post.id);
    await fs.mkdir(dir, { recursive: true });
    await Promise.all(
      payload.images.map((image, index) =>
        fs.writeFile(
          path.join(dir, `slide-${String(index + 1).padStart(2, "0")}.png`),
          image.data,
        ),
      ),
    );
  } catch {
    // A cache that cannot be written is not an error: rendering on demand is
    // the supported path, and the publish must not fail over a warm-up.
  }

  return { count: payload.images.length, bytesRemoved: payload.bytesRemoved };
}

/**
 * Reads a cached slide, if this instance happens to have one.
 *
 * Best-effort by design. A miss is expected on serverless and simply means the
 * caller renders instead.
 */
export async function readCachedSlide(
  postId: string,
  slideNumber: number,
): Promise<Buffer | null> {
  const file = path.join(
    MEDIA_DIR,
    postId,
    `slide-${String(slideNumber).padStart(2, "0")}.png`,
  );

  // Path traversal guard: an id arrives from the URL.
  if (!path.resolve(file).startsWith(path.resolve(MEDIA_DIR))) return null;

  return fs.readFile(file).catch(() => null);
}

/** Publicly reachable URL for one slide image. */
export function slideImageUrl(postId: string, slideNumber: number): string {
  return `${appBaseUrl()}/api/instagram/media/${postId}/${slideNumber}`;
}
