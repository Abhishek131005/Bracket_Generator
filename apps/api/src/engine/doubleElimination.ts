/**
 * Double Elimination Bracket Engine
 *
 * Structure:
 * - Winners Bracket: standard single-elimination
 * - Losers Bracket: losers from WB feed in, complex routing
 * - Grand Final: WB winner vs LB winner (with potential reset match)
 */

export interface DEMatch {
  id: string;
  bracket: "WINNERS" | "LOSERS" | "GRAND_FINAL";
  roundIndex: number;
  matchIndex: number;
  leftLabel: string | null;
  rightLabel: string | null;
  leftSeed: number | null;
  rightSeed: number | null;
  status: "SCHEDULED" | "PENDING" | "AUTO_ADVANCE";
  autoAdvanceWinner: string | null;
  winnerGoesTo: string | null;
  loserGoesTo: string | null;
}

export interface DERound {
  roundIndex: number;
  bracket: "WINNERS" | "LOSERS" | "GRAND_FINAL";
  title: string;
  matches: DEMatch[];
}

export interface DoubleEliminationBracket {
  format: "DOUBLE_ELIMINATION";
  participantCount: number;
  slots: number;
  byeCount: number;
  winnersRounds: DERound[];
  losersRounds: DERound[];
  grandFinal: DERound;
  allRounds: DERound[];
}

function nextPow2(n: number): number {
  return 2 ** Math.ceil(Math.log2(n));
}

export function buildDoubleEliminationBracket(
  participantsInput: Array<{ name: string; seed?: number }>
): DoubleEliminationBracket {
  const normalized = participantsInput
    .map((p, i) => ({ name: p.name.trim(), seed: p.seed ?? i + 1 }))
    .filter((p) => p.name.length > 0)
    .sort((a, b) => a.seed - b.seed)
    .map((p, i) => ({ name: p.name, seed: i + 1 }));

  if (normalized.length < 2) throw new Error("At least 2 participants required.");

  const slots = nextPow2(normalized.length);
  const byeCount = slots - normalized.length;
  const wbRoundCount = Math.log2(slots);

  // ── Winners Bracket ────────────────────────────────────────────────────────
  const winnersRounds: DERound[] = [];

  const r1Matches: DEMatch[] = [];
  const matchesInR1 = slots / 2;
  for (let i = 0; i < matchesInR1; i++) {
    const leftSeed = i + 1;
    const rightSeed = slots - i;
    const left = normalized[leftSeed - 1] ?? null;
    const right = normalized[rightSeed - 1] ?? null;
    const isBye = Boolean(left) !== Boolean(right);
    r1Matches.push({
      id: `WR1M${i + 1}`,
      bracket: "WINNERS",
      roundIndex: 1,
      matchIndex: i + 1,
      leftLabel: left?.name ?? null,
      rightLabel: right?.name ?? null,
      leftSeed: left ? leftSeed : null,
      rightSeed: right ? rightSeed : null,
      status: isBye ? "AUTO_ADVANCE" : "SCHEDULED",
      autoAdvanceWinner: isBye ? (left?.name ?? right?.name ?? null) : null,
      winnerGoesTo: matchesInR1 === 1 ? "GF1M1" : `WR2M${Math.floor(i / 2) + 1}`,
      loserGoesTo: isBye ? null : `LR1M${i + 1}`,
    });
  }

  const r1Size = matchesInR1 * 2;
  winnersRounds.push({
    roundIndex: 1,
    bracket: "WINNERS",
    title:
      matchesInR1 === 1
        ? "Winners Final"
        : matchesInR1 === 2
        ? "Winners Semi Final"
        : `Round of ${r1Size}`,
    matches: r1Matches,
  });

  for (let r = 2; r <= wbRoundCount; r++) {
    const matchCount = slots / 2 ** r;
    const isFinal = r === wbRoundCount;
    const matches: DEMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        id: `WR${r}M${i + 1}`,
        bracket: "WINNERS",
        roundIndex: r,
        matchIndex: i + 1,
        leftLabel: null,
        rightLabel: null,
        leftSeed: null,
        rightSeed: null,
        status: "PENDING",
        autoAdvanceWinner: null,
        winnerGoesTo: isFinal ? "GF1M1" : `WR${r + 1}M${Math.floor(i / 2) + 1}`,
        loserGoesTo: isFinal ? "GF1M1" : `LR${2 * r - 2}M${i + 1}`,
      });
    }
    const roundSize = matchCount * 2;
    winnersRounds.push({
      roundIndex: r,
      bracket: "WINNERS",
      title: isFinal
        ? "Winners Final"
        : matchCount === 2
        ? "Winners Semi Final"
        : `Winners Round of ${roundSize}`,
      matches,
    });
  }

  // ── Losers Bracket ─────────────────────────────────────────────────────────
  const losersRounds: DERound[] = [];
  const lbRoundCount = 2 * (wbRoundCount - 1);

  for (let lr = 1; lr <= lbRoundCount; lr++) {
    const matchCount = Math.max(1, slots / 2 ** (Math.ceil(lr / 2) + 1));
    const isLast = lr === lbRoundCount;
    const matches: DEMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        id: `LR${lr}M${i + 1}`,
        bracket: "LOSERS",
        roundIndex: lr,
        matchIndex: i + 1,
        leftLabel: null,
        rightLabel: null,
        leftSeed: null,
        rightSeed: null,
        status: "PENDING",
        autoAdvanceWinner: null,
        winnerGoesTo: isLast ? "GF1M1" : `LR${lr + 1}M${Math.floor(i / 2) + 1}`,
        loserGoesTo: null,
      });
    }
    losersRounds.push({
      roundIndex: lr,
      bracket: "LOSERS",
      title: isLast ? "Losers Final" : `Losers Round ${lr}`,
      matches,
    });
  }

  // ── Grand Final ────────────────────────────────────────────────────────────
  const grandFinal: DERound = {
    roundIndex: 1,
    bracket: "GRAND_FINAL",
    title: "Grand Final",
    matches: [
      {
        id: "GF1M1",
        bracket: "GRAND_FINAL",
        roundIndex: 1,
        matchIndex: 1,
        leftLabel: null,
        rightLabel: null,
        leftSeed: null,
        rightSeed: null,
        status: "PENDING",
        autoAdvanceWinner: null,
        winnerGoesTo: null,
        loserGoesTo: "GF1M2",
      },
      {
        id: "GF1M2",
        bracket: "GRAND_FINAL",
        roundIndex: 2,
        matchIndex: 1,
        leftLabel: null,
        rightLabel: null,
        leftSeed: null,
        rightSeed: null,
        status: "PENDING",
        autoAdvanceWinner: null,
        winnerGoesTo: null,
        loserGoesTo: null,
      },
    ],
  };

  const allRounds: DERound[] = [...winnersRounds, ...losersRounds, grandFinal];

  return {
    format: "DOUBLE_ELIMINATION",
    participantCount: normalized.length,
    slots,
    byeCount,
    winnersRounds,
    losersRounds,
    grandFinal,
    allRounds,
  };
}