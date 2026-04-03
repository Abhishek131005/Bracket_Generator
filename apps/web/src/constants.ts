// Shared display constants used across components and pages

export const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: "Single Elim",
  DOUBLE_ELIMINATION: "Double Elim",
  ROUND_ROBIN: "Round Robin",
  SWISS: "Swiss",
  LEAGUE_PLUS_PLAYOFF: "League + Playoff",
  HEATS_PLUS_FINAL: "Heats + Final",
  DIRECT_FINAL: "Direct Final",
  MULTI_EVENT_POINTS: "Multi-Event",
  JUDGED_LEADERBOARD: "Judged",
  CUSTOM: "Custom",
};

export const VIEW_COLORS: Record<string, string> = {
  BRACKET: "#c7f464",
  HYBRID: "#ff6b35",
  STANDINGS: "#2ec4b6",
  LEADERBOARD: "#f4d35e",
};

export const VIEW_ICONS: Record<string, string> = {
  BRACKET: "🏆",
  HYBRID: "⚽",
  STANDINGS: "♟️",
  LEADERBOARD: "🏁",
};

export const RANKING_DIRECTION: Record<string, "ASC" | "DESC"> = {
  TIME_ASC: "ASC",
  DISTANCE_DESC: "DESC",
  HEIGHT_DESC_WITH_COUNTBACK: "DESC",
  JUDGES_SCORE_DESC: "DESC",
  AGGREGATE_POINTS_DESC: "DESC",
};

export const METRIC_LABEL: Record<string, string> = {
  TIME_ASC: "Time",
  DISTANCE_DESC: "Distance",
  HEIGHT_DESC_WITH_COUNTBACK: "Height",
  JUDGES_SCORE_DESC: "Score",
  AGGREGATE_POINTS_DESC: "Points",
};

export const METRIC_UNIT: Record<string, string> = {
  TIME_ASC: "s",
  DISTANCE_DESC: "m",
  HEIGHT_DESC_WITH_COUNTBACK: "m",
  JUDGES_SCORE_DESC: "pts",
  AGGREGATE_POINTS_DESC: "pts",
};
