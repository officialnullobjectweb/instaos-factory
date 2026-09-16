"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveTemplate, TEMPLATE_IDS, TEMPLATES } from "@/design/templates";
import type {
  DesignOverrides,
  SlideLayout,
  TemplateId,
  TemplateTypography,
} from "@/design/types";

type FontFamilyId = TemplateTypography["display"];

const FONT_LABELS: Record<FontFamilyId, string> = {
  inter: "Inter",
  fraunces: "Fraunces",
  grotesk: "Space Grotesk",
};
import {
  LAYOUT_LABELS,
  useStudioStore,
} from "@/features/studio/store/studio-store";
import { cn } from "@/lib/utils";

/**
 * The design inspector: template-level controls.
 *
 * Colour changes go through contrast validation implicitly — the quality panel
 * re-runs the WCAG checks on every resolved value, so an override that breaks
 * accessibility turns the report red without this panel having to duplicate
 * the maths.
 */

const PALETTE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface" },
  { key: "ink", label: "Ink" },
  { key: "inkSoft", label: "Soft ink" },
  { key: "accent", label: "Accent" },
  { key: "onAccent", label: "On accent" },
];

const FONTS: FontFamilyId[] = ["inter", "fraunces", "grotesk"];
const LAYOUTS: SlideLayout[] = ["cover", "statement", "data", "closing"];

export function DesignInspector() {
  const document_ = useStudioStore((state) => state.document);
  const setTemplate = useStudioStore((state) => state.setTemplate);
  const setOverrides = useStudioStore((state) => state.setOverrides);
  const selected = useStudioStore((state) => state.selected);
  const patchSlide = useStudioStore((state) => state.patchSlide);

  const resolved = resolveTemplate(document_.templateId, document_.overrides);

  function patchOverride(patch: DesignOverrides) {
    setOverrides({
      ...document_.overrides,
      ...patch,
      palette: { ...resolved.overrides.palette, ...patch.palette },
      typography: { ...resolved.overrides.typography, ...patch.typography },
      spacing: { ...resolved.overrides.spacing, ...patch.spacing },
    });
  }

  function patchPalette(key: string, value: string) {
    if (!/^#[0-9a-fA-F]{0,6}$/.test(value)) return;
    patchOverride({ palette: { [key]: value } as never });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <Label>Template system</Label>
        <div className="flex flex-col gap-1.5">
          {TEMPLATE_IDS.map((id: TemplateId) => (
            <button
              key={id}
              type="button"
              onClick={() => setTemplate(id)}
              aria-pressed={document_.templateId === id}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 ease-soft",
                document_.templateId === id
                  ? "border-ink/25 bg-surface-2"
                  : "border-line hover:bg-surface-2",
              )}
            >
              <span className="mt-0.5 flex gap-0.5">
                {[TEMPLATES[id].palette.background, TEMPLATES[id].palette.accent, TEMPLATES[id].palette.ink].map(
                  (colour) => (
                    <span
                      key={colour}
                      className="size-3 rounded-full border border-black/10"
                      style={{ backgroundColor: colour }}
                    />
                  ),
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[13px] font-medium text-ink">
                  {TEMPLATES[id].label}
                </span>
                <span className="text-[11.5px] leading-snug text-ink-2">
                  {TEMPLATES[id].description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <Label>Palette</Label>
        <div className="grid grid-cols-2 gap-2">
          {PALETTE_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
              <input
                type="color"
                value={resolved.palette[field.key as keyof typeof resolved.palette]}
                onChange={(event) => patchPalette(field.key, event.target.value)}
                aria-label={`${field.label} colour`}
                className="size-6 shrink-0 cursor-pointer rounded-xs border-0 bg-transparent p-0"
              />
              <span className="flex min-w-0 flex-col leading-none">
                <span className="truncate text-[11.5px] text-ink">{field.label}</span>
                <span className="truncate font-mono text-[10px] text-ink-3">
                  {resolved.palette[field.key as keyof typeof resolved.palette]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <Label>Typography</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] text-ink-2">Display font</span>
            <Select
              value={resolved.typography.display}
              onValueChange={(value) =>
                patchOverride({ typography: { display: value as FontFamilyId } })
              }
            >
              <SelectTrigger className="w-full" aria-label="Display font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((font) => (
                  <SelectItem key={font} value={font}>
                    {FONT_LABELS[font]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] text-ink-2">Body font</span>
            <Select
              value={resolved.typography.body}
              onValueChange={(value) =>
                patchOverride({ typography: { body: value as FontFamilyId } })
              }
            >
              <SelectTrigger className="w-full" aria-label="Body font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((font) => (
                  <SelectItem key={font} value={font}>
                    {FONT_LABELS[font]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] text-ink-2">Max display size</span>
            <Input
              type="number"
              min={40}
              max={140}
              value={resolved.typography.displaySizeMax}
              onChange={(event) =>
                patchOverride({
                  typography: { displaySizeMax: Number(event.target.value) || 84 },
                })
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] text-ink-2">Body size</span>
            <Input
              type="number"
              min={20}
              max={48}
              value={resolved.typography.bodySize}
              onChange={(event) =>
                patchOverride({
                  typography: { bodySize: Number(event.target.value) || 30 },
                })
              }
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <Label>Spacing</Label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { key: "margin", label: "Margin" },
              { key: "gutter", label: "Gutter" },
              { key: "baseline", label: "Baseline" },
            ] as const
          ).map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <span className="text-[11.5px] text-ink-2">{field.label}</span>
              <Input
                type="number"
                min={4}
                max={160}
                value={resolved.spacing[field.key]}
                onChange={(event) =>
                  patchOverride({
                    spacing: { [field.key]: Number(event.target.value) || 8 },
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Label htmlFor="footer-branding">Footer branding</Label>
        <Input
          id="footer-branding"
          value={resolved.footer}
          onChange={(event) => patchOverride({ footer: event.target.value })}
          placeholder="ATLAS · FIELD NOTES"
        />
      </section>

      <section className="flex flex-col gap-2">
        <Label>Selected slide layout</Label>
        <div className="flex gap-1.5">
          {LAYOUTS.map((layout) => (
            <Button
              key={layout}
              size="xs"
              variant={
                document_.slides[selected]?.layout === layout ? "primary" : "secondary"
              }
              onClick={() => patchSlide(selected, { layout })}
            >
              {LAYOUT_LABELS[layout]}
            </Button>
          ))}
        </div>
      </section>

    </div>
  );
}
