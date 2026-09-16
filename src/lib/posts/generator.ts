import { GENERATION_MODEL } from "@/lib/constants";
import type {
  GenerationLogEntry,
  Post,
  PostCategory,
  Slide,
} from "@/types";

/**
 * The mock generation engine.
 *
 * This stands in for the model call that will eventually live behind this
 * interface. It recomposes the post's own research material rather than
 * inventing facts, so regenerated copy stays traceable to its sources. Swap the
 * two exported functions for real inference without touching callers.
 */

export interface RegenerationResult {
  caption?: string;
  hashtags?: string[];
  altText?: string;
  slides?: Slide[];
  logs: GenerationLogEntry[];
  summary: string;
}

type CaptionFrame = (post: Post) => string;

const CAPTION_FRAMES: Record<PostCategory, CaptionFrame[]> = {
  Geography: [
    (post) =>
      `${post.title}. The part most cities skip is the maintenance schedule, and it is the whole reason this works. ${firstBody(post)}`,
    (post) =>
      `Read this as an infrastructure decision, not a lifestyle one. ${post.caption.split(".")[0]}. Here is what actually moved the numbers, and what stayed decoration.`,
    (post) =>
      `Three details decide whether this survives a bad winter: width, service order, and who pays. Swipe for the breakdown — ${firstHeadline(post).toLowerCase()}.`,
  ],
  Psychology: [
    (post) =>
      `${post.title}. It is not a discipline problem, it is a default problem — change the default and the behaviour follows. ${firstBody(post)}`,
    (post) =>
      `The research here is older than most productivity advice and considerably better sourced. ${post.caption.split(".")[0]}. Save this for the next time someone tells you to try harder.`,
    () =>
      `What actually changed the outcome: one written sentence, decided in advance. Swipe for the mechanism and the study it comes from.`,
  ],
  Branding: [
    (post) =>
      `${post.title}. The system matters more than the taste, because the system is what survives a busy quarter. ${firstBody(post)}`,
    (post) =>
      `Everyone can copy the look. Nobody wants to copy the governance. ${post.caption.split(".")[0]}. Here is what we actually wrote down.`,
    () =>
      `Three rules, two refusals, and one example of each. Swipe for how this holds up when the deadline is Friday afternoon.`,
  ],
};

const HASHTAG_POOLS: Record<PostCategory, string[]> = {
  Geography: ["#citydesign", "#urbanism", "#infrastructure", "#places", "#maps", "#systems"],
  Psychology: ["#behaviouralscience", "#psychology", "#research", "#decisions", "#habits", "#attention"],
  Branding: ["#brandstrategy", "#identity", "#designsystem", "#positioning", "#craft", "#branding"],
};

function firstHeadline(post: Post) {
  return post.slides[0]?.headline ?? post.title;
}

function firstBody(post: Post) {
  return post.slides[1]?.body ?? post.slides[0]?.body ?? "";
}

function variantIndex(post: Post, variants: number) {
  return post.versions.length % variants;
}

function logEntry(
  post: Post,
  step: GenerationLogEntry["step"],
  status: GenerationLogEntry["status"],
  message: string,
  durationMs: number,
  tokens: number,
): GenerationLogEntry {
  return {
    id: `${post.id}-log-${step}-${Date.now().toString(36)}`,
    step,
    status,
    message,
    durationMs,
    timestamp: new Date().toISOString(),
    model: GENERATION_MODEL,
    tokens,
  };
}

export function regenerateCaption(post: Post): RegenerationResult {
  const frames = CAPTION_FRAMES[post.category];
  const variant = variantIndex(post, frames.length);
  const caption = frames[variant](post).replace(/\s+/g, " ").trim();

  const pool = HASHTAG_POOLS[post.category];
  const offset = variant + 1;
  const hashtags = [
    ...post.hashtags.slice(0, 3),
    ...pool.slice(offset % 3, (offset % 3) + 2),
    `#${post.brandId.replace(/-/g, "")}`,
  ]
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 8);

  return {
    caption,
    hashtags,
    altText: caption.slice(0, 180),
    logs: [
      logEntry(
        post,
        "caption",
        "success",
        `Regenerated the caption — frame ${variant + 1} of ${frames.length}, ${caption.split(" ").length} words.`,
        1180 + variant * 240,
        940 + variant * 130,
      ),
      logEntry(
        post,
        "hashtags",
        "success",
        `Re-resolved ${hashtags.length} tags against the ${post.category.toLowerCase()} pool.`,
        210,
        60,
      ),
    ],
    summary: `Regenerated the caption — variant ${variant + 1} of ${frames.length}.`,
  };
}

export function regenerateCarousel(post: Post): RegenerationResult {
  const [cover, ...rest] = post.slides;
  const statistics = rest.filter((slide) => slide.kind === "statistic");
  const lists = rest.filter((slide) => slide.kind === "list");
  const quotes = rest.filter((slide) => slide.kind === "quote");
  const others = rest.filter(
    (slide) => !["statistic", "list", "quote"].includes(slide.kind),
  );

  const variant = variantIndex(post, 2);

  // Variant A pulls proof forward; variant B leads with the practical rules.
  const reordered =
    variant === 0
      ? [...statistics, ...lists.slice(0, 2), ...quotes, ...lists.slice(2), ...others]
      : [...lists, ...statistics, ...quotes, ...others.slice(0, 1)];

  const rebuilt: Slide[] = [cover, ...reordered].map((slide, index) => ({
    ...slide,
    id: `${post.id}-slide-${index + 1}`,
    index,
    kicker:
      index === 0
        ? slide.kicker
        : slide.kind === "statistic"
          ? "The number"
          : slide.kind === "list"
            ? `Rule ${String(index).padStart(2, "0")}`
            : slide.kicker,
    footnote: index === 0 ? "Swipe for the full breakdown" : undefined,
  }));

  const altText = rebuilt
    .map((slide, index) => `${index + 1}. ${slide.headline} — ${slide.body}`)
    .join(" ");

  return {
    slides: rebuilt,
    altText,
    logs: [
      logEntry(
        post,
        "carousel",
        "success",
        `Rebuilt the carousel — variant ${variant + 1}, proof ${
          variant === 0 ? "pulled forward" : "held back"
        }, ${rebuilt.length} frames.`,
        2340 + variant * 410,
        1480 + variant * 220,
      ),
      logEntry(
        post,
        "alt_text",
        "success",
        `Rewrote alt text across all ${rebuilt.length} frames.`,
        320,
        180,
      ),
    ],
    summary: `Regenerated the carousel — variant ${variant + 1}, ${
      variant === 0 ? "statistics moved to slide 2" : "rules moved ahead of the proof"
    }.`,
  };
}
