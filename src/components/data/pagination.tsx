"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGINATION } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  itemLabel?: string;
}

/** Windowed page numbers: first, last and a span around the current page. */
function pageWindow(page: number, pageCount: number, span = 1) {
  const pages = new Set<number>([1, pageCount, page]);
  for (let offset = 1; offset <= span; offset += 1) {
    pages.add(page - offset);
    pages.add(page + offset);
  }
  return [...pages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
  className,
  itemLabel = "items",
}: PaginationProps) {
  const pages = pageWindow(page, pageCount);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 pt-2",
        className,
      )}
    >
      <p className="text-[12.5px] text-ink-2 tnum" aria-live="polite">
        Showing {formatNumber(rangeStart)}–{formatNumber(rangeEnd)} of{" "}
        {formatNumber(total)} {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger size="sm" aria-label="Rows per page" className="min-w-24">
              <SelectValue>{`${pageSize} / page`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAGINATION.pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>

          {pages.map((value, index) => {
            const previous = pages[index - 1];
            const gap = previous !== undefined && value - previous > 1;

            return (
              <span key={value} className="flex items-center gap-1">
                {gap ? (
                  <span aria-hidden="true" className="px-1 text-[12px] text-ink-3">
                    …
                  </span>
                ) : null}
                <Button
                  variant={value === page ? "primary" : "secondary"}
                  size="icon-sm"
                  onClick={() => onPageChange(value)}
                  aria-label={`Page ${value}`}
                  aria-current={value === page ? "page" : undefined}
                  className="tnum text-[12.5px]"
                >
                  {value}
                </Button>
              </span>
            );
          })}

          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </nav>
  );
}
