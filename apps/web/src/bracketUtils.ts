// Bracket reconstruction utilities — rebuild display objects from persisted fixtures

import {
  SingleEliminationBracket,
  DoubleEliminationBracket,
  DERound,
  BracketRound,
  BracketMatch,
  StageFixture,
} from "./types";

/**
 * Rebuild a SingleEliminationBracket display object purely from persisted fixtures.
 * This means the Bracket tab always reflects the latest scores & winner advancement.
 */
export function buildBracketFromFixtures(
  fixtures: StageFixture[],
  participantCount: number
): SingleEliminationBracket | null {
  if (!fixtures.length) return null;

  const roundMap = new Map<number, StageFixture[]>();
  for (const f of fixtures) {
    if (!roundMap.has(f.roundIndex)) roundMap.set(f.roundIndex, []);
    roundMap.get(f.roundIndex)!.push(f);
  }

  const sortedRoundIndices = Array.from(roundMap.keys()).sort((a, b) => a - b);
  const totalRounds = sortedRoundIndices.length;
  const slots = Math.pow(2, totalRounds);

  const rounds: BracketRound[] = sortedRoundIndices.map((roundIndex, rIdx) => {
    const roundFixtures = roundMap.get(roundIndex)!.sort((a, b) => a.matchIndex - b.matchIndex);
    const isFinal = rIdx === totalRounds - 1;
    const isSemi = rIdx === totalRounds - 2;
    const roundSize = roundFixtures.length * 2;

    let title = `Round of ${roundSize}`;
    if (isFinal) title = "Final";
    else if (isSemi) title = "Semi Final";
    else if (roundSize === 8) title = "Quarter Final";

    const matches: BracketMatch[] = roundFixtures.map((f) => {
      let winner: string | null = null;
      if (f.status === "COMPLETED" && f.leftScore !== null && f.rightScore !== null) {
        winner = f.leftScore > f.rightScore
          ? (f.leftLabel ?? null)
          : f.rightScore > f.leftScore
          ? (f.rightLabel ?? null)
          : null;
      }
      if (f.status === "AUTO_ADVANCE") {
        winner = f.leftLabel && f.leftLabel !== "TBD" ? f.leftLabel : f.rightLabel ?? null;
      }

      return {
        id: f.id,
        roundIndex: f.roundIndex,
        matchIndex: f.matchIndex,
        left: { seed: null, participantName: f.leftLabel ?? null },
        right: { seed: null, participantName: f.rightLabel ?? null },
        status: f.status as BracketMatch["status"],
        autoAdvanceWinner: f.status === "AUTO_ADVANCE" ? winner : null,
        _winner: winner,
        _leftScore: f.leftScore,
        _rightScore: f.rightScore,
      } as BracketMatch & { _winner: string | null; _leftScore: number | null; _rightScore: number | null };
    });

    return { roundIndex, title, matches };
  });

  return {
    format: "SINGLE_ELIMINATION",
    participantCount,
    slots,
    byeCount: slots - participantCount,
    rounds,
  };
}

/**
 * Reconstruct a DoubleEliminationBracket from persisted fixtures.
 *
 * The repository stores DE fixtures with a global roundIndex built from offsets:
 *   Winners rounds   → roundIndex 1..wbCount
 *   Losers rounds    → roundIndex wbCount+1 .. wbCount+lbCount
 *   Grand Final      → roundIndex wbCount+lbCount+1 .. (2 matches)
 */
export function buildDEBracketFromFixtures(
  fixtures: StageFixture[],
  participantCount: number
): DoubleEliminationBracket | null {
  if (!fixtures.length) return null;

  const slots = Math.pow(2, Math.ceil(Math.log2(Math.max(participantCount, 2))));
  const wbRoundCount = Math.log2(slots);
  const lbRoundCount = 2 * (wbRoundCount - 1);

  const sorted = [...fixtures].sort((a, b) =>
    a.roundIndex !== b.roundIndex ? a.roundIndex - b.roundIndex : a.matchIndex - b.matchIndex
  );

  const byRound = new Map<number, StageFixture[]>();
  for (const f of sorted) {
    if (!byRound.has(f.roundIndex)) byRound.set(f.roundIndex, []);
    byRound.get(f.roundIndex)!.push(f);
  }

  const toMatches = (
    roundFixtures: StageFixture[],
    bracket: "WINNERS" | "LOSERS" | "GRAND_FINAL",
    localRoundIndex: number
  ) =>
    roundFixtures.map((f) => ({
      id: f.id,
      bracket,
      roundIndex: localRoundIndex,
      matchIndex: f.matchIndex,
      leftLabel: f.leftLabel,
      rightLabel: f.rightLabel,
      leftSeed: null,
      rightSeed: null,
      status: f.status as "SCHEDULED" | "PENDING" | "AUTO_ADVANCE" | "COMPLETED",
      autoAdvanceWinner: f.status === "AUTO_ADVANCE"
        ? (f.leftLabel && f.leftLabel !== "TBD" ? f.leftLabel : f.rightLabel ?? null)
        : null,
      winnerGoesTo: null,
      loserGoesTo: null,
      _leftScore: f.leftScore,
      _rightScore: f.rightScore,
      _winner:
        f.status === "COMPLETED" && f.leftScore !== null && f.rightScore !== null
          ? f.leftScore > f.rightScore
            ? f.leftLabel
            : f.rightScore > f.leftScore
            ? f.rightLabel
            : null
          : f.status === "AUTO_ADVANCE"
          ? (f.leftLabel && f.leftLabel !== "TBD" ? f.leftLabel : f.rightLabel ?? null)
          : null,
    }));

  const winnersRounds: DERound[] = [];
  for (let r = 1; r <= wbRoundCount; r++) {
    const roundFixtures = byRound.get(r) ?? [];
    const matchCount = roundFixtures.length;
    const roundSize = matchCount * 2;
    const isFinal = r === wbRoundCount;
    const isSemi = r === wbRoundCount - 1;
    const title = isFinal
      ? "Winners Final"
      : isSemi
      ? "Winners Semi Final"
      : `Round of ${roundSize}`;
    winnersRounds.push({
      roundIndex: r,
      bracket: "WINNERS",
      title,
      matches: toMatches(roundFixtures, "WINNERS", r) as any,
    });
  }

  const losersRounds: DERound[] = [];
  for (let lr = 1; lr <= lbRoundCount; lr++) {
    const globalIdx = wbRoundCount + lr;
    const roundFixtures = byRound.get(globalIdx) ?? [];
    const isLast = lr === lbRoundCount;
    const title = isLast ? "Losers Final" : `Losers Round ${lr}`;
    losersRounds.push({
      roundIndex: lr,
      bracket: "LOSERS",
      title,
      matches: toMatches(roundFixtures, "LOSERS", lr) as any,
    });
  }

  const gfRound1Idx = wbRoundCount + lbRoundCount + 1;
  const gfRound2Idx = gfRound1Idx + 1;
  const gfFixtures1 = byRound.get(gfRound1Idx) ?? [];
  const gfFixtures2 = byRound.get(gfRound2Idx) ?? [];
  const gfAllFixtures = [
    ...gfFixtures1.map((f) => ({ ...f, _gfMatch: 1 })),
    ...gfFixtures2.map((f) => ({ ...f, _gfMatch: 2 })),
  ];

  const grandFinal: DERound = {
    roundIndex: 1,
    bracket: "GRAND_FINAL",
    title: "Grand Final",
    matches: gfAllFixtures.map((f, i) => ({
      id: f.id,
      bracket: "GRAND_FINAL" as const,
      roundIndex: 1,
      matchIndex: i + 1,
      leftLabel: f.leftLabel,
      rightLabel: f.rightLabel,
      leftSeed: null,
      rightSeed: null,
      status: f.status as "SCHEDULED" | "PENDING" | "AUTO_ADVANCE" | "COMPLETED",
      autoAdvanceWinner: null,
      winnerGoesTo: null,
      loserGoesTo: null,
      _leftScore: f.leftScore,
      _rightScore: f.rightScore,
      _winner:
        f.status === "COMPLETED" && f.leftScore !== null && f.rightScore !== null
          ? f.leftScore > f.rightScore
            ? f.leftLabel
            : f.rightScore > f.leftScore
            ? f.rightLabel
            : null
          : null,
    })) as any,
  };

  return {
    format: "DOUBLE_ELIMINATION",
    participantCount,
    slots,
    byeCount: slots - participantCount,
    winnersRounds,
    losersRounds,
    grandFinal,
    allRounds: [...winnersRounds, ...losersRounds, grandFinal],
  };
}
