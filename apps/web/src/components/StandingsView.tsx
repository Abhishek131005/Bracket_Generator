import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { fetchStageStandings } from "../api";
import type { StandingRow } from "../types";

export function StandingsView({ stageId }: { stageId: string }) {
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchStageStandings(stageId).then(setStandings).finally(() => setLoading(false));
  }, [stageId]);

  if (loading) return <div className="empty-state"><span className="empty-icon">⏳</span><p>Calculating standings...</p></div>;
  if (standings.length === 0) return <div className="empty-state"><span className="empty-icon">📊</span><p>No results yet. Enter match scores to see standings.</p></div>;

  return (
    <div className="standings-view">
      <div className="standings-table-wrap">
        <table className="standings-table">
          <thead>
            <tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr>
          </thead>
          <tbody>
            {standings.map((row, i) => (
              <motion.tr key={row.participantId} className={`standing-row ${i < 3 ? "standing-top" : ""}`}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <td><span className={`rank-badge rank-${Math.min(row.rank, 4)}`}>{row.rank}</span></td>
                <td className="team-name-cell">{row.participantName}</td>
                <td>{row.played}</td>
                <td className="stat-win">{row.won}</td>
                <td>{row.drawn}</td>
                <td className="stat-loss">{row.lost}</td>
                <td>{row.goalsFor}</td>
                <td>{row.goalsAgainst}</td>
                <td className={row.goalDifference >= 0 ? "stat-positive" : "stat-negative"}>
                  {row.goalDifference > 0 ? "+" : ""}{row.goalDifference}
                </td>
                <td className="stat-points">{row.points}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="standings-legend">3 pts for win · 1 pt for draw · 0 for loss</p>
    </div>
  );
}
