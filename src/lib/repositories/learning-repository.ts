import { document } from "@/lib/storage";
import type { LearningReport, LearningState, TopicWeight } from "@/types";

/**
 * The learning ledger.
 *
 * Holds the current topic weights plus the last few weekly reports. Weights are
 * the actionable part — the generation engine reads them on every run, so a
 * weight change is a behaviour change, not a dashboard decoration. Reports are
 * kept so "why did the weights move?" is answerable a month later.
 *
 * A corrupt or absent document degrades to "no analysis yet" rather than
 * throwing into a route handler.
 */

/** How many weekly reports to retain. */
const HISTORY_LIMIT = 12;

const EMPTY_STATE: LearningState = {
  updatedAt: null,
  latest: null,
  history: [],
  topicWeights: [],
};

function normalise(raw: unknown): LearningState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const parsed = raw as Partial<LearningState>;

  return {
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    latest: (parsed.latest as LearningReport | null) ?? null,
    history: Array.isArray(parsed.history)
      ? (parsed.history as LearningReport[])
          .filter(isReport)
          .slice(0, HISTORY_LIMIT)
      : [],
    topicWeights: Array.isArray(parsed.topicWeights)
      ? (parsed.topicWeights as TopicWeight[]).filter(isTopicWeight)
      : [],
  };
}

/** A report the UI can render: it needs a timestamp and its recommendations. */
function isReport(raw: unknown): raw is LearningReport {
  if (typeof raw !== "object" || raw === null) return false;
  const report = raw as Partial<LearningReport>;
  return (
    typeof report.id === "string" &&
    typeof report.generatedAt === "string" &&
    Array.isArray(report.recommendations) &&
    Array.isArray(report.topicWeights)
  );
}

/**
 * A weight without a numeric multiplier would be applied as `NaN` to the
 * generation prompt, which is worse than having no weight at all.
 */
function isTopicWeight(raw: unknown): raw is TopicWeight {
  if (typeof raw !== "object" || raw === null) return false;
  const weight = raw as Partial<TopicWeight>;
  return (
    typeof weight.topicId === "string" &&
    typeof weight.label === "string" &&
    typeof weight.multiplier === "number" &&
    Number.isFinite(weight.multiplier)
  );
}

const learning = () =>
  document<LearningState>({
    key: "learning",
    parse: normalise,
    fallback: () => EMPTY_STATE,
  });

export async function getLearningState(): Promise<LearningState> {
  return learning().read();
}

export async function getLatestReport(): Promise<LearningReport | null> {
  return (await learning().read()).latest;
}

export async function listReports(limit = HISTORY_LIMIT): Promise<LearningReport[]> {
  return (await learning().read()).history.slice(0, limit);
}

/**
 * The multipliers the generation engine applies.
 *
 * An empty list means no analysis has run, and callers must treat that as
 * "no opinion" rather than "every topic is worthless".
 */
export async function getTopicWeights(): Promise<TopicWeight[]> {
  return (await learning().read()).topicWeights;
}

/**
 * Stores a new report and adopts its weights.
 *
 * The report is prepended to history and the whole state is written as one
 * document, so a crash mid-run cannot leave weights pointing at a report that
 * was never saved.
 */
export async function recordReport(report: LearningReport): Promise<LearningState> {
  return learning().mutate((state) => ({
    updatedAt: report.generatedAt,
    latest: report,
    history: [report, ...state.history].slice(0, HISTORY_LIMIT),
    topicWeights: report.topicWeights,
  }));
}

/** Zeroes the multipliers without discarding the report history. */
export async function clearTopicWeights(): Promise<LearningState> {
  return learning().mutate((state) => ({
    ...state,
    topicWeights: [],
    updatedAt: new Date().toISOString(),
  }));
}
