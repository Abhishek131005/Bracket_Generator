import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useMemo, useState } from "react";
import { METRIC_LABEL, METRIC_UNIT, RANKING_DIRECTION } from "../constants";
import { usePerformances } from "../hooks/useQueries";
import { useAddPerformance, useDeletePerformance } from "../hooks/useMutations";
import { usePermissions } from "../hooks/usePermissions";
import { formatTime, rankBestAttempts } from "../utils";
import type { TournamentParticipant } from "../types";
import { HeightLeaderboard } from "./HeightLeaderboard";
import { JudgedLeaderboard } from "./JudgedLeaderboard";

export function LeaderboardView({ stageId, participants, rankingRule }: {
  stageId: string;
  participants: TournamentParticipant[];
  rankingRule: string;
}) {
  // Route to specialized components for complex formats
  if (rankingRule === "HEIGHT_DESC_WITH_COUNTBACK") {
    return <HeightLeaderboard stageId={stageId} participants={participants} />;
  }
  if (rankingRule === "JUDGES_SCORE_DESC") {
    return <JudgedLeaderboard stageId={stageId} participants={participants} />;
  }

  return <GenericLeaderboard stageId={stageId} participants={participants} rankingRule={rankingRule} />;
}

// ── Generic leaderboard (TIME_ASC, DISTANCE_DESC, AGGREGATE_POINTS_DESC, etc.) ─

function GenericLeaderboard({ stageId, participants, rankingRule }: {
  stageId: string;
  participants: TournamentParticipant[];
  rankingRule: string;
}) {
  const { data: entries = [], isLoading } = usePerformances(stageId);
  const addPerformance = useAddPerformance(stageId);
  const deletePerformance = useDeletePerformance(stageId);
  const { canScore } = usePermissions();

  const direction = RANKING_DIRECTION[rankingRule] ?? "ASC";
  const metricLabel = METRIC_LABEL[rankingRule] ?? "Value";
  const defaultUnit = METRIC_UNIT[rankingRule] ?? "";
  const isTime = rankingRule === "TIME_ASC";

  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [error, setError] = useState("");

  // One row per athlete (their best attempt), with shared places for ties
  const ranked = useMemo(() => rankBestAttempts(entries, direction), [entries, direction]);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedParticipantId || !metricValue) { setError("Select a participant and enter a value."); return; }
    const val = parseFloat(metricValue);
    if (isNaN(val)) { setError("Enter a valid number."); return; }
    addPerformance.mutate(
      { participantId: selectedParticipantId, metricValue: val, unit: defaultUnit || undefined },
      {
        onSuccess: () => setMetricValue(""),
        onError: (err) => setError(err instanceof Error ? err.message : "Could not save entry."),
      }
    );
  }

  const placeholder = isTime ? "Time (seconds)" : `${metricLabel}${defaultUnit ? ` (${defaultUnit})` : ""}`;

  return (
    <div className="leaderboard-view">
      {canScore && <form onSubmit={handleAdd} className="perf-entry-form">
        <select className="field-select perf-select" value={selectedParticipantId} onChange={(e) => setSelectedParticipantId(e.target.value)}>
          <option value="">Select participant...</option>
          {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="perf-metric-row">
          <input className="field-input perf-metric-input" type="number" step="0.001"
            placeholder={placeholder} value={metricValue} onChange={(e) => setMetricValue(e.target.value)} />
          <button type="submit" className="btn-lime" disabled={addPerformance.isPending}>
            {addPerformance.isPending ? "..." : `+ Add ${metricLabel}`}
          </button>
        </div>
        {isTime && (
          <p className="height-form-hint">Enter time in seconds (e.g. 9.58 for 9.58s, 65.3 for 1:05.30).</p>
        )}
        {error && <p className="form-error">{error}</p>}
      </form>}

      {isLoading ? (
        <div className="empty-state"><span className="empty-icon">⏳</span><p>Loading...</p></div>
      ) : ranked.length === 0 ? (
        <div className="empty-state"><span className="empty-icon">🏁</span><p>No entries yet. Add results above.</p></div>
      ) : (
        <div className="leaderboard-list">
          <div className="lb-header-row">
            <span>#</span><span>Participant</span><span>{metricLabel}</span><span></span>
          </div>
          <AnimatePresence mode="popLayout">
            {ranked.map(({ entry, rank, attempts }) => (
              <motion.div key={entry.id} className={`lb-row ${rank === 1 ? "lb-row-best" : ""}`}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ layout: { duration: 0.35, ease: "easeOut" }, duration: 0.2 }}>
                <span className={`lb-rank rank-badge rank-${Math.min(rank, 4)}`}>
                  {ranked.filter((r) => r.rank === rank).length > 1 ? `=${rank}` : rank}
                </span>
                <span className="lb-name">
                  {entry.participantName}
                  {attempts > 1 && <span className="lb-attempts" title="Best of all recorded attempts"> · best of {attempts}</span>}
                </span>
                <span className="lb-metric">
                  <strong>{isTime ? formatTime(entry.metricValue) : entry.metricValue}</strong>
                  {!isTime && entry.unit && <span className="lb-unit"> {entry.unit}</span>}
                </span>
                {canScore ? <button className="lb-delete-btn" onClick={() => deletePerformance.mutate(entry.id)} title="Remove">✕</button> : <span />}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
