"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { slideSpecSchema } from "@/design/api-schemas";
import { fitSlide } from "@/design/fit";
import { resolveTemplate } from "@/design/templates";
import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type DesignOverrides,
  type SlideSpec,
  type TemplateId,
} from "@/design/types";
import { cn } from "@/lib/utils";

/**
 * The live canvas.
 *
 * Preview renders through the *server* renderer via /api/design/preview, so the
 * editor shows the same output the exporter produces — there is no second,
 * slightly-divergent client renderer to drift out of sync. Requests are
 * debounced per keystroke and cached by content hash; a repeat render is
 * instant because the previous SVG is still on screen.
 */

interface SlideCanvasProps {
  slide: SlideSpec;
  templateId: TemplateId;
  overrides: DesignOverrides | null;
  className?: string;
  /** Dimmed, non-interactive variant used by the filmstrip and grid. */
  static?: boolean;
}

export function SlideCanvas({
  slide,
  templateId,
  overrides,
  className,
  static: isStatic = false,
}: SlideCanvasProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);
  const cache = useRef(new Map<string, string>());

  const template = resolveTemplate(templateId, overrides ?? {});
  const fit = fitSlide(slide, template);

  const cacheKey = JSON.stringify([templateId, overrides, slide]);

  const render = useCallback(async () => {
    const id = requestId.current + 1;
    requestId.current = id;

    const cached = cache.current.get(cacheKey);
    if (cached) {
      setSvg(cached);
      setLoading(false);
      setFailed(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/design/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          overrides: overrides ?? {},
          slide: slideSpecSchema.parse(slide),
        }),
      });
      if (!response.ok) throw new Error(await response.text());

      const text = await response.text();
      // Only the newest request may paint.
      if (requestId.current !== id) return;

      // Keep the cache small — a session edits a handful of slides.
      if (cache.current.size > 40) cache.current.clear();
      cache.current.set(cacheKey, text);
      setSvg(text);
      setFailed(false);
    } catch {
      if (requestId.current === id) setFailed(true);
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, [cacheKey, overrides, slide, templateId]);

  useEffect(() => {
    const timer = setTimeout(() => void render(), 140);
    return () => clearTimeout(timer);
  }, [render]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-line bg-surface-2",
        className,
      )}
      style={{ aspectRatio: `${SLIDE_WIDTH} / ${SLIDE_HEIGHT}` }}
    >
      {svg ? (
        <div
          className={cn("size-full [&>svg]:size-full", isStatic && "pointer-events-none")}
          // The SVG carries its own fonts; danger-free because we rendered it.
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
          aria-label={`Slide ${slide.index} preview: ${slide.headline}`}
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <span className="text-[11.5px] text-ink-3">
            {failed ? "Render failed" : loading ? "Rendering…" : "Empty"}
          </span>
        </div>
      )}

      {loading && svg ? (
        <span
          aria-hidden="true"
          className="absolute top-2 right-2 size-1.5 animate-pulse rounded-full bg-ink/40"
        />
      ) : null}

      {/* Auto-fit badge: the quality signal, visible while editing. */}
      {!isStatic ? (
        <span
          className={cn(
            "absolute bottom-2 left-2 rounded-full px-2 py-0.5 font-mono text-[10px] tnum",
            fit.scale < 0.7
              ? "bg-warning-soft text-warning"
              : "bg-surface/80 text-ink-3",
          )}
          title={`Display type at ${Math.round(fit.scale * 100)}% of maximum`}
        >
          {Math.round(fit.scale * 100)}%
        </span>
      ) : null}
    </div>
  );
}
