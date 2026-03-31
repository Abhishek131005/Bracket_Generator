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

export type PrimaryView = "BRACKET" | "STANDINGS" | "LEADERBOARD" | "HYBRID";

export interface SportDefinition {
  id: number;
  name: string;
  format: CompetitionFormat;
  rankingRule: RankingRule;
  needsBracket: boolean;
  primaryView: PrimaryView;
  notes?: string;
}

export type TournamentStatus = "DRAFT" | "LIVE" | "COMPLETED";

export interface Tournament {
  id: string;
  name: string;
  sportId: number;
  sportName: string;
  format: CompetitionFormat;
  rankingRule: RankingRule;
  status: TournamentStatus;
  createdAt: string;
  updatedAt: string;
}
