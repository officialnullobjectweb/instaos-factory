import type { Template } from "@/types";

/**
 * The bundled layout catalogue. These are product configuration, not usage
 * data: `uses` counts real publishes through the design engine and starts at
 * zero, and `updatedAt` is the day the catalogue shipped.
 */
const CATALOGUE_SHIPPED_AT = "2026-09-16T00:00:00.000Z";

export const templates: Template[] = [
  {
    id: "tpl-editorial-quote",
    name: "Editorial Quote",
    description:
      "Serif-free editorial layout with a single statement and a small caps eyebrow.",
    category: "Editorial",
    format: "static",
    brandIds: ["midnight-ritual", "studio-noir"],
    uses: 0,
    updatedAt: CATALOGUE_SHIPPED_AT,
    status: "live",
    preview: ["EYEBROW · 01", "A quiet statement", "set in two lines."],
  },
  {
    id: "tpl-reel-teaser",
    name: "Reel Teaser",
    description:
      "Nine-second hook card, mono type, hard cut to the first frame.",
    category: "Product",
    format: "reel",
    brandIds: ["studio-noir", "daily-grind"],
    uses: 0,
    updatedAt: CATALOGUE_SHIPPED_AT,
    status: "live",
    preview: ["HOOK · REEL", "First 3 words", "carry the frame."],
  },
  {
    id: "tpl-carousel-story",
    name: "Carousel Story",
    description:
      "Six-slide narrative arc: tension, proof, resolution, call to save.",
    category: "Carousel",
    format: "carousel",
    brandIds: ["midnight-ritual", "studio-noir", "daily-grind"],
    uses: 0,
    updatedAt: CATALOGUE_SHIPPED_AT,
    status: "live",
    preview: ["SLIDE 01 / 06", "Set the tension", "resolve by slide 5."],
  },
  {
    id: "tpl-product-drop",
    name: "Product Drop",
    description:
      "Launch grid with object crop, price whisper and scarcity line.",
    category: "Product",
    format: "carousel",
    brandIds: ["midnight-ritual", "studio-noir"],
    uses: 0,
    updatedAt: CATALOGUE_SHIPPED_AT,
    status: "live",
    preview: ["DROP · 400 UNITS", "Object, centred", "scarcity last."],
  },
  {
    id: "tpl-story-tease",
    name: "Story Tease",
    description: "Three-frame vertical tease with a swipe-up prompt.",
    category: "Story",
    format: "story",
    brandIds: ["midnight-ritual", "daily-grind"],
    uses: 0,
    updatedAt: CATALOGUE_SHIPPED_AT,
    status: "live",
    preview: ["FRAME 01 / 03", "Tease the payoff", "swipe for the rest."],
  },
  {
    id: "tpl-announcement",
    name: "Studio Announcement",
    description:
      "In-development layout for hiring, awards and partnership news.",
    category: "Announcement",
    format: "static",
    brandIds: ["studio-noir"],
    uses: 0,
    updatedAt: CATALOGUE_SHIPPED_AT,
    status: "draft",
    preview: ["IN DEVELOPMENT", "Announcement layout", "not yet released."],
  },
];

export const TEMPLATE_BY_ID = new Map(templates.map((t) => [t.id, t]));
