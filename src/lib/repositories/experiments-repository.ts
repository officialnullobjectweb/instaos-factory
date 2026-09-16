import { arrayDocument } from "@/lib/storage";

/**
 * The experiments ledger.
 *
 * Design variants win by *evidence*, not taste, so every decision — which
 * variant won, on which numbers, decided when — is persisted next to the
 * variant definitions. Written rarely and read on every experiments render.
 */

export interface ExperimentDecision {
  subNicheId: string;
  audienceId: string;
  /** The variant that won the test. */
  winnerId: string;
  /** The variant that lost. */
  loserId: string;
  metrics: {
    reach: number;
    engagementRate: number;
    saves: number;
    follows: number;
  };
  decidedAt: string;
  /** Free-text note: what the data said, in one line. */
  note: string;
}

/**
 * Guards rows on read.
 *
 * A decision missing its metrics would render an empty evidence line and a
 * zeroed comparison, which reads as a real (bad) result rather than as missing
 * data — so it is dropped instead.
 */
function isExperimentDecision(raw: unknown): raw is ExperimentDecision {
  if (typeof raw !== "object" || raw === null) return false;
  const entry = raw as Partial<ExperimentDecision>;

  return (
    typeof entry.audienceId === "string" &&
    typeof entry.winnerId === "string" &&
    typeof entry.loserId === "string" &&
    typeof entry.decidedAt === "string" &&
    typeof entry.metrics === "object" &&
    entry.metrics !== null &&
    typeof entry.metrics.reach === "number"
  );
}

const decisions = () =>
  arrayDocument<ExperimentDecision>({
    key: "experiments",
    isItem: isExperimentDecision,
  });

export async function listDecisions(): Promise<ExperimentDecision[]> {
  return decisions().read();
}

/** Latest decision for an audience, if the test has been run. */
export async function getDecision(
  audienceId: string,
): Promise<ExperimentDecision | null> {
  const entries = await decisions().read();
  return entries.find((entry) => entry.audienceId === audienceId) ?? null;
}

export async function recordDecision(
  decision: Omit<ExperimentDecision, "decidedAt">,
): Promise<ExperimentDecision> {
  const entry: ExperimentDecision = {
    ...decision,
    decidedAt: new Date().toISOString(),
  };

  // One decision per audience: re-running a test replaces the verdict.
  await decisions().mutate((current) => [
    entry,
    ...current.filter((existing) => existing.audienceId !== decision.audienceId),
  ]);

  return entry;
}

export async function resetDecisions(): Promise<number> {
  const current = await decisions().read();
  await decisions().replaceAll([]);
  return current.length;
}
