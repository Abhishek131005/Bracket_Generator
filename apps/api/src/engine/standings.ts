/**
 * Standings Engine
 * Calculates points-table standings from fixture results.
 * Supports HEAD_TO_HEAD_SCORE and POINTS_TABLE ranking rules.
 */

export interface FixtureResult {
  id: string;
  homeParticipantId: string | null;
  awayParticipantId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

export interface StandingRow {
  participantId: string;
  participantName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  rank: number;
}

const WIN_POINTS = 3;
const DRAW_POINTS = 1;
const LOSS_POINTS = 0;

export function calculateStandings(
  participants: { id: string; name: string }[],
  fixtures: FixtureResult[]
): StandingRow[] {
  const map = new Map<string, Omit<StandingRow, "rank">>();

  for (const p of participants) {
    map.set(p.id, {
      participantId: p.id,
      participantName: p.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const fixture of fixtures) {
    if (
      fixture.status !== "COMPLETED" ||
      fixture.homeScore === null ||
      fixture.awayScore === null ||
      !fixture.homeParticipantId ||
      !fixture.awayParticipantId
    ) {
      continue;
    }

    const home = map.get(fixture.homeParticipantId);
    const away = map.get(fixture.awayParticipantId);
    if (!home || !away) continue;

    const hs = fixture.homeScore;
    const as_ = fixture.awayScore;

    home.played++;
    away.played++;
    home.goalsFor += hs;
    home.goalsAgainst += as_;
    away.goalsFor += as_;
    away.goalsAgainst += hs;

    if (hs > as_) {
      home.won++;
      home.points += WIN_POINTS;
      away.lost++;
      away.points += LOSS_POINTS;
    } else if (hs < as_) {
      away.won++;
      away.points += WIN_POINTS;
      home.lost++;
      home.points += LOSS_POINTS;
    } else {
      home.drawn++;
      home.points += DRAW_POINTS;
      away.drawn++;
      away.points += DRAW_POINTS;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  const rows = Array.from(map.values()).sort((a, b) => {
    // Sort by: points, then GD, then GF, then name
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.participantName.localeCompare(b.participantName);
  });

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * Calculate leaderboard from performance entries (time/distance/height/score).
 */
export interface PerformanceEntry {
  id: string;
  participantId: string;
  participantName: string;
  metricValue: number;
  unit: string | null;
  rank?: number;
}

export type RankingDirection = "ASC" | "DESC";

export function calculateLeaderboard(
  entries: PerformanceEntry[],
  direction: RankingDirection = "ASC"
): (PerformanceEntry & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => {
    return direction === "ASC"
      ? a.metricValue - b.metricValue
      : b.metricValue - a.metricValue;
  });

  let rank = 1;
  return sorted.map((entry, i) => {
    if (i > 0 && sorted[i].metricValue !== sorted[i - 1].metricValue) {
      rank = i + 1;
    }
    return { ...entry, rank };
  });
}