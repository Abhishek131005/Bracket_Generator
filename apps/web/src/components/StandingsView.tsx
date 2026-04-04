import { AnimatePresence, motion } from "framer-motion";
import { useStandings } from "../hooks/useQueries";

export function StandingsView({ stageId }: { stageId: string }) {
  const { data: standings = [], isLoading } = useStandings(stageId);

  if (isLoading) return <div className="empty-state"><span className="empty-icon">⏳</span><p>Calculating standings...</p></div>;
  if (standings.length === 0) return <div className="empty-state"><span className="empty-icon">📊</span><p>No results yet. Enter match scores to see standings.</p></div>;

  return (
    <div className="standings-view">
      <div className="standings-grid-wrap">
        <div className="standings-grid-header">
          <span>#</span><span>Team</span>
          <span>P</span><span>W</span><span>D</span><span>L</span>
          <span>GF</span><span>GA</span><span>GD</span><span>Pts</span>
        </div>
        <AnimatePresence mode="popLayout">
          {standings.map((row, i) => (
            <motion.div
              key={row.participantId}
              className={`standings-grid-row ${i < 3 ? "standing-top" : ""}`}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ layout: { duration: 0.35, ease: "easeOut" }, duration: 0.2 }}
            >
              <span><span className={`rank-badge rank-${Math.min(row.rank, 4)}`}>{row.rank}</span></span>
              <span className="team-name-cell">{row.participantName}</span>
              <span>{row.played}</span>
              <span className="stat-win">{row.won}</span>
              <span>{row.drawn}</span>
              <span className="stat-loss">{row.lost}</span>
              <span>{row.goalsFor}</span>
              <span>{row.goalsAgainst}</span>
              <span className={row.goalDifference >= 0 ? "stat-positive" : "stat-negative"}>
                {row.goalDifference > 0 ? "+" : ""}{row.goalDifference}
              </span>
              <span className="stat-points">{row.points}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <p className="standings-legend">3 pts for win · 1 pt for draw · 0 for loss</p>
    </div>
  );
}
