export type PrimaryView = "BRACKET" | "STANDINGS" | "LEADERBOARD" | "HYBRID";

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

export interface GeneratedSingleEliminationStage {
  stage: TournamentStage;
  fixtures: StageFixture[];
  bracket: SingleEliminationBracket;
}

export interface GeneratedRoundRobinStage {
  stage: TournamentStage;
  fixtures: StageFixture[];
  schedule: RoundRobinFixtures;
}