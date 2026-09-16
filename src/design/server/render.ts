import { composeSlide, footerGeometry, type ComposedSlide } from "@/design/compose";
import { assetLibrary } from "@/design/data/assets";
import { fitSlide } from "@/design/fit";
import { designAssets, worldCountries } from "@/design/server/assets";
import {
  FONT_FAMILIES,
  FONT_WEIGHT_FILES,
  type FontFamilyId,
} from "@/design/server/assets";
import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type AssetEntry,
  type GeoJsonCollection,
  type ResolvedTemplate,
  type SlideSpec,
} from "@/design/types";

/**
 * The SVG slide renderer.
 *
 * One slide in, one 1080×1350 SVG out — pure and deterministic, so the same
 * function serves the PNG exporter (which rasterises this string), the PDF
 * exporter and the editor's live preview (which inlines it). Nothing here reads
 * the clock or the network: same input, same pixels, every time.
 *
 * Placement comes from `composeSlide`, which is shared with the fit engine and
 * the editor's guides. This module only draws.
 */

type GeoFeature = {
  type: "Feature";
  properties: { name?: string };
  geometry: GeoJsonCollection["features"][number]["geometry"];
};

function esc(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fontWeightOf(family: FontFamilyId, preferred: number) {
  const weights = Object.keys(FONT_WEIGHT_FILES[family]).map(Number);
  return weights.reduce(
    (best, weight) => (Math.abs(weight - preferred) < Math.abs(best - preferred) ? weight : best),
    weights[0],
  );
}

function fontFamily(family: FontFamilyId) {
  return `${FONT_FAMILIES[family]}, sans-serif`;
}

/** Project equirectangular into the slide box (world map). */
function projectLongitude(latitude: number, longitude: number) {
  const x = ((longitude + 180) / 360) * SLIDE_WIDTH;
  const y = ((90 - latitude) / 180) * (SLIDE_HEIGHT * 0.62);
  return [x, y] as const;
}

function pathOf(geometry: GeoFeature["geometry"]) {
  const draw = (rings: number[][][]) =>
    rings
      .map((ring) => {
        if (ring.length === 0) return "";
        const [startLon, startLat] = ring[0];
        const [startX, startY] = projectLongitude(startLat, startLon);
        const segments = ring
          .slice(1)
          .map(([lon, lat]) => {
            const [x, y] = projectLongitude(lat, lon);
            return `L${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(" ");
        return `M${startX.toFixed(1)} ${startY.toFixed(1)}${segments}Z`;
      })
      .join(" ");

  if (geometry.type === "Polygon") return draw(geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map(draw).join(" ");
  return "";
}

function highlightMatches(countries: GeoJsonCollection, wanted: string[]): GeoFeature[] {
  const wantedLower = wanted.map((name) => name.toLowerCase());
  return (countries.features as GeoFeature[]).filter((feature) => {
    const name = feature.properties?.name?.toLowerCase();
    return name ? wantedLower.includes(name) : false;
  });
}

/* --------------------------------- motifs --------------------------------- */

/**
 * The motif band.
 *
 * It occupies the space `composeSlide` reserved for it, so artwork and copy can
 * never collide — the previous renderer drew the band at a fixed offset and let
 * long headlines run straight through the map.
 */
function renderMotif(slide: SlideSpec, template: ResolvedTemplate, composed: ComposedSlide): string {
  const motif = slide.motif ?? "none";
  if (motif === "none" || composed.motifHeight <= 0) return "";

  const { palette, spacing } = template;
  const bandTop = composed.motifTop;
  const bandHeight = composed.motifHeight;
  const bandWidth = SLIDE_WIDTH - spacing.margin * 2;

  const openTag = `<g clip-path="url(#safe-clip)">`;

  if (motif === "map") {
    const wanted = slide.highlightCountries ?? [];
    const countries = worldCountries();
    const base = (countries.features as GeoFeature[])
      .map(
        (feature) =>
          `<path d="${pathOf(feature.geometry)}" fill="${palette.surface}" stroke="${palette.inkSoft}" stroke-width="0.6" stroke-opacity="0.35"/>`,
      )
      .join("");

    const highlighted = highlightMatches(countries, wanted)
      .map(
        (feature) =>
          `<path d="${pathOf(feature.geometry)}" fill="${palette.accent}" fill-opacity="0.9"/>`,
      )
      .join("");

    // Full-bleed band: the map keeps its equirectangular grid and is squashed
    // into the reserved height, which is what makes it read as a cartographic
    // strip rather than a floating picture.
    const yScale = bandHeight / (SLIDE_HEIGHT * 0.62);

    return `${openTag}
      <g transform="translate(0 ${bandTop.toFixed(1)}) scale(1 ${yScale.toFixed(4)})" opacity="0.85">
        ${base}${highlighted}
      </g>
    </g>`;
  }

  const entry = slide.assetRef ? slide.assetRef.split(":")[1] : null;
  if (!entry) return "";

  const collection: AssetEntry[] =
    motif === "pattern"
      ? assetLibrary.patterns
      : motif === "illustration"
        ? assetLibrary.illustrations
        : motif === "flag"
          ? assetLibrary.flags
          : assetLibrary.icons;

  const asset = collection.find((candidate) => candidate.id === entry);
  if (!asset) return "";

  const strokeColor = motif === "flag" ? undefined : palette.inkSoft;
  const fills = "fills" in asset ? (asset.fills ?? []) : [];
  const paths = asset.paths
    .map((pathData, index) => {
      if (motif === "flag") {
        const fill = fills[index % Math.max(fills.length, 1)] ?? palette.accent;
        return `<path d="${pathData}" fill="${fill}" fill-opacity="0.85"/>`;
      }
      return `<path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${motif === "icon" ? 2.4 : 1.6}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");

  // Aspect-preserving scale into the reserved band, centred both ways.
  const [vw, vh] = asset.viewBox.split(" ").map(Number);
  const scale =
    Math.min(bandWidth / vw, bandHeight / vh) * (motif === "icon" ? 0.72 : 0.92);
  const offsetX = (SLIDE_WIDTH - vw * scale) / 2;
  const offsetY = bandTop + (bandHeight - vh * scale) / 2;

  return `${openTag}
    <g transform="translate(${offsetX.toFixed(1)} ${offsetY.toFixed(1)}) scale(${scale.toFixed(3)})">${paths}</g>
  </g>`;
}

/* ------------------------------- decorations ------------------------------- */

function graticule(template: ResolvedTemplate) {
  const { palette, spacing } = template;
  const step = 108;
  const lines: string[] = [];
  for (let x = spacing.margin; x <= SLIDE_WIDTH - spacing.margin; x += step) {
    lines.push(
      `<line x1="${x}" y1="${spacing.margin}" x2="${x}" y2="${SLIDE_HEIGHT - spacing.margin}" stroke="${palette.inkSoft}" stroke-opacity="0.08" stroke-width="1"/>`,
    );
  }
  for (let y = spacing.margin; y <= SLIDE_HEIGHT - spacing.margin; y += step) {
    lines.push(
      `<line x1="${spacing.margin}" y1="${y}" x2="${SLIDE_WIDTH - spacing.margin}" y2="${y}" stroke="${palette.inkSoft}" stroke-opacity="0.08" stroke-width="1"/>`,
    );
  }
  return lines.join("");
}

/* --------------------------------- slide ---------------------------------- */

/** Every line of the block drawn at the baseline the composer gave it. */
function renderTextBlock(composed: ComposedSlide, template: ResolvedTemplate): string {
  const { palette, typography } = template;
  const displayWeight = fontWeightOf(typography.display, 700);
  const kickerWeight = fontWeightOf(typography.body, 600);
  const bodyWeight = fontWeightOf(typography.body, 400);

  const common = `x="${composed.blockX}" text-anchor="${composed.textAnchor}" xml:space="preserve"`;
  const parts: string[] = [];

  // The template owns the kicker's case, so it is applied to the composed
  // lines rather than to the raw field.
  const kickerLines = typography.uppercaseKicker
    ? composed.kickerLines.map((line) => line.toUpperCase())
    : composed.kickerLines;

  if (kickerLines.length > 0) {
    parts.push(
      kickerLines
        .map(
          (line, index) =>
            `<text ${common} y="${(composed.kickerBaseline + index * composed.kickerSize * 1.4).toFixed(1)}" font-family="${fontFamily(typography.body)}" font-size="${composed.kickerSize.toFixed(1)}" font-weight="${kickerWeight}" fill="${palette.accent}" letter-spacing="0.14em">${esc(line)}</text>`,
        )
        .join(""),
    );
  }

  parts.push(
    composed.displayLines
      .map(
        (line, index) =>
          `<text ${common} y="${composed.displayBaselines[index].toFixed(1)}" font-family="${fontFamily(typography.display)}" font-size="${composed.displaySize.toFixed(1)}" font-weight="${displayWeight}" fill="${palette.ink}" letter-spacing="${typography.letterSpacingDisplay}em">${esc(line)}</text>`,
      )
      .join(""),
  );

  if (composed.bodyLines.length > 0) {
    parts.push(
      composed.bodyLines
        .map(
          (line, index) =>
            `<text ${common} y="${composed.bodyBaselines[index].toFixed(1)}" font-family="${fontFamily(typography.body)}" font-size="${composed.bodySize.toFixed(1)}" font-weight="${bodyWeight}" fill="${palette.inkSoft}">${esc(line)}</text>`,
        )
        .join(""),
    );
  }

  if (composed.stat) {
    parts.push(
      `<text ${common} y="${composed.stat.valueBaseline.toFixed(1)}" font-family="${fontFamily(typography.display)}" font-size="${(composed.bodySize * 3.2).toFixed(1)}" font-weight="${fontWeightOf(typography.display, 700)}" fill="${palette.accent}" letter-spacing="${typography.letterSpacingDisplay}em">${esc(composed.stat.value)}</text>`,
      `<text ${common} y="${composed.stat.labelBaseline.toFixed(1)}" font-family="${fontFamily(typography.body)}" font-size="${composed.bodySize.toFixed(1)}" font-weight="${bodyWeight}" fill="${palette.inkSoft}">${esc(composed.stat.label)}</text>`,
    );
  }

  return parts.join("\n    ");
}

export function renderSlideSvg(slide: SlideSpec, template: ResolvedTemplate): string {
  const { palette, typography } = template;
  const fit = fitSlide(slide, template);
  const composed = composeSlide(slide, template, fit.displaySize);
  const footer = footerGeometry(template);

  const kickerTransform = typography.uppercaseKicker ? "uppercase" : "none";
  const kickerWeight = fontWeightOf(typography.body, 600);

  const decorated =
    slide.layout === "cover" || slide.layout === "closing" ? graticule(template) : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" viewBox="0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}">
  <defs>
    <clipPath id="safe-clip"><rect x="0" y="0" width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}"/></clipPath>
  </defs>

  <rect width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="${palette.background}"/>
  ${decorated}

  ${renderMotif(slide, template, composed)}

  <g clip-path="url(#safe-clip)">
    <g>
    ${renderTextBlock(composed, template)}
    </g>

    <line x1="${template.spacing.margin}" y1="${footer.ruleY.toFixed(1)}" x2="${SLIDE_WIDTH - template.spacing.margin}" y2="${footer.ruleY.toFixed(1)}" stroke="${palette.inkSoft}" stroke-opacity="0.25" stroke-width="1"/>
    <text x="${template.spacing.margin}" y="${footer.textY.toFixed(1)}" font-family="${fontFamily(typography.body)}" font-size="20" font-weight="${kickerWeight}" fill="${palette.inkSoft}" letter-spacing="0.18em" style="text-transform:${kickerTransform}">${esc(template.footer.toUpperCase())}</text>
    <text x="${SLIDE_WIDTH - template.spacing.margin}" y="${footer.textY.toFixed(1)}" text-anchor="end" font-family="${fontFamily(typography.body)}" font-size="20" font-weight="${kickerWeight}" fill="${palette.inkSoft}" letter-spacing="0.1em">${slide.index} / 7</text>
  </g>
</svg>`;
}

/** The @font-face block the rasteriser needs for each self-hosted weight. */
export function fontFaceCss(): string {
  return (Object.keys(FONT_WEIGHT_FILES) as FontFamilyId[])
    .flatMap((family) =>
      Object.entries(FONT_WEIGHT_FILES[family]).map(
        ([weight, key]) => `
@font-face {
  font-family: "${FONT_FAMILIES[family]}";
  font-weight: ${weight};
  src: url(data:font/woff2;base64,${
    designAssets().fonts.find((font) => font.name === key)?.data.toString("base64") ?? ""
  }) format("woff2");
}`,
      ),
    )
    .join("\n");
}
