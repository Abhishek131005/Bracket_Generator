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

  for (let matchNumber = 0; matchNumber < matchesInRoundOne; matchNumber += 1) {
    const leftSeed = matchNumber + 1;
    const rightSeed = slots - matchNumber;
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
    title: getRoundTitle(slots, false, slots === 4),
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

  return {
    format: "SINGLE_ELIMINATION",
    participantCount: participants.length,
    slots,
    byeCount,
    rounds
  };
}
