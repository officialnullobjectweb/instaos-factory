export type DiffSegmentType = "same" | "add" | "remove";

export interface DiffSegment {
  type: DiffSegmentType;
  text: string;
}

export interface ListDiff {
  added: string[];
  removed: string[];
  unchanged: string[];
}

function tokenize(text: string) {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

function append(segments: DiffSegment[], type: DiffSegmentType, text: string) {
  const last = segments.at(-1);
  if (last && last.type === type) {
    last.text += text;
    return;
  }
  segments.push({ type, text });
}

/**
 * Longest-common-subsequence word diff. Inputs are short (captions, alt text,
 * headlines), so the quadratic table is cheap and the result is exact.
 */
export function diffWords(before: string, after: string): DiffSegment[] {
  const a = tokenize(before);
  const b = tokenize(after);

  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      append(segments, "same", a[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      append(segments, "remove", a[i]);
      i += 1;
    } else {
      append(segments, "add", b[j]);
      j += 1;
    }
  }

  while (i < a.length) {
    append(segments, "remove", a[i]);
    i += 1;
  }
  while (j < b.length) {
    append(segments, "add", b[j]);
    j += 1;
  }

  return segments;
}

export function diffList(before: string[], after: string[]): ListDiff {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);

  return {
    added: after.filter((item) => !beforeSet.has(item)),
    removed: before.filter((item) => !afterSet.has(item)),
    unchanged: after.filter((item) => beforeSet.has(item)),
  };
}

export function countChanges(segments: DiffSegment[]) {
  return {
    added: segments.filter((segment) => segment.type === "add").length,
    removed: segments.filter((segment) => segment.type === "remove").length,
  };
}
