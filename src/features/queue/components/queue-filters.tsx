"use client";

import type { ReactNode } from "react";

import { FilterBar } from "@/components/data/filter-bar";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { DateRangePicker } from "@/components/ui/date-picker";
import { brands } from "@/data/brands";
import { DATE_RANGE_LABELS, QUALITY_FILTER_OPTIONS } from "@/lib/constants";
import { CONTENT_STATUS_META, FORMAT_LABELS, FORMAT_ORDER, STATUS_ORDER } from "@/lib/status";
import { activeFilterCount } from "@/lib/posts/query";
import type {
  BrandId,
  ContentFormat,
  ContentStatus,
  DateRangeKey,
  PostCategory,
  PostsFilters,
} from "@/types";

export const CATEGORY_ORDER: PostCategory[] = ["Geography", "Psychology", "Branding"];

const DATE_ORDER: DateRangeKey[] = ["any", "today", "week", "month", "custom"];

interface QueueFiltersProps {
  filters: PostsFilters;
  onFilterChange: <K extends keyof PostsFilters>(key: K, value: PostsFilters[K]) => void;
  onReset: () => void;
  /** View switch, rendered at the far end of the row. */
  trailing?: ReactNode;
}

export function QueueFilters({
  filters,
  onFilterChange,
  onReset,
  trailing,
}: QueueFiltersProps) {
  const activeCount = activeFilterCount(filters);

  return (
    <FilterBar activeCount={activeCount} onReset={onReset} trailing={trailing}>
      <SearchInput
        value={filters.search}
        onValueChange={(value) => onFilterChange("search", value)}
        placeholder="Search titles, captions, hashtags, owners…"
        label="Search posts"
        className="min-w-56 flex-1"
      />

      <FilterSelect<ContentStatus | "all">
        label="Status"
        value={filters.status}
        onValueChange={(value) => onFilterChange("status", value)}
        options={[
          { value: "all", label: "All statuses" },
          ...STATUS_ORDER.map((status) => ({
            value: status as ContentStatus | "all",
            label: CONTENT_STATUS_META[status].label,
          })),
        ]}
      />

      <FilterSelect<BrandId | "all">
        label="Brand"
        value={filters.brandId}
        onValueChange={(value) => onFilterChange("brandId", value)}
        options={[
          { value: "all", label: "All brands" },
          ...brands.map((brand) => ({ value: brand.id as BrandId | "all", label: brand.name })),
        ]}
      />

      <FilterSelect<PostCategory | "all">
        label="Category"
        value={filters.category}
        onValueChange={(value) => onFilterChange("category", value)}
        options={[
          { value: "all", label: "All categories" },
          ...CATEGORY_ORDER.map((category) => ({
            value: category as PostCategory | "all",
            label: category,
          })),
        ]}
      />

      <FilterSelect<ContentFormat | "all">
        label="Content type"
        value={filters.format}
        onValueChange={(value) => onFilterChange("format", value)}
        options={[
          { value: "all", label: "All types" },
          ...FORMAT_ORDER.map((format) => ({
            value: format as ContentFormat | "all",
            label: FORMAT_LABELS[format],
          })),
        ]}
      />

      <FilterSelect<DateRangeKey>
        label="Date"
        value={filters.dateRange}
        onValueChange={(value) => onFilterChange("dateRange", value)}
        options={DATE_ORDER.map((range) => ({
          value: range,
          label: DATE_RANGE_LABELS[range],
        }))}
      />

      <FilterSelect<string>
        label="Quality"
        value={String(filters.minQuality)}
        onValueChange={(value) => onFilterChange("minQuality", Number(value))}
        options={QUALITY_FILTER_OPTIONS.map((threshold) => ({
          value: String(threshold),
          label: threshold === 0 ? "Any quality" : `${threshold}+ score`,
        }))}
      />

      {/*
       * Custom ranges use our own calendar, never `<input type="date">`, and
       * store the day boundaries as inclusive instants: from 00:00 to 23:59:59.999.
       */}
      {filters.dateRange === "custom" ? (
        <DateRangePicker
          label="Generated between"
          placeholder="Pick a range"
          value={{
            from: filters.customFrom?.slice(0, 10) ?? null,
            to: filters.customTo?.slice(0, 10) ?? null,
          }}
          onChange={(next) => {
            onFilterChange(
              "customFrom",
              next.from ? `${next.from}T00:00:00.000Z` : null,
            );
            onFilterChange(
              "customTo",
              next.to ? `${next.to}T23:59:59.999Z` : null,
            );
          }}
        />
      ) : null}
    </FilterBar>
  );
}
