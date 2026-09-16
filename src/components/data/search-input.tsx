"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function SearchInput({
  value,
  onValueChange,
  placeholder = "Search…",
  label = "Search",
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3"
        aria-hidden="true"
      />
      <Input
        // Picked up by the global "/" shortcut.
        data-search-input=""
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        className="pr-16 pl-10 [&::-webkit-search-cancel-button]:appearance-none"
      />

      {value ? (
        <button
          type="button"
          onClick={() => onValueChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 transition-colors duration-150 ease-soft hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3 sm:block">
          /
        </kbd>
      )}
    </div>
  );
}
