export type PrimaryView = "BRACKET" | "STANDINGS" | "LEADERBOARD" | "HYBRID";

export interface SportDefinition {
  id: number;
  name: string;
  format: string;
  rankingRule: string;
  needsBracket: boolean;
  primaryView: PrimaryView;
  notes?: string;
}

export interface Tournament {
  id: string;
  name: string;
  sportId: number;
  sportName: string;
  format: string;
  rankingRule: string;
  status: string;
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
  status: "SCHEDULED" | "AUTO_ADVANCE" | "PENDING" | "COMPLETED";
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
  bracket: "WINNERS" | "LOSERS" | "GRAND_FINAL";
  roundIndex: number;
  matchIndex: number;
  leftLabel: string | null;
  rightLabel: string | null;
  leftSeed: number | null;
  rightSeed: number | null;
  status: "SCHEDULED" | "PENDING" | "AUTO_ADVANCE" | "COMPLETED";
  autoAdvanceWinner: string | null;
  winnerGoesTo: string | null;
  loserGoesTo: string | null;
}

export interface DERound {
  roundIndex: number;
  bracket: "WINNERS" | "LOSERS" | "GRAND_FINAL";
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
  type: "INDIVIDUAL" | "TEAM";
  createdAt: string;
}

export interface TournamentStage {
  id: string;
  name: string;
  sequence: number;
  format: string;
  rankingRule: string;
  status: string;
  createdAt: string;
}

export interface StageFixture {
  id: string;
  code?: string | null;
  roundIndex: number;
  matchIndex: number;
  leftParticipantId: string | null;
  rightParticipantId: string | null;
  leftLabel: string | null;
  rightLabel: string | null;
  leftScore: number | null;
  rightScore: number | null;
  status: string;
  autoAdvanceParticipantId: string | null;
  bracket?: string | null;
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
  participantId: string;
  participantName: string;
  metricValue: number;
  unit: string | null;
  rank: number | null;
  metadata: string | null;
  createdAt: string;
}