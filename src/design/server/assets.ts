import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

import { feature } from "topojson-client";

import type { GeoJsonCollection, WorldFeatureCollection } from "@/design/types";
import { assetLibrary } from "@/design/data/assets";

/**
 * Everything the design engine needs at render time, resolved once per server
 * boot and cached on `globalThis` (route modules can be instantiated more than
 * once, and the font files alone are a couple of hundred kilobytes).
 *
 * Fonts are self-hosted .woff2 files — no network at render time. The world map
 * is TopoJSON converted to GeoJSON on first use and then cached.
 */

const FONTS_DIR = path.join(process.cwd(), "src", "design", "fonts");
/**
 * TTFs converted from the woff2 sources by scripts/build-fonts.mjs (npm
 * prebuild / predev). The rasteriser (resvg) can only load sfnt containers —
 * woff2 registered via fontFiles is silently ignored — so the renderer reads
 * these; any other consumer that can parse woff2 keeps working through the
 * `fonts` fallback below.
 */
const TTF_DIR = path.join(FONTS_DIR, "ttf");
const MAP_FILE = path.join(process.cwd(), "src", "design", "data", "world-110m.json.gz");

const FONT_FILES = {
  inter400: "inter-latin-400-normal.woff2",
  inter500: "inter-latin-500-normal.woff2",
  inter600: "inter-latin-600-normal.woff2",
  inter700: "inter-latin-700-normal.woff2",
  fraunces400: "fraunces-latin-400-normal.woff2",
  fraunces600: "fraunces-latin-600-normal.woff2",
  fraunces700: "fraunces-latin-700-normal.woff2",
  grotesk400: "space-grotesk-latin-400-normal.woff2",
  grotesk500: "space-grotesk-latin-500-normal.woff2",
  grotesk700: "space-grotesk-latin-700-normal.woff2",
} as const;

export type FontKey = keyof typeof FONT_FILES;

/** The TTF twin of a woff2 key, produced by scripts/build-fonts.mjs. */
function ttfFileName(key: FontKey): string {
  return FONT_FILES[key].replace(/\.woff2$/, ".ttf");
}

/**
 * The rasteriser-ready font set. Prefers the converted TTFs; falls back to the
 * raw woff2s (with a warning) when the build script has not run, so a stale
 * checkout degrades loudly rather than silently rendering text-free slides.
 */
function loadRasterFonts(): Array<{ name: string; data: Buffer }> {
  return Object.entries(FONT_FILES).map(([key, woff2File]) => {
    try {
      return {
        name: key,
        data: readFileSync(path.join(TTF_DIR, ttfFileName(key as FontKey))),
      };
    } catch {
      console.warn(
        `[design] ${ttfFileName(key as FontKey)} not found — run \`npm run fonts:build\`. ` +
          "The PNG renderer will drop all text until the fonts are converted.",
      );
      return { name: key, data: readFileSync(path.join(FONTS_DIR, woff2File)) };
    }
  });
}

export const FONT_FAMILIES = {
  inter: "Inter",
  fraunces: "Fraunces",
  grotesk: "Space Grotesk",
} as const;

export type FontFamilyId = keyof typeof FONT_FAMILIES;

/** Weight → exact font file, per family. Resvg needs the real file per weight. */
export const FONT_WEIGHT_FILES: Record<
  FontFamilyId,
  Record<number, FontKey>
> = {
  inter: { 400: "inter400", 500: "inter500", 600: "inter600", 700: "inter700" },
  fraunces: { 400: "fraunces400", 600: "fraunces600", 700: "fraunces700" },
  grotesk: { 400: "grotesk400", 500: "grotesk500", 700: "grotesk700" },
};

interface DesignAssets {
  fonts: Array<{ name: string; data: Buffer }>;
  world: WorldFeatureCollection;
}

const globalForAssets = globalThis as unknown as { __factoryDesignAssets?: DesignAssets };

function loadAssets(): DesignAssets {
  const fonts = loadRasterFonts();

  // TopoJSON (stored gzipped — it is 39 KB vs 108 KB) → GeoJSON, cached after
  // the first conversion.
  const topo = JSON.parse(gunzipSync(readFileSync(MAP_FILE)).toString("utf8")) as Parameters<
    typeof feature
  >[0];
  const countries = feature(topo, topo.objects.countries as never) as unknown;
  const land = feature(topo, topo.objects.land as never) as unknown;

  return {
    fonts,
    world: {
      countries: countries as WorldFeatureCollection["countries"],
      land: land as WorldFeatureCollection["land"],
    },
  };
}

export function designAssets(): DesignAssets {
  if (!globalForAssets.__factoryDesignAssets) {
    globalForAssets.__factoryDesignAssets = loadAssets();
  }
  return globalForAssets.__factoryDesignAssets;
}

/** Font buffers for the rasteriser, resolved once. */
export function fontFiles(): Buffer[] {
  return designAssets().fonts.map((font) => font.data);
}

export interface AssetLibraryEntrySummary {
  id: string;
  label: string;
  kind: string;
  tags: string[];
}

/** Namespaced ids so an asset reference is self-describing ("icon:wave"). */
export const ASSET_PREFIX = {
  icon: "icon",
  illustration: "ill",
  pattern: "pat",
  flag: "flag",
  map: "map",
} as const;

export function assetById(ref: string) {
  const [kind, id] = ref.split(":");
  if (kind === ASSET_PREFIX.icon) return assetLibrary.icons.find((a) => a.id === id);
  if (kind === ASSET_PREFIX.illustration) return assetLibrary.illustrations.find((a) => a.id === id);
  if (kind === ASSET_PREFIX.pattern) return assetLibrary.patterns.find((a) => a.id === id);
  if (kind === ASSET_PREFIX.flag) return assetLibrary.flags.find((a) => a.id === id);
  return null;
}

export function allLibraryEntries(): AssetLibraryEntrySummary[] {
  return [
    ...assetLibrary.icons.map((entry) => ({
      id: `icon:${entry.id}`,
      label: entry.label,
      kind: "Icon",
      tags: entry.tags,
    })),
    ...assetLibrary.illustrations.map((entry) => ({
      id: `ill:${entry.id}`,
      label: entry.label,
      kind: "Illustration",
      tags: entry.tags,
    })),
    ...assetLibrary.patterns.map((entry) => ({
      id: `pat:${entry.id}`,
      label: entry.label,
      kind: "Pattern",
      tags: entry.tags,
    })),
    ...assetLibrary.flags.map((entry) => ({
      id: `flag:${entry.id}`,
      label: entry.label,
      kind: "Flag",
      tags: entry.tags,
    })),
    { id: "map:world", label: "World map (vector)", kind: "Map", tags: ["geo", "world"] },
  ];
}

/** GeoJSON lookup used by the map slide: every country, simplified to 110m. */
export function worldCountries(): GeoJsonCollection {
  return designAssets().world.countries as GeoJsonCollection;
}
