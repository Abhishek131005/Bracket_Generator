-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'PENDING', 'IN_PROGRESS', 'AUTO_ADVANCE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('INDIVIDUAL', 'TEAM');

-- CreateEnum
CREATE TYPE "BracketType" AS ENUM ('WINNERS', 'LOSERS', 'GRAND_FINAL');

-- CreateEnum
CREATE TYPE "CompetitionFormat" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'SWISS', 'LEAGUE_PLUS_PLAYOFF', 'HEATS_PLUS_FINAL', 'DIRECT_FINAL', 'MULTI_EVENT_POINTS', 'JUDGED_LEADERBOARD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RankingRule" AS ENUM ('HEAD_TO_HEAD_SCORE', 'POINTS_TABLE', 'TIME_ASC', 'DISTANCE_DESC', 'HEIGHT_DESC_WITH_COUNTBACK', 'JUDGES_SCORE_DESC', 'AGGREGATE_POINTS_DESC');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sportId" INTEGER NOT NULL,
    "sportName" TEXT NOT NULL,
    "format" "CompetitionFormat" NOT NULL,
    "rankingRule" "RankingRule" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "maxParticipants" INTEGER,
    "scheduledStartAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" INTEGER,
    "type" "ParticipantType" NOT NULL DEFAULT 'TEAM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "format" "CompetitionFormat" NOT NULL,
    "rankingRule" "RankingRule" NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "code" TEXT,
    "bracket" "BracketType",
    "roundIndex" INTEGER NOT NULL,
    "matchIndex" INTEGER NOT NULL,
    "leftParticipantId" TEXT,
    "rightParticipantId" TEXT,
    "leftLabel" TEXT,
    "rightLabel" TEXT,
    "winnerGoesTo" TEXT,
    "loserGoesTo" TEXT,
    "leftScore" DOUBLE PRECISION,
    "rightScore" DOUBLE PRECISION,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "autoAdvanceParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceEntry" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "fixtureId" TEXT,
    "participantId" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "rank" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "Tournament_sportId_idx" ON "Tournament"("sportId");

-- CreateIndex
CREATE INDEX "Participant_tournamentId_idx" ON "Participant"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_tournamentId_name_key" ON "Participant"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_tournamentId_seed_key" ON "Participant"("tournamentId", "seed");

-- CreateIndex
CREATE INDEX "Stage_tournamentId_status_idx" ON "Stage"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_tournamentId_sequence_key" ON "Stage"("tournamentId", "sequence");

-- CreateIndex
CREATE INDEX "Fixture_stageId_roundIndex_idx" ON "Fixture"("stageId", "roundIndex");

-- CreateIndex
CREATE INDEX "Fixture_stageId_status_idx" ON "Fixture"("stageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_stageId_roundIndex_matchIndex_key" ON "Fixture"("stageId", "roundIndex", "matchIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_stageId_code_key" ON "Fixture"("stageId", "code");

-- CreateIndex
CREATE INDEX "PerformanceEntry_stageId_participantId_idx" ON "PerformanceEntry"("stageId", "participantId");

-- CreateIndex
CREATE INDEX "PerformanceEntry_stageId_metricValue_idx" ON "PerformanceEntry"("stageId", "metricValue");

-- CreateIndex
CREATE INDEX "PerformanceEntry_fixtureId_idx" ON "PerformanceEntry"("fixtureId");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_leftParticipantId_fkey" FOREIGN KEY ("leftParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_rightParticipantId_fkey" FOREIGN KEY ("rightParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_autoAdvanceParticipantId_fkey" FOREIGN KEY ("autoAdvanceParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceEntry" ADD CONSTRAINT "PerformanceEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
