import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useUpdateFixture } from "../hooks/useMutations";

export interface BracketMatchInfo {
  fixtureId: string;
  stageId: string;
  leftLabel: string | null;
  rightLabel: string | null;
  leftScore: number | null;
  rightScore: number | null;
}

export function BracketScoreModal({
  match,
  onClose,
}: {
  match: BracketMatchInfo | null;
  onClose: () => void;
}) {
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [error, setError] = useState("");
  const updateFixture = useUpdateFixture(match?.stageId ?? "");

  useEffect(() => {
    if (match) {
      setHomeScore(match.leftScore?.toString() ?? "");
      setAwayScore(match.rightScore?.toString() ?? "");
      setError("");
    }
  }, [match?.fixtureId]);

  function handleSave() {
    if (!match) return;
    const hs = parseInt(homeScore);
    const as_ = parseInt(awayScore);
    if (isNaN(hs) || isNaN(as_) || hs < 0 || as_ < 0) {
      setError("Enter valid non-negative scores.");
      return;
    }
    setError("");
    updateFixture.mutate(
      { fixtureId: match.fixtureId, homeScore: hs, awayScore: as_ },
      {
        onSuccess: onClose,
        onError: (err) => setError(err instanceof Error ? err.message : "Could not save score."),
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onClose();
  }

  return (
    <AnimatePresence>
      {match && (
        <>
          <motion.div
            className="bsm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="bsm-panel"
            initial={{ opacity: 0, scale: 0.92, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -10 }}
            transition={{ type: "spring", duration: 0.28, bounce: 0.18 }}
            onKeyDown={handleKeyDown}
          >
            <div className="bsm-header">
              <h4 className="bsm-title">Enter Score</h4>
              <button className="bsm-close" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className="bsm-teams">
              <div className="bsm-team-row">
                <span className="bsm-team-name">{match.leftLabel ?? "TBD"}</span>
                <input
                  className="bsm-score-input"
                  type="number"
                  min="0"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div className="bsm-sep">vs</div>
              <div className="bsm-team-row">
                <span className="bsm-team-name">{match.rightLabel ?? "TBD"}</span>
                <input
                  className="bsm-score-input"
                  type="number"
                  min="0"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {error && <p className="form-error" style={{ marginBottom: "0.75rem" }}>{error}</p>}

            <div className="bsm-actions">
              <button
                className="btn-lime"
                onClick={handleSave}
                disabled={updateFixture.isPending}
              >
                {updateFixture.isPending ? "Saving..." : "✓ Save Score"}
              </button>
              <button className="btn-cancel-score" onClick={onClose}>Cancel</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
