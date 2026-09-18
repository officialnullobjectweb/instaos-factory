"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineField } from "@/features/queue/components/inline-field";
import { cn } from "@/lib/utils";
import type { Slide } from "@/types";

interface CarouselPreviewProps {
  slides: Slide[];
  onSaveSlide?: (slides: Slide[]) => Promise<unknown>;
  onCommitSlide?: (slides: Slide[]) => void;
  /** Per-slide accept/reject callbacks */
  onAcceptSlide?: (slideIndex: number) => void;
  onRejectSlide?: (slideIndex: number) => void;
  /** Track which slides are accepted/rejected */
  slideStatus?: Record<number, "accepted" | "rejected">;
  className?: string;
}

const KIND_LABELS: Record<Slide["kind"], string> = {
  cover: "Cover",
  statement: "Statement",
  list: "Rule",
  statistic: "Statistic",
  quote: "Quote",
  cta: "Call to action",
};

/**
 * Bernoulli effect: the first slide creates urgency by showing what the user
 * stands to LOSE if they scroll past. Uses loss aversion framing.
 */
function BernoulliHook({ slide }: { slide: Slide }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl">
      {/* Urgency gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-ink/95 via-ink/85 to-ink/70" />

      {/* Animated pulse ring */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="size-32 animate-pulse rounded-full border-2 border-white/20" />
        <div className="absolute inset-2 animate-pulse rounded-full border border-white/10" style={{ animationDelay: "0.5s" }} />
      </div>

      {/* Content */}
      <div className="relative flex h-full flex-col justify-between p-6">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[11px] tracking-[0.08em] text-white/50 uppercase">
            {slide.kicker || "Warning"}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60">
            Scroll carefully
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="h-px w-16 bg-gradient-to-r from-white/40 to-transparent" />
          <p className="text-[28px] font-medium leading-tight tracking-[-0.03em] text-white">
            {slide.headline}
          </p>
          <p className="text-[14px] leading-relaxed text-white/70">
            {slide.body}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.08em] text-white/40 uppercase">
            {KIND_LABELS[slide.kind]}
          </span>
          <span className="text-[11px] text-white/40">
            ↓ Keep scrolling to find out
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Barnum effect: statement slides feel personally written for the reader.
 * Uses "you" framing, subtle personalization cues, and a mirror-like layout
 * so vague descriptions feel specific to them.
 */
function BarnumStatement({ slide }: { slide: Slide }) {
  return (
    <div className="flex aspect-[4/5] flex-col justify-between p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
          {slide.kicker || "This is for you"}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-ink-3 tnum">
          ← →
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="h-px w-12 bg-line-strong" />

        {/* Personalization marker */}
        <div className="flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-ink/30" />
          <span className="text-[11px] text-ink-3">You&apos;ve probably noticed this</span>
        </div>

        <p className="text-[26px] font-medium leading-tight tracking-[-0.03em] text-ink">
          {slide.headline}
        </p>

        <p className="text-[14px] leading-relaxed text-ink-2">
          {slide.body}
        </p>

        {/* Subtle "this applies to you" nudge */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-ink-3">Sound familiar?</span>
          <div className="h-px flex-1 bg-line" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase">
          {KIND_LABELS[slide.kind]}
        </span>
        {slide.footnote ? (
          <span className="text-[12px] text-ink-3">{slide.footnote}</span>
        ) : null}
      </div>
    </div>
  );
}

export function CarouselPreview({
  slides,
  onSaveSlide,
  onCommitSlide,
  onAcceptSlide,
  onRejectSlide,
  slideStatus = {},
  className,
}: CarouselPreviewProps) {
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const safeIndex = Math.min(index, slides.length - 1);
  const slide = slides[safeIndex];
  const editable = Boolean(onSaveSlide);
  const isFirstSlide = safeIndex === 0;
  const currentStatus = slideStatus[safeIndex];

  useEffect(() => {
    if (!editing) return;
    frameRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (editing) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editing, slides.length]);

  function merged(patch: Partial<Slide>) {
    return slides.map((candidate, position) =>
      position === safeIndex ? { ...candidate, ...patch } : candidate,
    );
  }

  function save(patch: Partial<Slide>) {
    if (!onSaveSlide) return;
    void onSaveSlide(merged(patch));
  }

  function commit(patch: Partial<Slide>) {
    onCommitSlide?.(merged(patch));
  }

  function step(direction: -1 | 1) {
    setIndex((current) => {
      const next = current + direction;
      if (next < 0) return slides.length - 1;
      if (next > slides.length - 1) return 0;
      return next;
    });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Keyboard hint */}
      <div className="flex items-center justify-between text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-line bg-surface px-1 font-mono text-[10px]">←</kbd>
          <kbd className="rounded border border-line bg-surface px-1 font-mono text-[10px]">→</kbd>
          navigate
        </span>
        <span>{safeIndex + 1} of {slides.length}</span>
      </div>

      {/* Slide frame */}
      <div
        ref={frameRef}
        tabIndex={0}
        role="group"
        aria-label={`Carousel preview, slide ${safeIndex + 1} of ${slides.length}`}
        onKeyDown={(event) => {
          if (editing) return;
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
        }}
        className="relative overflow-hidden rounded-xl border border-line bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-ink/15"
      >
        {isFirstSlide ? (
          <BernoulliHook slide={slide} />
        ) : slide.kind === "statement" ? (
          <BarnumStatement slide={slide} />
        ) : (
          <div className="flex aspect-[4/5] flex-col justify-between p-6">
            <div className="flex items-start justify-between gap-3">
              {editing ? (
                <InlineField
                  value={slide.kicker}
                  label="Slide kicker"
                  placeholder="Kicker"
                  onSave={(value) => save({ kicker: value })}
                  onCommit={(value) => commit({ kicker: value })}
                  commitSummary="Edited a slide kicker"
                  textClassName="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase"
                />
              ) : (
                <span className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
                  {slide.kicker || KIND_LABELS[slide.kind]}
                </span>
              )}

              <span className="shrink-0 font-mono text-[11px] text-ink-3 tnum">
                {String(safeIndex + 1).padStart(2, "0")} /{" "}
                {String(slides.length).padStart(2, "0")}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <span className="h-px w-12 bg-line-strong" aria-hidden="true" />

              {editing ? (
                <div className="flex flex-col gap-2">
                  <InlineField
                    value={slide.headline}
                    label="Slide headline"
                    placeholder="Headline"
                    onSave={(value) => save({ headline: value })}
                    onCommit={(value) => commit({ headline: value })}
                    commitSummary="Edited a slide headline"
                    textClassName="text-[26px] leading-tight font-medium tracking-[-0.03em]"
                  />
                  <InlineField
                    value={slide.body}
                    label="Slide body"
                    placeholder="Supporting line"
                    multiline
                    onSave={(value) => save({ body: value })}
                    onCommit={(value) => commit({ body: value })}
                    commitSummary="Edited a slide body"
                    textClassName="text-[14px] leading-relaxed text-ink-2"
                  />
                </div>
              ) : (
                <>
                  <p
                    className={cn(
                      "font-medium tracking-[-0.03em] text-ink",
                      slide.kind === "statistic"
                        ? "text-[42px] leading-[1.05] tnum"
                        : slide.kind === "cover"
                          ? "text-[30px] leading-tight"
                          : "text-[26px] leading-tight",
                      slide.kind === "quote" && "italic",
                    )}
                  >
                    {slide.headline}
                  </p>
                  <p className="text-[14px] leading-relaxed text-ink-2">{slide.body}</p>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase">
                {KIND_LABELS[slide.kind]}
              </span>
              {slide.footnote ? (
                <span className="text-[12px] text-ink-3">{slide.footnote}</span>
              ) : null}
            </div>
          </div>
        )}

        {/* Per-slide accept/reject overlay */}
        {currentStatus && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center",
            currentStatus === "accepted" ? "bg-success/10" : "bg-danger/10",
          )}>
            <div className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium",
              currentStatus === "accepted"
                ? "bg-success text-white"
                : "bg-danger text-white",
            )}>
              {currentStatus === "accepted" ? <Check className="size-4" /> : <X className="size-4" />}
              {currentStatus === "accepted" ? "Accepted" : "Rejected"}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => step(-1)}
            aria-label="Previous slide"
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            onClick={() => step(1)}
            aria-label="Next slide"
          >
            <ChevronRight />
          </Button>
        </div>

        {/* Per-slide accept/reject buttons */}
        {onAcceptSlide && onRejectSlide && (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={currentStatus === "accepted" ? "primary" : "secondary"}
              onClick={() => onAcceptSlide(safeIndex)}
              className={cn(
                currentStatus === "accepted" && "bg-success hover:bg-success/90",
              )}
            >
              <Check className="size-3.5" />
              Accept
            </Button>
            <Button
              size="sm"
              variant={currentStatus === "rejected" ? "primary" : "secondary"}
              onClick={() => onRejectSlide(safeIndex)}
              className={cn(
                currentStatus === "rejected" && "bg-danger hover:bg-danger/90",
              )}
            >
              <X className="size-3.5" />
              Reject
            </Button>
          </div>
        )}

        {editable ? (
          <Button
            size="sm"
            variant={editing ? "primary" : "secondary"}
            aria-pressed={editing}
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? <Eye /> : <Pencil />}
            {editing ? "Preview" : "Edit"}
          </Button>
        ) : null}
      </div>

      {/* Thumbnails */}
      <ul className="flex flex-wrap items-stretch gap-1.5" aria-label="Slide thumbnails">
        {slides.map((candidate, position) => {
          const status = slideStatus[position];
          return (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Go to slide ${position + 1}: ${candidate.headline}`}
                aria-current={position === safeIndex}
                className={cn(
                  "relative flex h-16 w-14 flex-col justify-between rounded-md border p-1.5 text-left outline-none transition-colors duration-150 ease-soft",
                  position === safeIndex
                    ? "border-ink/30 bg-surface-2"
                    : "border-line bg-surface hover:bg-surface-2",
                  status === "accepted" && "border-success/50",
                  status === "rejected" && "border-danger/50",
                )}
              >
                <span className="font-mono text-[9px] text-ink-3 tnum">
                  {String(position + 1).padStart(2, "0")}
                </span>
                <span className="line-clamp-2 text-[9px] leading-tight text-ink-2">
                  {candidate.headline}
                </span>
                {status && (
                  <span className={cn(
                    "absolute -right-1 -top-1 size-3 rounded-full",
                    status === "accepted" ? "bg-success" : "bg-danger",
                  )} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
