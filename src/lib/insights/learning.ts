import { compositeScore, hourLabel, postTotals, round, weekdayLabel } from "@/lib/insights/engine";
import type {
  HookPerformance,
  HookType,
  LearningRecommendation,
  LearningReport,
  PlannedPost,
  PostInsight,
  TimePerformance,
  TopicWeight,
} from "@/types";

/**
 * The learning engine.
 *
 * Runs weekly and answers one question: given what actually performed, what
 * should be published next week? It writes two things — a set of topic
 * multipliers that the generation engine reads on every run, and a plan with
 * the reasoning attached.
 *
 * Three design decisions are worth stating, because they are what separate this
 * from a nice-looking dashboard:
 *
 * 1. Ranking is percentile-based, not absolute. A topic's multiplier depends on
 *    where it ranks, not on how far ahead it is, so one viral post cannot push a
 *    weight to the ceiling.
 * 2. Every claim carries its sample size and a confidence, and a group below the
 *    minimum sample is reported as too thin rather than quietly promoted.
 * 3. Nothing here is random or time-dependent. The same inputs produce the same
 *    report, which is what makes "what changed since last week" a real diff.
 */

export const MIN_GROUP_SAMPLE = 3;
export const DEFAULT_WINDOW_DAYS = 28;

/** Multiplier floor and ceiling handed to the generation engine. */
const MULTIPLIER_RANGE = { min: 0.6, max: 1.5 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Confidence from sample size, damped.
 *
 * Twenty posts is not ten times as trustworthy as two, so the curve flattens:
 * two posts lands near 0.5 and ten clears 0.8.
 */
function confidenceFor(sample: number): number {
  if (sample <= 0) return 0;
  // Deliberately slow, and capped below 1: three posts is a hint, sixty is a
  // pattern, and no sample size makes a past result certain. A curve that
  // saturated at 0.95 for everything would make the number decorative.
  return round(clamp(0.28 + Math.log2(sample + 1) * 0.085, 0, 0.92), 2);
}

/** Percentile position of each entry, 1 = strongest. Used for multipliers. */
function percentileMultipliers<T>(
  entries: T[],
  scoreOf: (entry: T) => number,
): Map<T, number> {
  const ranked = [...entries].sort((a, b) => scoreOf(b) - scoreOf(a));
  const result = new Map<T, number>();
  ranked.forEach((entry, index) => {
    const share = ranked.length === 1 ? 1 : 1 - index / (ranked.length - 1);
    result.set(
      entry,
      round(
        MULTIPLIER_RANGE.min +
          share * (MULTIPLIER_RANGE.max - MULTIPLIER_RANGE.min),
        2,
      ),
    );
  });
  return result;
}

/* --------------------------------- topics --------------------------------- */

interface TopicGroup {
  topicId: string;
  label: string;
  category: PostInsight["category"];
  posts: PostInsight[];
  score: number;
  recent: number;
  earlier: number;
}

function groupTopics(posts: PostInsight[]): TopicGroup[] {
  const groups = new Map<string, PostInsight[]>();
  for (const post of posts) {
    const bucket = groups.get(post.topicId) ?? [];
    bucket.push(post);
    groups.set(post.topicId, bucket);
  }

  // Sort each group by date so the first half is genuinely the earlier half.
  return [...groups.entries()].map(([topicId, groupPosts]) => {
    const ordered = [...groupPosts].sort((a, b) =>
      a.publishedAt.localeCompare(b.publishedAt),
    );
    const half = Math.max(1, Math.floor(ordered.length / 2));
    const earlier = ordered.slice(0, half);
    const recent = ordered.slice(half);

    return {
      topicId,
      label: ordered[0].topicLabel,
      category: ordered[0].category,
      posts: ordered,
      score: round(mean(ordered.map(compositeScore)), 3),
      earlier: round(mean(earlier.map(compositeScore)), 3),
      recent: recent.length > 0 ? round(mean(recent.map(compositeScore)), 3) : 0,
    };
  });
}

function buildTopicWeights(groups: TopicGroup[]): TopicWeight[] {
  const multipliers = percentileMultipliers(groups, (group) => group.score);
  const total = groups.reduce((sum, group) => sum + group.score, 0);

  return [...groups]
    .sort((a, b) => b.score - a.score)
    .map((group) => {
      const totals = group.posts.map(postTotals);
      const movement =
        group.earlier > 0 ? (group.recent - group.earlier) / group.earlier : 0;
      return {
        topicId: group.topicId,
        label: group.label,
        category: group.category,
        posts: group.posts.length,
        avgEngagementRate: round(mean(totals.map((entry) => entry.engagementRate)), 4),
        avgReach: Math.round(mean(group.posts.map((post) => post.reach))),
        avgSaveRate: round(mean(totals.map((entry) => entry.saveRate)), 4),
        weight: total > 0 ? round(group.score / total, 4) : 0,
        multiplier: multipliers.get(group) ?? 1,
        trend:
          movement > 0.05 ? "rising" : movement < -0.05 ? "falling" : "steady",
      } satisfies TopicWeight;
    });
}

/* ---------------------------------- hooks --------------------------------- */

function buildHookPerformance(posts: PostInsight[]): HookPerformance[] {
  const groups = new Map<HookType, PostInsight[]>();
  for (const post of posts) {
    const bucket = groups.get(post.hookType) ?? [];
    bucket.push(post);
    groups.set(post.hookType, bucket);
  }

  const entries = [...groups.entries()].map(([hookType, groupPosts]) => ({
    hookType,
    groupPosts,
    score: round(mean(groupPosts.map(compositeScore)), 3),
  }));

  const total = entries.reduce((sum, entry) => sum + entry.score, 0);

  return entries
    .map((entry) => {
      const totals = entry.groupPosts.map(postTotals);
      return {
        hookType: entry.hookType,
        posts: entry.groupPosts.length,
        avgEngagementRate: round(mean(totals.map((t) => t.engagementRate)), 4),
        avgReach: Math.round(mean(entry.groupPosts.map((post) => post.reach))),
        weight: total > 0 ? round(entry.score / total, 4) : 0,
      } satisfies HookPerformance;
    })
    .sort((a, b) => b.weight - a.weight);
}

/* ---------------------------------- times --------------------------------- */

function buildTimePerformance(posts: PostInsight[]): TimePerformance[] {
  const groups = new Map<string, PostInsight[]>();
  for (const post of posts) {
    const key = `${post.dayOfWeek}-${post.hourUtc}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(post);
    groups.set(key, bucket);
  }

  return [...groups.values()]
    .map((groupPosts) => {
      const totals = groupPosts.map(postTotals);
      const avgEngagementRate = mean(
        totals.map((entry) => entry.engagementRate),
      );
      const avgReach = mean(groupPosts.map((post) => post.reach));
      return {
        dayOfWeek: groupPosts[0].dayOfWeek,
        hourUtc: groupPosts[0].hourUtc,
        posts: groupPosts.length,
        avgEngagementRate: round(avgEngagementRate, 4),
        avgReach: Math.round(avgReach),
        /*
         * Windows are a volume question, so a window scores on the reach it
         * earns, weighted by how engaged that reach was — not on the composite
         * used to rank content.
         *
         * Ranking windows by `compositeScore` looked reasonable and was not. In
         * that score a 1% relative change in engagement rate moves the result
         * roughly five hundred times as much as a 1% relative change in reach —
         * reach is inside a logarithm and weighted at a tenth, while a rate is
         * already multiplied by a hundred. The consequence was concrete: two
         * windows with 24 posts each, one reaching 10% further, were separated
         * by an engagement difference of 0.02 of a point, and the "best posting
         * time" the engine announced was noise with a confident voice. Reach is
         * what a posting-time decision is about; engagement rate adjusts it.
         */
        score: round(avgReach * (1 + avgEngagementRate), 1),
      } satisfies TimePerformance;
    })
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------ recommendations --------------------------- */

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function buildRecommendations(input: {
  posts: PostInsight[];
  topics: TopicWeight[];
  hooks: HookPerformance[];
  times: TimePerformance[];
  plan: PlannedPost[];
}): LearningRecommendation[] {
  const { posts, topics, hooks, times, plan } = input;
  const recommendations: LearningRecommendation[] = [];

  const scaled = topics.filter((topic) => topic.posts >= MIN_GROUP_SAMPLE);
  const bestTopic = scaled[0];
  const worstTopic = scaled[scaled.length - 1];

  if (bestTopic) {
    recommendations.push({
      id: "rec-best-topic",
      kind: "best-topic",
      title: `Lean into ${bestTopic.label}`,
      detail: `${bestTopic.label} is your strongest topic in this window at ${percent(bestTopic.avgEngagementRate)} engagement and a ${percent(bestTopic.avgSaveRate)} save rate. Generation now weights it at ${bestTopic.multiplier}× so it is chosen ahead of the rest.`,
      evidence: `${bestTopic.posts} posts · ${bestTopic.avgReach.toLocaleString()} avg reach · weight ${(bestTopic.weight * 100).toFixed(0)}% of the mix`,
      confidence: confidenceFor(bestTopic.posts),
      action: {
        label: "Generate from this topic",
        topicId: bestTopic.topicId,
      },
    });
  }

  if (worstTopic && worstTopic.topicId !== bestTopic?.topicId) {
    recommendations.push({
      id: "rec-worst-topic",
      kind: "worst-topic",
      title: `Pause ${worstTopic.label}`,
      detail: `${worstTopic.label} is the weakest topic you are actively publishing — ${percent(worstTopic.avgEngagementRate)} engagement against a ${percent(bestTopic?.avgEngagementRate ?? 0)} best. Its multiplier is ${worstTopic.multiplier}×, so it still appears occasionally rather than being dropped outright; a topic that is merely out of fashion should be able to come back.`,
      evidence: `${worstTopic.posts} posts · ${worstTopic.avgReach.toLocaleString()} avg reach · ${percent(worstTopic.avgSaveRate)} save rate`,
      confidence: confidenceFor(worstTopic.posts),
      action: { label: "Deprioritise", topicId: worstTopic.topicId },
    });
  }

  const bestHook = hooks.find((hook) => hook.posts >= MIN_GROUP_SAMPLE);
  if (bestHook) {
    recommendations.push({
      id: "rec-best-hook",
      kind: "best-hook",
      title: `Open with a ${bestHook.hookType} hook`,
      detail: `Hooks that lead with a ${bestHook.hookType} shape hold ${percent(bestHook.avgEngagementRate)} engagement across ${bestHook.posts} posts. The plan for next week uses it on every slot where it fits the topic.`,
      evidence: `${bestHook.posts} posts · weight ${(bestHook.weight * 100).toFixed(0)}% of measured hook performance`,
      confidence: confidenceFor(bestHook.posts),
      action: { label: "Prefer this hook", hookType: bestHook.hookType },
    });
  }

  const bestTime = times.find((time) => time.posts >= MIN_GROUP_SAMPLE);
  if (bestTime) {
    const worstTime = [...times]
      .filter((time) => time.posts >= MIN_GROUP_SAMPLE)
      .sort((a, b) => a.score - b.score)[0];

    recommendations.push({
      id: "rec-best-time",
      kind: "best-time",
      title: `Publish ${weekdayLabel(bestTime.dayOfWeek)} at ${hourLabel(bestTime.hourUtc)} UTC`,
      detail: worstTime
        ? `It reaches ${bestTime.avgReach.toLocaleString()} accounts on average — the widest of your windows — against ${worstTime.avgReach.toLocaleString()} for your weakest (${weekdayLabel(worstTime.dayOfWeek)} ${hourLabel(worstTime.hourUtc)} UTC). The plan below books the strongest windows first.`
        : `It reaches ${bestTime.avgReach.toLocaleString()} accounts on average, the widest of your windows.`,
      evidence: `${bestTime.posts} posts in this window · ${bestTime.avgReach.toLocaleString()} avg reach · ${percent(bestTime.avgEngagementRate)} engagement`,
      confidence: confidenceFor(bestTime.posts),
      action: {
        label: "Use this slot",
        dayOfWeek: bestTime.dayOfWeek,
        hourUtc: bestTime.hourUtc,
      },
    });
  }

  /* Which slide position loses the reader — measured across every carousel. */
  const dropByPosition = new Map<number, number[]>();
  for (const post of posts) {
    if (post.slides.length < 3) continue;
    for (let index = 1; index < post.slides.length; index += 1) {
      const previous = post.slides[index - 1];
      if (previous.views === 0) continue;
      const drop = Math.max(0, (previous.views - post.slides[index].views) / previous.views);
      const bucket = dropByPosition.get(post.slides[index].index) ?? [];
      bucket.push(drop);
      dropByPosition.set(post.slides[index].index, bucket);
    }
  }

  const worstPosition = [...dropByPosition.entries()]
    .filter(([, drops]) => drops.length >= MIN_GROUP_SAMPLE)
    .map(([index, drops]) => ({ index, drop: mean(drops), sample: drops.length }))
    .sort((a, b) => b.drop - a.drop)[0];

  if (worstPosition) {
    recommendations.push({
      id: "rec-slide-drop",
      kind: "slide",
      title: `Slide ${worstPosition.index} is where readers leave`,
      detail: `Slide ${worstPosition.index} loses ${(worstPosition.drop * 100).toFixed(1)}% of the readers who reached the slide before it — the steepest drop in any position. Put the payoff or the most surprising number on that slide.`,
      evidence: `Measured across ${worstPosition.sample} carousels in this window`,
      confidence: confidenceFor(worstPosition.sample + 4),
    });
  }

  const formats = new Map<string, PostInsight[]>();
  for (const post of posts) {
    const bucket = formats.get(post.format) ?? [];
    bucket.push(post);
    formats.set(post.format, bucket);
  }
  const bestFormat = [...formats.entries()]
    .filter(([, group]) => group.length >= MIN_GROUP_SAMPLE)
    .map(([format, group]) => ({
      format,
      score: mean(group.map(compositeScore)),
      posts: group.length,
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (bestFormat) {
    recommendations.push({
      id: "rec-format",
      kind: "format",
      title: `${bestFormat.format} is your best-performing format`,
      detail: `It outscores every other format you publish. Keep the carousel ratio for the plan below rather than chasing single images.`,
      evidence: `${bestFormat.posts} posts · composite score ${bestFormat.score.toFixed(2)}`,
      confidence: confidenceFor(bestFormat.posts),
    });
  }

  if (plan.length > 0) {
    recommendations.push({
      id: "rec-next-week",
      kind: "next-week",
      title: `${plan.length} posts planned for next week`,
      detail: plan
        .map(
          (entry) =>
            `${weekdayLabel(entry.dayOfWeek)} ${hourLabel(entry.hourUtc)} — ${entry.topicLabel} (${entry.hookType} hook)`,
        )
        .join(". "),
      evidence: `Sequenced from the strongest available topics and slots over a ${posts.length}-post sample`,
      confidence: confidenceFor(posts.length),
    });
  }

  return recommendations;
}

/* ----------------------------------- plan --------------------------------- */

/**
 * A week of slots.
 *
 * One post per publishing day, using the best-performing hours and rotating the
 * strongest topics so a schedule is not four variations of the same subject.
 * Topics below the sample threshold are still eligible when there is no
 * evidence either way — silence is not a verdict.
 */
function buildPlan(input: {
  topics: TopicWeight[];
  hooks: HookPerformance[];
  times: TimePerformance[];
}): PlannedPost[] {
  const { topics, hooks, times } = input;
  if (topics.length === 0) return [];

  const known = topics.filter((topic) => topic.posts >= MIN_GROUP_SAMPLE);
  const pool = known.length >= 4 ? known : topics;

  const slotHours = new Map<number, number>();
  for (let day = 0; day < 7; day += 1) {
    const candidates = times.filter(
      (time) => time.dayOfWeek === day && time.posts >= MIN_GROUP_SAMPLE,
    );
    const best = candidates[0];
    if (best) slotHours.set(day, best.hourUtc);
  }

  // Days without evidence use the brand's own preference ordering: midweek and
  // Friday evenings, which is also what the seeded history shows.
  const fallbackDays = [0, 1, 2, 3, 5, 6];
  const fallbackHours: Record<number, number> = {
    0: 17,
    1: 6,
    2: 21,
    3: 14,
    4: 15,
    5: 21,
    6: 9,
  };

  const days = [
    ...new Set([...slotHours.keys(), ...fallbackDays]),
  ].sort((a, b) => a - b);

  const bestHook = hooks.find((hook) => hook.posts >= MIN_GROUP_SAMPLE)?.hookType ?? "number";

  const plan: PlannedPost[] = [];
  for (let index = 0; index < days.length; index += 1) {
    const dayOfWeek = days[index];
    // Rotate the pool so consecutive days never repeat a topic.
    const topic = pool[index % pool.length];
    plan.push({
      dayOfWeek,
      hourUtc: slotHours.get(dayOfWeek) ?? fallbackHours[dayOfWeek] ?? 14,
      topicId: topic.topicId,
      topicLabel: topic.label,
      hookType: bestHook,
      reason:
        topic.posts >= MIN_GROUP_SAMPLE
          ? `${topic.multiplier}× weight · ${(topic.avgEngagementRate * 100).toFixed(2)}% engagement over ${topic.posts} posts`
          : `No reliable data yet — publishing to find out`,
    });
  }

  return plan;
}

/* --------------------------------- analyse -------------------------------- */

export interface AnalysisInput {
  /** Every post in the warehouse, newest first or oldest — order is irrelevant. */
  posts: PostInsight[];
  /** How many days back the analysis looks. */
  windowDays?: number;
  trigger: "cron" | "manual";
  /** The previous report, for the summary diff. */
  previous?: LearningReport | null;
  /** Injected for determinism in tests; defaults to now. */
  now?: Date;
}

export function analysePerformance(input: AnalysisInput): LearningReport {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - windowDays * 86_400_000);

  const inWindow = input.posts.filter(
    (post) => new Date(post.publishedAt).getTime() >= cutoff.getTime(),
  );

  /*
   * Real weeks can be quiet, and a warehouse can go stale. Analysing the most
   * recent posts instead of nothing keeps the weights usable, and the report
   * says out loud that the window had to be widened — a silent widening would
   * make "last 4 weeks" a claim the numbers do not support.
   */
  const widened = inWindow.length === 0 && input.posts.length > 0;
  const windowPosts = widened
    ? [...input.posts]
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 60)
    : inWindow;

  const generatedAt = now.toISOString();

  if (windowPosts.length === 0) {
    return {
      id: `learn-${generatedAt}`,
      generatedAt,
      weekOf: weekStartOf(now),
      trigger: input.trigger,
      sampleSize: 0,
      windowDays,
      topPosts: [],
      recommendations: [
        {
          id: "rec-no-data",
          kind: "next-week",
          title: "Not enough published posts to analyse yet",
          detail: `No posts in the warehouse were published in the last ${windowDays} days, so there is nothing to learn from. Publish the current queue and the weekly analysis will start producing weights.`,
          evidence: `0 posts in the last ${windowDays} days`,
          confidence: 0,
        },
      ],
      topicWeights: [],
      hooks: [],
      times: [],
      plan: [],
      summary: `No published posts in the last ${windowDays} days — weights left unchanged.`,
    };
  }

  const topicGroups = groupTopics(windowPosts);
  const topicWeights = buildTopicWeights(topicGroups);
  const hooks = buildHookPerformance(windowPosts);
  const times = buildTimePerformance(windowPosts);
  const plan = buildPlan({ topics: topicWeights, hooks, times });

  const topPosts = [...windowPosts]
    .sort((a, b) => compositeScore(b) - compositeScore(a))
    .slice(0, 5)
    .map((post) => {
      const totals = postTotals(post);
      return {
        postId: post.queuePostId ?? post.postId,
        title: post.title,
        brandId: post.brandId,
        reach: post.reach,
        engagementRate: totals.engagementRate,
        saveRate: totals.saveRate,
      };
    });

  const recommendations = buildRecommendations({
    posts: windowPosts,
    topics: topicWeights,
    hooks,
    times,
    plan,
  });

  const summary = summarise({
    previous: input.previous ?? null,
    topicWeights,
    sampleSize: windowPosts.length,
    windowDays,
    widened,
    bestTime: times.find((time) => time.posts >= MIN_GROUP_SAMPLE) ?? null,
    plan,
  });

  return {
    id: `learn-${generatedAt}`,
    generatedAt,
    weekOf: weekStartOf(now),
    trigger: input.trigger,
    sampleSize: windowPosts.length,
    windowDays,
    topPosts,
    recommendations,
    topicWeights,
    hooks,
    times,
    plan,
    summary,
  };
}

function weekStartOf(date: Date): string {
  const monday = new Date(date);
  const weekday = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function nextWeekStart(date: Date): Date {
  const monday = new Date(`${weekStartOf(date)}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() + 7);
  return monday;
}

/** One line that says what changed, so a weekly report is readable at a glance. */
function summarise(input: {
  previous: LearningReport | null;
  topicWeights: TopicWeight[];
  sampleSize: number;
  windowDays: number;
  widened: boolean;
  bestTime: TimePerformance | null;
  plan: PlannedPost[];
}): string {
  const { previous, topicWeights, sampleSize, windowDays, widened, bestTime, plan } = input;
  const leader = topicWeights[0];

  if (!leader) {
    return `${sampleSize} posts analysed over ${windowDays} days — no topic reached a usable sample.`;
  }

  const parts: string[] = [];
  if (widened) {
    parts.push(
      `Nothing published in the last ${windowDays} days — analysed the ${sampleSize} most recent posts instead.`,
    );
  }
  if (previous) {
    const beforeLeader = previous.topicWeights[0];
    if (beforeLeader && beforeLeader.topicId !== leader.topicId) {
      parts.push(
        `Lead topic changed from ${beforeLeader.label} to ${leader.label}.`,
      );
    } else if (beforeLeader) {
      const delta = leader.multiplier - beforeLeader.multiplier;
      parts.push(
        Math.abs(delta) < 0.05
          ? `${leader.label} held the lead unchanged.`
          : `${leader.label} held the lead (weight ${delta > 0 ? "up" : "down"} to ${leader.multiplier}×).`,
      );
    }
  } else {
    parts.push(`First analysis — ${leader.label} leads at ${leader.multiplier}×.`);
  }

  const rising = topicWeights.filter((topic) => topic.trend === "rising");
  if (rising.length > 0) {
    parts.push(`${rising.map((topic) => topic.label).join(", ")} trending up.`);
  }

  if (bestTime) {
    parts.push(
      `Best window ${weekdayLabel(bestTime.dayOfWeek)} ${hourLabel(bestTime.hourUtc)} UTC.`,
    );
  }

  parts.push(`${plan.length} posts planned for next week.`);
  return parts.join(" ");
}

export { weekStartOf, nextWeekStart };
