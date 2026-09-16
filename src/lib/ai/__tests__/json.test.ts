import { describe, it, expect } from "vitest";
import { parseModelJson, repairJsonText, normaliseShape, describeIssues } from "@/lib/ai/json";

describe("JSON Repair", () => {
  describe("repairJsonText", () => {
    it("passes through valid JSON", () => {
      const input = '{"key": "value"}';
      const result = repairJsonText(input);
      expect(result.text).toBe(input);
      expect(result.repairs).toHaveLength(0);
    });

    it("removes markdown code fences", () => {
      const input = '```json\n{"key": "value"}\n```';
      const result = repairJsonText(input);
      expect(JSON.parse(result.text)).toEqual({ key: "value" });
      expect(result.repairs).toContain("removed markdown code fence");
    });

    it("strips prose around JSON", () => {
      const input = 'Here is the result:\n{"key": "value"}\nDone.';
      const result = repairJsonText(input);
      expect(JSON.parse(result.text)).toEqual({ key: "value" });
      expect(result.repairs).toContain("stripped prose around the JSON object");
    });

    it("removes trailing commas", () => {
      const input = '{"items": [1, 2, 3,], "name": "test",}';
      const result = repairJsonText(input);
      expect(JSON.parse(result.text)).toEqual({ items: [1, 2, 3], name: "test" });
      expect(result.repairs).toContain("removed trailing commas");
    });

    it("normalises smart quotes", () => {
      const input = '{"name": \u201cHello\u201d}';
      const result = repairJsonText(input);
      expect(JSON.parse(result.text)).toEqual({ name: "Hello" });
      expect(result.repairs).toContain("normalised smart quotes");
    });

    it("converts Python-style literals", () => {
      const input = '{"active": True, "count": None, "flag": False}';
      const result = repairJsonText(input);
      expect(JSON.parse(result.text)).toEqual({ active: true, count: null, flag: false });
      expect(result.repairs).toContain("converted Python-style literals");
    });

    it("quotes bare object keys", () => {
      const input = '{name: "test", count: 42}';
      const result = repairJsonText(input);
      expect(JSON.parse(result.text)).toEqual({ name: "test", count: 42 });
      expect(result.repairs).toContain("quoted bare object keys");
    });

    it("escapes raw newlines in strings", () => {
      const input = '{"text": "line1\nline2"}';
      const result = repairJsonText(input);
      expect(JSON.parse(result.text)).toEqual({ text: "line1\nline2" });
      expect(result.repairs).toContain("escaped raw newlines inside strings");
    });

    it("closes unbalanced brackets", () => {
      const input = '{"items": [1, 2, 3';
      const result = repairJsonText(input);
      expect(JSON.parse(result.text)).toEqual({ items: [1, 2, 3] });
      expect(result.repairs).toContain("closed unbalanced strings or brackets");
    });

    it("handles multiple repairs at once", () => {
      const input = '```json\n{"active": True, "items": [1, 2,],}\n```';
      const result = repairJsonText(input);
      expect(JSON.parse(result.text)).toEqual({ active: true, items: [1, 2] });
      expect(result.repairs.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("parseModelJson", () => {
    it("parses valid JSON directly", () => {
      const result = parseModelJson('{"topic": "test"}');
      expect(result.value).toEqual({ topic: "test" });
      expect(result.repairs).toHaveLength(0);
    });

    it("repairs and parses broken JSON", () => {
      const result = parseModelJson('Here is the output:\n```json\n{"topic": "test"}\n```');
      expect(result.value).toEqual({ topic: "test" });
      expect(result.repairs.length).toBeGreaterThan(0);
    });

    it("throws on unparseable JSON", () => {
      expect(() => parseModelJson("not json at all {{{")).toThrow(SyntaxError);
    });
  });

  describe("normaliseShape", () => {
    it("wraps single items in arrays for list keys", () => {
      const input = { slides: { kind: "cover", headline: "test" } };
      const result = normaliseShape(input);
      expect(result.value).toEqual({ slides: [{ kind: "cover", headline: "test" }] });
      expect(result.repairs.some((r) => r.includes("slides"))).toBe(true);
    });

    it("leaves arrays untouched", () => {
      const input = { slides: [{ kind: "cover" }] };
      const result = normaliseShape(input);
      expect(result.value).toEqual({ slides: [{ kind: "cover" }] });
    });

    it("recursively normalises nested objects", () => {
      const input = { facts: { claim: "test", evidence: "proof" } };
      const result = normaliseShape(input);
      expect(result.value).toEqual({ facts: [{ claim: "test", evidence: "proof" }] });
    });

    it("handles null and undefined gracefully", () => {
      expect(normaliseShape(null).value).toBeNull();
      expect(normaliseShape(undefined).value).toBeUndefined();
      expect(normaliseShape("string").value).toBe("string");
      expect(normaliseShape(42).value).toBe(42);
    });
  });

  describe("describeIssues", () => {
    it("formats Zod issues into readable strings", () => {
      const issues = [
        { path: ["topic"], message: "Too short" },
        { path: [], message: "Required" },
      ];
      const result = describeIssues(issues);
      expect(result).toContain("topic: Too short");
      expect(result).toContain("root: Required");
    });

    it("limits to 8 issues", () => {
      const issues = Array.from({ length: 12 }, (_, i) => ({
        path: [`field${i}`],
        message: `Error ${i}`,
      }));
      const result = describeIssues(issues);
      const parts = result.split("; ");
      expect(parts.length).toBeLessThanOrEqual(8);
    });
  });
});
