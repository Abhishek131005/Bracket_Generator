/**
 * Swiss Tournament Pairing Engine
 *
 * Rules:
 * - Players paired by similar score (Dutch system simplified)
 * - No two players meet twice
 * - Odd player gets a bye (counts as a win, 1 point)
 * - Typically runs ceil(log2(n)) rounds
 */

export interface SwissParticipant {
  id: string;
  name: string;
  seed?: number;
}

export interface SwissMatch {
  id: string;
  roundIndex: number;
  matchIndex: number;
  homeParticipantId: string | null;
  awayParticipantId: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  isBye: boolean;
}

export interface SwissRound {
  roundIndex: number;
  title: string;
  matches: SwissMatch[];
}

export interface SwissFixtures {
  format: "SWISS";
  participantCount: number;
  totalRounds: number;
  totalMatches: number;
  rounds: SwissRound[];
}

interface PlayerState {
  id: string;
  name: string;
  points: number;
  opponents: Set<string>;
  hasBye: boolean;
}

export function buildSwissFixtures(
  participants: SwissParticipant[],
  totalRounds?: number
): SwissFixtures {
  if (participants.length < 2) throw new Error("At least 2 participants required.");

  const n = participants.length;
  const rounds = totalRounds ?? Math.ceil(Math.log2(n));

  const allRounds: SwissRound[] = [];

  // Round 1: pair by seed order (1v2, 3v4, etc.)
  const r1Matches: SwissMatch[] = [];
  const sorted = [...participants].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0));
  const hasBye = sorted.length % 2 !== 0;
  if (hasBye) sorted.push({ id: "__bye__", name: "BYE" });

  const playerPairs1 = Math.floor(sorted.length / 2);
  for (let i = 0; i < playerPairs1; i++) {
    const home = sorted[i * 2];
    const away = sorted[i * 2 + 1];
    const isBye = home.id === "__bye__" || away.id === "__bye__";
    r1Matches.push({
      id: `swiss-r1m${i + 1}`,
      roundIndex: 1,
      matchIndex: i + 1,
      homeParticipantId: home.id === "__bye__" ? null : home.id,
      awayParticipantId: away.id === "__bye__" ? null : away.id,
      homeLabel: home.id === "__bye__" ? null : home.name,
      awayLabel: away.id === "__bye__" ? null : away.name,
      isBye,
    });
  }

  allRounds.push({ roundIndex: 1, title: "Round 1", matches: r1Matches });

  // Rounds 2+: TBD placeholders (pairings generated dynamically after scores)
  for (let r = 2; r <= rounds; r++) {
    const matchCount = Math.floor(n / 2);
    const matches: SwissMatch[] = Array.from({ length: matchCount }, (_, i) => ({
      id: `swiss-r${r}m${i + 1}`,
      roundIndex: r,
      matchIndex: i + 1,
      homeParticipantId: null,
      awayParticipantId: null,
      homeLabel: "TBD",
      awayLabel: "TBD",
      isBye: false,
    }));
    if (n % 2 !== 0) {
      matches.push({
        id: `swiss-r${r}m${matchCount + 1}`,
        roundIndex: r,
        matchIndex: matchCount + 1,
        homeParticipantId: null,
        awayParticipantId: null,
        homeLabel: null,
        awayLabel: null,
        isBye: true,
      });
    }
    allRounds.push({ roundIndex: r, title: `Round ${r}`, matches });
  }

  const realMatches = allRounds.flatMap((r) => r.matches).filter((m) => !m.isBye);

  return {
    format: "SWISS",
    participantCount: n,
    totalRounds: rounds,
    totalMatches: realMatches.length,
    rounds: allRounds,
  };
}

/**
 * Generate pairings for a specific Swiss round based on current standings.
 * Uses a greedy Dutch-system: sort by points desc, pair top with next available.
 */
export function generateSwissRoundPairings(
  participants: SwissParticipant[],
  results: Array<{
    homeId: string;
    awayId: string;
    homeScore: number;
    awayScore: number;
  }>,
  roundIndex: number
): SwissMatch[] {
  const stateMap = new Map<string, PlayerState>();
  for (const p of participants) {
    stateMap.set(p.id, {
      id: p.id,
      name: p.name,
      points: 0,
      opponents: new Set(),
      hasBye: false,
    });
  }

  for (const r of results) {
    const home = stateMap.get(r.homeId);
    const away = stateMap.get(r.awayId);
    if (!home || !away) continue;
    home.opponents.add(r.awayId);
    away.opponents.add(r.homeId);
    if (r.homeScore > r.awayScore) {
      home.points += 1;
    } else if (r.awayScore > r.homeScore) {
      away.points += 1;
    } else {
      home.points += 0.5;
      away.points += 0.5;
    }
  }

  const sorted = [...stateMap.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const seedA = participants.find((p) => p.id === a.id)?.seed ?? 999;
    const seedB = participants.find((p) => p.id === b.id)?.seed ?? 999;
    return seedA - seedB;
  });

  const unpaired = [...sorted];
  const matches: SwissMatch[] = [];
  let matchIdx = 1;

  while (unpaired.length >= 2) {
    const player = unpaired.shift()!;
    const oppIdx = unpaired.findIndex((p) => !player.opponents.has(p.id));
    const opponent = oppIdx >= 0 ? unpaired.splice(oppIdx, 1)[0] : unpaired.shift()!;

    matches.push({
      id: `swiss-r${roundIndex}m${matchIdx}`,
      roundIndex,
      matchIndex: matchIdx++,
      homeParticipantId: player.id,
      awayParticipantId: opponent.id,
      homeLabel: player.name,
      awayLabel: opponent.name,
      isBye: false,
    });
  }

  if (unpaired.length === 1) {
    const byePlayer = unpaired[0];
    matches.push({
      id: `swiss-r${roundIndex}m${matchIdx}`,
      roundIndex,
      matchIndex: matchIdx,
      homeParticipantId: byePlayer.id,
      awayParticipantId: null,
      homeLabel: byePlayer.name,
      awayLabel: null,
      isBye: true,
    });
  }

  return matches;
}