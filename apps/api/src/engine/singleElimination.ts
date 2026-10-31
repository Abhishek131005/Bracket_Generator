export interface BracketParticipant {
  name: string;
  seed: number;
}

export interface BracketSide {
  seed: number | null;
  participantName: string | null;
}

export interface BracketMatch {
  id: string;
  roundIndex: number;
  matchIndex: number;
  left: BracketSide;
  right: BracketSide;
  status: "SCHEDULED" | "AUTO_ADVANCE" | "PENDING";
  autoAdvanceWinner: string | null;
}

export interface BracketRound {
  roundIndex: number;
  title: string;
  matches: BracketMatch[];
}

export interface SingleEliminationBracket {
  format: "SINGLE_ELIMINATION";
  participantCount: number;
  slots: number;
  byeCount: number;
  rounds: BracketRound[];
}

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(value));
}

/**
 * Standard bracket seed placement, listed as consecutive pairs per round-1 match.
 * 8 slots -> [1,8, 4,5, 2,7, 3,6]: seeds 1 and 2 sit in opposite halves and can
 * only meet in the final; 3/4 can only meet 1/2 in the semi-finals.
 */
export function standardSeedOrder(slots: number): number[] {
  let order = [1, 2];
  while (order.length < slots) {
    const size = order.length * 2;
    order = order.flatMap((seed) => [seed, size + 1 - seed]);
  }
  return order.slice(0, slots);
}

function getRoundTitle(roundSize: number, isFinalRound: boolean, isSemiRound: boolean): string {
  if (isFinalRound) {
    return "Final";
  }

  if (isSemiRound) {
    return "Semi Final";
  }

  if (roundSize === 8) {
    return "Quarter Final";
  }

  return `Round of ${roundSize}`;
}

export function buildSingleEliminationBracket(participantsInput: Array<{ name: string; seed?: number }>): SingleEliminationBracket {
  const normalized = participantsInput
    .map((item, index) => ({
      name: item.name.trim(),
      seed: item.seed ?? index + 1
    }))
    .filter((item) => item.name.length > 0)
    .sort((a, b) => a.seed - b.seed);

  if (normalized.length < 2) {
    throw new Error("At least 2 participants are required to generate a bracket.");
  }

  const participants: BracketParticipant[] = normalized.map((item, index) => ({
    name: item.name,
    seed: index + 1
  }));

  const slots = nextPowerOfTwo(participants.length);
  const byeCount = slots - participants.length;
  const rounds: BracketRound[] = [];

  const roundOneMatches: BracketMatch[] = [];
  const matchesInRoundOne = slots / 2;

  const seedOrder = standardSeedOrder(slots);

  for (let matchNumber = 0; matchNumber < matchesInRoundOne; matchNumber += 1) {
    const leftSeed = seedOrder[matchNumber * 2];
    const rightSeed = seedOrder[matchNumber * 2 + 1];
    const leftParticipant = participants[leftSeed - 1];
    const rightParticipant = participants[rightSeed - 1];

    const left: BracketSide = {
      seed: leftParticipant ? leftSeed : null,
      participantName: leftParticipant?.name ?? null
    };

    const right: BracketSide = {
      seed: rightParticipant ? rightSeed : null,
      participantName: rightParticipant?.name ?? null
    };

    const hasSingleParticipant = Boolean(left.participantName) !== Boolean(right.participantName);

    roundOneMatches.push({
      id: `r1m${matchNumber + 1}`,
      roundIndex: 1,
      matchIndex: matchNumber + 1,
      left,
      right,
      status: hasSingleParticipant ? "AUTO_ADVANCE" : "SCHEDULED",
      autoAdvanceWinner: hasSingleParticipant ? left.participantName ?? right.participantName : null
    });
  }

  rounds.push({
    roundIndex: 1,
    title: getRoundTitle(slots, slots === 2, slots === 4),
    matches: roundOneMatches
  });

  let currentRoundMatches = matchesInRoundOne;
  let roundIndex = 2;

  while (currentRoundMatches > 1) {
    currentRoundMatches /= 2;

    const isFinalRound = currentRoundMatches === 1;
    const isSemiRound = currentRoundMatches === 2;
    const roundSize = currentRoundMatches * 2;

    const matches: BracketMatch[] = Array.from({ length: currentRoundMatches }).map((_, index) => ({
      id: `r${roundIndex}m${index + 1}`,
      roundIndex,
      matchIndex: index + 1,
      left: {
        seed: null,
        participantName: "Winner of previous match"
      },
      right: {
        seed: null,
        participantName: "Winner of previous match"
      },
      status: "PENDING",
      autoAdvanceWinner: null
    }));

    rounds.push({
      roundIndex,
      title: getRoundTitle(roundSize, isFinalRound, isSemiRound),
      matches
    });

    roundIndex += 1;
  }

  // Place bye winners straight into round 2 (same rule the repository uses when a
  // result is saved: odd matchIndex feeds the left slot, even feeds the right slot).
  if (rounds.length > 1) {
    for (const match of roundOneMatches) {
      if (match.status !== "AUTO_ADVANCE") continue;
      const winner = match.left.participantName ? match.left : match.right;
      const target = rounds[1].matches[Math.ceil(match.matchIndex / 2) - 1];
      const slot = match.matchIndex % 2 === 1 ? "left" : "right";
      target[slot] = { seed: winner.seed, participantName: winner.participantName };
    }

    for (const match of rounds[1].matches) {
      match.status = match.left.seed !== null && match.right.seed !== null ? "SCHEDULED" : "PENDING";
    }
  }

  return {
    format: "SINGLE_ELIMINATION",
    participantCount: participants.length,
    slots,
    byeCount,
    rounds
  };
}
