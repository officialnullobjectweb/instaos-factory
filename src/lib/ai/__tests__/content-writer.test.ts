import { describe, it, expect } from "vitest";
import {
  planContent,
  generateHook,
  generateArc,
  generateCaption,
  generateHashtags,
  generateAltText,
  type PsychologyHook,
} from "@/lib/ai/content-writer";
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

describe("Content Writer", () => {
  describe("planContent", () => {
    it("returns a valid content plan", () => {
      const plan = planContent(mockBrand, "The Psychology of Urban Design", "Psychology");
      expect(plan).toHaveProperty("hook");
      expect(plan).toHaveProperty("emotionalArc");
      expect(plan).toHaveProperty("slideCount");
      expect(plan).toHaveProperty("tone");
      expect(plan).toHaveProperty("readerState");
    });

    it("selects from valid hooks", () => {
      const validHooks: PsychologyHook[] = [
        "curiosity_gap", "social_proof", "loss_aversion", "authority",
        "specificity", "contrast", "narrative", "identity",
      ];
      for (let i = 0; i < 10; i++) {
        const plan = planContent(mockBrand, "Test topic", "Pillar");
        expect(validHooks).toContain(plan.hook);
      }
    });

    it("selects from valid arcs", () => {
      const validArcs = ["problem→solution", "myth→reality", "data→insight", "story→lesson", "before→after"];
      for (let i = 0; i < 10; i++) {
        const plan = planContent(mockBrand, "Test topic", "Pillar");
        expect(validArcs).toContain(plan.emotionalArc);
      }
    });

    it("adjusts slide count based on topic complexity", () => {
      const shortTopic = planContent(mockBrand, "Urban Design", "Psychology");
      const longTopic = planContent(mockBrand, "How Urban Systems Shape Human Behavior and Decision-Making Patterns in Modern Cities", "Psychology");
      expect(shortTopic.slideCount).toBeLessThanOrEqual(6);
      expect(longTopic.slideCount).toBeGreaterThanOrEqual(6);
    });
  });

  describe("generateHook", () => {
    it("returns a non-empty string", () => {
      const plan = planContent(mockBrand, "Urban Design Psychology", "Psychology");
      const hook = generateHook(plan.hook, {
        brand: mockBrand,
        topic: "Urban Design Psychology",
        pillar: "Psychology",
        angle: "How cities shape behavior",
      });
      expect(hook.length).toBeGreaterThan(10);
    });

    it("generates different hooks for different plans", () => {
      const hooks = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const plan = planContent(mockBrand, "Test topic", "Pillar");
        const hook = generateHook(plan.hook, {
          brand: mockBrand,
          topic: "Test topic",
          pillar: "Pillar",
          angle: "Test angle",
        });
        hooks.add(hook);
      }
      expect(hooks.size).toBeGreaterThan(3);
    });
  });

  describe("generateArc", () => {
    it("returns an array of slides", () => {
      const plan = planContent(mockBrand, "Test topic", "Pillar");
      const slides = generateArc(plan.emotionalArc, {
        brand: mockBrand,
        topic: "Test topic",
        pillar: "Pillar",
        hook: "Test hook line",
        plan,
        facts: ["Fact 1", "Fact 2", "Fact 3"],
      });
      expect(Array.isArray(slides)).toBe(true);
      expect(slides.length).toBeGreaterThanOrEqual(3);
    });

    it("first slide is always a cover", () => {
      const plan = planContent(mockBrand, "Test topic", "Pillar");
      const slides = generateArc(plan.emotionalArc, {
        brand: mockBrand,
        topic: "Test topic",
        pillar: "Pillar",
        hook: "Test hook",
        plan,
        facts: ["Fact 1", "Fact 2", "Fact 3"],
      });
      expect(slides[0].kind).toBe("cover");
    });

    it("last slide is always a cta", () => {
      const plan = planContent(mockBrand, "Test topic", "Pillar");
      const slides = generateArc(plan.emotionalArc, {
        brand: mockBrand,
        topic: "Test topic",
        pillar: "Pillar",
        hook: "Test hook",
        plan,
        facts: ["Fact 1", "Fact 2", "Fact 3"],
      });
      expect(slides[slides.length - 1].kind).toBe("cta");
    });
  });

  describe("generateCaption", () => {
    it("returns a caption meeting minimum length", () => {
      const plan = planContent(mockBrand, "Urban Design", "Psychology");
      const caption = generateCaption({
        brand: mockBrand,
        topic: "Urban Design",
        pillar: "Psychology",
        hook: "Test hook",
        tone: plan.tone,
      });
      expect(caption.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe("generateHashtags", () => {
    it("returns at least 3 hashtags", () => {
      const tags = generateHashtags(mockBrand, "Urban Psychology", "Psychology");
      expect(tags.length).toBeGreaterThanOrEqual(3);
    });

    it("all start with #", () => {
      const tags = generateHashtags(mockBrand, "Urban Psychology", "Psychology");
      tags.forEach((tag) => {
        expect(tag.startsWith("#")).toBe(true);
      });
    });

    it("includes brand tags", () => {
      const tags = generateHashtags(mockBrand, "Urban Psychology", "Psychology");
      expect(tags).toContain("#studionoir");
    });
  });

  describe("generateAltText", () => {
    it("returns descriptive alt text", () => {
      const alt = generateAltText(mockBrand, [
        { kind: "cover", kicker: "Topic", headline: "Main Title", body: "", footnote: null },
        { kind: "statement", kicker: "Point", headline: "Key Insight", body: "Supporting detail", footnote: null },
        { kind: "cta", kicker: "Action", headline: "Take Action", body: "", footnote: null },
      ], "Test Carousel");
      expect(alt.length).toBeGreaterThanOrEqual(20);
      expect(alt).toContain("carousel");
    });
  });
});
