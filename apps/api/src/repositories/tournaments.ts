import { sportsCatalog } from "../data/sports.js";
import { prisma } from "../db.js";
import { buildSingleEliminationBracket } from "../engine/singleElimination.js";
import { buildRoundRobinFixtures } from "../engine/roundRobin.js";
import { buildDoubleEliminationBracket } from "../engine/doubleElimination.js";
import { buildSwissFixtures, generateSwissRoundPairings } from "../engine/swiss.js";
import { calculateStandings, calculateLeaderboard } from "../engine/standings.js";
import { CompetitionFormat, RankingRule, Tournament } from "../types.js";

type StageStatus = "DRAFT" | "PUBLISHED" | "COMPLETED";
type FixtureStatus = "SCHEDULED" | "PENDING" | "AUTO_ADVANCE" | "COMPLETED";

export interface TournamentParticipant {
  id: string;
  name: string;
  seed: number | null;
  type: "INDIVIDUAL" | "TEAM";
  createdAt: string;
}

export interface TournamentStage {
  id: string;
  name: string;
  sequence: number;
  format: CompetitionFormat;
  rankingRule: RankingRule;
  status: StageStatus;
  createdAt: string;
}

export interface StageFixture {
  id: string;
  roundIndex: number;
  matchIndex: number;
  leftParticipantId: string | null;
  rightParticipantId: string | null;
  leftLabel: string | null;
  rightLabel: string | null;
  leftScore: number | null;
  rightScore: number | null;
  status: FixtureStatus;
  autoAdvanceParticipantId: string | null;
  bracket?: string | null;
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

export interface PerformanceEntryRecord {
  id: string;
  stageId: string;
  participantId: string;
  participantName: string;
  metricValue: number;
  unit: string | null;
  rank: number | null;
  metadata: string | null;
  createdAt: string;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapTournament(record: any): Tournament {
  return {
    id: record.id,
    name: record.name,
    sportId: record.sportId,
    sportName: record.sportName,
    format: record.format as CompetitionFormat,
    rankingRule: record.rankingRule as RankingRule,
    status: record.status as Tournament["status"],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapParticipant(record: any): TournamentParticipant {
  return {
    id: record.id,
    name: record.name,
    seed: record.seed,
    type: record.type as TournamentParticipant["type"],
    createdAt: record.createdAt.toISOString(),
  };
}

function mapStage(record: any): TournamentStage {
  return {
    id: record.id,
    name: record.name,
    sequence: record.sequence,
    format: record.format as CompetitionFormat,
    rankingRule: record.rankingRule as RankingRule,
    status: record.status as StageStatus,
    createdAt: record.createdAt.toISOString(),
  };
}

function mapFixture(record: any): StageFixture {
  const r = record as any & {
    leftScore?: number | null;
    rightScore?: number | null;
    bracket?: string | null;
  };
  return {
    id: record.id,
    roundIndex: record.roundIndex,
    matchIndex: record.matchIndex,
    leftParticipantId: record.leftParticipantId,
    rightParticipantId: record.rightParticipantId,
    leftLabel: record.leftLabel,
    rightLabel: record.rightLabel,
    leftScore: r.leftScore ?? null,
    rightScore: r.rightScore ?? null,
    status: record.status as FixtureStatus,
    autoAdvanceParticipantId: record.autoAdvanceParticipantId,
    bracket: r.bracket ?? null,
  };
}

// ── Tournament CRUD ──────────────────────────────────────────────────────────

type CreateTournamentInput = { name: string; sportId: number };
type AddParticipantsInput = { tournamentId: string; participantNames: string[] };
type GenerateStageInput = { tournamentId: string; stageName?: string; totalRounds?: number };

export async function listTournaments(): Promise<Tournament[]> {
  const records = await prisma.tournament.findMany({ orderBy: { createdAt: "desc" } });
  return records.map(mapTournament);
}

export async function getTournamentById(id: string): Promise<Tournament | undefined> {
  const record = await prisma.tournament.findUnique({ where: { id } });
  return record ? mapTournament(record) : undefined;
}

export async function createTournament(input: CreateTournamentInput): Promise<Tournament> {
  const sport = sportsCatalog.find((item) => item.id === input.sportId);
  if (!sport) throw new Error("Sport does not exist in catalog.");

  const record = await prisma.tournament.create({
    data: {
      name: input.name,
      sportId: sport.id,
      sportName: sport.name,
      format: sport.format,
      rankingRule: sport.rankingRule,
      status: "DRAFT",
    },
  });

  return mapTournament(record);
}

// ── Participants ──────────────────────────────────────────────────────────────

export async function listParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  const records = await prisma.participant.findMany({
    where: { tournamentId },
    orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
  });
  return records.map(mapParticipant);
}

export async function addParticipants(input: AddParticipantsInput): Promise<TournamentParticipant[]> {
  const tournament = await prisma.tournament.findUnique({ where: { id: input.tournamentId } });
  if (!tournament) throw new Error("Tournament not found.");

  const normalizedNames = Array.from(
    new Set(input.participantNames.map((n) => n.trim()).filter((n) => n.length > 0))
  );
  if (normalizedNames.length === 0) throw new Error("No valid participants to add.");

  const existing = await prisma.participant.findMany({
    where: { tournamentId: input.tournamentId, name: { in: normalizedNames } },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((p: { name: string }) => p.name));
  const toCreate = normalizedNames.filter((n) => !existingNames.has(n));

  if (toCreate.length === 0) return listParticipants(input.tournamentId);

  const maxSeed = await prisma.participant.aggregate({
    where: { tournamentId: input.tournamentId },
    _max: { seed: true },
  });

  let nextSeed = (maxSeed._max.seed ?? 0) + 1;

  await prisma.$transaction(
    toCreate.map((name) =>
      prisma.participant.create({
        data: { tournamentId: input.tournamentId, name, type: "TEAM", seed: nextSeed++ },
      })
    )
  );

  return listParticipants(input.tournamentId);
}

// ── Stages ────────────────────────────────────────────────────────────────────

export async function listStages(tournamentId: string): Promise<TournamentStage[]> {
  const records = await prisma.stage.findMany({
    where: { tournamentId },
    orderBy: { sequence: "asc" },
  });
  return records.map(mapStage);
}

async function getNextSequence(tournamentId: string): Promise<number> {
  const stages = await prisma.stage.findMany({
    where: { tournamentId },
    select: { sequence: true },
  });
  return stages.length > 0 ? Math.max(...stages.map((s: { sequence: number }) => s.sequence)) + 1 : 1;
}

// ── Single Elimination ────────────────────────────────────────────────────────

export async function generateSingleEliminationStage(input: GenerateStageInput): Promise<{
  stage: TournamentStage;
  fixtures: StageFixture[];
  bracket: ReturnType<typeof buildSingleEliminationBracket>;
}> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      participants: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }] },
      stages: { select: { sequence: true } },
    },
  });

  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.participants.length < 2)
    throw new Error("Add at least 2 participants before generating a stage.");

  const bracket = buildSingleEliminationBracket(
    tournament.participants.map((p: { name: string; seed: number | null }) => ({ name: p.name, seed: p.seed ?? undefined }))
  );

  const nextSequence = await getNextSequence(input.tournamentId);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSequence,
      name: input.stageName?.trim() || `Single Elimination — Stage ${nextSequence}`,
      format: "SINGLE_ELIMINATION",
      rankingRule: tournament.rankingRule,
      status: "DRAFT",
    },
  });

  const participantBySeed = new Map<number, any>();
  tournament.participants.forEach((p: { name: string; seed: number | null; id: string }) => {
    if (p.seed) participantBySeed.set(p.seed, p as any);
  });

  await prisma.fixture.createMany({
    data: bracket.rounds.flatMap((round) =>
      round.matches.map((match) => {
        const leftP = match.left.seed ? participantBySeed.get(match.left.seed) : undefined;
        const rightP = match.right.seed ? participantBySeed.get(match.right.seed) : undefined;
        const autoP = match.autoAdvanceWinner
          ? tournament.participants.find((p: { name: string }) => p.name === match.autoAdvanceWinner)
          : undefined;

        return {
          stageId: stage.id,
          roundIndex: round.roundIndex,
          matchIndex: match.matchIndex,
          leftParticipantId: leftP?.id,
          rightParticipantId: rightP?.id,
          leftLabel: match.left.participantName,
          rightLabel: match.right.participantName,
          status:
            match.status === "AUTO_ADVANCE"
              ? "AUTO_ADVANCE"
              : match.status === "PENDING"
              ? "PENDING"
              : "SCHEDULED",
          autoAdvanceParticipantId: autoP?.id,
        };
      })
    ),
  });

  const fixtures = await listFixturesByStage(stage.id);
  return { stage: mapStage(stage), fixtures, bracket };
}

// ── Round Robin ───────────────────────────────────────────────────────────────

export async function generateRoundRobinStage(input: GenerateStageInput): Promise<{
  stage: TournamentStage;
  fixtures: StageFixture[];
  schedule: ReturnType<typeof buildRoundRobinFixtures>;
}> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      participants: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.participants.length < 2)
    throw new Error("Add at least 2 participants before generating a stage.");

  const schedule = buildRoundRobinFixtures(
    tournament.participants.map((p: any) => ({ id: p.id, name: p.name, seed: p.seed ?? undefined }))
  );

  const nextSequence = await getNextSequence(input.tournamentId);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSequence,
      name: input.stageName?.trim() || `Round Robin — Stage ${nextSequence}`,
      format: "ROUND_ROBIN",
      rankingRule: tournament.rankingRule,
      status: "DRAFT",
    },
  });

  const realMatches = schedule.rounds.flatMap((r) => r.matches).filter((m) => !m.isBye);

  await prisma.fixture.createMany({
    data: realMatches.map((match) => ({
      stageId: stage.id,
      roundIndex: match.roundIndex,
      matchIndex: match.matchIndex,
      leftParticipantId: match.homeParticipantId,
      rightParticipantId: match.awayParticipantId,
      leftLabel: match.homeLabel,
      rightLabel: match.awayLabel,
      status: "SCHEDULED",
      autoAdvanceParticipantId: null,
    })),
  });

  const fixtures = await listFixturesByStage(stage.id);
  return { stage: mapStage(stage), fixtures, schedule };
}

// ── Double Elimination ────────────────────────────────────────────────────────

export async function generateDoubleEliminationStage(input: GenerateStageInput): Promise<{
  stage: TournamentStage;
  fixtures: StageFixture[];
  bracket: ReturnType<typeof buildDoubleEliminationBracket>;
}> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      participants: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.participants.length < 2)
    throw new Error("Add at least 2 participants before generating a stage.");

  const bracket = buildDoubleEliminationBracket(
    tournament.participants.map((p: { name: string; seed: number | null }) => ({ name: p.name, seed: p.seed ?? undefined }))
  );

  const nextSequence = await getNextSequence(input.tournamentId);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSequence,
      name: input.stageName?.trim() || `Double Elimination — Stage ${nextSequence}`,
      format: "DOUBLE_ELIMINATION",
      rankingRule: tournament.rankingRule,
      status: "DRAFT",
    },
  });

  const participantByName = new Map<string, any>();
  tournament.participants.forEach((p: any) => participantByName.set(p.name, p));

  const winnersRoundCount = bracket.winnersRounds.length;
  const losersRoundCount = bracket.losersRounds.length;

  const roundOffsetByBracket: Record<"WINNERS" | "LOSERS" | "GRAND_FINAL", number> = {
    WINNERS: 0,
    LOSERS: winnersRoundCount,
    GRAND_FINAL: winnersRoundCount + losersRoundCount,
  };

  // Flatten all rounds from the bracket and persist
  const allMatches = bracket.allRounds.flatMap((round) =>
    round.matches.map((match) => {
      const leftP = match.leftLabel ? participantByName.get(match.leftLabel) : undefined;
      const rightP = match.rightLabel ? participantByName.get(match.rightLabel) : undefined;
      const autoP = match.autoAdvanceWinner
        ? participantByName.get(match.autoAdvanceWinner)
        : undefined;

      return {
        stageId: stage.id,
        roundIndex: roundOffsetByBracket[match.bracket] + match.roundIndex,
        matchIndex: match.matchIndex,
        leftParticipantId: leftP?.id ?? null,
        rightParticipantId: rightP?.id ?? null,
        leftLabel: match.leftLabel,
        rightLabel: match.rightLabel,
        status: match.status as string,
        autoAdvanceParticipantId: autoP?.id ?? null,
      };
    })
  );

  await prisma.fixture.createMany({ data: allMatches });

  const fixtures = await listFixturesByStage(stage.id);
  return { stage: mapStage(stage), fixtures, bracket };
}

// ── Swiss ─────────────────────────────────────────────────────────────────────

export async function generateSwissStage(input: GenerateStageInput): Promise<{
  stage: TournamentStage;
  fixtures: StageFixture[];
  schedule: ReturnType<typeof buildSwissFixtures>;
}> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      participants: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.participants.length < 2)
    throw new Error("Add at least 2 participants before generating a stage.");

  const schedule = buildSwissFixtures(
    tournament.participants.map((p: { id: string; name: string; seed: number | null }) => ({ id: p.id, name: p.name, seed: p.seed ?? undefined })),
    input.totalRounds
  );

  const nextSequence = await getNextSequence(input.tournamentId);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSequence,
      name: input.stageName?.trim() || `Swiss — Stage ${nextSequence}`,
      format: "SWISS",
      rankingRule: tournament.rankingRule,
      status: "DRAFT",
    },
  });

  const allMatches = schedule.rounds.flatMap((round) =>
    round.matches.map((match) => ({
      stageId: stage.id,
      roundIndex: match.roundIndex,
      matchIndex: match.matchIndex,
      leftParticipantId: match.homeParticipantId,
      rightParticipantId: match.awayParticipantId,
      leftLabel: match.homeLabel,
      rightLabel: match.awayLabel,
      status: match.isBye ? "AUTO_ADVANCE" : "SCHEDULED",
      autoAdvanceParticipantId: null,
    }))
  );

  await prisma.fixture.createMany({ data: allMatches });

  const fixtures = await listFixturesByStage(stage.id);
  return { stage: mapStage(stage), fixtures, schedule };
}

/**
 * Regenerate Swiss pairings for a specific round after scores are entered.
 * Replaces TBD fixtures in that round with real pairings.
 */
export async function regenerateSwissRoundPairings(
  stageId: string,
  roundIndex: number
): Promise<StageFixture[]> {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      fixtures: true,
      tournament: { include: { participants: true } },
    },
  });

  if (!stage) throw new Error("Stage not found.");
  if (stage.format !== "SWISS") throw new Error("Stage is not Swiss format.");

  const participants = stage.tournament.participants.map((p: { id: string; name: string; seed: number | null }) => ({
    id: p.id,
    name: p.name,
    seed: p.seed ?? undefined,
  }));

  // Collect completed results from all previous rounds
  const completedFixtures = stage.fixtures.filter(
    (f: any) => f.status === "COMPLETED" && f.roundIndex < roundIndex
  );

  const r = completedFixtures as Array<
    any & { leftScore?: number | null; rightScore?: number | null }
  >;

  const results = r
    .filter(
      (f) =>
        f.leftParticipantId &&
        f.rightParticipantId &&
        f.leftScore != null &&
        f.rightScore != null
    )
    .map((f) => ({
      homeId: f.leftParticipantId!,
      awayId: f.rightParticipantId!,
      homeScore: (f as any).leftScore as number,
      awayScore: (f as any).rightScore as number,
    }));

  const newPairings = generateSwissRoundPairings(participants, results, roundIndex);

  // Delete existing TBD fixtures for this round
  await prisma.fixture.deleteMany({
    where: { stageId, roundIndex },
  });

  // Create new pairings
  await prisma.fixture.createMany({
    data: newPairings.map((match) => ({
      stageId,
      roundIndex: match.roundIndex,
      matchIndex: match.matchIndex,
      leftParticipantId: match.homeParticipantId,
      rightParticipantId: match.awayParticipantId,
      leftLabel: match.homeLabel,
      rightLabel: match.awayLabel,
      status: match.isBye ? "AUTO_ADVANCE" : "SCHEDULED",
      autoAdvanceParticipantId: null,
    })),
  });

  return listFixturesByStage(stageId);
}

// ── League + Playoff ─────────────────────────────────────────────────────────

export async function generateLeaguePlusPlayoffStage(input: GenerateStageInput): Promise<{
  leagueStage: TournamentStage;
  leagueFixtures: StageFixture[];
  leagueSchedule: ReturnType<typeof buildRoundRobinFixtures>;
}> {
  // Phase 1: create the league (round-robin) stage
  // The playoff bracket stage is generated separately after league concludes
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      participants: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.participants.length < 2)
    throw new Error("Add at least 2 participants before generating a stage.");

  const schedule = buildRoundRobinFixtures(
    tournament.participants.map((p: any) => ({ id: p.id, name: p.name, seed: p.seed ?? undefined }))
  );

  const nextSequence = await getNextSequence(input.tournamentId);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSequence,
      name: input.stageName?.trim() || `League Stage — Stage ${nextSequence}`,
      format: "LEAGUE_PLUS_PLAYOFF",
      rankingRule: tournament.rankingRule,
      status: "DRAFT",
    },
  });

  const realMatches = schedule.rounds.flatMap((r) => r.matches).filter((m) => !m.isBye);

  await prisma.fixture.createMany({
    data: realMatches.map((match) => ({
      stageId: stage.id,
      roundIndex: match.roundIndex,
      matchIndex: match.matchIndex,
      leftParticipantId: match.homeParticipantId,
      rightParticipantId: match.awayParticipantId,
      leftLabel: match.homeLabel,
      rightLabel: match.awayLabel,
      status: "SCHEDULED",
      autoAdvanceParticipantId: null,
    })),
  });

  const leagueFixtures = await listFixturesByStage(stage.id);
  return { leagueStage: mapStage(stage), leagueFixtures, leagueSchedule: schedule };
}

/**
 * After league concludes, generate the playoff (SE) bracket using top N teams.
 */
export async function generatePlayoffStage(
  tournamentId: string,
  leagueStageId: string,
  playoffTeamCount: number,
  stageName?: string
): Promise<{
  stage: TournamentStage;
  fixtures: StageFixture[];
  bracket: ReturnType<typeof buildSingleEliminationBracket>;
}> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { participants: true },
  });

  if (!tournament) throw new Error("Tournament not found.");

  // Get standings from league stage
  const standings = await getStandingsByStage(leagueStageId);

  // Take top N teams
  const topTeams = standings.slice(0, playoffTeamCount);
  const participantsInput = topTeams.map((row, i) => ({
    name: row.participantName,
    seed: i + 1,
  }));

  if (participantsInput.length < 2) throw new Error("Not enough teams for playoff.");

  const bracket = buildSingleEliminationBracket(participantsInput);

  const nextSequence = await getNextSequence(tournamentId);

  const stage = await prisma.stage.create({
    data: {
      tournamentId,
      sequence: nextSequence,
      name: stageName?.trim() || `Playoffs — Stage ${nextSequence}`,
      format: "SINGLE_ELIMINATION",
      rankingRule: tournament.rankingRule,
      status: "DRAFT",
    },
  });

  // Map participant names back to IDs
  const participantByName = new Map<string, any>();
  tournament.participants.forEach((p: any) => participantByName.set(p.name, p));

  await prisma.fixture.createMany({
    data: bracket.rounds.flatMap((round) =>
      round.matches.map((match) => {
        const leftP = match.left.participantName
          ? participantByName.get(match.left.participantName)
          : undefined;
        const rightP = match.right.participantName
          ? participantByName.get(match.right.participantName)
          : undefined;
        const autoP = match.autoAdvanceWinner
          ? participantByName.get(match.autoAdvanceWinner)
          : undefined;

        return {
          stageId: stage.id,
          roundIndex: round.roundIndex,
          matchIndex: match.matchIndex,
          leftParticipantId: leftP?.id ?? null,
          rightParticipantId: rightP?.id ?? null,
          leftLabel: match.left.participantName,
          rightLabel: match.right.participantName,
          status: match.status === "AUTO_ADVANCE" ? "AUTO_ADVANCE" : match.status === "PENDING" ? "PENDING" : "SCHEDULED",
          autoAdvanceParticipantId: autoP?.id ?? null,
        };
      })
    ),
  });

  const fixtures = await listFixturesByStage(stage.id);
  return { stage: mapStage(stage), fixtures, bracket };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

export async function listFixturesByStage(stageId: string): Promise<StageFixture[]> {
  const records = await prisma.fixture.findMany({
    where: { stageId },
    orderBy: [{ roundIndex: "asc" }, { matchIndex: "asc" }],
  });
  return records.map(mapFixture);
}

type UpdateFixtureInput = { fixtureId: string; homeScore: number; awayScore: number };

export async function updateFixtureResult(input: UpdateFixtureInput): Promise<StageFixture> {
  const fixture = await prisma.fixture.findUnique({ where: { id: input.fixtureId } });
  if (!fixture) throw new Error("Fixture not found.");

  const updated = await prisma.fixture.update({
    where: { id: input.fixtureId },
    data: {
      leftScore: input.homeScore,
      rightScore: input.awayScore,
      status: "COMPLETED",
    } as any,
  });

  // Attempt to advance winner in single elimination bracket
  await advanceWinnerIfApplicable(fixture.stageId, updated as any, input);

  return mapFixture(updated);
}

/**
 * After a fixture result is entered, find the next match in the bracket
 * and set the winner's label there (for SE and DE brackets).
 */
async function advanceWinnerIfApplicable(
  stageId: string,
  fixture: any,
  scores: { homeScore: number; awayScore: number }
): Promise<void> {
  const stage = await prisma.stage.findUnique({ where: { id: stageId } });
  if (!stage) return;

  const isSE = stage.format === "SINGLE_ELIMINATION";
  const isDE = stage.format === "DOUBLE_ELIMINATION";

  if (!isSE && !isDE) return;

  const allFixtures = await prisma.fixture.findMany({ where: { stageId } });

  // Determine winner
  const homeWon = scores.homeScore > scores.awayScore;
  const winnerId = homeWon ? fixture.leftParticipantId : fixture.rightParticipantId;
  const winnerLabel = homeWon ? fixture.leftLabel : fixture.rightLabel;

  if (!winnerId || !winnerLabel) return;

  if (isSE) {
    // In SE, the next match in the next round is: matchIndex ceil(current/2)
    const nextRoundIndex = fixture.roundIndex + 1;
    const nextMatchIndex = Math.ceil(fixture.matchIndex / 2);

    const nextFixture = allFixtures.find(
      (f: any) => f.roundIndex === nextRoundIndex && f.matchIndex === nextMatchIndex
    );

    if (!nextFixture) return;

    // Winner fills left slot if current matchIndex is odd, right if even
    const fillLeft = fixture.matchIndex % 2 === 1;

    await prisma.fixture.update({
      where: { id: nextFixture.id },
      data: fillLeft
        ? { leftParticipantId: winnerId, leftLabel: winnerLabel, status: nextFixture.rightParticipantId || nextFixture.rightLabel ? "SCHEDULED" : "PENDING" }
        : { rightParticipantId: winnerId, rightLabel: winnerLabel, status: nextFixture.leftParticipantId || nextFixture.leftLabel ? "SCHEDULED" : "PENDING" },
    } as any);
  }
  // DE advancement is more complex; left as a future enhancement
}

// ── Standings ─────────────────────────────────────────────────────────────────

export async function getStandingsByStage(stageId: string): Promise<StandingRow[]> {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      fixtures: true,
      tournament: { include: { participants: true } },
    },
  });

  if (!stage) throw new Error("Stage not found.");

  const participants = stage.tournament.participants.map((p: any) => ({
    id: p.id,
    name: p.name,
  }));

  const fixtures = stage.fixtures.map((f: any) => {
    const r = f as typeof f & { leftScore?: number | null; rightScore?: number | null };
    return {
      id: f.id,
      homeParticipantId: f.leftParticipantId,
      awayParticipantId: f.rightParticipantId,
      homeScore: r.leftScore ?? null,
      awayScore: r.rightScore ?? null,
      status: f.status,
    };
  });

  return calculateStandings(participants, fixtures);
}

// ── Performance Entries ───────────────────────────────────────────────────────

type AddPerformanceInput = {
  stageId: string;
  participantId: string;
  metricValue: number;
  unit?: string;
  metadata?: string;
};

export async function addPerformanceEntry(
  input: AddPerformanceInput
): Promise<PerformanceEntryRecord> {
  const stage = await prisma.stage.findUnique({ where: { id: input.stageId } });
  if (!stage) throw new Error("Stage not found.");

  const participant = await prisma.participant.findUnique({ where: { id: input.participantId } });
  if (!participant) throw new Error("Participant not found.");

  const entry = await prisma.performanceEntry.create({
    data: {
      stageId: input.stageId,
      participantId: input.participantId,
      metricValue: input.metricValue,
      unit: input.unit ?? null,
      metadata: input.metadata ?? null,
    },
  });

  return {
    id: entry.id,
    stageId: entry.stageId,
    participantId: entry.participantId,
    participantName: participant.name,
    metricValue: entry.metricValue,
    unit: entry.unit,
    rank: entry.rank,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function listPerformanceEntries(stageId: string): Promise<PerformanceEntryRecord[]> {
  const entries = await prisma.performanceEntry.findMany({
    where: { stageId },
    include: { participant: true },
    orderBy: { metricValue: "asc" },
  });

  return entries.map((e: any) => ({
    id: e.id,
    stageId: e.stageId,
    participantId: e.participantId,
    participantName: e.participant.name,
    metricValue: e.metricValue,
    unit: e.unit,
    rank: e.rank,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
  }));
}

export async function deletePerformanceEntry(entryId: string): Promise<void> {
  await prisma.performanceEntry.delete({ where: { id: entryId } });
}