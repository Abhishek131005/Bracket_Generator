import { motion } from "framer-motion";
import { type FormEvent, useMemo, useState } from "react";
import { usePerformances } from "../hooks/useQueries";
import { useAddPerformance, useDeletePerformance } from "../hooks/useMutations";
import type { MultiEventPointsStructure, TournamentParticipant, TournamentStage } from "../types";

export function MultiEventView({
  stage,
  participants,
}: {
  stage: TournamentStage;
  participants: TournamentParticipant[];
}) {
  const structure = stage.config as unknown as MultiEventPointsStructure | null;
  const events = structure?.events ?? [];

  const { data: entries = [], isLoading } = usePerformances(stage.id);
  const addPerformance = useAddPerformance(stage.id);
  const deletePerformance = useDeletePerformance(stage.id);

  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [pointsValue, setPointsValue] = useState("");
  const [error, setError] = useState("");

  // Build lookup: participantId → { eventId → entry }
  const entryMap = useMemo(() => {
    const map = new Map<string, Map<string, typeof entries[0]>>();
    for (const entry of entries) {
      if (!entry.fixtureId) continue;
      if (!map.has(entry.participantId)) map.set(entry.participantId, new Map());
      map.get(entry.participantId)!.set(entry.fixtureId, entry);
    }
    return map;
  }, [entries]);

  // Compute totals per participant, sorted DESC
  const ranked = useMemo(() => {
    return [...participants]
      .map((p) => {
        const eventMap = entryMap.get(p.id);
        const total = eventMap
          ? Array.from(eventMap.values()).reduce((sum, e) => sum + e.metricValue, 0)
          : 0;
        return { participant: p, total, eventMap: eventMap ?? new Map() };
      })
      .sort((a, b) => b.total - a.total);
  }, [participants, entryMap]);

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedParticipantId || !selectedEventId || !pointsValue) {
      setError("Select a participant, an event, and enter a points value.");
      return;
    }
    const val = parseFloat(pointsValue);
    if (isNaN(val)) { setError("Enter a valid number."); return; }
    addPerformance.mutate(
      { participantId: selectedParticipantId, metricValue: val, unit: "pts", fixtureId: selectedEventId },
      {
        onSuccess: () => setPointsValue(""),
        onError: (err) => setError(err instanceof Error ? err.message : "Could not save entry."),
      }
    );
  }

  if (!structure) {
    return (
      <div className="empty-state">
        <span className="empty-icon">⚠️</span>
        <p>Stage config not found. Regenerate this stage.</p>
      </div>
    );
  }

  return (
    <div className="multi-event-view">
      <div className="me-meta-bar">
        <span>{structure.participantCount} participants</span>
        <span>{structure.eventCount} events</span>
        <span>{entries.length} scores recorded</span>
      </div>

      <form onSubmit={handleAdd} className="me-entry-form">
        <select className="field-select" value={selectedParticipantId}
          onChange={(e) => setSelectedParticipantId(e.target.value)}>
          <option value="">Participant...</option>
          {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="field-select" value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}>
          <option value="">Event...</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
        <input className="field-input me-pts-input" type="number" step="0.01"
          placeholder="Points" value={pointsValue} onChange={(e) => setPointsValue(e.target.value)} />
        <button type="submit" className="btn-lime" disabled={addPerformance.isPending}>
          {addPerformance.isPending ? "..." : "+ Add"}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}

      {isLoading ? (
        <div className="empty-state"><span className="empty-icon">⏳</span><p>Loading...</p></div>
      ) : (
        <div className="me-grid-wrap">
          <table className="me-grid">
            <thead>
              <tr>
                <th className="me-th-rank">#</th>
                <th className="me-th-name">Participant</th>
                {events.map((ev) => <th key={ev.id} className="me-th-event">{ev.name}</th>)}
                <th className="me-th-total">Total</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ participant, total, eventMap }, i) => (
                <motion.tr key={participant.id} className={`me-row ${i === 0 && total > 0 ? "me-row-leader" : ""}`}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <td className={`me-td-rank rank-badge rank-${Math.min(i + 1, 4)}`}>{i + 1}</td>
                  <td className="me-td-name">{participant.name}</td>
                  {events.map((ev) => {
                    const entry = eventMap.get(ev.id);
                    return (
                      <td key={ev.id} className="me-td-score">
                        {entry ? (
                          <span className="me-score-cell">
                            <strong>{entry.metricValue}</strong>
                            <button className="me-del-btn" onClick={() => deletePerformance.mutate(entry.id)} title="Remove">✕</button>
                          </span>
                        ) : (
                          <span className="me-score-empty">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="me-td-total">
                    <strong>{total > 0 ? total : "—"}</strong>
                    {total > 0 && <span className="me-pts-unit"> pts</span>}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
