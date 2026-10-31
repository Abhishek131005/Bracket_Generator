import { sportsCatalog } from "../data/sports.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { buildSingleEliminationBracket } from "../engine/singleElimination.js";
import { buildRoundRobinFixtures } from "../engine/roundRobin.js";
import { buildDoubleEliminationBracket } from "../engine/doubleElimination.js";
import { buildSwissFixtures, generateSwissRoundPairings } from "../engine/swiss.js";
import { calculateStandings, calculateLeaderboard } from "../engine/standings.js";
import { buildHeatsPlusFinalStructure, type HeatsPlusFinalStructure } from "../engine/heatsPlusFinal.js";
import { buildMultiEventConfig, type MultiEventPointsStructure } from "../engine/multiEventPoints.js";
import { deriveStageStatus, deriveTournamentStatus, isFixtureBasedFormat } from "../engine/status.js";
import { DownstreamPlayedError, collectDescendantCodes, singleEliminationNext, winnerSide } from "../engine/progression.js";
import { CompetitionFormat, RankingRule, Tournament } from "../types.js";

type StageStatus = "DRAFT" | "PUBLISHED" | "IN_PROGRESS" | "COMPLETED";
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
  config?: Record<string, unknown> | null;
  createdAt: string;
}

export interface StageFixture {
  id: string;
  stageId: string;
  code?: string | null;
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
  winnerGoesTo?: string | null;
  loserGoesTo?: string | null;
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
  fixtureId: string | null;
  participantId: string;
  participantName: string;
  metricValue: number;
  unit: string | null;
  rank: number | null;
  metadata: string | null;
  createdAt: string;
}

function serializeMetadata(value: string | null): string | null {
  return value;
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
    config: record.config ? JSON.parse(record.config) : null,
    createdAt: record.createdAt.toISOString(),
  };
}

function mapFixture(record: any): StageFixture {
  const r = record as any & {
    code?: string | null;
    leftScore?: number | null;
    rightScore?: number | null;
    bracket?: string | null;
    winnerGoesTo?: string | null;
    loserGoesTo?: string | null;
  };
  return {
    id: record.id,
    code: r.code ?? null,
    roundIndex: record.roundIndex,
    matchIndex: record.matchIndex,
    leftParticipantId: record.leftParticipantId,
    rightParticipantId: record.rightParticipantId,
    leftLabel: record.leftLabel,
    rightLabel: record.rightLabel,
    leftScore: r.leftScore ?? null,
    rightScore: r.rightScore ?? null,
    status: record.status as FixtureStatus,
    stageId: record.stageId,
    autoAdvanceParticipantId: record.autoAdvanceParticipantId,
    bracket: r.bracket ?? null,
    winnerGoesTo: r.winnerGoesTo ?? null,
    loserGoesTo: r.loserGoesTo ?? null,
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

// ── Status workflow ───────────────────────────────────────────────────────────
// The rules live in engine/status.ts; these helpers load the data and save the result.

/** Recompute a tournament's status from its stages. */
export async function refreshTournamentStatus(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { stages: { select: { status: true, format: true, sequence: true } } },
  });
  if (!tournament) return;

  const next = deriveTournamentStatus({
    current: tournament.status as Parameters<typeof deriveTournamentStatus>[0]["current"],
    stages: tournament.stages,
  });
  if (next !== tournament.status) {
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: next } });
  }
}

/** Recompute a stage's status (and then its tournament's) after results change. */
export async function refreshStageStatus(stageId: string): Promise<void> {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      fixtures: { select: { code: true, status: true, leftParticipantId: true, rightParticipantId: true } },
      _count: { select: { performanceEntries: true } },
    },
  });
  if (!stage) return;

  const next = deriveStageStatus({
    format: stage.format,
    current: stage.status as StageStatus,
    fixtures: stage.fixtures,
    performanceCount: stage._count.performanceEntries,
  });
  if (next !== stage.status) {
    await prisma.stage.update({ where: { id: stageId }, data: { status: next } });
  }
  await refreshTournamentStatus(stage.tournamentId);
}

/**
 * Organiser action for leaderboard-style stages (heats, direct final, judged, multi-event):
 * there is no "last match", so a person decides when the stage is finished.
 */
export async function setStageStatus(stageId: string, status: "IN_PROGRESS" | "COMPLETED"): Promise<TournamentStage> {
  const stage = await prisma.stage.findUnique({ where: { id: stageId } });
  if (!stage) throw new Error("Stage not found.");
  if (isFixtureBasedFormat(stage.format)) {
    throw new Error("Match-based stages complete automatically once every match is finished.");
  }
  const updated = await prisma.stage.update({ where: { id: stageId }, data: { status } });
  await refreshTournamentStatus(stage.tournamentId);
  return mapStage(updated);
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
      const status =
        match.status === "AUTO_ADVANCE"
          ? "AUTO_ADVANCE"
          : match.status === "PENDING"
          ? "PENDING"
          : "SCHEDULED";

      return {
        stageId: stage.id,
        code: match.id,
        bracket: match.bracket,
        roundIndex: roundOffsetByBracket[match.bracket] + match.roundIndex,
        matchIndex: match.matchIndex,
        leftParticipantId: leftP?.id ?? null,
        rightParticipantId: rightP?.id ?? null,
        leftLabel: match.leftLabel,
        rightLabel: match.rightLabel,
        winnerGoesTo: match.winnerGoesTo,
        loserGoesTo: match.loserGoesTo,
        status,
        autoAdvanceParticipantId: autoP?.id ?? null,
      };
    })
  );

  await prisma.fixture.createMany({ data: allMatches });

  // Seed downstream rounds immediately when WR round 1 has byes.
  await recalculateDoubleEliminationProgress(stage.id);

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

  await refreshStageStatus(stageId);
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

// ── Heats + Final ─────────────────────────────────────────────────────────────

export async function generateHeatsPlusFinalStage(
  input: GenerateStageInput & { participantsPerHeat?: number }
): Promise<{
  stage: TournamentStage;
  structure: HeatsPlusFinalStructure;
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

  const participantsInput = tournament.participants.map((p: any) => ({
    id: p.id,
    name: p.name,
    seed: p.seed ?? undefined,
  }));

  const structure = buildHeatsPlusFinalStructure(
    participantsInput,
    input.participantsPerHeat
  );

  const nextSequence = await getNextSequence(input.tournamentId);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSequence,
      name: input.stageName?.trim() || `Heats — Stage ${nextSequence}`,
      format: "HEATS_PLUS_FINAL",
      rankingRule: tournament.rankingRule,
      status: "DRAFT",
      config: JSON.stringify(structure),
    },
  });

  return { stage: mapStage(stage), structure };
}

export async function generateMultiEventPointsStage(
  input: GenerateStageInput & { eventNames?: string[] }
): Promise<{ stage: TournamentStage; structure: MultiEventPointsStructure }> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      participants: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.participants.length < 2)
    throw new Error("Add at least 2 participants before generating a stage.");

  const { participantCount, events } = buildMultiEventConfig(
    tournament.participants.length,
    input.eventNames
  );

  const nextSeq = await getNextSequence(input.tournamentId);

  // Create the stage without config first (we need fixture IDs)
  const stageRecord = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSeq,
      name: input.stageName?.trim() || `Multi-Event — Stage ${nextSeq}`,
      format: "MULTI_EVENT_POINTS",
      rankingRule: "AGGREGATE_POINTS_DESC",
      status: "DRAFT",
      config: null,
    },
  });

  // Create one fixture per event (no participants — just a named slot)
  await prisma.fixture.createMany({
    data: events.map((ev) => ({
      stageId: stageRecord.id,
      code: `event-${ev.index + 1}`,
      roundIndex: 0,
      matchIndex: ev.index,
      leftLabel: ev.name,
      status: "IN_PROGRESS",
    })),
  });

  // Fetch fixtures in order to get their DB-generated IDs
  const fixtureRecords = await prisma.fixture.findMany({
    where: { stageId: stageRecord.id },
    orderBy: { matchIndex: "asc" },
  });

  const structure: MultiEventPointsStructure = {
    format: "MULTI_EVENT_POINTS",
    participantCount,
    eventCount: events.length,
    events: fixtureRecords.map((f: any, i: number) => ({
      id: f.id,
      index: i,
      name: f.leftLabel ?? `Event ${i + 1}`,
    })),
  };

  const updatedStage = await prisma.stage.update({
    where: { id: stageRecord.id },
    data: { config: JSON.stringify(structure) },
  });

  return { stage: mapStage(updatedStage), structure };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

export async function listFixturesByStage(stageId: string): Promise<StageFixture[]> {
  const records = await prisma.fixture.findMany({
    where: { stageId },
    orderBy: [{ roundIndex: "asc" }, { matchIndex: "asc" }],
  });
  return records.map(mapFixture);
}

type UpdateFixtureInput = {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  /** Allow a correction that resets already-played downstream matches. */
  confirmReset?: boolean;
};

const SLOT_PLACEHOLDER = "Winner of previous match";

/** Winner of a fixture as it is stored right now (null if unplayed or drawn). */
function storedWinnerId(fixture: any): string | null {
  if (fixture.status !== "COMPLETED") return null;
  const side = winnerSide(fixture.leftScore, fixture.rightScore);
  return side === "left" ? fixture.leftParticipantId : side === "right" ? fixture.rightParticipantId : null;
}

/**
 * Single elimination: the matches that currently carry this fixture's winner forward.
 * The first entry is the next match; the walk continues only while those matches were played.
 */
function singleEliminationChain(fixture: any, all: any[]): { fixture: any; slot: "left" | "right" }[] {
  const chain: { fixture: any; slot: "left" | "right" }[] = [];
  let current = fixture;
  for (;;) {
    const next = singleEliminationNext(current.roundIndex, current.matchIndex);
    const target = all.find((f) => f.roundIndex === next.roundIndex && f.matchIndex === next.matchIndex);
    if (!target) break;
    chain.push({ fixture: target, slot: next.slot });
    if (target.status !== "COMPLETED") break;
    current = target;
  }
  return chain;
}

const CLEARED_FIXTURE = {
  leftParticipantId: null,
  rightParticipantId: null,
  leftLabel: null,
  rightLabel: null,
  leftScore: null,
  rightScore: null,
  autoAdvanceParticipantId: null,
  status: "PENDING",
};

export async function updateFixtureResult(input: UpdateFixtureInput): Promise<StageFixture> {
  const fixture = await prisma.fixture.findUnique({
    where: { id: input.fixtureId },
    include: { stage: true },
  });
  if (!fixture) throw new Error("Fixture not found.");

  if (!fixture.leftParticipantId || !fixture.rightParticipantId) {
    throw new Error("This match is not ready yet: both participants must be known before a score can be entered.");
  }
  if (fixture.status === "PENDING" || fixture.status === "AUTO_ADVANCE" || fixture.status === "CANCELLED") {
    throw new Error(`This match cannot be scored while it is ${fixture.status === "AUTO_ADVANCE" ? "a bye" : fixture.status.toLowerCase()}.`);
  }

  const isSingleElimination = fixture.stage.format === "SINGLE_ELIMINATION";
  const isDoubleElimination = fixture.stage.format === "DOUBLE_ELIMINATION";
  const isEliminationStage = isSingleElimination || isDoubleElimination;

  if (isEliminationStage && input.homeScore === input.awayScore) {
    throw new Error("Draws are not allowed in elimination brackets.");
  }

  // ── Correction of an already-played match ───────────────────────────────────
  // Changing only the scoreline is harmless. Changing the winner invalidates every match
  // that winner (or loser, in double elimination) was already placed into: check first,
  // before anything is written, then reset those matches after saving.
  const previousWinner = storedWinnerId(fixture);
  const newSide = winnerSide(input.homeScore, input.awayScore);
  const newWinner = newSide === "left" ? fixture.leftParticipantId : newSide === "right" ? fixture.rightParticipantId : null;
  const winnerChanged = isEliminationStage && previousWinner !== null && previousWinner !== newWinner;

  let seChain: { fixture: any; slot: "left" | "right" }[] = [];
  let deTargets: any[] = [];
  if (winnerChanged) {
    const all = await prisma.fixture.findMany({ where: { stageId: fixture.stageId } });
    if (isSingleElimination) {
      seChain = singleEliminationChain(fixture, all);
    } else if (fixture.code) {
      const codes = collectDescendantCodes(fixture.code, all as any[]);
      deTargets = all.filter((f: any) => f.code && codes.has(f.code));
    }
    const affected = [...seChain.map((c) => c.fixture), ...deTargets].filter((f) => f.status === "COMPLETED").length;
    if (affected > 0 && !input.confirmReset) throw new DownstreamPlayedError(affected);
  }

  const updated = await prisma.fixture.update({
    where: { id: input.fixtureId },
    data: {
      leftScore: input.homeScore,
      rightScore: input.awayScore,
      status: "COMPLETED",
    } as any,
  });

  if (winnerChanged) {
    if (isSingleElimination) {
      // Empty the slot that held the old winner (and reset the match it was played in).
      await prisma.$transaction(
        seChain.map(({ fixture: target, slot }) =>
          prisma.fixture.update({
            where: { id: target.id },
            data: {
              ...(slot === "left"
                ? { leftParticipantId: null, leftLabel: SLOT_PLACEHOLDER }
                : { rightParticipantId: null, rightLabel: SLOT_PLACEHOLDER }),
              leftScore: null,
              rightScore: null,
              autoAdvanceParticipantId: null,
              status: "PENDING",
            },
          } as any)
        )
      );
    } else {
      // Wipe everything routed from this match; the recalculation below re-routes whatever is still valid.
      await prisma.$transaction(
        deTargets.map((target) => prisma.fixture.update({ where: { id: target.id }, data: CLEARED_FIXTURE } as any))
      );
    }
  }

  if (isSingleElimination && (previousWinner === null || winnerChanged)) {
    await advanceSingleEliminationWinner(fixture.stageId, updated as any, input);
  }

  if (isDoubleElimination) {
    await recalculateDoubleEliminationProgress(fixture.stageId);
  }

  await refreshStageStatus(fixture.stageId);

  const refreshed = await prisma.fixture.findUnique({ where: { id: input.fixtureId } });
  return mapFixture(refreshed ?? updated);
}

/**
 * In single elimination, place the winner into the correct next-round slot.
 */
async function advanceSingleEliminationWinner(
  stageId: string,
  fixture: any,
  scores: { homeScore: number; awayScore: number }
): Promise<void> {
  const allFixtures = await prisma.fixture.findMany({ where: { stageId } });

  // Determine winner
  const homeWon = scores.homeScore > scores.awayScore;
  const winnerId = homeWon ? fixture.leftParticipantId : fixture.rightParticipantId;
  const winnerLabel = homeWon ? fixture.leftLabel : fixture.rightLabel;

  if (!winnerId || !winnerLabel) return;

  // The next match is round+1, matchIndex ceil(m/2); odd matches fill the left slot, even the right.
  const next = singleEliminationNext(fixture.roundIndex, fixture.matchIndex);

  const nextFixture = allFixtures.find(
    (f: any) => f.roundIndex === next.roundIndex && f.matchIndex === next.matchIndex
  );

  if (!nextFixture) return;

  const fillLeft = next.slot === "left";
  const nextLeftId = fillLeft ? winnerId : nextFixture.leftParticipantId;
  const nextLeftLabel = fillLeft ? winnerLabel : nextFixture.leftLabel;
  const nextRightId = fillLeft ? nextFixture.rightParticipantId : winnerId;
  const nextRightLabel = fillLeft ? nextFixture.rightLabel : winnerLabel;

  await prisma.fixture.update({
    where: { id: nextFixture.id },
    data: {
      leftParticipantId: nextLeftId,
      leftLabel: nextLeftLabel,
      rightParticipantId: nextRightId,
      rightLabel: nextRightLabel,
      status: nextLeftId && nextRightId ? "SCHEDULED" : "PENDING",
      autoAdvanceParticipantId: null,
    },
  } as any);
}

type ResolvedParticipant = {
  id: string;
  label: string;
};

function resolveWinnerFromFixture(fixture: any): ResolvedParticipant | null {
  if (fixture.status === "AUTO_ADVANCE") {
    if (fixture.leftParticipantId && fixture.leftLabel) {
      return { id: fixture.leftParticipantId, label: fixture.leftLabel };
    }
    if (fixture.rightParticipantId && fixture.rightLabel) {
      return { id: fixture.rightParticipantId, label: fixture.rightLabel };
    }
    return null;
  }

  if (fixture.status !== "COMPLETED") return null;
  if (fixture.leftScore == null || fixture.rightScore == null) return null;
  if (fixture.leftScore === fixture.rightScore) return null;

  if (fixture.leftScore > fixture.rightScore) {
    return fixture.leftParticipantId && fixture.leftLabel
      ? { id: fixture.leftParticipantId, label: fixture.leftLabel }
      : null;
  }

  return fixture.rightParticipantId && fixture.rightLabel
    ? { id: fixture.rightParticipantId, label: fixture.rightLabel }
    : null;
}

function resolveLoserFromFixture(fixture: any): ResolvedParticipant | null {
  if (fixture.status !== "COMPLETED") return null;
  if (fixture.leftScore == null || fixture.rightScore == null) return null;
  if (fixture.leftScore === fixture.rightScore) return null;
  if (!fixture.leftParticipantId || !fixture.rightParticipantId) return null;
  if (!fixture.leftLabel || !fixture.rightLabel) return null;

  if (fixture.leftScore > fixture.rightScore) {
    return { id: fixture.rightParticipantId, label: fixture.rightLabel };
  }

  return { id: fixture.leftParticipantId, label: fixture.leftLabel };
}

function parseDERoundCode(code: string | null | undefined): { bracket: "LOSERS"; roundIndex: number } | null {
  if (!code) return null;
  const losersMatch = code.match(/^LR(\d+)M\d+$/);
  if (!losersMatch) return null;
  return { bracket: "LOSERS", roundIndex: Number(losersMatch[1]) };
}

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(2, value)));
}

async function hydrateDoubleEliminationFixtureMetadata(stageId: string): Promise<void> {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      tournament: {
        include: {
          participants: true,
        },
      },
      fixtures: true,
    },
  });

  if (!stage) return;
  if (stage.format !== "DOUBLE_ELIMINATION") return;
  if (stage.tournament.participants.length < 2) return;

  const slots = nextPowerOfTwo(stage.tournament.participants.length);
  const winnersRoundCount = Math.log2(slots);
  const losersRoundCount = Math.max(0, 2 * (winnersRoundCount - 1));

  const participantInputs = [...stage.tournament.participants]
    .sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER))
    .map((participant, index) => ({
      name: participant.name,
      seed: participant.seed ?? index + 1,
    }));

  const template = buildDoubleEliminationBracket(participantInputs);
  const templateByCode = new Map<string, { winnerGoesTo: string | null; loserGoesTo: string | null; bracket: string }>();

  for (const round of template.allRounds) {
    for (const match of round.matches) {
      templateByCode.set(match.id, {
        winnerGoesTo: match.winnerGoesTo,
        loserGoesTo: match.loserGoesTo,
        bracket: match.bracket,
      });
    }
  }

  const updates = stage.fixtures.map((fixture: any) => {
    let bracket: "WINNERS" | "LOSERS" | "GRAND_FINAL";
    let localRoundIndex: number;

    if (fixture.roundIndex <= winnersRoundCount) {
      bracket = "WINNERS";
      localRoundIndex = fixture.roundIndex;
    } else if (fixture.roundIndex <= winnersRoundCount + losersRoundCount) {
      bracket = "LOSERS";
      localRoundIndex = fixture.roundIndex - winnersRoundCount;
    } else {
      bracket = "GRAND_FINAL";
      localRoundIndex = fixture.roundIndex - (winnersRoundCount + losersRoundCount);
    }

    const code =
      bracket === "WINNERS"
        ? `WR${localRoundIndex}M${fixture.matchIndex}`
        : bracket === "LOSERS"
        ? `LR${localRoundIndex}M${fixture.matchIndex}`
        : `GF1M${localRoundIndex}`;

    const templateMatch = templateByCode.get(code);

    return prisma.fixture.update({
      where: { id: fixture.id },
      data: {
        code,
        bracket,
        winnerGoesTo: templateMatch?.winnerGoesTo ?? null,
        loserGoesTo: templateMatch?.loserGoesTo ?? null,
      },
    } as any);
  });

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

function getPreferredSlotForDERoute(
  sourceFixture: any,
  targetFixture: any,
  routeType: "winner" | "loser"
): "left" | "right" | null {
  if (!targetFixture) return null;

  if (targetFixture.bracket === "GRAND_FINAL") {
    if (sourceFixture.bracket === "WINNERS" && routeType === "winner") return "left";
    if (sourceFixture.bracket === "LOSERS" && routeType === "winner") return "right";
  }

  if (targetFixture.bracket === "WINNERS") {
    return sourceFixture.matchIndex % 2 === 1 ? "left" : "right";
  }

  if (targetFixture.bracket === "LOSERS") {
    const targetRound = parseDERoundCode(targetFixture.code)?.roundIndex ?? 1;

    // WR1 losers pair into LR1 directly (odd/even split).
    if (sourceFixture.bracket === "WINNERS" && routeType === "loser") {
      if (targetRound === 1) return sourceFixture.matchIndex % 2 === 1 ? "left" : "right";
      // In later LB rounds, WB losers occupy the right side.
      return "right";
    }

    if (sourceFixture.bracket === "LOSERS" && routeType === "winner") {
      // Odd LB rounds are paired merges, even LB rounds are one-to-one receivers.
      if (targetRound % 2 === 1) return sourceFixture.matchIndex % 2 === 1 ? "left" : "right";
      return "left";
    }
  }

  return sourceFixture.matchIndex % 2 === 1 ? "left" : "right";
}

async function placeParticipantInTargetMatch(
  targetFixture: any,
  participant: ResolvedParticipant,
  preferredSlot: "left" | "right" | null
): Promise<boolean> {
  if (!targetFixture) return false;
  if (!participant.id || !participant.label) return false;

  if (
    targetFixture.leftParticipantId === participant.id ||
    targetFixture.rightParticipantId === participant.id
  ) {
    return false;
  }

  let nextLeftId: string | null = targetFixture.leftParticipantId ?? null;
  let nextLeftLabel: string | null = targetFixture.leftLabel ?? null;
  let nextRightId: string | null = targetFixture.rightParticipantId ?? null;
  let nextRightLabel: string | null = targetFixture.rightLabel ?? null;

  const fillLeft = () => {
    nextLeftId = participant.id;
    nextLeftLabel = participant.label;
  };

  const fillRight = () => {
    nextRightId = participant.id;
    nextRightLabel = participant.label;
  };

  if (preferredSlot === "left" && !nextLeftId) {
    fillLeft();
  } else if (preferredSlot === "right" && !nextRightId) {
    fillRight();
  } else if (!nextLeftId) {
    fillLeft();
  } else if (!nextRightId) {
    fillRight();
  } else {
    return false;
  }

  const nextStatus = nextLeftId && nextRightId ? "SCHEDULED" : "PENDING";

  await prisma.fixture.update({
    where: { id: targetFixture.id },
    data: {
      leftParticipantId: nextLeftId,
      leftLabel: nextLeftLabel,
      rightParticipantId: nextRightId,
      rightLabel: nextRightLabel,
      status: nextStatus,
      autoAdvanceParticipantId: null,
      leftScore: null,
      rightScore: null,
    },
  } as any);

  return true;
}

async function clearGrandFinalResetMatch(gf2: any): Promise<boolean> {
  const alreadyDormant =
    gf2.status === "PENDING" &&
    !gf2.leftParticipantId &&
    !gf2.rightParticipantId &&
    !gf2.leftLabel &&
    !gf2.rightLabel &&
    gf2.leftScore == null &&
    gf2.rightScore == null &&
    !gf2.autoAdvanceParticipantId;

  if (alreadyDormant) return false;

  await prisma.fixture.update({
    where: { id: gf2.id },
    data: {
      leftParticipantId: null,
      rightParticipantId: null,
      leftLabel: null,
      rightLabel: null,
      leftScore: null,
      rightScore: null,
      autoAdvanceParticipantId: null,
      status: "PENDING",
    },
  } as any);

  return true;
}

async function applyGrandFinalResetRules(fixtures: any[]): Promise<boolean> {
  const gf1 = fixtures.find((f) => f.code === "GF1M1");
  const gf2 = fixtures.find((f) => f.code === "GF1M2");

  if (!gf1 || !gf2) return false;

  const participantsReady =
    Boolean(gf1.leftParticipantId && gf1.leftLabel) &&
    Boolean(gf1.rightParticipantId && gf1.rightLabel);

  // If GF1 is not resolved, keep GF2 dormant.
  if (
    !participantsReady ||
    gf1.status !== "COMPLETED" ||
    gf1.leftScore == null ||
    gf1.rightScore == null ||
    gf1.leftScore === gf1.rightScore
  ) {
    return clearGrandFinalResetMatch(gf2);
  }

  const gf1WinnerId = gf1.leftScore > gf1.rightScore ? gf1.leftParticipantId : gf1.rightParticipantId;

  // WB finalist is placed on the left side of GF1; if they win, event ends at GF1.
  const wbFinalistWonGF1 = gf1WinnerId === gf1.leftParticipantId;
  if (wbFinalistWonGF1) {
    return clearGrandFinalResetMatch(gf2);
  }

  // LB finalist won GF1 => activate reset match with same two finalists.
  const matchesCurrentPairing =
    gf2.leftParticipantId === gf1.leftParticipantId &&
    gf2.rightParticipantId === gf1.rightParticipantId &&
    gf2.leftLabel === gf1.leftLabel &&
    gf2.rightLabel === gf1.rightLabel;

  if (gf2.status === "COMPLETED" && matchesCurrentPairing) {
    // Reset already played and valid.
    return false;
  }

  await prisma.fixture.update({
    where: { id: gf2.id },
    data: {
      leftParticipantId: gf1.leftParticipantId,
      leftLabel: gf1.leftLabel,
      rightParticipantId: gf1.rightParticipantId,
      rightLabel: gf1.rightLabel,
      leftScore: null,
      rightScore: null,
      autoAdvanceParticipantId: null,
      status: "SCHEDULED",
    },
  } as any);

  return true;
}

/**
 * Rebuild and advance DE state from all resolved fixtures.
 * This keeps downstream rounds synced for both normal results and byes.
 */
async function recalculateDoubleEliminationProgress(stageId: string): Promise<void> {
  await hydrateDoubleEliminationFixtureMetadata(stageId);

  for (let pass = 0; pass < 128; pass++) {
    const fixtures = (await prisma.fixture.findMany({
      where: { stageId },
      orderBy: [{ roundIndex: "asc" }, { matchIndex: "asc" }],
    })) as any[];

    const byCode = new Map<string, any>();
    for (const fixture of fixtures) {
      if (fixture.code) byCode.set(fixture.code, fixture);
    }

    let changed = false;

    for (const sourceFixture of fixtures) {
      if (sourceFixture.bracket === "GRAND_FINAL") {
        continue;
      }

      const winner = resolveWinnerFromFixture(sourceFixture);
      if (winner && sourceFixture.winnerGoesTo) {
        const targetFixture = byCode.get(sourceFixture.winnerGoesTo);
        const preferredSlot = getPreferredSlotForDERoute(sourceFixture, targetFixture, "winner");
        changed = (await placeParticipantInTargetMatch(targetFixture, winner, preferredSlot)) || changed;
      }

      const loser = resolveLoserFromFixture(sourceFixture);
      if (loser && sourceFixture.loserGoesTo) {
        const targetFixture = byCode.get(sourceFixture.loserGoesTo);
        const preferredSlot = getPreferredSlotForDERoute(sourceFixture, targetFixture, "loser");
        changed = (await placeParticipantInTargetMatch(targetFixture, loser, preferredSlot)) || changed;
      }
    }

    if (changed) continue;

    changed = (await applyGrandFinalResetRules(fixtures)) || changed;
    if (changed) continue;

    // If a match has one entrant and no unresolved feeders left, auto-advance it.
    for (const targetFixture of fixtures) {
      if (targetFixture.status === "COMPLETED" || targetFixture.status === "AUTO_ADVANCE") continue;
      if (!targetFixture.code) continue;
      if (targetFixture.code === "GF1M2") continue;

      const hasLeft = Boolean(targetFixture.leftParticipantId && targetFixture.leftLabel);
      const hasRight = Boolean(targetFixture.rightParticipantId && targetFixture.rightLabel);
      if (hasLeft === hasRight) continue;

      const feeders = fixtures.filter(
        (f) => f.winnerGoesTo === targetFixture.code || f.loserGoesTo === targetFixture.code
      );

      const hasUnresolvedFeeder = feeders.some((feeder) => {
        if (feeder.winnerGoesTo === targetFixture.code) {
          return resolveWinnerFromFixture(feeder) === null;
        }

        if (feeder.loserGoesTo === targetFixture.code) {
          // AUTO_ADVANCE has no loser to contribute.
          if (feeder.status === "AUTO_ADVANCE") return false;
          return resolveLoserFromFixture(feeder) === null;
        }

        return false;
      });

      if (hasUnresolvedFeeder) continue;

      const soleParticipantId = targetFixture.leftParticipantId ?? targetFixture.rightParticipantId;
      if (!soleParticipantId) continue;

      await prisma.fixture.update({
        where: { id: targetFixture.id },
        data: {
          status: "AUTO_ADVANCE",
          autoAdvanceParticipantId: soleParticipantId,
          leftScore: null,
          rightScore: null,
        },
      } as any);

      changed = true;
    }

    if (!changed) break;
  }
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
  fixtureId?: string;
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
      fixtureId: input.fixtureId ?? null,
      participantId: input.participantId,
      metricValue: input.metricValue,
      unit: input.unit ?? null,
      metadata: input.metadata ?? null,
    },
  });
  await refreshStageStatus(input.stageId);

  return {
    id: entry.id,
    stageId: entry.stageId,
    fixtureId: entry.fixtureId,
    participantId: entry.participantId,
    participantName: participant.name,
    metricValue: entry.metricValue,
    unit: entry.unit,
    rank: entry.rank,
    metadata: serializeMetadata(entry.metadata),
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
    fixtureId: e.fixtureId,
    participantId: e.participantId,
    participantName: e.participant.name,
    metricValue: e.metricValue,
    unit: e.unit,
    rank: e.rank,
    metadata: serializeMetadata(e.metadata),
    createdAt: e.createdAt.toISOString(),
  }));
}

export async function deletePerformanceEntry(entryId: string): Promise<{ stageId: string }> {
  const entry = await prisma.performanceEntry.findUniqueOrThrow({ where: { id: entryId }, select: { stageId: true } });
  await prisma.performanceEntry.delete({ where: { id: entryId } });
  return { stageId: entry.stageId };
}

// ── Direct Final / Judged Leaderboard ─────────────────────────────────────────

export async function generateLeaderboardStage(
  input: GenerateStageInput & { format: "DIRECT_FINAL" | "JUDGED_LEADERBOARD" }
): Promise<{ stage: TournamentStage }> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: { participants: true },
  });

  if (!tournament) throw new Error("Tournament not found.");
  if ((tournament.participants as any[]).length < 2)
    throw new Error("Add at least 2 participants before generating a stage.");

  const nextSequence = await getNextSequence(input.tournamentId);
  const rankingRule =
    input.format === "JUDGED_LEADERBOARD" ? "JUDGES_SCORE_DESC" : tournament.rankingRule;
  const defaultName =
    input.format === "JUDGED_LEADERBOARD"
      ? `Judged Event — Stage ${nextSequence}`
      : `Final — Stage ${nextSequence}`;

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSequence,
      name: input.stageName?.trim() || defaultName,
      format: input.format,
      rankingRule,
      status: "DRAFT",
      config: null,
    },
  });

  return { stage: mapStage(stage) };
}

// ── Deleting ──────────────────────────────────────────────────────────────────
// Database cascades remove everything underneath (stages -> fixtures -> performance entries).

export async function deleteTournament(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true } });
  if (!tournament) throw new Error("Tournament not found.");
  await prisma.tournament.delete({ where: { id: tournamentId } });
}

/** Deletes a stage and returns the tournament it belonged to (its status may change as a result). */
export async function deleteStage(stageId: string): Promise<{ tournamentId: string }> {
  const stage = await prisma.stage.findUnique({ where: { id: stageId }, select: { id: true, tournamentId: true } });
  if (!stage) throw new Error("Stage not found.");
  await prisma.stage.delete({ where: { id: stageId } });
  await refreshTournamentStatus(stage.tournamentId);
  return { tournamentId: stage.tournamentId };
}

/**
 * Removes a participant. Only allowed before any stage exists: once brackets or schedules
 * have been generated, removing someone would leave holes in them.
 * Remaining seeds are renumbered 1..n because the bracket builders assume contiguous seeds.
 */
export async function deleteParticipant(participantId: string): Promise<{ tournamentId: string }> {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { id: true, tournamentId: true },
  });
  if (!participant) throw new Error("Participant not found.");

  const stageCount = await prisma.stage.count({ where: { tournamentId: participant.tournamentId } });
  if (stageCount > 0) {
    throw new Error("Participants can't be removed once stages exist. Delete the stages first.");
  }

  await prisma.participant.delete({ where: { id: participantId } });

  // Close the gap. Going in ascending order, each new seed (<= old seed) is already free.
  const remaining = await prisma.participant.findMany({
    where: { tournamentId: participant.tournamentId },
    orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
    select: { id: true, seed: true },
  });
  const updates = remaining
    .map((p: { id: string; seed: number | null }, index: number) =>
      p.seed === index + 1 ? null : prisma.participant.update({ where: { id: p.id }, data: { seed: index + 1 } })
    )
    .filter((u): u is NonNullable<typeof u> => u !== null);
  if (updates.length > 0) await prisma.$transaction(updates);

  return { tournamentId: participant.tournamentId };
}