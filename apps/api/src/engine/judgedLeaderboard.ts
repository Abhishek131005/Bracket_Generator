// JUDGED_LEADERBOARD engine
// Aggregates multiple judge scores per participant and produces a ranked leaderboard.
//
// Used by artistic/subjectively-scored sports (e.g., Indian Artyrst, gymnastics-style events)
// where several judges each submit a numeric score and the result is computed from those.
//
// Aggregation options (all optional; safe defaults match a plain average):
//   dropLowest   – remove the single lowest score before aggregating  (default: false)
//   dropHighest  – remove the single highest score before aggregating (default: false)
//   aggregate    – "average" (default) or "sum"
//
// Storing judge scores
// ────────────────────
// Each judge adds one PerformanceEntry for a participant:
//   participantId → the competitor
//   metricValue   → the judge's score
//   metadata      → JSON string: { judgeId: "<name or id>" }
//
// Call buildJudgedParticipants() to group flat PerformanceEntry records into
// the JudgedParticipant shape expected by calculateJudgedLeaderboard().

export interface JudgeScore {
  judgeId: string;
  score: number;
}

export interface JudgedParticipant {
  participantId: string;
  participantName: string;
  scores: JudgeScore[];
}

export interface JudgedResult {
  participantId: string;
  participantName: string;
  scores: JudgeScore[];
  judgeCount: number;
  /** Sum of all raw scores before any drop rule is applied */
  rawTotal: number;
  /** Final aggregated score used for ranking */
  finalScore: number;
  rank: number;
}

export interface JudgedLeaderboardOptions {
  /** Remove the single lowest judge score before aggregating */
  dropLowest?: boolean;
  /** Remove the single highest judge score before aggregating */
  dropHighest?: boolean;
  /** "average" (default) or "sum" of remaining scores */
  aggregate?: "average" | "sum";
}

/**
 * Group flat PerformanceEntry-like records into JudgedParticipant objects.
 *
 * @param entries  Array of { participantId, participantName, metricValue, metadata }
 *                 where metadata may contain { judgeId: string }
 */
export function buildJudgedParticipants(
  entries: {
    participantId: string;
    participantName: string;
    metricValue: number;
    metadata: string | null;
  }[]
): JudgedParticipant[] {
  const map = new Map<string, JudgedParticipant>();

  for (const entry of entries) {
    if (!map.has(entry.participantId)) {
      map.set(entry.participantId, {
        participantId: entry.participantId,
        participantName: entry.participantName,
        scores: [],
      });
    }

    let judgeId = `judge-${map.get(entry.participantId)!.scores.length + 1}`;
    try {
      const meta = entry.metadata ? JSON.parse(entry.metadata) : null;
      if (meta?.judgeId) judgeId = String(meta.judgeId);
    } catch {
      // keep generated judgeId
    }

    map.get(entry.participantId)!.scores.push({ judgeId, score: entry.metricValue });
  }

  return Array.from(map.values());
}

/**
 * Rank participants by aggregated judge score (higher = better).
 *
 * Returns a new sorted array; the input is not mutated.
 * Participants with no scores are ranked last with finalScore = 0.
 */
export function calculateJudgedLeaderboard(
  participants: JudgedParticipant[],
  options: JudgedLeaderboardOptions = {}
): JudgedResult[] {
  if (participants.length === 0) return [];

  const { dropHighest = false, dropLowest = false, aggregate = "average" } = options;

  const results: Omit<JudgedResult, "rank">[] = participants.map((p) => {
    const rawTotal = parseFloat(
      p.scores.reduce((sum, s) => sum + s.score, 0).toFixed(6)
    );

    let effective = p.scores.map((s) => s.score);
    const minDrops = (dropLowest ? 1 : 0) + (dropHighest ? 1 : 0);

    if (effective.length > minDrops) {
      const asc = [...effective].sort((a, b) => a - b);
      if (dropLowest) asc.shift();
      if (dropHighest) asc.pop();
      effective = asc;
    }

    let finalScore = 0;
    if (effective.length > 0) {
      const total = effective.reduce((sum, s) => sum + s, 0);
      finalScore =
        aggregate === "average"
          ? parseFloat((total / effective.length).toFixed(3))
          : parseFloat(total.toFixed(3));
    }

    return {
      participantId: p.participantId,
      participantName: p.participantName,
      scores: p.scores,
      judgeCount: p.scores.length,
      rawTotal,
      finalScore,
    };
  });

  const sorted = results.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return a.participantName.localeCompare(b.participantName);
  });

  let rank = 1;
  return sorted.map((result, i) => {
    if (i > 0 && sorted[i].finalScore !== sorted[i - 1].finalScore) rank = i + 1;
    return { ...result, rank };
  });
}
