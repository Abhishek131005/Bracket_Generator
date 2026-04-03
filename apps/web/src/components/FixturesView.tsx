import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useFixtures } from "../hooks/useQueries";
import { useUpdateFixture, useRegenerateSwissPairings } from "../hooks/useMutations";

export function FixturesView({ stageId, isSwiss, onFixturesChanged }: {
  stageId: string;
  isSwiss?: boolean;
  onFixturesChanged?: () => void;
}) {
  const { data: fixtures = [], isLoading } = useFixtures(stageId);
  const updateFixture = useUpdateFixture(stageId);
  const regeneratePairings = useRegenerateSwissPairings(stageId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [error, setError] = useState("");

  const byRound = useMemo(() => {
    const map = new Map<number, typeof fixtures>();
    for (const f of fixtures) { if (!map.has(f.roundIndex)) map.set(f.roundIndex, []); map.get(f.roundIndex)!.push(f); }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [fixtures]);

  function handleSave(fixtureId: string) {
    const hs = parseInt(homeScore); const as_ = parseInt(awayScore);
    if (isNaN(hs) || isNaN(as_) || hs < 0 || as_ < 0) { setError("Enter valid non-negative scores."); return; }
    setError("");
    updateFixture.mutate({ fixtureId, homeScore: hs, awayScore: as_ }, {
      onSuccess: () => { setEditingId(null); onFixturesChanged?.(); },
      onError: (err) => setError(err instanceof Error ? err.message : "Could not save."),
    });
  }

  function handleSwissRePair(roundIndex: number) {
    setError("");
    regeneratePairings.mutate(roundIndex, {
      onSuccess: () => onFixturesChanged?.(),
      onError: (err) => setError(err instanceof Error ? err.message : "Could not generate pairings."),
    });
  }

  if (isLoading) return <div className="empty-state"><span className="empty-icon">⏳</span><p>Loading fixtures...</p></div>;
  if (fixtures.length === 0) return <div className="empty-state"><span className="empty-icon">📋</span><p>No fixtures in this stage.</p></div>;

  return (
    <div className="fixtures-view">
      {error && <p className="form-error" style={{ marginBottom: "1rem" }}>{error}</p>}
      {byRound.map(([roundIdx, roundFixtures]) => {
        const allPrevRoundsDone = roundIdx === 1 || byRound
          .filter(([ri]) => ri < roundIdx)
          .every(([, rfs]) => rfs.filter((f) => !f.autoAdvanceParticipantId).every((f) => f.status === "COMPLETED"));
        const isTBD = roundFixtures.some((f) => f.leftLabel === "TBD" || f.rightLabel === "TBD");
        return (
          <div key={roundIdx} className="fixtures-round">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <h4 className="fixtures-round-title">Round {roundIdx}</h4>
              {isSwiss && isTBD && allPrevRoundsDone && (
                <button className="btn-cyan" style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem" }}
                  onClick={() => handleSwissRePair(roundIdx)} disabled={regeneratePairings.isPending}>
                  {regeneratePairings.isPending ? "Pairing..." : "⚡ Generate Pairings"}
                </button>
              )}
            </div>
            <div className="fixtures-list">
              {roundFixtures.map((f, i) => {
                const isEditing = editingId === f.id;
                const isDone = f.status === "COMPLETED";
                const isTBDMatch = f.leftLabel === "TBD" || f.rightLabel === "TBD";
                return (
                  <motion.div key={f.id} className={`fixture-row ${isDone ? "fixture-done" : ""}`}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                    <div className="fixture-teams">
                      <span className="fixture-team home">{f.leftLabel ?? "TBD"}</span>
                      <div className="fixture-score-area">
                        {isDone && !isEditing ? (
                          <span className="fixture-scoreline">
                            <strong>{f.leftScore}</strong>
                            <span className="score-sep">–</span>
                            <strong>{f.rightScore}</strong>
                          </span>
                        ) : isEditing ? (
                          <div className="score-entry">
                            <input className="score-input" type="number" min="0" value={homeScore}
                              onChange={(e) => setHomeScore(e.target.value)} placeholder="0" />
                            <span className="score-sep">–</span>
                            <input className="score-input" type="number" min="0" value={awayScore}
                              onChange={(e) => setAwayScore(e.target.value)} placeholder="0" />
                          </div>
                        ) : (
                          <span className="fixture-vs">vs</span>
                        )}
                      </div>
                      <span className="fixture-team away">{f.rightLabel ?? "TBD"}</span>
                    </div>
                    <div className="fixture-actions">
                      {isEditing ? (
                        <>
                          <button className="btn-save-score" onClick={() => handleSave(f.id)} disabled={updateFixture.isPending}>
                            {updateFixture.isPending ? "..." : "✓ Save"}
                          </button>
                          <button className="btn-cancel-score" onClick={() => setEditingId(null)}>✕</button>
                        </>
                      ) : (
                        <button className="btn-enter-score"
                          onClick={() => {
                            setEditingId(f.id);
                            setHomeScore(f.leftScore?.toString() ?? "");
                            setAwayScore(f.rightScore?.toString() ?? "");
                          }}
                          disabled={f.status === "AUTO_ADVANCE" || f.status === "PENDING" || isTBDMatch}>
                          {isDone ? "Edit" : "Enter Score"}
                        </button>
                      )}
                      <span className={`fixture-status-badge status-${f.status.toLowerCase()}`}>
                        {f.status === "COMPLETED" ? "FT" : f.status === "AUTO_ADVANCE" ? "BYE" : isTBDMatch ? "TBD" : "—"}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
