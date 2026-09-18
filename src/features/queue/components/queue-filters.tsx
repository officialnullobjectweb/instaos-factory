"use client";

import type { ReactNode } from "react";

import { FilterBar } from "@/components/data/filter-bar";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { brands } from "@/data/brands";
import { activeFilterCount } from "@/lib/posts/query";
import { FORMAT_ORDER, FORMAT_LABELS } from "@/lib/status";
import type {
  BrandId,
  ContentFormat,
  PostCategory,
  PostsFilters,
} from "@/types";

export const CATEGORY_ORDER: PostCategory[] = ["Geography", "Psychology", "Branding"];

interface QueueFiltersProps {
  filters: PostsFilters;
  onFilterChange: <K extends keyof PostsFilters>(key: K, value: PostsFilters[K]) => void;
  onReset: () => void;
  trailing?: ReactNode;
}

/**
 * Minimal filter bar — search + essential filters only.
 */
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
        placeholder="Search..."
        label="Search posts"
        className="min-w-40 flex-1"
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
          { value: "all", label: "All" },
          ...CATEGORY_ORDER.map((category) => ({
            value: category as PostCategory | "all",
            label: category,
          })),
        ]}
      />

      <FilterSelect<ContentFormat | "all">
        label="Type"
        value={filters.format}
        onValueChange={(value) => onFilterChange("format", value)}
        options={[
          { value: "all", label: "All" },
          ...FORMAT_ORDER.map((format) => ({
            value: format as ContentFormat | "all",
            label: FORMAT_LABELS[format],
          })),
        ]}
      />
    </FilterBar>
  );
}
