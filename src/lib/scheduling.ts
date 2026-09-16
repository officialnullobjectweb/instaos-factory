import { MOCK_NOW } from "@/data/time";
import { formatDateShort, formatWeekday } from "@/lib/format";

export interface SlotSuggestion {
  id: string;
  iso: string;
  dayLabel: string;
  timeLabel: string;
  /** Highest-engagement slot for the day, surfaced first. */
  recommended: boolean;
}

const SLOT_TIMES: Array<[number, number]> = [
  [7, 30],
  [12, 15],
  [18, 30],
];

function isoFor(dayOffset: number, hour: number, minute: number) {
  const date = new Date(MOCK_NOW);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

/** Suggests the next slots across the coming days, latest day last. */
export function suggestSlots(days = 3): SlotSuggestion[] {
  const suggestions: SlotSuggestion[] = [];

  for (let dayOffset = 1; dayOffset <= days; dayOffset += 1) {
    SLOT_TIMES.forEach(([hour, minute], index) => {
      const iso = isoFor(dayOffset, hour, minute);
      suggestions.push({
        id: `${dayOffset}-${hour}-${minute}`,
        iso,
        dayLabel: `${formatWeekday(iso)} · ${formatDateShort(iso)}`,
        timeLabel: new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        }).format(new Date(iso)),
        recommended: index === 2,
      });
    });
  }

  return suggestions;
}
