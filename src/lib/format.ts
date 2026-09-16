const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const plain = new Intl.NumberFormat("en-US");

export function formatNumber(value: number) {
  return plain.format(value);
}

export function formatCompact(value: number) {
  return value < 1000 ? plain.format(value) : compact.format(value);
}

export function formatPercent(value: number, options?: { signed?: boolean }) {
  const formatted = `${Math.abs(value).toFixed(1)}%`;
  if (!options?.signed) return formatted;
  if (value === 0) return formatted;
  return `${value > 0 ? "+" : "−"}${formatted}`;
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDateShort(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return `${formatDateShort(iso)} · ${formatTime(iso)}`;
}

export function formatWeekday(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
    new Date(iso),
  );
}

/** "2h ago" style label for activity and notification feeds. */
export function formatRelativeTime(iso: string, now = new Date()) {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 1000],
    ["minute", 60_000],
    ["hour", 3_600_000],
    ["day", 86_400_000],
  ];

  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

  for (let index = units.length - 1; index >= 0; index -= 1) {
    const [unit, ms] = units[index];
    if (Math.abs(diffMs) >= ms || unit === "second") {
      return formatter.format(Math.round(diffMs / ms), unit);
    }
  }

  return "just now";
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

/** 0.418 → "42%" */
export function formatRatio(value: number) {
  return `${Math.round(value * 100)}%`;
}
