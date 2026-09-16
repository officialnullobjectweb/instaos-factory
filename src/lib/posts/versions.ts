import { countChanges, diffList, diffWords } from "@/lib/diff";
import type { DiffSegment, ListDiff } from "@/lib/diff";
import type { PostVersion, Slide } from "@/types";

/**
 * Version comparison.
 *
 * A version stores a full snapshot of the editable surface, so comparing two of
 * them is a pure function of the two objects — no diffing against the live post,
 * no server round trip. Everything the reviewer can change is covered: title,
 * caption, hashtags, alt text and the slide stack.
 */

export interface FieldDiff {
  before: string;
  after: string;
  segments: DiffSegment[];
  changed: boolean;
  added: number;
  removed: number;
}

export interface SlideChange {
  index: number;
  kind: "added" | "removed" | "changed";
  before: Slide | null;
  after: Slide | null;
  /** Field names that differ, e.g. ["headline", "body"]. */
  fields: string[];
}

export interface VersionComparison {
  from: PostVersion;
  to: PostVersion;
  title: FieldDiff;
  caption: FieldDiff;
  altText: FieldDiff;
  hashtags: ListDiff;
  slides: {
    before: number;
    after: number;
    changes: SlideChange[];
  };
  /** Total number of changed units across every field, for the summary line. */
  totalChanges: number;
}

function fieldDiff(before: string, after: string): FieldDiff {
  const segments = diffWords(before, after);
  const { added, removed } = countChanges(segments);

  return {
    before,
    after,
    segments,
    changed: added > 0 || removed > 0,
    added,
    removed,
  };
}

const SLIDE_FIELDS = ["kicker", "headline", "body", "footnote", "kind"] as const;

function compareSlides(before: Slide[], after: Slide[]): SlideChange[] {
  const changes: SlideChange[] = [];
  const length = Math.max(before.length, after.length);

  for (let index = 0; index < length; index += 1) {
    const a = before[index] ?? null;
    const b = after[index] ?? null;

    if (!a && b) {
      changes.push({ index, kind: "added", before: null, after: b, fields: [] });
      continue;
    }
    if (a && !b) {
      changes.push({ index, kind: "removed", before: a, after: null, fields: [] });
      continue;
    }
    if (!a || !b) continue;

    const fields = SLIDE_FIELDS.filter(
      (field) => (a[field] ?? "") !== (b[field] ?? ""),
    );

    if (fields.length > 0) {
      changes.push({ index, kind: "changed", before: a, after: b, fields });
    }
  }

  return changes;
}

export function compareVersions(
  from: PostVersion,
  to: PostVersion,
): VersionComparison {
  const title = fieldDiff(from.snapshot.title, to.snapshot.title);
  const caption = fieldDiff(from.snapshot.caption, to.snapshot.caption);
  const altText = fieldDiff(from.snapshot.altText, to.snapshot.altText);
  const hashtags = diffList(from.snapshot.hashtags, to.snapshot.hashtags);
  const changes = compareSlides(from.snapshot.slides, to.snapshot.slides);

  const totalChanges =
    Number(title.changed) +
    Number(caption.changed) +
    Number(altText.changed) +
    hashtags.added.length +
    hashtags.removed.length +
    changes.length;

  return {
    from,
    to,
    title,
    caption,
    altText,
    hashtags,
    slides: {
      before: from.snapshot.slides.length,
      after: to.snapshot.slides.length,
      changes,
    },
    totalChanges,
  };
}

/** Newest first, which is the order the history panel renders. */
export function versionsDescending(versions: PostVersion[]) {
  return [...versions].sort((a, b) => b.number - a.number);
}

export const VERSION_SOURCE_LABELS = {
  generation: "Generated",
  edit: "Edited",
  regeneration: "Regenerated",
} as const;
