import type {
  DesignOverrides,
  ResolvedTemplate,
  SlideLayout,
  SlideSpec,
  TemplateId,
  TemplateTokens,
} from "@/design/types";
import { SLIDE_COUNT } from "@/design/types";

/**
 * The three template systems.
 *
 * Each is a complete editorial system — typography, spacing, palette, motif
 * vocabulary and footer branding — not a colour swap. Geography is cartographic
 * and documentary; Psychology is editorial and calm; Branding is typographic
 * and confident. All three compose against the same slide contract, so content
 * is portable between them.
 */

export const TEMPLATES: Record<TemplateId, TemplateTokens> = {
  geography: {
    id: "geography",
    label: "Geography",
    description:
      "Cartographic and documentary. A thin graticule, a precise serif for place names and a data-forward layout.",
    palette: {
      background: "#0E1116",
      surface: "#161B22",
      ink: "#EDEBE4",
      inkSoft: "#9BA4AD",
      accent: "#D9A441",
      onAccent: "#0E1116",
    },
    typography: {
      display: "fraunces",
      body: "inter",
      displaySizeMax: 92,
      displaySizeMin: 56,
      bodySize: 30,
      lineHeightDisplay: 1.06,
      lineHeightBody: 1.5,
      letterSpacingDisplay: -0.015,
      uppercaseKicker: true,
    },
    spacing: { margin: 88, gutter: 32, baseline: 8 },
    footer: "ATLAS · FIELD NOTES",
  },
  psychology: {
    id: "psychology",
    label: "Psychology",
    description:
      "Editorial and calm. Generous whitespace, one idea per slide, soft grey inks with a single considered accent.",
    palette: {
      background: "#F7F5F0",
      surface: "#FFFFFF",
      ink: "#1A1A18",
      inkSoft: "#6E6E68",
      accent: "#3E6B4F",
      onAccent: "#F7F5F0",
    },
    typography: {
      display: "inter",
      body: "inter",
      displaySizeMax: 84,
      displaySizeMin: 52,
      bodySize: 30,
      lineHeightDisplay: 1.1,
      lineHeightBody: 1.55,
      letterSpacingDisplay: -0.025,
      uppercaseKicker: true,
    },
    spacing: { margin: 104, gutter: 28, baseline: 8 },
    footer: "MIND · EXAMINED",
  },
  branding: {
    id: "branding",
    label: "Branding",
    description:
      "Typographic and confident. Big grotesk statements, hard grids, ink-on-ink contrast.",
    palette: {
      background: "#111111",
      surface: "#1C1C1C",
      ink: "#F4F4F2",
      inkSoft: "#8A8A85",
      accent: "#E8E6DF",
      onAccent: "#111111",
    },
    typography: {
      display: "grotesk",
      body: "inter",
      displaySizeMax: 104,
      displaySizeMin: 64,
      bodySize: 30,
      lineHeightDisplay: 1.02,
      lineHeightBody: 1.5,
      letterSpacingDisplay: -0.03,
      uppercaseKicker: true,
    },
    spacing: { margin: 96, gutter: 36, baseline: 8 },
    footer: "BRAND · SYSTEMS",
  },
};

export const TEMPLATE_IDS: TemplateId[] = ["geography", "psychology", "branding"];

/** Apply user overrides to a template, producing the resolved tokens. */
export function resolveTemplate(
  templateId: TemplateId,
  overrides: DesignOverrides = {},
): ResolvedTemplate {
  const base = TEMPLATES[templateId];
  return {
    ...base,
    palette: { ...base.palette, ...overrides.palette },
    typography: { ...base.typography, ...overrides.typography },
    spacing: { ...base.spacing, ...overrides.spacing },
    footer: overrides.footer ?? base.footer,
    overrides,
  };
}

/* ----------------------------- default decks ------------------------------ */

/**
 * A starter deck per template — what a reviewer sees when they open the studio
 * fresh. Real content shape: cover, three statements, a data slide, a closing.
 */
export function defaultDeck(templateId: TemplateId): SlideSpec[] {
  const decks: Record<TemplateId, SlideSpec[]> = {
    geography: [
      {
        index: 1,
        layout: "cover",
        kicker: "Field note 014",
        headline: "The strait that trades more than the Pacific",
        body: "Malacca carries a quarter of the world's traded goods through 800 kilometres of water.",
        motif: "map",
        highlightCountries: ["Malaysia", "Indonesia", "Singapore"],
      },
      {
        index: 2,
        layout: "data",
        kicker: "Throughput",
        headline: "94,000 ships a year",
        body: "One every six minutes, day and night, in either direction.",
        stat: { value: "94k", label: "transits annually" },
        motif: "icon",
        assetRef: "icon:route",
      },
      {
        index: 3,
        layout: "statement",
        kicker: "Chokepoint",
        headline: "Narrower than the Thames at London",
        body: "At Phillips Channel the fairway shrinks to 1.7 miles of navigable water.",
      },
      {
        index: 4,
        layout: "statement",
        kicker: "Dependency",
        headline: "Two-thirds of China's imports pass here",
        body: "Beijing calls it the Malacca dilemma. The alternative route adds 3,000 nautical miles.",
        motif: "map",
        highlightCountries: ["China"],
      },
      {
        index: 5,
        layout: "data",
        kicker: "Piracy",
        headline: "The Singapore Strait is the world's busiest",
        body: "Incidents cluster in the strait itself — 76 reported in a single year.",
        stat: { value: "76", label: "incidents, latest year" },
        motif: "icon",
        assetRef: "icon:alert",
      },
      {
        index: 6,
        layout: "statement",
        kicker: "What changed",
        headline: "Dredging is now national strategy",
        body: "Two metres of depth decides which ports a 400-metre container ship can serve.",
      },
      {
        index: 7,
        layout: "closing",
        kicker: "Atlas · Field notes",
        headline: "Geography is not destiny. It is a budget.",
        body: "Follow for more field notes on the systems that move the world.",
        motif: "pattern",
        assetRef: "pat:contour",
      },
    ],
    psychology: [
      {
        index: 1,
        layout: "cover",
        kicker: "Examined 007",
        headline: "Your brain edits the past in real time",
        body: "Every recalled memory is a reconstruction — and each reconstruction rewrites the original.",
        motif: "illustration",
        assetRef: "ill:memory",
      },
      {
        index: 2,
        layout: "statement",
        kicker: "The mechanism",
        headline: "Recall is reconsolidation",
        body: "A memory must become chemically unstable to be read, then be re-saved — imperfectly.",
      },
      {
        index: 3,
        layout: "data",
        kicker: "The evidence",
        headline: "Confidence predicts nothing",
        body: "Studies of eyewitness testimony find near-zero link between certainty and accuracy.",
        stat: { value: "~0", label: "correlation, confidence vs accuracy" },
        motif: "icon",
        assetRef: "icon:eye",
      },
      {
        index: 4,
        layout: "statement",
        kicker: "The cost",
        headline: "Nostalgia is a curator with a bias",
        body: "The 'good old days' are assembled from what survived the edits — mostly the emotionally loud.",
        motif: "pattern",
        assetRef: "pat:dots",
      },
      {
        index: 5,
        layout: "statement",
        kicker: "The leverage",
        headline: "Write things down within 24 hours",
        body: "A written record freezes the reconstruction before the day's mood colours it.",
      },
      {
        index: 6,
        layout: "statement",
        kicker: "The caveat",
        headline: "This is not a flaw to fix",
        body: "Reconstruction is what lets learning update old information with new context.",
        motif: "illustration",
        assetRef: "ill:growth",
      },
      {
        index: 7,
        layout: "closing",
        kicker: "Mind · Examined",
        headline: "Trust the note, not the memory.",
        body: "Follow for more examined psychology, one mechanism at a time.",
      },
    ],
    branding: [
      {
        index: 1,
        layout: "cover",
        kicker: "Systems 021",
        headline: "Category design beats share stealing",
        body: "The strongest brands do not out-compete rivals — they change the question the market asks.",
        motif: "pattern",
        assetRef: "pat:grid",
      },
      {
        index: 2,
        layout: "statement",
        kicker: "The move",
        headline: "Name the problem you own",
        body: "If buyers can't name the problem, they default to price. Own the name, escape the auction.",
      },
      {
        index: 3,
        layout: "data",
        kicker: "The economics",
        headline: "Leaders capture most of the profit",
        body: "Category creators hold a structural margin advantage for years, not quarters.",
        stat: { value: "76%", label: "of category profit to the creator" },
        motif: "icon",
        assetRef: "icon:crown",
      },
      {
        index: 4,
        layout: "statement",
        kicker: "The signal",
        headline: "Distinct beats familiar",
        body: "Fluency makes ads likeable; distinctiveness makes brands findable in memory.",
        motif: "icon",
        assetRef: "icon:target",
      },
      {
        index: 5,
        layout: "statement",
        kicker: "The discipline",
        headline: "One enemy, named",
        body: "Every strong category has a villain — an old way of doing things worth replacing.",
      },
      {
        index: 6,
        layout: "statement",
        kicker: "The proof",
        headline: "Language is the product",
        body: "Salesforce didn't sell software. It ended software — with a slogan.",
        motif: "pattern",
        assetRef: "pat:lines",
      },
      {
        index: 7,
        layout: "closing",
        kicker: "Brand · Systems",
        headline: "Design the category, then the logo.",
        body: "Follow for more brand systems, one mechanism at a time.",
      },
    ],
  };

  return decks[templateId];
}

/** Validate a deck's shape; the editor keeps it always at 7 slides. */
export function normaliseDeck(slides: SlideSpec[]): SlideSpec[] {
  const next = [...slides];
  while (next.length < SLIDE_COUNT) {
    next.push({
      index: next.length + 1,
      layout: "statement",
      kicker: "",
      headline: "Untitled slide",
      body: "",
    });
  }
  return next.slice(0, SLIDE_COUNT).map((slide, i) => ({ ...slide, index: i + 1 }));
}

export const LAYOUTS: SlideLayout[] = ["cover", "statement", "data", "closing"];
