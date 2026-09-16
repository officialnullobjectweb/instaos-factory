"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  options: FilterOption<T>[];
  onValueChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onValueChange,
  className,
  size = "sm",
}: FilterSelectProps<T>) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
      <SelectTrigger
        size={size}
        aria-label={label}
        className={cn("min-w-32", className)}
      >
        {/* Radix cannot read item text before hydration, so render the label. */}
        <SelectValue placeholder={label}>
          {options.find((option) => option.value === value)?.label ?? label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
