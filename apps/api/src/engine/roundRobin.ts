export interface RoundRobinParticipant {
  id: string;
  name: string;
  seed?: number;
}

export interface RoundRobinMatch {
  id: string;
  roundIndex: number;
  matchIndex: number;
  homeParticipantId: string | null;
  awayParticipantId: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  isBye: boolean;
}

export interface RoundRobinRound {
  roundIndex: number;
  title: string;
  matches: RoundRobinMatch[];
}

export interface RoundRobinFixtures {
  format: "ROUND_ROBIN";
  participantCount: number;
  totalRounds: number;
  totalMatches: number;
  rounds: RoundRobinRound[];
}

/**
 * Classic "circle method" round-robin scheduling algorithm.
 * With an even number of teams, one team is fixed and all others rotate.
 * With an odd number, a "bye" is added.
 */
export function buildRoundRobinFixtures(
  participants: RoundRobinParticipant[]
): RoundRobinFixtures {
  if (participants.length < 2) {
    throw new Error("At least 2 participants are required.");
  }

  const teams = [...participants];
  const hasBye = teams.length % 2 !== 0;
  if (hasBye) {
    teams.push({ id: "__bye__", name: "BYE" });
  }

  const n = teams.length;
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;

  const rounds: RoundRobinRound[] = [];

  // Fix the last team, rotate all others
  const fixed = teams[n - 1];
  const rotating = teams.slice(0, n - 1);

  for (let round = 0; round < totalRounds; round++) {
    const matches: RoundRobinMatch[] = [];
    const currentTeams = [fixed, ...rotating];

    for (let matchIdx = 0; matchIdx < matchesPerRound; matchIdx++) {
      const home = currentTeams[matchIdx];
      const away = currentTeams[n - 1 - matchIdx];

      const isBye = home.id === "__bye__" || away.id === "__bye__";
      const homeReal = home.id === "__bye__" ? null : home;
      const awayReal = away.id === "__bye__" ? null : away;

      matches.push({
        id: `rr-r${round + 1}m${matchIdx + 1}`,
        roundIndex: round + 1,
        matchIndex: matchIdx + 1,
        homeParticipantId: homeReal?.id ?? null,
        awayParticipantId: awayReal?.id ?? null,
        homeLabel: homeReal?.name ?? null,
        awayLabel: awayReal?.name ?? null,
        isBye,
      });
    }

    rounds.push({
      roundIndex: round + 1,
      title: `Matchday ${round + 1}`,
      matches,
    });

    // Rotate: move last element of rotating to front
    rotating.unshift(rotating.pop()!);
  }

  const realMatches = rounds
    .flatMap((r) => r.matches)
    .filter((m) => !m.isBye);

  return {
    format: "ROUND_ROBIN",
    participantCount: participants.length,
    totalRounds,
    totalMatches: realMatches.length,
    rounds,
  };
}