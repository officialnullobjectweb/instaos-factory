import {
  CirclePlay,
  Image as ImageIcon,
  Layers,
  Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { FORMAT_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ContentFormat } from "@/types";

const FORMAT_ICONS: Record<ContentFormat, LucideIcon> = {
  reel: CirclePlay,
  carousel: Layers,
  static: ImageIcon,
  story: Smartphone,
};

interface AssetPreviewProps {
  format: ContentFormat;
  frames: number;
  /** Reserved for future asset URLs — currently drives the aria id only. */
  seed: string;
  className?: string;
  /** Large previews are used in the review drawer. */
  size?: "sm" | "md" | "lg";
}

/**
 * Deterministic monochrome placeholder: no remote images in the foundation, yet
 * every item still gets a distinct, layout-stable frame.
 */
export function AssetPreview({
  format,
  frames,
  seed,
  className,
  size = "sm",
}: AssetPreviewProps) {
  const Icon = FORMAT_ICONS[format];

  return (
    <div
      aria-hidden="true"
      data-asset={seed}
      className={cn(
        "relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-md border border-line bg-surface-2",
        size === "sm" && "size-16",
        size === "md" && "aspect-square w-full",
        size === "lg" && "aspect-square w-full max-w-xs",
        className,
      )}
    >
      {/* Framing rule instead of decoration: monochrome, no gradients. */}
      <span className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-line-strong opacity-60" />

      <Icon
        className={cn(
          "relative text-ink",
          size === "sm" ? "size-4" : "size-6",
        )}
      />

      {size !== "sm" ? (
        <span className="relative mt-2 flex flex-col items-center gap-0.5 text-center">
          <span className="text-[13px] font-medium text-ink">
            {FORMAT_LABELS[format]}
          </span>
          <span className="font-mono text-[10px] tracking-[0.06em] text-ink-3 uppercase">
            {frames} {frames === 1 ? "frame" : "frames"}
          </span>
        </span>
      ) : null}
    </div>
  );
}
