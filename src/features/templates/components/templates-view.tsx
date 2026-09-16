"use client";

import { motion } from "framer-motion";
import { Layers, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { FilterBar } from "@/components/data/filter-bar";
import { FilterSelect } from "@/components/data/filter-select";
import { SearchInput } from "@/components/data/search-input";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { templates } from "@/data/templates";
import { TemplateCard } from "@/features/templates/components/template-card";
import { listContainer, listItem } from "@/lib/motion";
import { FORMAT_LABELS, FORMAT_ORDER } from "@/lib/status";
import { toast } from "@/lib/toast";
import type { ContentFormat, TemplateCategory } from "@/types";

const CATEGORIES: TemplateCategory[] = [
  "Editorial",
  "Product",
  "Story",
  "Carousel",
  "Announcement",
];

export function TemplatesView() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [format, setFormat] = useState<ContentFormat | "all">("all");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (category !== "all" && template.category !== category) return false;
      if (format !== "all" && template.format !== format) return false;
      if (!needle) return true;
      return (
        template.name.toLowerCase().includes(needle) ||
        template.description.toLowerCase().includes(needle)
      );
    });
  }, [search, category, format]);

  const activeCount = [
    category !== "all",
    format !== "all",
    search.trim().length > 0,
  ].filter(Boolean).length;

  function reset() {
    setSearch("");
    setCategory("all");
    setFormat("all");
  }

  return (
    <>
      <PageHeader
        eyebrow="Templates"
        title="Reusable creative systems"
        description="Each template encodes a brand's layout rules, pacing and typography so new content starts from a decision, not a blank canvas."
        actions={
          <Button
            variant="primary"
            onClick={() =>
              toast.info("Template builder is a placeholder", {
                description: "Design-editor tooling arrives in the next phase.",
              })
            }
          >
            <Plus />
            New template
          </Button>
        }
        toolbar={
          <FilterBar activeCount={activeCount} onReset={reset}>
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search templates…"
              label="Search templates"
              className="min-w-56 flex-1"
            />
            <FilterSelect<TemplateCategory | "all">
              label="Category"
              value={category}
              onValueChange={setCategory}
              options={[
                { value: "all", label: "All categories" },
                ...CATEGORIES.map((item) => ({ value: item, label: item })),
              ]}
            />
            <FilterSelect<ContentFormat | "all">
              label="Format"
              value={format}
              onValueChange={setFormat}
              options={[
                { value: "all", label: "All formats" },
                ...FORMAT_ORDER.map((item) => ({
                  value: item as ContentFormat | "all",
                  label: FORMAT_LABELS[item],
                })),
              ]}
            />
          </FilterBar>
        }
      />

      <div className="shell-container pb-8">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No templates match"
            description="Adjust the category or format filter to see more of the library."
            action={
              <Button variant="secondary" onClick={reset}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <motion.ul
            variants={listContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {filtered.map((template) => (
              <motion.li key={template.id} variants={listItem}>
                <TemplateCard template={template} className="h-full" />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </>
  );
}
