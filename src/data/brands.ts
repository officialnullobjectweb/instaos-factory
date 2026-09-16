import type { Brand, BrandId } from "@/types";

/**
 * The generation engine reads these profiles directly, so this file is the
 * brief: change a voice or a pillar here and every prompt changes with it.
 *
 * Audience numbers (followers, growth, engagement) are **not declared here** —
 * they are live account facts. They start at zero and are filled by the
 * Instagram account connection and the insights sync; nothing invents them.
 */
export const brands: Brand[] = [
  {
    id: "midnight-ritual",
    name: "Midnight Ritual",
    handle: "@midnightritual",
    initials: "MR",
    positioning: "Late-night minimalism for slow living",
    followers: 0,
    followerGrowth: 0,
    postsThisWeek: 0,
    avgEngagement: 0,
    status: "active",
    logoSrc: "/brands/midnight-ritual.svg",
    category: "Branding",
    voice: "Quiet authority. Second person, never preachy, comfortable with silence and white space.",
    writingStyle:
      "Short declarative sentences. Concrete nouns. One idea per slide. No hype adjectives, no exclamation marks, no emoji.",
    readingLevel: "Grade 7 (plain and unhurried)",
    colorTheme: {
      background: "#111111",
      foreground: "#F4F4F2",
      accent: "#F4F4F2",
    },
    contentPillars: [
      "Ritual design",
      "Category creation",
      "Brand governance",
      "Slow marketing",
    ],
    hashtagBase: ["#midnightritual", "#slowbrand"],
    postingWindow: { weekday: 2, hourUtc: 21 },
  },
  {
    id: "studio-noir",
    name: "Studio Noir",
    handle: "@studionoir",
    initials: "SN",
    positioning: "Editorial monochrome for design studios",
    followers: 0,
    followerGrowth: 0,
    postsThisWeek: 0,
    avgEngagement: 0,
    status: "active",
    logoSrc: "/brands/studio-noir.svg",
    category: "Geography",
    voice: "Editorial and observational. Reports what cities actually did, not what they should do.",
    writingStyle:
      "Reported sentences with a number in them. Named places and named systems. No moralising, no listicle filler.",
    readingLevel: "Grade 8 (editorial, precise)",
    colorTheme: {
      background: "#FFFFFF",
      foreground: "#111111",
      accent: "#6B6B68",
    },
    contentPillars: [
      "Urban systems",
      "Infrastructure economics",
      "Place and identity",
      "Maps and movement",
    ],
    hashtagBase: ["#studionoir", "#citydesign"],
    postingWindow: { weekday: 4, hourUtc: 15 },
  },
  {
    id: "daily-grind",
    name: "The Daily Grind",
    handle: "@thedailygrind",
    initials: "DG",
    positioning: "Morning routines for founders",
    followers: 0,
    followerGrowth: 0,
    postsThisWeek: 0,
    avgEngagement: 0,
    status: "active",
    logoSrc: "/brands/daily-grind.svg",
    category: "Psychology",
    voice: "Direct and unsentimental. Talks to someone who is already tired and does not need a lecture.",
    writingStyle:
      "Talks to the reader. Names the mechanism, then the one change. Cites the study rather than the guru.",
    readingLevel: "Grade 6 (plain spoken)",
    colorTheme: {
      background: "#F1EDE8",
      foreground: "#1A1714",
      accent: "#B7791F",
    },
    contentPillars: [
      "Habit mechanics",
      "Attention and focus",
      "Decision fatigue",
      "Behavioural research",
    ],
    hashtagBase: ["#thedailygrind", "#founderroutines"],
    postingWindow: { weekday: 1, hourUtc: 6 },
  },
];

export const BRAND_BY_ID = Object.fromEntries(
  brands.map((brand) => [brand.id, brand]),
) as Record<BrandId, Brand>;

export function getBrand(id: BrandId): Brand {
  return BRAND_BY_ID[id];
}

export const activeBrandIds: BrandId[] = brands.map((brand) => brand.id);

/** Totals derived from the (real) per-brand numbers; zero until insights sync. */
export const workspaceSnapshot = {
  followers: brands.reduce((total, brand) => total + brand.followers, 0),
  poststhisWeek: brands.reduce((total, brand) => total + brand.postsThisWeek, 0),
};
