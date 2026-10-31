/**
 * Status workflow (pure rules — the repository loads the data and applies the result).
 *
 *   Stage       DRAFT ──first result──▶ IN_PROGRESS ──every match settled──▶ COMPLETED
 *               (fixture-based formats complete automatically;
 *                leaderboard formats are closed by an organiser)
 *   Tournament  DRAFT ──a stage starts──▶ IN_PROGRESS ──all stages complete──▶ COMPLETED
 */

export type StageStatusValue = "DRAFT" | "PUBLISHED" | "IN_PROGRESS" | "COMPLETED";
export type TournamentStatusValue = "DRAFT" | "PUBLISHED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/** Formats whose progress is fully described by their fixtures. */
export const FIXTURE_BASED_FORMATS = new Set([
  "SINGLE_ELIMINATION",
  "DOUBLE_ELIMINATION",
  "ROUND_ROBIN",
  "SWISS",
  "LEAGUE_PLUS_PLAYOFF",
]);

export interface StatusFixture {
  code?: string | null;
  status: string;
  leftParticipantId?: string | null;
  rightParticipantId?: string | null;
}

function isSettled(fixture: StatusFixture, byCode: Map<string, StatusFixture>): boolean {
  if (fixture.status === "COMPLETED" || fixture.status === "AUTO_ADVANCE" || fixture.status === "CANCELLED") return true;

  // Double elimination: the grand-final reset match stays dormant when the
  // winners-bracket finalist wins the first grand final, so it must not block completion.
  if (fixture.code === "GF1M2" && fixture.status === "PENDING" && !fixture.leftParticipantId && !fixture.rightParticipantId) {
    return byCode.get("GF1M1")?.status === "COMPLETED";
  }
  return false;
}

export function isFixtureBasedFormat(format: string): boolean {
  return FIXTURE_BASED_FORMATS.has(format);
}

export function deriveStageStatus(input: {
  format: string;
  current: StageStatusValue;
  fixtures: StatusFixture[];
  performanceCount: number;
}): StageStatusValue {
  const { format, current, fixtures, performanceCount } = input;

  if (isFixtureBasedFormat(format)) {
    const byCode = new Map<string, StatusFixture>();
    for (const f of fixtures) if (f.code) byCode.set(f.code, f);

    const anyPlayed = fixtures.some((f) => f.status === "COMPLETED");
    if (!anyPlayed) return "DRAFT";

    const allSettled = fixtures.length > 0 && fixtures.every((f) => isSettled(f, byCode));
    return allSettled ? "COMPLETED" : "IN_PROGRESS";
  }

  // Leaderboard formats: starting is automatic, finishing is a deliberate organiser action.
  if (current === "DRAFT" && performanceCount > 0) return "IN_PROGRESS";
  return current;
}

export function deriveTournamentStatus(input: {
  current: TournamentStatusValue;
  stages: { status: string; format: string; sequence: number }[];
}): TournamentStatusValue {
  const { current, stages } = input;
  if (current === "CANCELLED") return current;

  if (stages.length === 0) return current === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

  const lastSequence = Math.max(...stages.map((s) => s.sequence));
  // A finished league is not the end of a league + playoff tournament: the playoff stage comes next.
  const awaitingPlayoff = stages.some((s) => s.format === "LEAGUE_PLUS_PLAYOFF" && s.sequence === lastSequence);

  if (!awaitingPlayoff && stages.every((s) => s.status === "COMPLETED")) return "COMPLETED";
  if (stages.some((s) => s.status === "IN_PROGRESS" || s.status === "COMPLETED")) return "IN_PROGRESS";
  return current === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
}
