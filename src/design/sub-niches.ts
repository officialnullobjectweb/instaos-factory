import type { DesignVariant, SubNiche } from "@/design/types";

/**
 * The niche tree.
 *
 * Three main niches, three sub-niches each — chosen for a *pain point or a
 * proven demand signal*, not for topical variety, because the point of the
 * sub-niche is to reach an audience that already wants the content. Every
 * sub-niche runs exactly two design variants (A/B): two readings of the same
 * audience, expressed as real template overrides and a distinct content angle.
 * The Experiments page promotes the winner; `audienceKey` is what the winner is
 * promoted *to*.
 */

export const SUB_NICHES: SubNiche[] = [
  /* ------------------------------ GEOGRAPHY ------------------------------- */
  {
    id: "geo-oceans",
    mainNiche: "geography",
    label: "Oceans & Chokepoints",
    rationale:
      "Trade-war headlines keep chokepoints in the news cycle; the pain is not understanding why prices move. High demand, low competition from editorial accounts.",
    audiences: [
      {
        id: "geo-oceans.invested",
        label: "The Invested",
        ageRange: "25–40",
        interests: ["markets", "shipping", "macro", "documentaries"],
        painPoint: "Reads trade headlines without the geographic layer underneath them.",
        demandSignal: "Highest saves on map + number posts in the niche's own analytics.",
        sizeEstimate: "large",
      },
      {
        id: "geo-oceans.curious",
        label: "The Curious Scroller",
        ageRange: "18–30",
        interests: ["maps", "fun facts", "travel"],
        painPoint: "Wants a shareable fact in five seconds, not a macro lecture.",
        demandSignal: "Reels-style hooks outperform carousels with this group in the niche.",
        sizeEstimate: "very large",
      },
    ],
    variants: [
      {
        id: "geo-oceans.atlas",
        label: "Atlas — dark cartographic",
        thesis:
          "The Invested audience wants authority: dark chart-room aesthetic, serif headlines, one map per deck, numbers with units.",
        templateId: "geography",
        overrides: {
          palette: {
            background: "#0E1116",
            accent: "#D9A441",
          },
        },
        contentAngle:
          "Chokepoint economics: one strait, canal or port per post, told through volumes, prices and dependency.",
      },
      {
        id: "geo-oceans.postcard",
        label: "Postcard — bright field-guide",
        thesis:
          "The Curious Scroller wants a keepsake: light field-guide palette, bigger type, playful motifs, zero jargon.",
        templateId: "geography",
        overrides: {
          palette: {
            background: "#F4F1EA",
            surface: "#FFFFFF",
            ink: "#22303A",
            inkSoft: "#5E6E78",
            accent: "#1F6E8C",
            onAccent: "#F4F1EA",
          },
          footer: "ATLAS · POSTCARDS",
        },
        contentAngle:
          "One astonishing fact per post, framed as a postcard from a place — no economics jargon in the hook.",
      },
    ],
  },
  {
    id: "geo-urban",
    mainNiche: "geography",
    label: "Cities & Systems",
    rationale:
      "Urbanism is a fast-growing interest with a clear pain: people live inside systems they can't see. Strong comment potential (opinions about cities are identity).",
    audiences: [
      {
        id: "geo-urban.commuters",
        label: "The Commuter",
        ageRange: "22–38",
        interests: ["transit", "housing", "walkability", "local politics"],
        painPoint: "Feels the city is designed against them but can't articulate why.",
        demandSignal: "Transit-fail stories reliably outperform in reach; validation content earns comments.",
        sizeEstimate: "large",
      },
      {
        id: "geo-urban.planners",
        label: "The Enthusiast",
        ageRange: "20–45",
        interests: ["urban planning", "architecture", "maps"],
        painPoint: "Wants the professional's lens — comparisons, numbers, named systems.",
        demandSignal: "Follows niche accounts; highest profile-visit rate after a save.",
        sizeEstimate: "medium",
      },
    ],
    variants: [
      {
        id: "geo-urban.blueprint",
        label: "Blueprint — technical documentary",
        thesis:
          "The Enthusiast wants the planner's view: technical kickers, named streets and budgets, diagrammatic motifs.",
        templateId: "geography",
        overrides: {
          palette: { background: "#10161C", accent: "#7FB4C9" },
          footer: "STREETS · DOCUMENTED",
        },
        contentAngle:
          "Why this street, station or block works the way it does — one system, measured.",
      },
      {
        id: "geo-urban.walknote",
        label: "Walknote — warm and personal",
        thesis:
          "The Commuter wants validation and vocabulary: warm paper tones, second-person headlines, one feeling per slide.",
        templateId: "psychology",
        overrides: {
          palette: { background: "#F6F3EC", accent: "#A4552F", onAccent: "#F6F3EC" },
          footer: "STREETS · WALK NOTES",
        },
        contentAngle:
          "“You're not imagining it” — the felt experience of a city, then the system behind it.",
      },
    ],
  },
  {
    id: "geo-econ",
    mainNiche: "geography",
    label: "Geography of Money",
    rationale:
      "Where GDP, resources and borders meet — perennial search demand and the highest CPM audience in the niche. The pain: economics explainers are usually text-first and dry.",
    audiences: [
      {
        id: "geo-econ.career",
        label: "The Career Builder",
        ageRange: "22–35",
        interests: ["economics", "careers", "startups", "investing"],
        painPoint: "Wants macro literacy that sounds smart at work, fast.",
        demandSignal: "Saves-heavy audience; 'one chart' posts are the proven format.",
        sizeEstimate: "large",
      },
      {
        id: "geo-econ.sceptic",
        label: "The Sceptic",
        ageRange: "25–50",
        interests: ["politics", "news", "debunking"],
        painPoint: "Distrusts numbers without sources; engages to argue.",
        demandSignal: "Comment-driven reach; sourced posts double comment rates.",
        sizeEstimate: "medium",
      },
    ],
    variants: [
      {
        id: "geo-econ.ledger",
        label: "Ledger — data-forward",
        thesis:
          "The Career Builder wants chart-first authority: every slide carries a number, kickers read like a briefing.",
        templateId: "geography",
        overrides: {
          palette: { background: "#0C1210", accent: "#5FBF8F" },
          footer: "MONEY · MAPPED",
        },
        contentAngle:
          "One economic fact mapped to a place per slide, each with its unit and year.",
      },
      {
        id: "geo-econ.briefing",
        label: "Briefing — editorial with sources",
        thesis:
          "The Sceptic wants receipts: editorial layout with a visible sources line on every slide.",
        templateId: "psychology",
        overrides: {
          palette: { background: "#F4F2ED", ink: "#101820", accent: "#20415A", onAccent: "#F4F2ED" },
          footer: "MONEY · BRIEFING",
        },
        contentAngle:
          "Debunk or confirm a widely shared economic claim, with the source named on-slide.",
      },
    ],
  },

  /* ------------------------------ PSYCHOLOGY ------------------------------ */
  {
    id: "psych-focus",
    mainNiche: "psychology",
    label: "Attention & Focus",
    rationale:
      "Attention is the defining pain of the audience itself — they are scroll-fatigued yet scrolling. Demand is evergreen and the content is self-referential, which drives saves.",
    audiences: [
      {
        id: "psych-focus.workers",
        label: "The Knowledge Worker",
        ageRange: "23–40",
        interests: ["productivity", "deep work", "tools"],
        painPoint: "Can't sustain attention long enough to do the work they're judged on.",
        demandSignal: "Highest saves-per-reach of any psych topic in published niche data.",
        sizeEstimate: "very large",
      },
      {
        id: "psych-focus.students",
        label: "The Student",
        ageRange: "16–24",
        interests: ["studying", "exams", "habits"],
        painPoint: "Studies in bursts, retains little, blames willpower.",
        demandSignal: "Shares study-mechanism posts to friends — peer share is the growth loop.",
        sizeEstimate: "large",
      },
    ],
    variants: [
      {
        id: "psych-focus.clinic",
        label: "Clinic — calm editorial",
        thesis:
          "The Knowledge Worker wants calm competence: paper background, serif-free, one mechanism per slide, no hustle language.",
        templateId: "psychology",
        overrides: {
          palette: { background: "#F7F5F0", accent: "#3E6B4F" },
        },
        contentAngle:
          "Attention mechanisms explained like a clinician: what happens, why, and the single intervention.",
      },
      {
        id: "psych-focus.signal",
        label: "Signal — high-contrast terse",
        thesis:
          "The Student wants punchy and shareable: near-black type, huge headlines, seven words per slide maximum.",
        templateId: "branding",
        overrides: {
          palette: { background: "#FAFAF8", ink: "#111111", accent: "#111111", onAccent: "#FAFAF8" },
          footer: "FOCUS · SIGNALS",
        },
        contentAngle:
          "Terse imperatives: one rule per slide, stated in under ten words, evidence in the caption.",
      },
    ],
  },
  {
    id: "psych-money",
    mainNiche: "psychology",
    label: "Money Psychology",
    rationale:
      "Behavioural-economics content monetises audiences well and has a concrete pain: people know what to do with money and don't do it. Strong emotional engagement.",
    audiences: [
      {
        id: "psych-money.earners",
        label: "The Early Earner",
        ageRange: "22–32",
        interests: ["saving", "investing", "salary"],
        painPoint: "Knows the advice, fails at the behaviour — feels guilty about it.",
        demandSignal: "'Why you still buy X' framing consistently top-performs in the niche.",
        sizeEstimate: "large",
      },
      {
        id: "psych-money.sceptics",
        label: "The Anti-Hustler",
        ageRange: "25–40",
        interests: ["minimalism", "anti-consumerism"],
        painPoint: "Wants validation that opting out is rational, not lazy.",
        demandSignal: "Comment-heavy; identity-affirming posts drive follows.",
        sizeEstimate: "medium",
      },
    ],
    variants: [
      {
        id: "psych-money.ledger",
        label: "Ledger — calm and non-judgemental",
        thesis:
          "The Early Earner needs zero shame: soft palette, warm second person, mechanism before advice.",
        templateId: "psychology",
        overrides: {
          palette: { background: "#F5F1EA", accent: "#7A5C2E", onAccent: "#F5F1EA" },
          footer: "MONEY · EXAMINED",
        },
        contentAngle:
          "The mechanism behind a money behaviour, then one friction-reducer. Never 'stop doing X'.",
      },
      {
        id: "psych-money.counter",
        label: "Counter — stark ink on ink",
        thesis:
          "The Anti-Hustler wants conviction: near-monochrome, declarative headlines, consumer culture as the named enemy.",
        templateId: "branding",
        overrides: {
          palette: { background: "#141414", ink: "#F2F0EA", accent: "#C9B98A", onAccent: "#141414" },
          footer: "MONEY · COUNTER",
        },
        contentAngle:
          "Anti-consumerist arguments with a behavioural backbone — cultural critique first, tactic second.",
      },
    ],
  },
  {
    id: "psych-social",
    mainNiche: "psychology",
    label: "Social Instincts",
    rationale:
      "Relationships and status are the most-shared content category on the platform. The pain is social friction with no vocabulary for it — naming a feeling is the product.",
    audiences: [
      {
        id: "psych-social.navigators",
        label: "The Social Navigator",
        ageRange: "18–30",
        interests: ["relationships", "friendship", "communication"],
        painPoint: "Has recurring social friction but no words for the pattern.",
        demandSignal: "Tag-a-friend behaviour is the platform's strongest organic loop here.",
        sizeEstimate: "very large",
      },
      {
        id: "psych-social.observers",
        label: "The Quiet Observer",
        ageRange: "20–40",
        interests: ["people-watching", "sociology", "podcasts"],
        painPoint: "Enjoys decoding others more than advice for themselves.",
        demandSignal: "Long dwell time on taxonomy posts ('the 5 types of…').",
        sizeEstimate: "large",
      },
    ],
    variants: [
      {
        id: "psych-social.fieldguide",
        label: "Field Guide — taxonomy editorial",
        thesis:
          "The Quiet Observer wants naming and sorting: numbered lists, muted palette, 'type' cards as the visual system.",
        templateId: "psychology",
        overrides: {
          palette: { background: "#F3F2EE", accent: "#55607A", onAccent: "#F3F2EE" },
          footer: "PEOPLE · FIELD GUIDE",
        },
        contentAngle:
          "Taxonomies of everyday behaviour — 'the four ways people apologise', each named and quoted.",
      },
      {
        id: "psych-social.mirror",
        label: "Mirror — confronting monochrome",
        thesis:
          "The Social Navigator wants recognition: dark slides that mirror their situation back at them, second person throughout.",
        templateId: "branding",
        overrides: {
          palette: { background: "#101014", ink: "#ECEAE4", accent: "#B08968", onAccent: "#101014" },
          footer: "PEOPLE · MIRROR",
        },
        contentAngle:
          "Second-person scenarios: 'You reread the message four times. Here's what that is.'",
      },
    ],
  },

  /* ------------------------------- BRANDING ------------------------------- */
  {
    id: "brand-founders",
    mainNiche: "branding",
    label: "Founder Positioning",
    rationale:
      "Early founders feel positioning pain daily and buy solutions — the audience with clearest commercial value. Demand is proven by the category-creation canon.",
    audiences: [
      {
        id: "brand-founders.early",
        label: "The Early Founder",
        ageRange: "24–38",
        interests: ["startups", "positioning", "marketing"],
        painPoint: "Has a product and no way to say what it is in one sentence.",
        demandSignal: "Saves and shares on 'positioning statement' templates; recurring ask.",
        sizeEstimate: "large",
      },
      {
        id: "brand-founders.solo",
        label: "The Solo Operator",
        ageRange: "22–35",
        interests: ["indie hacking", "personal brands", "consulting"],
        painPoint: "Competing on price because they can't name a category.",
        demandSignal: "Engages with before/after repositioning examples.",
        sizeEstimate: "large",
      },
    ],
    variants: [
      {
        id: "brand-founders.systems",
        label: "Systems — stark typographic",
        thesis:
          "The Early Founder wants the consultant's confidence: brutal grid, giant statements, one framework per deck.",
        templateId: "branding",
        overrides: {
          palette: { background: "#111111", accent: "#E8E6DF" },
        },
        contentAngle:
          "One positioning mechanism per post, applied to a real company in three moves.",
      },
      {
        id: "brand-founders.workbook",
        label: "Workbook — paper and prompts",
        thesis:
          "The Solo Operator wants something to fill in: light workbook feel, prompts as content, blank lines as a motif.",
        templateId: "psychology",
        overrides: {
          palette: { background: "#F6F4EF", ink: "#17181A", accent: "#8A4B2F", onAccent: "#F6F4EF" },
          footer: "BRAND · WORKBOOK",
        },
        contentAngle:
          "Fill-in-the-blank positioning prompts — the post is a worksheet the reader screenshots.",
      },
    ],
  },
  {
    id: "brand-personal",
    mainNiche: "branding",
    label: "Personal Brand Systems",
    rationale:
      "Everyone on the platform is implicitly building one, and the pain is inconsistency. Audience overlaps with creators — the most share-hungry segment.",
    audiences: [
      {
        id: "brand-personal.creators",
        label: "The Creator",
        ageRange: "18–30",
        interests: ["content", "growth", "aesthetics"],
        painPoint: "Posts constantly with no recognisable identity, so growth resets each post.",
        demandSignal: "Aesthetic-system posts earn profile visits; identity content earns follows.",
        sizeEstimate: "very large",
      },
      {
        id: "brand-personal.career",
        label: "The Professional",
        ageRange: "26–42",
        interests: ["careers", "LinkedIn", "reputation"],
        painPoint: "Feels self-promotion is cringe but knows invisibility is worse.",
        demandSignal: "Saves on 'frameworks without the cringe'; shares privately.",
        sizeEstimate: "large",
      },
    ],
    variants: [
      {
        id: "brand-personal.atelier",
        label: "Atelier — editorial monochrome",
        thesis:
          "The Professional wants taste transfer: magazine-style restraint, serif accents, minimal accent colour.",
        templateId: "branding",
        overrides: {
          palette: { background: "#F2F0EB", ink: "#141414", accent: "#141414", onAccent: "#F2F0EB" },
          footer: "PERSONAL · ATELIER",
        },
        contentAngle:
          "Personal-brand decisions as editorial essays — one decision per slide, argued quietly.",
      },
      {
        id: "brand-personal.loud",
        label: "Loud — poster energy",
        thesis:
          "The Creator wants energy: maximum contrast, huge grotesk, poster-style slides that screenshot well.",
        templateId: "branding",
        overrides: {
          palette: { background: "#050505", ink: "#FFFFFF", accent: "#D8FF3E", onAccent: "#050505" },
          typography: { displaySizeMax: 120 },
          footer: "PERSONAL · LOUD",
        },
        contentAngle:
          "Poster rules for creators — punchy, quotable, each slide a standalone screenshot.",
      },
    ],
  },
  {
    id: "brand-culture",
    mainNiche: "branding",
    label: "Brand Culture & History",
    rationale:
      "Origin stories and design history are the niche's most reliably saved content — demand-driven rather than pain-driven, and perfect for the atlas-style treatment.",
    audiences: [
      {
        id: "brand-culture.nostalgics",
        label: "The Nostalgic",
        ageRange: "25–45",
        interests: ["design history", "logos", "advertising"],
        painPoint: "Loves the story behind brands but rarely gets it told well.",
        demandSignal: "Archive-photo posts outperform; timelines are the proven format.",
        sizeEstimate: "large",
      },
      {
        id: "brand-culture.designers",
        label: "The Designer",
        ageRange: "20–38",
        interests: ["typography", "identity design", "craft"],
        painPoint: "Wants references with analysis, not mood boards.",
        demandSignal: "Follows for craft breakdowns; highest profile-visit-to-follow conversion.",
        sizeEstimate: "medium",
      },
    ],
    variants: [
      {
        id: "brand-culture.archive",
        label: "Archive — documentary serif",
        thesis:
          "The Nostalgic wants the documentary: serif display, dated kickers, museum-caption tone.",
        templateId: "geography",
        overrides: {
          palette: { background: "#1A1611", surface: "#241F18", ink: "#EFE8DC", inkSoft: "#A79A85", accent: "#C89B5A", onAccent: "#1A1611" },
          footer: "BRAND · ARCHIVE",
        },
        contentAngle:
          "One brand decision per post, told as of its date, with the before/after and the consequence.",
      },
      {
        id: "brand-culture.anatomy",
        label: "Anatomy — craft breakdown",
        thesis:
          "The Designer wants the annotated specimen: monochrome, technical labels, geometry as the motif.",
        templateId: "branding",
        overrides: {
          palette: { background: "#EDEBE6", ink: "#131313", accent: "#D0402B", onAccent: "#EDEBE6" },
          typography: { display: "grotesk" },
          footer: "BRAND · ANATOMY",
        },
        contentAngle:
          "Anatomy of a classic identity — grid, type and colour choices annotated like a drawing.",
      },
    ],
  },
];

export const MAIN_NICHES = [
  { id: "geography", label: "Geography" },
  { id: "psychology", label: "Psychology" },
  { id: "branding", label: "Branding" },
] as const;

export function subNichesByMain(main: SubNiche["mainNiche"]) {
  return SUB_NICHES.filter((sub) => sub.mainNiche === main);
}

export function getSubNiche(id: string) {
  return SUB_NICHES.find((sub) => sub.id === id) ?? null;
}

export function getVariant(id: string): DesignVariant | null {
  for (const sub of SUB_NICHES) {
    const variant = sub.variants.find((candidate) => candidate.id === id);
    if (variant) return variant;
  }
  return null;
}
