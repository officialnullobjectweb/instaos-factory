"use client";

import { useMemo, useState } from "react";

import { SearchInput } from "@/components/data/search-input";
import { Badge } from "@/components/ui/badge";
import { assetLibrary } from "@/design/data/assets";
import type { AssetEntry } from "@/design/types";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { cn } from "@/lib/utils";

/**
 * The asset library browser.
 *
 * Everything is local vector data, so previews are just the paths drawn at
 * small size with `currentColor` — no thumbnails to generate, no loading, and
 * the preview is exactly the asset. Applying an asset sets the selected slide's
 * motif and reference in one write.
 */

type AssetGroup = "icons" | "patterns" | "illustrations" | "flags";

const GROUPS: Array<{ id: AssetGroup; label: string; motifPrefix: string; motif: string }> = [
  { id: "icons", label: "Icons", motifPrefix: "icon", motif: "icon" },
  { id: "illustrations", label: "Illustrations", motifPrefix: "ill", motif: "illustration" },
  { id: "patterns", label: "Patterns", motifPrefix: "pat", motif: "pattern" },
  { id: "flags", label: "Flags", motifPrefix: "flag", motif: "flag" },
];

function AssetGlyph({ entry }: { entry: AssetEntry }) {
  const [vw, vh] = entry.viewBox.split(" ").map(Number);
  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      className="size-8 text-ink-2"
      aria-hidden="true"
      fill="none"
    >
      {entry.paths.map((pathData, index) => (
        <path
          key={index}
          d={pathData}
          stroke="currentColor"
          strokeWidth={entry.fills ? 0 : 2}
          fill={entry.fills ? (entry.fills[index % entry.fills.length] ?? "none") : "none"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export function AssetBrowser() {
  const document_ = useStudioStore((state) => state.document);
  const selected = useStudioStore((state) => state.selected);
  const patchSlide = useStudioStore((state) => state.patchSlide);
  const [query, setQuery] = useState("");

  const slide = document_.slides[selected];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const match = (entry: AssetEntry) =>
      needle === "" ||
      entry.label.toLowerCase().includes(needle) ||
      entry.tags.some((tag) => tag.includes(needle));

    return {
      icons: assetLibrary.icons.filter(match),
      illustrations: assetLibrary.illustrations.filter(match),
      patterns: assetLibrary.patterns.filter(match),
      flags: assetLibrary.flags.filter(match),
    };
  }, [query]);

  function apply(group: AssetGroup, entry: AssetEntry) {
    const meta = GROUPS.find((candidate) => candidate.id === group);
    if (!meta) return;
    patchSlide(selected, {
      motif: meta.motif as never,
      assetRef: `${meta.motifPrefix}:${entry.id}`,
    });
  }

  const mapApplied = slide?.motif === "map";

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search assets and tags…"
        label="Search asset library"
      />

      {GROUPS.map((group) => {
        const entries = filtered[group.id];
        if (entries.length === 0) return null;

        return (
          <section key={group.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
                {group.label}
              </span>
              <Badge tone="neutral" size="sm">
                {entries.length}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {entries.map((entry) => {
                const ref = `${group.motifPrefix}:${entry.id}`;
                const applied = slide?.assetRef === ref;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => apply(group.id, entry)}
                    aria-pressed={applied}
                    title={`${entry.label} — apply to slide ${slide?.index ?? 1}`}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 transition-colors duration-150 ease-soft",
                      applied
                        ? "border-ink/25 bg-surface-2"
                        : "border-line hover:bg-surface-2",
                    )}
                  >
                    <AssetGlyph entry={entry} />
                    <span className="w-full truncate text-center text-[10.5px] text-ink-2">
                      {entry.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
            Maps
          </span>
          <Badge tone="neutral" size="sm">
            world
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => patchSlide(selected, { motif: "map" })}
          aria-pressed={mapApplied}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors duration-150 ease-soft",
            mapApplied ? "border-ink/25 bg-surface-2" : "border-line hover:bg-surface-2",
          )}
        >
          <svg viewBox="0 0 60 32" className="h-8 w-15 text-ink-2" aria-hidden="true">
            <ellipse
              cx="30"
              cy="16"
              rx="26"
              ry="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <ellipse cx="30" cy="16" rx="12" ry="13" fill="none" stroke="currentColor" strokeWidth="0.8" />
            <line x1="4" y1="16" x2="56" y2="16" stroke="currentColor" strokeWidth="0.8" />
          </svg>
          <span className="flex flex-col">
            <span className="text-[12.5px] text-ink">World map (vector)</span>
            <span className="text-[11px] text-ink-2">
              110m TopoJSON with country highlighting
            </span>
          </span>
        </button>
      </section>
    </div>
  );
}
