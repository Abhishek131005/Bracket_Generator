import {
  type Fixture,
  type Participant,
  type Stage,
  type Tournament as PrismaTournament
} from "@prisma/client";
import { sportsCatalog } from "../data/sports.js";
import { prisma } from "../db.js";
import { buildSingleEliminationBracket } from "../engine/singleElimination.js";
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
  status: FixtureStatus;
  autoAdvanceParticipantId: string | null;
}

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
  return {
    id: record.id,
    roundIndex: record.roundIndex,
    matchIndex: record.matchIndex,
    leftParticipantId: record.leftParticipantId,
    rightParticipantId: record.rightParticipantId,
    leftLabel: record.leftLabel,
    rightLabel: record.rightLabel,
    status: record.status as FixtureStatus,
    autoAdvanceParticipantId: record.autoAdvanceParticipantId
  };
}

type CreateTournamentInput = {
  name: string;
  sportId: number;
};

type AddParticipantsInput = {
  tournamentId: string;
  participantNames: string[];
};

type GenerateSingleEliminationStageInput = {
  tournamentId: string;
  stageName?: string;
};

export async function listTournaments(): Promise<Tournament[]> {
  const tournaments = await prisma.tournament.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  return tournaments.map(mapTournament);
}

export async function getTournamentById(id: string): Promise<Tournament | undefined> {
  const tournament = await prisma.tournament.findUnique({
    where: { id }
  });

  return tournament ? mapTournament(tournament) : undefined;
}

export async function createTournament(input: CreateTournamentInput): Promise<Tournament> {
  const sport = sportsCatalog.find((item) => item.id === input.sportId);

  if (!sport) {
    throw new Error("Sport does not exist in catalog.");
  }

  const tournament = await prisma.tournament.create({
    data: {
      name: input.name,
      sportId: sport.id,
      sportName: sport.name,
      format: sport.format,
      rankingRule: sport.rankingRule,
      status: "DRAFT"
    }
  });

  return mapTournament(tournament);
}

export async function listParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  const participants = await prisma.participant.findMany({
    where: { tournamentId },
    orderBy: [
      { seed: "asc" },
      { createdAt: "asc" }
    ]
  });

  return participants.map(mapParticipant);
}

export async function addParticipants(input: AddParticipantsInput): Promise<TournamentParticipant[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId }
  });

  if (!tournament) {
    throw new Error("Tournament not found.");
  }

  const normalizedNames = Array.from(
    new Set(input.participantNames.map((name) => name.trim()).filter((name) => name.length > 0))
  );

  if (normalizedNames.length === 0) {
    throw new Error("No valid participants to add.");
  }

  const existingParticipants = await prisma.participant.findMany({
    where: {
      tournamentId: input.tournamentId,
      name: { in: normalizedNames }
    },
    select: {
      name: true
    }
  });

  const existingNames = new Set(existingParticipants.map((participant) => participant.name));
  const namesToCreate = normalizedNames.filter((name) => !existingNames.has(name));

  if (namesToCreate.length === 0) {
    return listParticipants(input.tournamentId);
  }

  const maxSeed = await prisma.participant.aggregate({
    where: { tournamentId: input.tournamentId },
    _max: {
      seed: true
    }
  });

  let nextSeed = (maxSeed._max.seed ?? 0) + 1;

  await prisma.$transaction(
    namesToCreate.map((name) =>
      prisma.participant.create({
        data: {
          tournamentId: input.tournamentId,
          name,
          type: "TEAM",
          seed: nextSeed++
        }
      })
    )
  );

  return listParticipants(input.tournamentId);
}

export async function listStages(tournamentId: string): Promise<TournamentStage[]> {
  const stages = await prisma.stage.findMany({
    where: { tournamentId },
    orderBy: {
      sequence: "asc"
    }
  });

  return stages.map(mapStage);
}

export async function listFixturesByStage(stageId: string): Promise<StageFixture[]> {
  const fixtures = await prisma.fixture.findMany({
    where: { stageId },
    orderBy: [
      { roundIndex: "asc" },
      { matchIndex: "asc" }
    ]
  });

  return fixtures.map(mapFixture);
}

export async function generateSingleEliminationStage(
  input: GenerateSingleEliminationStageInput
): Promise<{ stage: TournamentStage; fixtures: StageFixture[]; bracket: ReturnType<typeof buildSingleEliminationBracket> }> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId },
    include: {
      participants: {
        orderBy: [
          { seed: "asc" },
          { createdAt: "asc" }
        ]
      },
      stages: {
        select: {
          sequence: true
        }
      }
    }
  });

  if (!tournament) {
    throw new Error("Tournament not found.");
  }

  if (tournament.participants.length < 2) {
    throw new Error("Add at least 2 participants before generating a stage.");
  }

  const bracket = buildSingleEliminationBracket(
    tournament.participants.map((participant) => ({
      name: participant.name,
      seed: participant.seed ?? undefined
    }))
  );

  const nextSequence = tournament.stages.length > 0
    ? Math.max(...tournament.stages.map((stage) => stage.sequence)) + 1
    : 1;

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      sequence: nextSequence,
      name: input.stageName?.trim() || `Single Elimination - Stage ${nextSequence}`,
      format: "SINGLE_ELIMINATION",
      rankingRule: tournament.rankingRule,
      status: "DRAFT"
    }
  });

  const participantBySeed = new Map<number, Participant>();
  tournament.participants.forEach((participant) => {
    if (participant.seed) {
      participantBySeed.set(participant.seed, participant);
    }
  });

  await prisma.fixture.createMany({
    data: bracket.rounds.flatMap((round) =>
      round.matches.map((match) => {
        const leftParticipant = match.left.seed ? participantBySeed.get(match.left.seed) : undefined;
        const rightParticipant = match.right.seed ? participantBySeed.get(match.right.seed) : undefined;

        const autoAdvanceParticipant = match.autoAdvanceWinner
          ? tournament.participants.find((participant) => participant.name === match.autoAdvanceWinner)
          : undefined;

        return {
          stageId: stage.id,
          roundIndex: round.roundIndex,
          matchIndex: match.matchIndex,
          leftParticipantId: leftParticipant?.id,
          rightParticipantId: rightParticipant?.id,
          leftLabel: match.left.participantName,
          rightLabel: match.right.participantName,
          status: match.status === "AUTO_ADVANCE" ? "AUTO_ADVANCE" : match.status === "PENDING" ? "PENDING" : "SCHEDULED",
          autoAdvanceParticipantId: autoAdvanceParticipant?.id
        };
      })
    )
  });

  const fixtures = await listFixturesByStage(stage.id);

  return {
    stage: mapStage(stage),
    fixtures,
    bracket
  };
}
