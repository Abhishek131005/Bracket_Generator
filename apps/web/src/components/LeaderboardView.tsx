import { motion } from "framer-motion";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { addPerformanceEntry, deletePerformanceEntry, fetchStagePerformances } from "../api";
import { METRIC_LABEL, METRIC_UNIT, RANKING_DIRECTION } from "../constants";
import type { PerformanceEntry, TournamentParticipant } from "../types";

export function LeaderboardView({ stageId, participants, rankingRule }: {
  stageId: string;
  participants: TournamentParticipant[];
  rankingRule: string;
}) {
  const [entries, setEntries] = useState<PerformanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const direction = RANKING_DIRECTION[rankingRule] ?? "ASC";
  const metricLabel = METRIC_LABEL[rankingRule] ?? "Value";
  const defaultUnit = METRIC_UNIT[rankingRule] ?? "";

  useEffect(() => {
    setLoading(true);
    fetchStagePerformances(stageId).then(setEntries).finally(() => setLoading(false));
  }, [stageId]);

  const ranked = useMemo(() =>
    [...entries].sort((a, b) => direction === "ASC" ? a.metricValue - b.metricValue : b.metricValue - a.metricValue),
    [entries, direction]
  );

  async function handleAdd(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!selectedParticipantId || !metricValue) { setError("Select a participant and enter a value."); return; }
    const val = parseFloat(metricValue);
    if (isNaN(val)) { setError("Enter a valid number."); return; }
    try {
      setSaving(true);
      const entry = await addPerformanceEntry(stageId, selectedParticipantId, val, defaultUnit || undefined);
      setEntries((prev) => [...prev, entry]);
      setMetricValue("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save entry."); }
    finally { setSaving(false); }
  }

  async function handleDelete(entryId: string) {
    try { await deletePerformanceEntry(entryId); setEntries((prev) => prev.filter((e) => e.id !== entryId)); }
    catch { setError("Could not delete entry."); }
  }

  return (
    <div className="leaderboard-view">
      <form onSubmit={handleAdd} className="perf-entry-form">
        <select className="field-select perf-select" value={selectedParticipantId} onChange={(e) => setSelectedParticipantId(e.target.value)}>
          <option value="">Select participant...</option>
          {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="perf-metric-row">
          <input className="field-input perf-metric-input" type="number" step="0.001"
            placeholder={`${metricLabel} (${defaultUnit})`} value={metricValue} onChange={(e) => setMetricValue(e.target.value)} />
          <button type="submit" className="btn-lime" disabled={saving}>{saving ? "..." : `+ Add ${metricLabel}`}</button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
      {loading ? (
        <div className="empty-state"><span className="empty-icon">⏳</span><p>Loading...</p></div>
      ) : ranked.length === 0 ? (
        <div className="empty-state"><span className="empty-icon">🏁</span><p>No entries yet. Add results above.</p></div>
      ) : (
        <div className="leaderboard-list">
          <div className="lb-header-row">
            <span>#</span><span>Participant</span><span>{metricLabel}</span><span></span>
          </div>
          {ranked.map((entry, i) => (
            <motion.div key={entry.id} className={`lb-row ${i === 0 ? "lb-row-best" : ""}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <span className={`lb-rank rank-badge rank-${Math.min(i + 1, 4)}`}>{i + 1}</span>
              <span className="lb-name">{entry.participantName}</span>
              <span className="lb-metric"><strong>{entry.metricValue}</strong>{entry.unit && <span className="lb-unit"> {entry.unit}</span>}</span>
              <button className="lb-delete-btn" onClick={() => handleDelete(entry.id)} title="Remove">✕</button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
