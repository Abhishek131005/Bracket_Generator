// apps/web/src/types.ts

export type PrimaryView = "BRACKET" | "STANDINGS" | "LEADERBOARD" | "HYBRID";

// ── Enums (mirrored from Prisma schema) ──────────────────────────────────────

export type TournamentStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type StageStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "IN_PROGRESS"
  | "COMPLETED";

export type FixtureStatus =
  | "SCHEDULED"
  | "PENDING"
  | "IN_PROGRESS"
  | "AUTO_ADVANCE"
  | "COMPLETED"
  | "CANCELLED";

export type ParticipantType = "INDIVIDUAL" | "TEAM";

export type BracketType = "WINNERS" | "LOSERS" | "GRAND_FINAL";

export type CompetitionFormat =
  | "SINGLE_ELIMINATION"
  | "DOUBLE_ELIMINATION"
  | "ROUND_ROBIN"
  | "SWISS"
  | "LEAGUE_PLUS_PLAYOFF"
  | "HEATS_PLUS_FINAL"
  | "DIRECT_FINAL"
  | "MULTI_EVENT_POINTS"
  | "JUDGED_LEADERBOARD"
  | "CUSTOM";

export type RankingRule =
  | "HEAD_TO_HEAD_SCORE"
  | "POINTS_TABLE"
  | "TIME_ASC"
  | "DISTANCE_DESC"
  | "HEIGHT_DESC_WITH_COUNTBACK"
  | "JUDGES_SCORE_DESC"
  | "AGGREGATE_POINTS_DESC";

// ── Sport Catalog ─────────────────────────────────────────────────────────────

export interface SportDefinition {
  id: number;
  name: string;
  format: CompetitionFormat;
  rankingRule: RankingRule;
  needsBracket: boolean;
  primaryView: PrimaryView;
  notes?: string;
}

// ── Core Domain Models ────────────────────────────────────────────────────────

export interface Tournament {
  id: string;
  name: string;
  sportId: number;
  sportName: string;
  format: CompetitionFormat;
  rankingRule: RankingRule;
  status: TournamentStatus;
  description?: string | null;
  maxParticipants?: number | null;
  scheduledStartAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Single Elimination ────────────────────────────────────────────────────────

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
  status: FixtureStatus;
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

// ── Double Elimination ────────────────────────────────────────────────────────

export interface DEMatch {
  id: string;
  bracket: BracketType;
  roundIndex: number;
  matchIndex: number;
  leftLabel: string | null;
  rightLabel: string | null;
  leftSeed: number | null;
  rightSeed: number | null;
  status: FixtureStatus;
  autoAdvanceWinner: string | null;
  winnerGoesTo: string | null;
  loserGoesTo: string | null;
}

export interface DERound {
  roundIndex: number;
  bracket: BracketType;
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

// ── Swiss ─────────────────────────────────────────────────────────────────────

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

export interface SwissSchedule {
  format: "SWISS";
  participantCount: number;
  totalRounds: number;
  totalMatches: number;
  rounds: SwissRound[];
}

// ── Round Robin ───────────────────────────────────────────────────────────────

export interface RoundRobinMatch {
  roundIndex: number;
  matchIndex: number;
  homeParticipantId: string;
  awayParticipantId: string;
  homeLabel: string;
  awayLabel: string;
  isBye: boolean;
}

export interface RoundRobinRound {
  roundIndex: number;
  matches: RoundRobinMatch[];
}

// ── Participants & Stages ─────────────────────────────────────────────────────

export interface TournamentParticipant {
  id: string;
  name: string;
  seed: number | null;
  type: ParticipantType;
  createdAt: string;
}

export interface TournamentStage {
  id: string;
  name: string;
  sequence: number;
  format: CompetitionFormat;
  rankingRule: RankingRule;
  status: StageStatus;
  // Stores format-specific settings: totalRounds, playoffTeamCount, etc.
  config?: Record<string, unknown> | null;
  createdAt: string;
}

export interface StageFixture {
  id: string;
  stageId: string;
  code?: string | null;
  bracket?: BracketType | null;
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
  winnerGoesTo?: string | null;
  loserGoesTo?: string | null;
}

// ── Generated Stage Responses ─────────────────────────────────────────────────

export interface GeneratedSingleEliminationStage {
  stage: TournamentStage;
  fixtures: StageFixture[];
  bracket: SingleEliminationBracket;
}

export interface GeneratedDoubleEliminationStage {
  stage: TournamentStage;
  fixtures: StageFixture[];
  bracket: DoubleEliminationBracket;
}

export interface GeneratedSwissStage {
  stage: TournamentStage;
  fixtures: StageFixture[];
  schedule: SwissSchedule;
}

export interface GeneratedLeaguePlusPlayoffStage {
  leagueStage: TournamentStage;
  leagueFixtures: StageFixture[];
  leagueSchedule: {
    participantCount: number;
    totalRounds: number;
    rounds: RoundRobinRound[];
  };
}

export interface GeneratedRoundRobinStage {
  stage: TournamentStage;
  fixtures: StageFixture[];
  schedule: {
    participantCount: number;
    totalRounds: number;
    rounds: RoundRobinRound[];
  };
}

// ── Heats + Final ─────────────────────────────────────────────────────────────

export interface HeatParticipant {
  participantId: string;
  participantName: string;
  seed?: number;
  lane: number;
}

export interface Heat {
  heatNumber: number;
  title: string;
  participants: HeatParticipant[];
}

export interface HeatsPlusFinalStructure {
  format: "HEATS_PLUS_FINAL";
  participantCount: number;
  participantsPerHeat: number;
  heatCount: number;
  heats: Heat[];
}

export interface GeneratedHeatsPlusFinalStage {
  stage: TournamentStage;
  structure: HeatsPlusFinalStructure;
}

// ── Standings & Leaderboard ───────────────────────────────────────────────────

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

export interface PerformanceEntry {
  id: string;
  stageId: string;
  fixtureId?: string | null;
  participantId: string;
  participantName: string;
  metricValue: number;
  unit: string | null;
  rank: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ── Multi-Event Points ────────────────────────────────────────────────────────

export interface MultiEventPointsEvent {
  id: string;
  index: number;
  name: string;
}

export interface MultiEventPointsStructure {
  format: "MULTI_EVENT_POINTS";
  participantCount: number;
  eventCount: number;
  events: MultiEventPointsEvent[];
}

export interface GeneratedMultiEventPointsStage {
  stage: TournamentStage;
  structure: MultiEventPointsStructure;
}