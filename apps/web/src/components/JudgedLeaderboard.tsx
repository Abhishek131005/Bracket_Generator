import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useMemo, useState } from "react";
import { usePerformances } from "../hooks/useQueries";
import { useAddPerformance, useDeletePerformance } from "../hooks/useMutations";
import { buildJudgedRows } from "../utils";
import type { TournamentParticipant } from "../types";

export function JudgedLeaderboard({
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
  const [judgeId, setJudgeId] = useState("");
  const [score, setScore] = useState("");
  const [error, setError] = useState("");

  // The aggregation mode could come from stage config; default to average
  const rows = useMemo(() => buildJudgedRows(entries), [entries]);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedParticipantId || !judgeId.trim() || !score) {
      setError("Select a participant, enter judge name, and enter a score.");
      return;
    }
    const s = parseFloat(score);
    if (isNaN(s) || s < 0) { setError("Enter a valid non-negative score."); return; }

    const metadata = JSON.stringify({ judgeId: judgeId.trim() });
    addPerformance.mutate(
      { participantId: selectedParticipantId, metricValue: s, unit: "pts", metadata },
      {
        onSuccess: () => setScore(""),
        onError: (err) => setError(err instanceof Error ? err.message : "Could not save score."),
      }
    );
  }

  // Collect all unique judge IDs for the header (ordered by first appearance)
  const allJudges = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const e of entries) {
      let jid = "Judge";
      const meta = e.metadata;
      if (meta && typeof meta === "object" && "judgeId" in meta) {
        jid = String((meta as Record<string, unknown>).judgeId);
      } else if (typeof meta === "string") {
        try { const p = JSON.parse(meta); if (p.judgeId) jid = String(p.judgeId); } catch { /* keep default */ }
      }
      if (!seen.has(jid)) { seen.add(jid); list.push(jid); }
    }
    return list;
  }, [entries]);

  return (
    <div className="leaderboard-view">
      {/* Entry form */}
      <form onSubmit={handleAdd} className="judged-entry-form">
        <div className="judged-form-row">
          <select
            className="field-select perf-select"
            value={selectedParticipantId}
            onChange={(e) => setSelectedParticipantId(e.target.value)}
          >
            <option value="">Select participant...</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            className="field-input judged-judge-input"
            type="text"
            placeholder="Judge name / ID"
            value={judgeId}
            onChange={(e) => setJudgeId(e.target.value)}
          />
          <input
            className="field-input judged-score-input"
            type="number"
            step="0.1"
            min="0"
            placeholder="Score"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
          <button type="submit" className="btn-lime" disabled={addPerformance.isPending}>
            {addPerformance.isPending ? "..." : "+ Add Score"}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <p className="height-form-hint">Final score = average of all judge scores. Add one row per judge per participant.</p>
      </form>

      {/* Leaderboard */}
      {isLoading ? (
        <div className="empty-state"><span className="empty-icon">⏳</span><p>Loading...</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">⚖️</span>
          <p>No judge scores yet. Add scores above.</p>
        </div>
      ) : (
        <div className="judged-lb-wrap">
          <div className="judged-lb-header">
            <span className="jlb-rank">#</span>
            <span className="jlb-name">Participant</span>
            <span className="jlb-scores">Judge Scores</span>
            <span className="jlb-final">Final</span>
            <span className="jlb-del"></span>
          </div>
          <AnimatePresence mode="popLayout">
          {rows.map((row) => (
            <motion.div
              key={row.participantId}
              className={`judged-lb-row ${row.rank === 1 ? "lb-row-best" : ""}`}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ layout: { duration: 0.35, ease: "easeOut" }, duration: 0.2 }}
            >
              <span className={`lb-rank rank-badge rank-${Math.min(row.rank, 4)} jlb-rank`}>
                {rows.filter((r) => r.rank === row.rank).length > 1 ? `=${row.rank}` : row.rank}
              </span>
              <span className="lb-name jlb-name">{row.participantName}</span>
              <span className="jlb-scores">
                {row.judgeScores.length === 0 ? (
                  <span className="judged-no-scores">—</span>
                ) : (
                  row.judgeScores.map((js) => (
                    <span key={js.entryId} className="judge-score-pill" title={js.judgeId}>
                      <span className="judge-score-val">{js.score}</span>
                      <button
                        className="judge-score-del"
                        onClick={() => deletePerformance.mutate(js.entryId)}
                        title={`Remove ${js.judgeId}`}
                      >✕</button>
                    </span>
                  ))
                )}
              </span>
              <span className="jlb-final">
                <strong>{row.judgeScores.length > 0 ? row.finalScore.toFixed(2) : "—"}</strong>
                {row.judgeScores.length > 0 && (
                  <span className="jlb-judge-count"> ({row.judgeScores.length}j)</span>
                )}
              </span>
              <span className="jlb-del"></span>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
