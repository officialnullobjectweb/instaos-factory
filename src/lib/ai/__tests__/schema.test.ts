import { describe, it, expect } from "vitest";
import {
  topicOutputSchema,
  researchOutputSchema,
  verifyOutputSchema,
  carouselOutputSchema,
  captionOutputSchema,
  hashtagsOutputSchema,
  altTextOutputSchema,
  qualityOutputSchema,
  generationPayloadSchema,
  expandQuality,
  slideKindSchema,
} from "@/lib/ai/schema";

describe("AI Schemas", () => {
  describe("topicOutputSchema", () => {
    it("accepts valid topic output", () => {
      const result = topicOutputSchema.safeParse({
        topic: "The Psychology of Decision Fatigue in Urban Design",
        angle: "How choice overload in city planning affects daily commuters",
        pillar: "Psychology",
        rationale: "Timely topic with recent research backing",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional topicKey", () => {
      const result = topicOutputSchema.safeParse({
        topic: "Decision Fatigue in Urban Design",
        angle: "How choice overload affects commuters",
        pillar: "Psychology",
        topicKey: "psychology",
        rationale: "Research-backed topic",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topicKey).toBe("psychology");
      }
    });

    it("rejects topic shorter than 8 chars", () => {
      const result = topicOutputSchema.safeParse({
        topic: "Short",
        angle: "Some angle that is long enough",
        pillar: "Pillar",
        rationale: "Some rationale that is long enough to pass",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing required fields", () => {
      const result = topicOutputSchema.safeParse({
        topic: "Valid topic here",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("researchOutputSchema", () => {
    it("accepts valid research with facts", () => {
      const result = researchOutputSchema.safeParse({
        facts: [
          {
            claim: "Studies show decision fatigue reduces quality by 25 percent",
            evidence: "A 2024 meta-analysis of 47 studies confirmed this effect",
            sourceTitle: "Journal of Behavioral Psychology",
            sourceUrl: "https://example.com/study",
            publisher: "APA",
            confidence: "high",
          },
          {
            claim: "Urban planners spend 31 percent of time re-making old decisions",
            evidence: "Research by the Urban Planning Institute documented this waste",
            sourceTitle: "Urban Planning Quarterly",
            sourceUrl: "https://example.com/upi",
            publisher: "Urban Planning Institute",
            confidence: "medium",
          },
          {
            claim: "Documented rules cut decision time by 40 percent in 90 days",
            evidence: "Case study of 12 design studios over 6 months",
            sourceTitle: "Design Management Review",
            sourceUrl: "",
            publisher: "Harvard Business Review",
            confidence: "medium",
          },
        ],
        gaps: ["Limited data on urban contexts"],
      });
      expect(result.success).toBe(true);
    });

    it("requires at least 3 facts", () => {
      const result = researchOutputSchema.safeParse({
        facts: [
          {
            claim: "Fact one with enough detail",
            evidence: "Evidence here that is long enough",
            sourceTitle: "Source Title",
            sourceUrl: "https://example.com",
            publisher: "Publisher",
            confidence: "high",
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("accepts empty source URL", () => {
      const result = researchOutputSchema.safeParse({
        facts: [
          {
            claim: "A fact with no URL",
            evidence: "Supporting evidence text",
            sourceTitle: "Some Source",
            sourceUrl: "",
            publisher: "Publisher",
            confidence: "medium",
          },
          {
            claim: "Another fact for minimum count",
            evidence: "More evidence text",
            sourceTitle: "Another Source",
            sourceUrl: "https://example.com",
            publisher: "Publisher",
            confidence: "high",
          },
          {
            claim: "Third fact to meet minimum",
            evidence: "Third evidence text",
            sourceTitle: "Third Source",
            sourceUrl: "https://example.com",
            publisher: "Publisher",
            confidence: "low",
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("carouselOutputSchema", () => {
    it("accepts valid carousel with slides", () => {
      const result = carouselOutputSchema.safeParse({
        title: "The Hidden Psychology Behind Great Design",
        hook: "What if your design decisions were driven by bias, not data?",
        slides: [
          { kind: "cover", kicker: "Psychology", headline: "Design Bias", body: "" },
          { kind: "statement", kicker: "Problem", headline: "We assume we're rational", body: "But 90% of decisions are unconscious" },
          { kind: "cta", kicker: "Action", headline: "Start questioning your assumptions", body: "" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects fewer than 3 slides", () => {
      const result = carouselOutputSchema.safeParse({
        title: "Valid Title Here",
        hook: "Valid hook here that is long enough",
        slides: [
          { kind: "cover", kicker: "", headline: "Slide 1", body: "" },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("validates slide kinds", () => {
      const result = carouselOutputSchema.safeParse({
        title: "Valid Title Here",
        hook: "Valid hook here that is long enough",
        slides: [
          { kind: "invalid_kind", kicker: "", headline: "Slide 1", body: "" },
          { kind: "statement", kicker: "", headline: "Slide 2", body: "" },
          { kind: "cta", kicker: "", headline: "Slide 3", body: "" },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("accepts all valid slide kinds", () => {
      const kinds = ["cover", "statement", "list", "statistic", "quote", "cta"];
      for (const kind of kinds) {
        const result = slideKindSchema.safeParse(kind);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("captionOutputSchema", () => {
    it("accepts valid caption", () => {
      const result = captionOutputSchema.safeParse({
        caption: "This is a valid caption that meets the minimum length requirement of forty characters",
      });
      expect(result.success).toBe(true);
    });

    it("rejects caption shorter than 40 chars", () => {
      const result = captionOutputSchema.safeParse({
        caption: "Too short",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("hashtagsOutputSchema", () => {
    it("accepts valid hashtags", () => {
      const result = hashtagsOutputSchema.safeParse({
        hashtags: ["#psychology", "#design", "#urban"],
      });
      expect(result.success).toBe(true);
    });

    it("adds # prefix when missing", () => {
      const result = hashtagsOutputSchema.safeParse({
        hashtags: ["psychology", "design", "urban"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hashtags).toContain("#psychology");
      }
    });

    it("deduplicates hashtags", () => {
      const result = hashtagsOutputSchema.safeParse({
        hashtags: ["#psychology", "#psychology", "#design", "#design"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hashtags.length).toBe(2);
      }
    });

    it("rejects fewer than 3 hashtags", () => {
      const result = hashtagsOutputSchema.safeParse({
        hashtags: ["#one", "#two"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("qualityOutputSchema", () => {
    it("accepts valid quality report", () => {
      const result = qualityOutputSchema.safeParse({
        score: 85,
        summary: "Strong content with good hook and clear narrative",
        criteria: [
          { id: "hook", label: "Hook strength", weight: 0.25, score: 90, note: "Strong opening" },
          { id: "clarity", label: "Caption clarity", weight: 0.25, score: 80, note: "Clear message" },
          { id: "visual", label: "Visual consistency", weight: 0.2, score: 85, note: "Good design" },
        ],
        blockers: [],
      });
      expect(result.success).toBe(true);
    });

    it("accepts score of 0", () => {
      const result = qualityOutputSchema.safeParse({
        score: 0,
        summary: "Very poor quality",
        criteria: [
          { id: "hook", label: "Hook", weight: 0.3, score: 0, note: "No hook" },
          { id: "clarity", label: "Clarity", weight: 0.3, score: 0, note: "Unclear" },
          { id: "visual", label: "Visual", weight: 0.4, score: 0, note: "Poor" },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("generationPayloadSchema", () => {
    it("accepts complete generation payload", () => {
      const result = generationPayloadSchema.safeParse({
        title: "Complete Post Title Here",
        hook: "An engaging hook for the carousel",
        slides: [
          { kind: "cover", kicker: "Topic", headline: "Main headline", body: "" },
          { kind: "statement", kicker: "Point", headline: "Key insight", body: "Supporting detail" },
          { kind: "cta", kicker: "Action", headline: "Take action", body: "" },
        ],
        caption: "A complete caption that is at least forty characters long for the post",
        hashtags: ["#tag1", "#tag2", "#tag3"],
        altText: "Alt text describing the carousel content for accessibility",
        references: [],
        qualityScore: {
          score: 75,
          summary: "Good quality",
          criteria: [
            { id: "hook", label: "Hook", weight: 0.3, score: 80, note: "Good" },
            { id: "clarity", label: "Clarity", weight: 0.3, score: 70, note: "OK" },
            { id: "visual", label: "Visual", weight: 0.4, score: 75, note: "Decent" },
          ],
          blockers: [],
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("expandQuality", () => {
    it("fills in missing criteria", () => {
      const result = expandQuality({
        score: 80,
        summary: "Good quality overall",
        criteria: [
          { id: "hook", label: "Hook strength", weight: 0.25, score: 90, note: "Strong" },
        ],
      });

      expect(result.score).toBe(80);
      expect(result.criteria.length).toBe(5); // All 5 criteria filled
      expect(result.criteria.find((c) => c.id === "hook")?.score).toBe(90);
      expect(result.criteria.find((c) => c.id === "clarity")?.score).toBe(80);
    });

    it("caps score at 100", () => {
      const result = expandQuality({ score: 150, summary: "Over 100" });
      expect(result.score).toBe(100);
    });

    it("floors score at 0", () => {
      const result = expandQuality({ score: -10, summary: "Negative" });
      expect(result.score).toBe(0);
    });

    it("provides default summary when missing", () => {
      const result = expandQuality({ score: 75 });
      expect(result.summary).toContain("75");
    });
  });
});
