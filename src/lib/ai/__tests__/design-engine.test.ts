import { describe, it, expect } from "vitest";
import {
  selectDesign,
  designSlides,
  enforceContentDesignLimits,
  scoreDesignQuality,
} from "@/lib/ai/design-engine";
import { planContent, type SlideContent } from "@/lib/ai/content-writer";
import type { Brand } from "@/types";

const mockBrand: Brand = {
  id: "studio-noir",
  name: "Studio Noir",
  handle: "@studionoir",
  initials: "SN",
  positioning: "Editorial monochrome for design studios",
  followers: 0,
  followerGrowth: 0,
  postsThisWeek: 0,
  avgEngagement: 0,
  status: "active",
  logoSrc: "/brands/studio-noir.svg",
  category: "Geography",
  voice: "Analytical. Data-backed. No fluff.",
  writingStyle: "Short sentences. Concrete examples. One idea per slide.",
  readingLevel: "Grade 8",
  colorTheme: {
    background: "#111111",
    foreground: "#F4F4F2",
    accent: "#888888",
  },
  contentPillars: ["Urban Systems", "Decision Architecture", "Behavioral Geography"],
  hashtagBase: ["#studionoir", "#geography", "#urban"],
  postingWindow: { weekday: 3, hourUtc: 10 },
};

describe("Design Engine", () => {
  describe("selectDesign", () => {
    it("returns a valid design spec", () => {
      const plan = planContent(mockBrand, "Urban Design Psychology", "Psychology");
      const design = selectDesign(plan, mockBrand);
      expect(design).toHaveProperty("layout");
      expect(design).toHaveProperty("typography");
      expect(design).toHaveProperty("colorRole");
      expect(design).toHaveProperty("spacing");
      expect(design).toHaveProperty("emphasis");
      expect(design).toHaveProperty("visualWeight");
    });

    it("selects valid layout styles", () => {
      const validLayouts = ["editorial", "data-driven", "narrative", "minimalist", "bold", "grid"];
      for (let i = 0; i < 20; i++) {
        const plan = planContent(mockBrand, "Test topic", "Pillar");
        const design = selectDesign(plan, mockBrand);
        expect(validLayouts).toContain(design.layout);
      }
    });

    it("selects valid typography modes", () => {
      const validModes = ["headline", "body", "caption", "stat", "quote"];
      for (let i = 0; i < 20; i++) {
        const plan = planContent(mockBrand, "Test topic", "Pillar");
        const design = selectDesign(plan, mockBrand);
        design.typography.forEach((mode) => {
          expect(validModes).toContain(mode);
        });
      }
    });
  });

  describe("designSlides", () => {
    it("applies design spec to slides", () => {
      const plan = planContent(mockBrand, "Test topic", "Pillar");
      const design = selectDesign(plan, mockBrand);
      const slides: SlideContent[] = [
        { kind: "cover", kicker: "Topic", headline: "Main Title", body: "", footnote: null },
        { kind: "statement", kicker: "Point", headline: "Key Insight", body: "Detail", footnote: null },
        { kind: "cta", kicker: "Action", headline: "Take Action", body: "", footnote: null },
      ];

      const designed = designSlides(slides, design, mockBrand);
      expect(designed.length).toBe(3);
      designed.forEach((slide) => {
        expect(slide).toHaveProperty("design");
        expect(slide.design).toHaveProperty("typography");
      });
    });
  });

  describe("enforceContentDesignLimits", () => {
    /** The limits are per kind, so exercises run through the real design pass. */
    const design = (slides: SlideContent[]) => {
      const plan = planContent(mockBrand, "Test topic", "Pillar");
      return designSlides(slides, selectDesign(plan, mockBrand), mockBrand);
    };

    it("truncates slides exceeding the per-kind body limit", () => {
      const slides: SlideContent[] = [
        { kind: "cover", kicker: "", headline: "Title", body: "", footnote: null },
        {
          kind: "statement",
          kicker: "",
          headline: "Point",
          body: "A".repeat(300),
          footnote: null,
        },
        { kind: "cta", kicker: "", headline: "Action", body: "", footnote: null },
      ];

      const result = enforceContentDesignLimits(design(slides));

      // 160 is the loosest body limit in the table (statement/quote).
      result.forEach((slide) => {
        expect(slide.body.length).toBeLessThanOrEqual(160);
      });
      expect(result[1].body).toHaveLength(160);
    });

    it("preserves slide order", () => {
      const slides: SlideContent[] = [
        { kind: "cover", kicker: "A", headline: "First", body: "", footnote: null },
        { kind: "statement", kicker: "B", headline: "Second", body: "", footnote: null },
        { kind: "cta", kicker: "C", headline: "Third", body: "", footnote: null },
      ];

      const designed = design(slides);
      const result = enforceContentDesignLimits(designed);

      expect(result.map((slide) => slide.kind)).toEqual(
        designed.map((slide) => slide.kind),
      );
      expect(result.map((slide) => slide.headline)).toEqual(
        designed.map((slide) => slide.headline),
      );
    });
  });

  describe("scoreDesignQuality", () => {
    it("returns a score between 0 and 100", () => {
      const plan = planContent(mockBrand, "Test topic", "Pillar");
      const designedSlides: SlideContent[] = [
        { kind: "cover", kicker: "", headline: "Title", body: "", footnote: null },
        { kind: "statement", kicker: "", headline: "Point", body: "Detail", footnote: null },
        { kind: "cta", kicker: "", headline: "Action", body: "", footnote: null },
      ];
      const design = selectDesign(plan, mockBrand);
      const designed = designSlides(designedSlides, design, mockBrand);

      const report = scoreDesignQuality(designed, plan);
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report).toHaveProperty("criteria");
    });

    it("penalizes missing CTA at end", () => {
      const plan = planContent(mockBrand, "Test topic", "Pillar");
      const designedSlides: SlideContent[] = [
        { kind: "cover", kicker: "", headline: "Cover", body: "", footnote: null },
        { kind: "statement", kicker: "", headline: "Point", body: "", footnote: null },
        { kind: "statement", kicker: "", headline: "Another point", body: "", footnote: null },
      ];
      const design = selectDesign(plan, mockBrand);
      const designed = designSlides(designedSlides, design, mockBrand);

      const report = scoreDesignQuality(designed, plan);
      expect(report.score).toBeLessThan(80);
    });
  });
});
