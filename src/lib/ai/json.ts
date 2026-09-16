/**
 * JSON extraction and repair.
 *
 * Models are asked for bare JSON, and most of the time that is what arrives.
 * When it is not, the failure is almost always one of a handful of shapes:
 * fences, prose around the object, trailing commas, smart quotes, Python
 * literals, raw newlines inside strings, or a truncated tail. Those are fixed
 * deterministically here — no model call, no guessing at content — and the
 * applied fixes are returned so the AI log can show exactly what was changed.
 *
 * Anything this module cannot rescue is escalated to a model-backed repair pass
 * (see `repairPrompt`) and, failing that, to the next provider.
 */

export interface ParseResult {
  value: unknown;
  repairs: string[];
}

/** Finds the first complete `{...}` block, ignoring braces inside strings. */
function firstBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  // No closing brace: hand back the tail so the truncation repair can try.
  return text.slice(start);
}

/** Removes `//` and block comments that sit outside strings. */
function stripComments(text: string) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      result += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      continue;
    }

    result += char;
  }

  return result;
}

/** Escapes literal newlines and tabs that appear inside JSON strings. */
function escapeRawNewlines(text: string) {
  let result = "";
  let inString = false;
  let escaped = false;
  let changed = false;

  for (const char of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        result += char;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        result += char;
        continue;
      }
      if (char === '"') {
        inString = false;
        result += char;
        continue;
      }
      if (char === "\n") {
        result += "\\n";
        changed = true;
        continue;
      }
      if (char === "\r") {
        result += "\\r";
        changed = true;
        continue;
      }
      if (char === "\t") {
        result += "\\t";
        changed = true;
        continue;
      }
      result += char;
      continue;
    }

    if (char === '"') inString = true;
    result += char;
  }

  return { text: result, changed };
}

/** Closes strings and brackets left open by a truncated response. */
function balanceTail(text: string) {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (const char of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}" || char === "]") stack.pop();
  }

  let repaired = text;
  let changed = false;

  if (inString) {
    repaired += '"';
    changed = true;
  }

  // A truncated member such as `"body":` or `"body": "abc",` is trimmed before
  // the brackets are closed, otherwise the result still will not parse.
  repaired = repaired.replace(/,\s*$/, "").replace(/"[^"]*"\s*:\s*$/, "");

  if (stack.length > 0) {
    changed = true;
    repaired += stack.reverse().join("");
  }

  return { text: repaired.replace(/,\s*$/, ""), changed };
}

/**
 * Applies every deterministic fix. Returns the candidate text and the list of
 * fixes that actually changed something.
 */
export function repairJsonText(raw: string): { text: string; repairs: string[] } {
  const repairs: string[] = [];
  let text = raw.trim();

  if (!text) return { text, repairs };

  const fenced = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced) {
    text = fenced[1].trim();
    repairs.push("removed markdown code fence");
  }

  const balanced = firstBalancedObject(text);
  if (balanced && balanced !== text) {
    const hadProse =
      text.slice(0, text.indexOf("{")).trim().length > 0 ||
      text.slice(text.lastIndexOf("}") + 1).trim().length > 0;
    if (hadProse) repairs.push("stripped prose around the JSON object");
    text = balanced;
  }

  const withoutComments = stripComments(text);
  if (withoutComments !== text) {
    text = withoutComments;
    repairs.push("removed comments");
  }

  const straightQuotes = text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00A0/g, " ");
  if (straightQuotes !== text) {
    text = straightQuotes;
    repairs.push("normalised smart quotes");
  }

  const literals = text
    .replace(/(?<=[:,[\s])(True|False)(?=\s*[,}\]])/g, (match) =>
      match === "True" ? "true" : "false",
    )
    .replace(/(?<=[:,[\s])None(?=\s*[,}\]])/g, "null")
    .replace(/(?<=[:,[\s])(NaN|Infinity|-Infinity)(?=\s*[,}\]])/g, "null");
  if (literals !== text) {
    text = literals;
    repairs.push("converted Python-style literals");
  }

  const unquotedKeys = text.replace(
    /([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g,
    '$1"$2"$3',
  );
  if (unquotedKeys !== text) {
    text = unquotedKeys;
    repairs.push("quoted bare object keys");
  }

  const escaped = escapeRawNewlines(text);
  if (escaped.changed) {
    text = escaped.text;
    repairs.push("escaped raw newlines inside strings");
  }

  const noTrailingCommas = text.replace(/,(\s*[}\]])/g, "$1");
  if (noTrailingCommas !== text) {
    text = noTrailingCommas;
    repairs.push("removed trailing commas");
  }

  const balancedTail = balanceTail(text);
  if (balancedTail.changed) {
    text = balancedTail.text;
    repairs.push("closed unbalanced strings or brackets");
  }

  return { text, repairs };
}

/**
 * Parses model output, applying repairs until something parses.
 * Throws only when the text is beyond deterministic rescue — the caller then
 * escalates to a model-backed repair pass.
 */
export function parseModelJson(raw: string): ParseResult {
  const repairs: string[] = [];

  try {
    return { value: JSON.parse(raw), repairs };
  } catch {
    // fall through to repair
  }

  const repaired = repairJsonText(raw);
  repairs.push(...repaired.repairs);

  try {
    return { value: JSON.parse(repaired.text), repairs };
  } catch (error) {
    throw new SyntaxError(
      `${error instanceof Error ? error.message : "unparseable JSON"}${
        repairs.length > 0 ? ` (after: ${repairs.join(", ")})` : ""
      }`,
    );
  }
}

/**
 * Coerces the shapes models get wrong while keeping the content intact:
 * single items where arrays were required, numbers as strings, `null` where an
 * empty string was expected. Runs before Zod so validation failures are about
 * substance, not syntax.
 */
export function normaliseShape(value: unknown): { value: unknown; repairs: string[] } {
  const repairs: string[] = [];

  if (Array.isArray(value)) {
    const mapped = value.map((entry) => normaliseShape(entry));
    mapped.forEach((entry) => repairs.push(...entry.repairs));
    return { value: mapped.map((entry) => entry.value), repairs };
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, entry]) => {
        const normalised = normaliseShape(entry);
        repairs.push(...normalised.repairs.map((repair) => `${key}: ${repair}`));

        // A list field given a single string is the most common shape error.
        if (
          normalised.value !== null &&
          normalised.value !== undefined &&
          LIST_KEYS.has(key) &&
          !Array.isArray(normalised.value)
        ) {
          repairs.push(`"${key}" wrapped in an array`);
          return [key, [normalised.value]];
        }

        return [key, normalised.value];
      },
    );

    return { value: Object.fromEntries(entries), repairs };
  }

  return { value, repairs };
}

const LIST_KEYS = new Set([
  "slides",
  "hashtags",
  "criteria",
  "blockers",
  "facts",
  "claims",
  "rejected",
  "references",
  "gaps",
]);

/** Zod issue paths flattened into a short, loggable sentence. */
export function describeIssues(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return issues
    .slice(0, 8)
    .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "root"}: ${issue.message}`)
    .join("; ");
}
