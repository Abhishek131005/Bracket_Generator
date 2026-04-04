import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useMemo, useState } from "react";
import { usePerformances } from "../hooks/useQueries";
import { useAddPerformance, useDeletePerformance } from "../hooks/useMutations";
import { formatHeight, rankHeightEntries } from "../utils";
import type { TournamentParticipant } from "../types";

export function HeightLeaderboard({
  stageId,
  participants,
}: {
  stageId: string;
  participants: TournamentParticipant[];
}) {
  const { data: entries = [], isLoading } = usePerformances(stageId);
  const addPerformance = useAddPerformance(stageId);
  const deletePerformance = useDeletePerformance(stageId);

  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [height, setHeight] = useState("");
  const [failuresAtMax, setFailuresAtMax] = useState("0");
  const [totalFailures, setTotalFailures] = useState("0");
  const [totalAttempts, setTotalAttempts] = useState("1");
  const [error, setError] = useState("");

  const ranked = useMemo(() => rankHeightEntries(entries), [entries]);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedParticipantId || !height) {
      setError("Select a participant and enter a height.");
      return;
    }
    const h = parseFloat(height);
    const fam = parseInt(failuresAtMax);
    const tf = parseInt(totalFailures);
    const ta = parseInt(totalAttempts);
    if (isNaN(h) || h <= 0) { setError("Enter a valid positive height (metres)."); return; }
    if (isNaN(fam) || fam < 0 || fam > 2) { setError("Failures at this height must be 0, 1, or 2."); return; }
    if (isNaN(tf) || tf < 0) { setError("Total failures must be ≥ 0."); return; }
    if (isNaN(ta) || ta < 1) { setError("Total attempts must be ≥ 1."); return; }
    if (tf > ta) { setError("Total failures cannot exceed total attempts."); return; }

    const metadata = JSON.stringify({ failuresAtMax: fam, totalFailures: tf, totalAttempts: ta });
    addPerformance.mutate(
      { participantId: selectedParticipantId, metricValue: h, unit: "m", metadata },
      {
        onSuccess: () => {
          setHeight("");
          setFailuresAtMax("0");
          setTotalFailures("0");
          setTotalAttempts("1");
        },
        onError: (err) => setError(err instanceof Error ? err.message : "Could not save entry."),
      }
    );
  }

  return (
    <div className="leaderboard-view">
      {/* Entry form */}
      <form onSubmit={handleAdd} className="height-entry-form">
        <div className="height-form-row">
          <select
            className="field-select perf-select"
            value={selectedParticipantId}
            onChange={(e) => setSelectedParticipantId(e.target.value)}
          >
            <option value="">Select athlete...</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            className="field-input height-main-input"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Height (m)"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
        <div className="height-countback-row">
          <label className="height-cb-label">
            <span className="height-cb-name">Fail @ height</span>
            <input
              className="field-input height-cb-input"
              type="number"
              min="0"
              max="2"
              value={failuresAtMax}
              onChange={(e) => setFailuresAtMax(e.target.value)}
            />
          </label>
          <label className="height-cb-label">
            <span className="height-cb-name">Total failures</span>
            <input
              className="field-input height-cb-input"
              type="number"
              min="0"
              value={totalFailures}
              onChange={(e) => setTotalFailures(e.target.value)}
            />
          </label>
          <label className="height-cb-label">
            <span className="height-cb-name">Total attempts</span>
            <input
              className="field-input height-cb-input"
              type="number"
              min="1"
              value={totalAttempts}
              onChange={(e) => setTotalAttempts(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-lime" disabled={addPerformance.isPending}>
            {addPerformance.isPending ? "..." : "+ Add"}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <p className="height-form-hint">
          IAAF countback rule: highest height → fewest fails at max → fewest total fails → fewest total attempts.
        </p>
      </form>

      {/* Leaderboard */}
      {isLoading ? (
        <div className="empty-state"><span className="empty-icon">⏳</span><p>Loading...</p></div>
      ) : ranked.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🏃</span>
          <p>No height results yet. Enter results above.</p>
        </div>
      ) : (
        <div className="leaderboard-list">
          <div className="height-lb-header">
            <span>#</span>
            <span>Athlete</span>
            <span>Height</span>
            <span className="height-cb-cols">Fail@max / Tot.fail / Attempts</span>
            <span></span>
          </div>
          <AnimatePresence mode="popLayout">
          {ranked.map((entry) => (
            <motion.div
              key={entry.entryId}
              className={`height-lb-row ${entry.rank === 1 ? "lb-row-best" : ""}`}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ layout: { duration: 0.35, ease: "easeOut" }, duration: 0.2 }}
            >
              <span className={`lb-rank rank-badge rank-${Math.min(entry.rank, 4)}`}>
                {ranked.filter((r) => r.rank === entry.rank).length > 1 ? `=${entry.rank}` : entry.rank}
              </span>
              <span className="lb-name">{entry.participantName}</span>
              <span className="height-cleared">
                <strong>{formatHeight(entry.maxHeightCleared)}</strong>
              </span>
              <span className="height-countback-cells">
                <span className="height-cb-val">{entry.failuresAtMax}</span>
                <span className="height-cb-sep">/</span>
                <span className="height-cb-val">{entry.totalFailures}</span>
                <span className="height-cb-sep">/</span>
                <span className="height-cb-val">{entry.totalAttempts}</span>
              </span>
              <button
                className="lb-delete-btn"
                onClick={() => deletePerformance.mutate(entry.entryId)}
                title="Remove"
              >✕</button>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
