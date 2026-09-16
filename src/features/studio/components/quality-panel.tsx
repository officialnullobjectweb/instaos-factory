"use client";

import { CircleAlert, CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fitDeck } from "@/design/fit";
import { contrastPairs, evaluateDeck, MAX_WORDS_PER_SLIDE } from "@/design/quality";
import { resolveTemplate } from "@/design/templates";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { cn } from "@/lib/utils";

/**
 * The quality gate.
 *
 * Re-computed on every document change — the maths is trivial (a few contrast
 * ratios and word counts) and the value is that the report can never be stale.
 * Export stays enabled even on failure so the file can be inspected, but the
 * verdict is unmissable.
 */
export function QualityPanel() {
  const document_ = useStudioStore((state) => state.document);

  const template = resolveTemplate(document_.templateId, document_.overrides);
  const fit = fitDeck(document_.slides, template);
  const report = evaluateDeck(document_.slides, template, fit);
  const pairs = contrastPairs(template);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        {report.passed ? (
          <Badge tone="success" size="md">
            <CircleCheck className="size-3.5" />
            Ready to export
          </Badge>
        ) : (
          <Badge tone="danger" size="md">
            <CircleAlert className="size-3.5" />
            Blocking issues
          </Badge>
        )}
        <span className="text-[12px] text-ink-3 tnum">
          {report.issues.filter((issue) => issue.severity === "error").length} errors ·{" "}
          {report.issues.filter((issue) => issue.severity === "warning").length} warnings
        </span>
      </div>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
          Words per slide — max {MAX_WORDS_PER_SLIDE}
        </span>
        <div className="flex flex-col gap-1.5">
          {report.wordsPerSlide.map((count, index) => (
            <div key={index} className="flex items-center gap-2.5">
              <span className="w-10 shrink-0 font-mono text-[10.5px] text-ink-3 tnum">
                #{index + 1}
              </span>
              <Progress
                value={(count / MAX_WORDS_PER_SLIDE) * 100}
                aria-label={`Slide ${index + 1}: ${count} of ${MAX_WORDS_PER_SLIDE} words`}
                className="h-1 flex-1"
                indicatorClassName={
                  count > MAX_WORDS_PER_SLIDE ? "bg-danger" : undefined
                }
              />
              <span
                className={cn(
                  "w-12 shrink-0 text-right text-[11px] tnum",
                  count > MAX_WORDS_PER_SLIDE ? "text-danger" : "text-ink-2",
                )}
              >
                {count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
          Contrast (WCAG)
        </span>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {pairs.map((pair) => (
            <li key={pair.name} className="flex items-center gap-2.5 px-3 py-2">
              {pair.passes ? (
                <CircleCheck className="size-3.5 shrink-0 text-success" />
              ) : (
                <CircleAlert className="size-3.5 shrink-0 text-danger" />
              )}
              <span className="flex-1 text-[12.5px] text-ink">{pair.name}</span>
              <span
                className={cn(
                  "font-mono text-[11.5px] tnum",
                  pair.passes ? "text-ink-2" : "text-danger",
                )}
              >
                {pair.ratio.toFixed(2)}:1
              </span>
              <span className="w-14 shrink-0 text-right text-[10.5px] text-ink-3">
                {pair.largeText ? "large" : "normal"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
          Auto-fit
        </span>
        <p className="text-[12px] leading-relaxed text-ink-2">
          Display type is shrunk automatically until every slide fits the safe
          margins. Anything below 60% of the template&apos;s maximum is flagged — the
          fix is fewer words, not smaller type.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {report.autoFitScale.map((entry) => (
            <span
              key={entry.slideIndex}
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[10.5px] tnum",
                entry.scale < 0.6
                  ? "border-warning/30 bg-warning-soft text-warning"
                  : "border-line text-ink-3",
              )}
              title={`Slide ${entry.slideIndex + 1}`}
            >
              {entry.slideIndex + 1}: {Math.round(entry.scale * 100)}%
            </span>
          ))}
        </div>
      </section>

      {report.issues.length > 0 ? (
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
            Issues
          </span>
          <ul className="flex flex-col gap-1.5">
            {report.issues.map((issue, index) => (
              <li
                key={`${issue.slideIndex}-${index}`}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed",
                  issue.severity === "error"
                    ? "border-danger/25 bg-danger-soft text-ink"
                    : "border-warning/25 bg-warning-soft text-ink",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 font-mono text-[10.5px]",
                    issue.severity === "error" ? "text-danger" : "text-warning",
                  )}
                >
                  {issue.slideIndex === 0 ? "—" : `#${issue.slideIndex}`}
                </span>
                {issue.message}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-[12.5px] text-ink-2">
          No issues. The deck respects the word limit, the safe margins and the
          contrast thresholds.
        </p>
      )}
    </div>
  );
}
