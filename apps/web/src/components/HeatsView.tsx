import { motion } from "framer-motion";
import type { HeatsPlusFinalStructure, TournamentStage } from "../types";

export function HeatsView({ stage }: { stage: TournamentStage }) {
  const structure = stage.config as HeatsPlusFinalStructure | null;

  if (!structure || !structure.heats) {
    return (
      <div className="empty-state">
        <span className="empty-icon">🏊</span>
        <p>No heat assignments found. Regenerate the stage.</p>
      </div>
    );
  }

  return (
    <div className="heats-view">
      <div className="heats-meta">
        <span>{structure.participantCount} athletes</span>
        <span>{structure.heatCount} heat{structure.heatCount !== 1 ? "s" : ""}</span>
        <span>{structure.participantsPerHeat} per heat</span>
      </div>

      <div className="heats-grid">
        {structure.heats.map((heat, hIdx) => (
          <motion.div
            key={heat.heatNumber}
            className="heat-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: hIdx * 0.06, duration: 0.22 }}
          >
            <div className="heat-card-header">
              <h4 className="heat-title">{heat.title}</h4>
              <span className="heat-count">{heat.participants.length} athletes</span>
            </div>
            <div className="heat-lane-table">
              <div className="heat-lane-header">
                <span>Lane</span>
                <span>Athlete / Team</span>
                <span>Seed</span>
              </div>
              {heat.participants.map((p) => (
                <div key={p.participantId} className="heat-lane-row">
                  <span className="heat-lane-num">{p.lane}</span>
                  <span className="heat-athlete-name">{p.participantName}</span>
                  <span className="heat-seed">
                    {p.seed != null ? `#${p.seed}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <p className="heats-note">
        Enter times in the Results tab after heats are completed.
      </p>
    </div>
  );
}
