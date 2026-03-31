import {
  type Fixture,
  type Participant,
  type Stage,
  type Tournament as PrismaTournament,
  type PerformanceEntry as PrismaPerformanceEntry,
} from "@prisma/client";
import { sportsCatalog } from "../data/sports.js";
import { prisma } from "../db.js";
import { buildSingleEliminationBracket } from "../engine/singleElimination.js";
import { buildRoundRobinFixtures } from "../engine/roundRobin.js";
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

function mapTournament(record: PrismaTournament): Tournament {
  return {
    id: record.id,
    name: record.name,
    sportId: record.sportId,
    sportName: record.sportName,
    format: record.format as CompetitionFormat,
    rankingRule: record.rankingRule as RankingRule,
    status: record.status as Tournament["status"],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapParticipant(record: Participant): TournamentParticipant {
  return {
    id: record.id,
    name: record.name,
    seed: record.seed,
    type: record.type as TournamentParticipant["type"],
    createdAt: record.createdAt.toISOString()
  };
}

function mapStage(record: Stage): TournamentStage {
  return {
    id: record.id,
    name: record.name,
    sequence: record.sequence,
    format: record.format as CompetitionFormat,
    rankingRule: record.rankingRule as RankingRule,
    status: record.status as StageStatus,
    createdAt: record.createdAt.toISOString()
  };
}

function mapFixture(record: Fixture): StageFixture {
  const r = record as Fixture & { leftScore?: number | null; rightScore?: number | null };
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
    autoAdvanceParticipantId: record.autoAdvanceParticipantId
  };
}

// ── Tournament CRUD ──────────────────────────────────────────────────────────

type CreateTournamentInput = { name: string; sportId: number };
type AddParticipantsInput = { tournamentId: string; participantNames: string[] };
type GenerateStageInput = { tournamentId: string; stageName?: string };

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
      status: "DRAFT"
    }
  });

  return mapTournament(record);
}

// ── Participants ──────────────────────────────────────────────────────────────

export async function listParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  const records = await prisma.participant.findMany({
    where: { tournamentId },
    orderBy: [{ seed: "asc" }, { createdAt: "asc" }]
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
    select: { name: true }
  });

  const existingNames = new Set(existing.map((p) => p.name));
  const toCreate = normalizedNames.filter((n) => !existingNames.has(n));

  if (toCreate.length === 0) return listParticipants(input.tournamentId);

  const maxSeed = await prisma.participant.aggregate({
    where: { tournamentId: input.tournamentId },
    _max: { seed: true }
  });

  let nextSeed = (maxSeed._max.seed ?? 0) + 1;

  await prisma.$transaction(
    toCreate.map((name) =>
      prisma.participant.create({
        data: { tournamentId: input.tournamentId, name, type: "TEAM", seed: nextSeed++ }
      })
    )
  );

  return listParticipants(input.tournamentId);
}

// ── Stages ────────────────────────────────────────────────────────────────────

export async function listStages(tournamentId: string): Promise<TournamentStage[]> {
  const records = await prisma.stage.findMany({
    where: { tournamentId },
    orderBy: { sequence: "asc" }
  });
  return records.map(mapStage);
}

async function getNextSequence(tournamentId: string): Promise<number> {
  const stages = await prisma.stage.findMany({
    where: { tournamentId },
    select: { sequence: true }
  });
  return stages.length > 0 ? Math.max(...stages.map((s) => s.sequence)) + 1 : 1;
}

export async function generateSingleEliminationStage(
  input: GenerateStageInput
): Promise<{ stage: TournamentStage; fixtures: StageFixture[]; bracket: ReturnType<typeof buildSingleEliminationBracket> }> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      participants: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }] },
      stages: { select: { sequence: true } }
    }
  });

  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.participants.length < 2) throw new Error("Add at least 2 participants before generating a stage.");

  const bracket = buildSingleEliminationBracket(
    tournament.participants.map((p) => ({ name: p.name, seed: p.seed ?? undefined }))
  );

  const nextSequence = await getNextSequence(input.tournamentId);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSequence,
      name: input.stageName?.trim() || `Single Elimination — Stage ${nextSequence}`,
      format: "SINGLE_ELIMINATION",
      rankingRule: tournament.rankingRule,
      status: "DRAFT"
    }
  });

  const participantBySeed = new Map<number, Participant>();
  tournament.participants.forEach((p) => { if (p.seed) participantBySeed.set(p.seed, p); });

  await prisma.fixture.createMany({
    data: bracket.rounds.flatMap((round) =>
      round.matches.map((match) => {
        const leftP = match.left.seed ? participantBySeed.get(match.left.seed) : undefined;
        const rightP = match.right.seed ? participantBySeed.get(match.right.seed) : undefined;
        const autoP = match.autoAdvanceWinner
          ? tournament.participants.find((p) => p.name === match.autoAdvanceWinner)
          : undefined;

        return {
          stageId: stage.id,
          roundIndex: round.roundIndex,
          matchIndex: match.matchIndex,
          leftParticipantId: leftP?.id,
          rightParticipantId: rightP?.id,
          leftLabel: match.left.participantName,
          rightLabel: match.right.participantName,
          status: match.status === "AUTO_ADVANCE" ? "AUTO_ADVANCE" : match.status === "PENDING" ? "PENDING" : "SCHEDULED",
          autoAdvanceParticipantId: autoP?.id
        };
      })
    )
  });

  const fixtures = await listFixturesByStage(stage.id);
  return { stage: mapStage(stage), fixtures, bracket };
}

export async function generateRoundRobinStage(
  input: GenerateStageInput
): Promise<{ stage: TournamentStage; fixtures: StageFixture[]; schedule: ReturnType<typeof buildRoundRobinFixtures> }> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      participants: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }] },
    }
  });

  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.participants.length < 2) throw new Error("Add at least 2 participants before generating a stage.");

  const schedule = buildRoundRobinFixtures(
    tournament.participants.map((p) => ({ id: p.id, name: p.name, seed: p.seed ?? undefined }))
  );

  const nextSequence = await getNextSequence(input.tournamentId);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSequence,
      name: input.stageName?.trim() || `Round Robin — Stage ${nextSequence}`,
      format: "ROUND_ROBIN",
      rankingRule: tournament.rankingRule,
      status: "DRAFT"
    }
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
    }))
  });

  const fixtures = await listFixturesByStage(stage.id);
  return { stage: mapStage(stage), fixtures, schedule };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

export async function listFixturesByStage(stageId: string): Promise<StageFixture[]> {
  const records = await prisma.fixture.findMany({
    where: { stageId },
    orderBy: [{ roundIndex: "asc" }, { matchIndex: "asc" }]
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
    } as any
  });

  return mapFixture(updated);
}

// ── Standings ─────────────────────────────────────────────────────────────────

export async function getStandingsByStage(stageId: string): Promise<StandingRow[]> {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      fixtures: true,
      tournament: {
        include: { participants: true }
      }
    }
  });

  if (!stage) throw new Error("Stage not found.");

  const participants = stage.tournament.participants.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  const fixtures = stage.fixtures.map((f) => {
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

export async function addPerformanceEntry(input: AddPerformanceInput): Promise<PerformanceEntryRecord> {
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
    }
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

  return entries.map((e) => ({
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