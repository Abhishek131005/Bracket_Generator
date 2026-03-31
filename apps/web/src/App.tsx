import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addParticipantsToTournament,
  createTournament,
  fetchSports,
  fetchTournamentParticipants,
  fetchTournamentStages,
  fetchTournaments,
  generateSingleEliminationBracket,
  generateSingleEliminationStageForTournament,
  generateRoundRobinStageForTournament,
  fetchStageFixtures,
  updateFixtureResult,
  fetchStageStandings,
  fetchStagePerformances,
  addPerformanceEntry,
  deletePerformanceEntry,
} from "./api";
import {
  GeneratedSingleEliminationStage,
  PrimaryView,
  SingleEliminationBracket,
  SportDefinition,
  StageFixture,
  StandingRow,
  PerformanceEntry,
  Tournament,
  TournamentParticipant,
  TournamentStage,
} from "./types";

type Page = "home" | "create" | "tournament" | "sports" | "playground";

const FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: "Single Elim",
  DOUBLE_ELIMINATION: "Double Elim",
  ROUND_ROBIN: "Round Robin",
  SWISS: "Swiss",
  LEAGUE_PLUS_PLAYOFF: "League + Playoff",
  HEATS_PLUS_FINAL: "Heats + Final",
  DIRECT_FINAL: "Direct Final",
  MULTI_EVENT_POINTS: "Multi-Event",
  JUDGED_LEADERBOARD: "Judged",
  CUSTOM: "Custom",
};

const VIEW_COLORS: Record<string, string> = {
  BRACKET: "#c7f464",
  HYBRID: "#ff6b35",
  STANDINGS: "#2ec4b6",
  LEADERBOARD: "#f4d35e",
};

const RANKING_DIRECTION: Record<string, "ASC" | "DESC"> = {
  TIME_ASC: "ASC",
  DISTANCE_DESC: "DESC",
  HEIGHT_DESC_WITH_COUNTBACK: "DESC",
  JUDGES_SCORE_DESC: "DESC",
  AGGREGATE_POINTS_DESC: "DESC",
};

const METRIC_LABEL: Record<string, string> = {
  TIME_ASC: "Time",
  DISTANCE_DESC: "Distance",
  HEIGHT_DESC_WITH_COUNTBACK: "Height",
  JUDGES_SCORE_DESC: "Score",
  AGGREGATE_POINTS_DESC: "Points",
};

const METRIC_UNIT: Record<string, string> = {
  TIME_ASC: "s",
  DISTANCE_DESC: "m",
  HEIGHT_DESC_WITH_COUNTBACK: "m",
  JUDGES_SCORE_DESC: "pts",
  AGGREGATE_POINTS_DESC: "pts",
};

// BracketCanvas
function BracketCanvas({ bracket }: { bracket: SingleEliminationBracket }) {
  const MATCH_W = 200; const MATCH_H = 80; const ROUND_GAP = 80;
  const MATCH_GAP = 24; const PAD_TOP = 32; const PAD_LEFT = 24;
  const rounds = bracket.rounds; const numRounds = rounds.length;
  const getMatchY = (ri: number, mi: number) => {
    const rm = rounds[ri]?.matches.length ?? 1;
    const slotH = MATCH_H + MATCH_GAP;
    const totalH = rounds[0].matches.length * slotH;
    const offset = (totalH - rm * slotH) / 2;
    return PAD_TOP + offset + mi * slotH;
  };
  const getMatchX = (ri: number) => PAD_LEFT + ri * (MATCH_W + ROUND_GAP);
  const totalH = PAD_TOP * 2 + rounds[0].matches.length * (MATCH_H + MATCH_GAP);
  const totalW = PAD_LEFT * 2 + numRounds * (MATCH_W + ROUND_GAP);
  return (
    <div className="bracket-canvas-wrap">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} width="100%" style={{ minWidth: totalW, overflow: "visible" }}>
        <defs>
          <linearGradient id="card-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
          </linearGradient>
          <linearGradient id="final-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(244,211,94,0.18)" />
            <stop offset="100%" stopColor="rgba(244,211,94,0.04)" />
          </linearGradient>
        </defs>
        {rounds.map((round, rIdx) => {
          if (rIdx >= rounds.length - 1) return null;
          const nextRound = rounds[rIdx + 1];
          return round.matches.map((_, mIdx) => {
            const x1 = getMatchX(rIdx) + MATCH_W;
            const y1 = getMatchY(rIdx, mIdx) + MATCH_H / 2;
            const targetIdx = Math.floor(mIdx / 2);
            const x2 = getMatchX(rIdx + 1);
            const y2 = getMatchY(rIdx + 1, targetIdx) + MATCH_H / 2;
            const midX = (x1 + x2) / 2;
            return (
              <motion.path key={`conn-${rIdx}-${mIdx}`}
                d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                fill="none" stroke="rgba(199,244,100,0.25)" strokeWidth="1.5" strokeDasharray="4 3"
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: rIdx * 0.15 + mIdx * 0.05, duration: 0.5 }} />
            );
          });
        })}
        {rounds.map((round, rIdx) => {
          const isFinal = rIdx === rounds.length - 1;
          return round.matches.map((match, mIdx) => {
            const x = getMatchX(rIdx); const y = getMatchY(rIdx, mIdx);
            const isAuto = match.status === "AUTO_ADVANCE";
            return (
              <motion.g key={match.id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: rIdx * 0.12 + mIdx * 0.06, duration: 0.3, type: "spring" }}>
                <rect x={x} y={y} width={MATCH_W} height={MATCH_H} rx={10}
                  fill={isFinal ? "url(#final-grad)" : "url(#card-grad)"}
                  stroke={isFinal ? "rgba(244,211,94,0.5)" : isAuto ? "rgba(199,244,100,0.35)" : "rgba(255,255,255,0.12)"}
                  strokeWidth={isFinal ? 1.5 : 1} />
                <line x1={x + 8} y1={y + MATCH_H / 2} x2={x + MATCH_W - 8} y2={y + MATCH_H / 2}
                  stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <text x={x + 10} y={y + MATCH_H / 2 - 10}
                  fill={match.left.participantName ? "#f4f1de" : "rgba(255,255,255,0.35)"}
                  fontSize="11" fontFamily="Manrope, sans-serif" fontWeight="600" dominantBaseline="middle">
                  {match.left.seed ? <tspan fill="rgba(199,244,100,0.7)" fontSize="9" fontWeight="700">S{match.left.seed} </tspan> : null}
                  {(match.left.participantName ?? "TBD").slice(0, 20)}
                </text>
                <text x={x + 10} y={y + MATCH_H / 2 + 10}
                  fill={match.right.participantName ? "#f4f1de" : "rgba(255,255,255,0.35)"}
                  fontSize="11" fontFamily="Manrope, sans-serif" fontWeight="600" dominantBaseline="middle">
                  {match.right.seed ? <tspan fill="rgba(199,244,100,0.7)" fontSize="9" fontWeight="700">S{match.right.seed} </tspan> : null}
                  {(match.right.participantName ?? "TBD").slice(0, 20)}
                </text>
                {isAuto && (
                  <g>
                    <rect x={x + MATCH_W - 58} y={y + 5} width={52} height={16} rx={8} fill="rgba(199,244,100,0.18)" />
                    <text x={x + MATCH_W - 32} y={y + 13} fill="#c7f464" fontSize="8"
                      fontFamily="Manrope, sans-serif" fontWeight="700" textAnchor="middle" dominantBaseline="middle">AUTO BYE</text>
                  </g>
                )}
              </motion.g>
            );
          });
        })}
        {rounds.map((round, rIdx) => (
          <text key={`label-${rIdx}`} x={getMatchX(rIdx) + MATCH_W / 2} y={PAD_TOP - 12}
            fill={rIdx === rounds.length - 1 ? "#f4d35e" : "rgba(255,255,255,0.45)"}
            fontSize="11" fontFamily="Bebas Neue, sans-serif" letterSpacing="2" textAnchor="middle" dominantBaseline="middle">
            {round.title.toUpperCase()}
          </text>
        ))}
      </svg>
    </div>
  );
}

function FixturesView({ stageId }: { stageId: string }) {
  const [fixtures, setFixtures] = useState<StageFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchStageFixtures(stageId).then(setFixtures).catch(() => setError("Could not load fixtures.")).finally(() => setLoading(false));
  }, [stageId]);

  const byRound = useMemo(() => {
    const map = new Map<number, StageFixture[]>();
    for (const f of fixtures) { if (!map.has(f.roundIndex)) map.set(f.roundIndex, []); map.get(f.roundIndex)!.push(f); }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [fixtures]);

  async function handleSave(fixtureId: string) {
    const hs = parseInt(homeScore); const as_ = parseInt(awayScore);
    if (isNaN(hs) || isNaN(as_) || hs < 0 || as_ < 0) { setError("Enter valid non-negative scores."); return; }
    try {
      setSaving(true); setError("");
      const updated = await updateFixtureResult(fixtureId, hs, as_);
      setFixtures((prev) => prev.map((f) => (f.id === fixtureId ? updated : f)));
      setEditingId(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="empty-state"><span className="empty-icon">⏳</span><p>Loading fixtures...</p></div>;
  if (fixtures.length === 0) return <div className="empty-state"><span className="empty-icon">📋</span><p>No fixtures in this stage.</p></div>;

  return (
    <div className="fixtures-view">
      {error && <p className="form-error" style={{ marginBottom: "1rem" }}>{error}</p>}
      {byRound.map(([roundIdx, roundFixtures]) => (
        <div key={roundIdx} className="fixtures-round">
          <h4 className="fixtures-round-title">Matchday {roundIdx}</h4>
          <div className="fixtures-list">
            {roundFixtures.map((f, i) => {
              const isEditing = editingId === f.id;
              const isDone = f.status === "COMPLETED";
              return (
                <motion.div key={f.id} className={`fixture-row ${isDone ? "fixture-done" : ""}`}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                  <div className="fixture-teams">
                    <span className="fixture-team home">{f.leftLabel ?? "TBD"}</span>
                    <div className="fixture-score-area">
                      {isDone && !isEditing ? (
                        <span className="fixture-scoreline"><strong>{f.leftScore}</strong><span className="score-sep">–</span><strong>{f.rightScore}</strong></span>
                      ) : isEditing ? (
                        <div className="score-entry">
                          <input className="score-input" type="number" min="0" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} placeholder="0" />
                          <span className="score-sep">–</span>
                          <input className="score-input" type="number" min="0" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} placeholder="0" />
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
                        <button className="btn-save-score" onClick={() => handleSave(f.id)} disabled={saving}>{saving ? "..." : "✓ Save"}</button>
                        <button className="btn-cancel-score" onClick={() => setEditingId(null)}>✕</button>
                      </>
                    ) : (
                      <button className="btn-enter-score"
                        onClick={() => { setEditingId(f.id); setHomeScore(f.leftScore?.toString() ?? ""); setAwayScore(f.rightScore?.toString() ?? ""); }}
                        disabled={f.status === "AUTO_ADVANCE" || f.status === "PENDING"}>
                        {isDone ? "Edit" : "Enter Score"}
                      </button>
                    )}
                    <span className={`fixture-status-badge status-${f.status.toLowerCase()}`}>
                      {f.status === "COMPLETED" ? "FT" : f.status === "AUTO_ADVANCE" ? "BYE" : "—"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StandingsView({ stageId }: { stageId: string }) {
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

function LeaderboardView({ stageId, participants, rankingRule }: { stageId: string; participants: TournamentParticipant[]; rankingRule: string }) {
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
            <span className="lb-col-rank">#</span>
            <span className="lb-col-name">Participant</span>
            <span className="lb-col-metric">{metricLabel}</span>
            <span className="lb-col-actions"></span>
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

function StageDetailPanel({ stage, participants, generatedBracket }: {
  stage: TournamentStage; participants: TournamentParticipant[]; generatedBracket: SingleEliminationBracket | null;
}) {
  const isLeaderboard = ["DIRECT_FINAL", "HEATS_PLUS_FINAL", "MULTI_EVENT_POINTS", "JUDGED_LEADERBOARD"].includes(stage.format);
  const isPointsTable = ["ROUND_ROBIN", "SWISS", "LEAGUE_PLUS_PLAYOFF"].includes(stage.format);
  const isBracket = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"].includes(stage.format);

  const tabs = useMemo(() => {
    const t: string[] = [];
    if (!isLeaderboard) t.push("fixtures");
    if (isPointsTable) t.push("standings");
    if (isBracket) t.push("bracket");
    if (isLeaderboard) t.push("leaderboard");
    return t;
  }, [stage.format, isLeaderboard, isPointsTable, isBracket]);

  const [activeTab, setActiveTab] = useState(tabs[0] ?? "fixtures");

  useEffect(() => { if (!tabs.includes(activeTab)) setActiveTab(tabs[0] ?? "fixtures"); }, [tabs]);

  return (
    <div className="stage-detail-panel">
      <div className="stage-detail-header">
        <h3 className="stage-detail-name">{stage.name}</h3>
        <span className="stage-format-chip">{FORMAT_LABELS[stage.format] ?? stage.format}</span>
        <span className={`stage-status-badge status-${stage.status.toLowerCase()}`}>{stage.status}</span>
      </div>
      <div className="tab-row">
        {tabs.map((tab) => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {activeTab === "fixtures" && !isLeaderboard && (
          <motion.div key="fixtures" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FixturesView stageId={stage.id} />
          </motion.div>
        )}
        {activeTab === "standings" && isPointsTable && (
          <motion.div key="standings" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StandingsView stageId={stage.id} />
          </motion.div>
        )}
        {activeTab === "bracket" && isBracket && (
          <motion.div key="bracket" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {generatedBracket ? (
              <div className="bracket-section">
                <div className="bracket-meta">
                  <span>{generatedBracket.participantCount} participants</span>
                  <span>{generatedBracket.slots} slots</span>
                  <span>{generatedBracket.byeCount} byes</span>
                </div>
                <div className="bracket-scroll"><BracketCanvas bracket={generatedBracket} /></div>
              </div>
            ) : (
              <div className="empty-state"><span className="empty-icon">🎯</span><p>Generate this stage to see the bracket.</p></div>
            )}
          </motion.div>
        )}
        {activeTab === "leaderboard" && isLeaderboard && (
          <motion.div key="leaderboard" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LeaderboardView stageId={stage.id} participants={participants} rankingRule={stage.rankingRule} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <motion.div className="stat-card" style={{ "--accent": accent } as any} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
    </motion.div>
  );
}

function SportCard({ sport, index }: { sport: SportDefinition; index: number }) {
  const color = VIEW_COLORS[sport.primaryView] ?? "#fff";
  return (
    <motion.article className="sport-card-v2" style={{ "--sport-accent": color } as any}
      initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }} transition={{ duration: 0.22, delay: index * 0.012 }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}>
      <div className="sc-header">
        <span className="sc-id">#{sport.id}</span>
        <span className="sc-tag" style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}>{sport.primaryView}</span>
      </div>
      <h3 className="sc-name">{sport.name}</h3>
      <p className="sc-format">{FORMAT_LABELS[sport.format] ?? sport.format}</p>
      <p className="sc-rule">{sport.rankingRule.replace(/_/g, " ")}</p>
      {sport.notes && <p className="sc-note">{sport.notes}</p>}
      <div className="sc-glow" style={{ background: `radial-gradient(circle at 80% 20%, ${color}22, transparent 60%)` }} />
    </motion.article>
  );
}

function Nav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const links: { id: Page; label: string }[] = [
    { id: "home", label: "Dashboard" }, { id: "create", label: "New Tournament" },
    { id: "tournament", label: "Tournament Hub" }, { id: "sports", label: "Sports Catalog" },
    { id: "playground", label: "Bracket Lab" },
  ];
  return (
    <nav className="main-nav">
      <div className="nav-logo">
        <span className="nav-logo-text">ZEMO</span>
        <span className="nav-logo-sub">Tournament OS</span>
      </div>
      <ul className="nav-links">
        {links.map((link) => (
          <li key={link.id}>
            <button className={`nav-link ${page === link.id ? "active" : ""}`} onClick={() => setPage(link.id)}>
              {link.label}
              {page === link.id && <motion.span className="nav-active-dot" layoutId="nav-dot" />}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function HomePage({ sports, tournaments, setPage }: { sports: SportDefinition[]; tournaments: Tournament[]; setPage: (p: Page) => void }) {
  const viewStats = useMemo(() => {
    const s = { BRACKET: 0, HYBRID: 0, STANDINGS: 0, LEADERBOARD: 0 };
    for (const sport of sports) s[sport.primaryView as keyof typeof s] += 1;
    return s;
  }, [sports]);
  return (
    <motion.div className="page-home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="home-hero">
        <div className="home-hero-bg">
          <div className="hero-orb hero-orb-1" /><div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" /><div className="hero-grid-lines" />
        </div>
        <div className="home-hero-content">
          <motion.p className="hero-eyebrow" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>⚡ Zemo Tournament Command Center</motion.p>
          <motion.h1 className="hero-headline" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
            Build Brackets.<br /><span className="hero-hl">Run Leagues.</span><br />Dominate Leaderboards.
          </motion.h1>
          <motion.p className="hero-sub" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            One platform for all {sports.length} sports — format-aware orchestration with a stunning live experience.
          </motion.p>
          <motion.div className="hero-ctas" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <button className="btn-primary" onClick={() => setPage("create")}>Start a Tournament</button>
            <button className="btn-ghost" onClick={() => setPage("playground")}>Try Bracket Lab →</button>
          </motion.div>
        </div>
      </div>
      <div className="stats-row">
        <StatCard label="Total Sports" value={sports.length} accent="#c7f464" />
        <StatCard label="Bracket Sports" value={viewStats.BRACKET + viewStats.HYBRID} accent="#ff6b35" />
        <StatCard label="Leaderboard Sports" value={viewStats.LEADERBOARD} accent="#f4d35e" />
        <StatCard label="Total Tournaments" value={tournaments.length} accent="#2ec4b6" />
      </div>
      {tournaments.length > 0 && (
        <section className="home-section">
          <div className="section-header">
            <h2 className="section-title">Recent Tournaments</h2>
            <button className="link-btn" onClick={() => setPage("tournament")}>View All →</button>
          </div>
          <div className="tournament-grid">
            {tournaments.slice(0, 6).map((t, i) => (
              <motion.article key={t.id} className="tournament-card"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                whileHover={{ y: -3 }} onClick={() => setPage("tournament")}>
                <div className="tc-top">
                  <span className={`tc-status status-${t.status.toLowerCase()}`}>{t.status}</span>
                  <span className="tc-sport">{t.sportName}</span>
                </div>
                <h3 className="tc-name">{t.name}</h3>
                <p className="tc-format">{FORMAT_LABELS[t.format] ?? t.format}</p>
                <p className="tc-date">{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </motion.article>
            ))}
          </div>
        </section>
      )}
      <section className="home-section">
        <div className="section-header">
          <h2 className="section-title">Sports Catalog Preview</h2>
          <button className="link-btn" onClick={() => setPage("sports")}>Browse All {sports.length} →</button>
        </div>
        <div className="sport-preview-row">
          {sports.slice(0, 6).map((s, i) => <SportCard key={s.id} sport={s} index={i} />)}
        </div>
      </section>
    </motion.div>
  );
}

function CreatePage({ sports, onCreated }: { sports: SportDefinition[]; onCreated: (t: Tournament) => void }) {
  const [tournamentName, setTournamentName] = useState("");
  const [selectedSportId, setSelectedSportId] = useState<number | "">("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Tournament | null>(null);
  const selectedSport = sports.find((s) => s.id === Number(selectedSportId)) ?? null;
  const viewGroups = useMemo(() => {
    const g: Record<string, SportDefinition[]> = {};
    for (const s of sports) { if (!g[s.primaryView]) g[s.primaryView] = []; g[s.primaryView].push(s); }
    return g;
  }, [sports]);
  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!tournamentName.trim() || !selectedSportId) { setError("Tournament name and sport are required."); return; }
    try {
      setIsSaving(true);
      const t = await createTournament({ name: tournamentName.trim(), sportId: Number(selectedSportId) });
      setSuccess(t); onCreated(t); setTournamentName(""); setSelectedSportId("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create tournament."); }
    finally { setIsSaving(false); }
  }
  return (
    <motion.div className="page-create" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="create-hero"><h1 className="page-title">Launch a Tournament</h1><p className="page-sub">Choose your sport, name your event, and Zemo handles the rest.</p></div>
      <div className="create-layout">
        <div className="create-form-wrap">
          <form onSubmit={handleSubmit} className="create-form-v2">
            <div className="form-field">
              <label className="field-label">Tournament Name</label>
              <input className="field-input" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} placeholder="e.g. Inter-College Basketball Cup 2025" />
            </div>
            <div className="form-field">
              <label className="field-label">Select Sport</label>
              <select className="field-select" value={selectedSportId} onChange={(e) => setSelectedSportId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Choose a sport...</option>
                {Object.entries(viewGroups).map(([view, sportList]) => (
                  <optgroup key={view} label={`── ${view} SPORTS ──`}>
                    {sportList.map((s) => <option key={s.id} value={s.id}>{s.name} — {FORMAT_LABELS[s.format] ?? s.format}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            {selectedSport && (
              <motion.div className="sport-preview-box" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <div className="spb-row"><span className="spb-label">Format</span><span className="spb-val">{FORMAT_LABELS[selectedSport.format] ?? selectedSport.format}</span></div>
                <div className="spb-row"><span className="spb-label">Ranking</span><span className="spb-val">{selectedSport.rankingRule.replace(/_/g, " ")}</span></div>
                <div className="spb-row"><span className="spb-label">View Type</span><span className="spb-val" style={{ color: VIEW_COLORS[selectedSport.primaryView] }}>{selectedSport.primaryView}</span></div>
                {selectedSport.notes && <p className="spb-note">{selectedSport.notes}</p>}
              </motion.div>
            )}
            {error && <p className="form-error">{error}</p>}
            {success && <motion.div className="form-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>✓ <strong>{success.name}</strong> created! Head to Tournament Hub.</motion.div>}
            <button type="submit" className="btn-primary btn-full" disabled={isSaving}>{isSaving ? "Creating..." : "Create Tournament →"}</button>
          </form>
        </div>
        <div className="create-info">
          <h3 className="info-title">How it works</h3>
          <div className="info-steps">
            {[
              { n: "01", t: "Pick your sport", d: "Zemo auto-selects the right competition format and ranking logic." },
              { n: "02", t: "Add participants", d: "Paste team/player names in bulk. Seeding is handled automatically." },
              { n: "03", t: "Generate stages", d: "Single Elim bracket or Round Robin league — persisted to the DB." },
              { n: "04", t: "Enter scores", d: "Log results and watch standings, brackets, and leaderboards update live." },
            ].map((step) => (
              <div key={step.n} className="info-step">
                <span className="step-num">{step.n}</span>
                <div><p className="step-title">{step.t}</p><p className="step-desc">{step.d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TournamentPage({ tournaments, sports }: { tournaments: Tournament[]; sports: SportDefinition[] }) {
  const [selectedId, setSelectedId] = useState(tournaments[0]?.id ?? "");
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [stages, setStages] = useState<TournamentStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [generatedBracket, setGeneratedBracket] = useState<SingleEliminationBracket | null>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [stageName, setStageName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateFormat, setGenerateFormat] = useState<"single-elimination" | "round-robin">("single-elimination");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mainTab, setMainTab] = useState<"participants" | "stages">("participants");

  const activeTournament = tournaments.find((t) => t.id === selectedId) ?? null;
  const activeStage = stages.find((s) => s.id === selectedStageId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true); setGeneratedBracket(null); setSelectedStageId(null);
    Promise.all([fetchTournamentParticipants(selectedId), fetchTournamentStages(selectedId)])
      .then(([p, s]) => { setParticipants(p); setStages(s); if (s.length > 0) setSelectedStageId(s[0].id); })
      .catch(() => setError("Could not load tournament data."))
      .finally(() => setLoading(false));
  }, [selectedId]);

  async function handleAddParticipants(e: FormEvent) {
    e.preventDefault(); setError("");
    const names = bulkInput.split("\n").map((n) => n.trim()).filter(Boolean);
    if (!names.length) return;
    try {
      setIsAdding(true);
      const p = await addParticipantsToTournament(selectedId, names);
      setParticipants(p); setBulkInput("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add participants."); }
    finally { setIsAdding(false); }
  }

  async function handleGenerateStage(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      setIsGenerating(true);
      if (generateFormat === "single-elimination") {
        const result = await generateSingleEliminationStageForTournament(selectedId, stageName || undefined);
        setGeneratedBracket(result.bracket);
        setStages((prev) => Array.from(new Map([result.stage, ...prev].map((s) => [s.id, s])).values()).sort((a, b) => a.sequence - b.sequence));
        setSelectedStageId(result.stage.id);
      } else {
        const result = await generateRoundRobinStageForTournament(selectedId, stageName || undefined);
        setStages((prev) => Array.from(new Map([result.stage, ...prev].map((s) => [s.id, s])).values()).sort((a, b) => a.sequence - b.sequence));
        setSelectedStageId(result.stage.id);
      }
      setStageName(""); setMainTab("stages");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not generate stage. Add at least 2 participants first."); }
    finally { setIsGenerating(false); }
  }

  return (
    <motion.div className="page-tournament" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="tournament-selector-row">
        <h1 className="page-title">Tournament Hub</h1>
        <select className="field-select tournament-picker" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">Select a tournament...</option>
          {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.sportName}</option>)}
        </select>
      </div>

      {activeTournament && (
        <motion.div className="tournament-meta-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {[
            { label: "Sport", val: activeTournament.sportName },
            { label: "Format", val: FORMAT_LABELS[activeTournament.format] ?? activeTournament.format },
            { label: "Status", val: activeTournament.status, cls: `status-badge status-${activeTournament.status.toLowerCase()}` },
            { label: "Participants", val: loading ? "..." : String(participants.length) },
            { label: "Stages", val: String(stages.length) },
          ].map(({ label, val, cls }) => (
            <div key={label} className="tmb-item">
              <span className="tmb-label">{label}</span>
              <span className={cls ? `tmb-val ${cls}` : "tmb-val"}>{val}</span>
            </div>
          ))}
        </motion.div>
      )}

      {error && <p className="form-error">{error}</p>}

      {activeTournament && (
        <div className="tournament-body-v2">
          <div className="tournament-sidebar">
            <div className="sidebar-tabs">
              <button className={`sidebar-tab ${mainTab === "participants" ? "active" : ""}`} onClick={() => setMainTab("participants")}>
                Participants {participants.length > 0 && <span className="tab-count">{participants.length}</span>}
              </button>
              <button className={`sidebar-tab ${mainTab === "stages" ? "active" : ""}`} onClick={() => setMainTab("stages")}>
                Stages {stages.length > 0 && <span className="tab-count">{stages.length}</span>}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {mainTab === "participants" && (
                <motion.div key="p-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <form onSubmit={handleAddParticipants} className="action-card">
                    <h3 className="action-title">Add Participants</h3>
                    <textarea className="field-input field-textarea" value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} placeholder={"Team Alpha\nTeam Bravo\nTeam Charlie"} rows={5} />
                    <button type="submit" className="btn-lime btn-full" disabled={isAdding || !selectedId}>{isAdding ? "Adding..." : "Add Participants"}</button>
                  </form>
                  <div className="participant-list-compact">
                    {participants.length === 0 ? <p className="sidebar-empty">No participants yet.</p> : (
                      participants.map((p, i) => (
                        <motion.div key={p.id} className="participant-row" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                          <span className="p-seed">S{p.seed ?? "—"}</span>
                          <span className="p-name">{p.name}</span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
              {mainTab === "stages" && (
                <motion.div key="s-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <form onSubmit={handleGenerateStage} className="action-card">
                    <h3 className="action-title">Generate Stage</h3>
                    <input className="field-input" value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Stage name (optional)" />
                    <div className="format-select-row">
                      <button type="button" className={`format-pill ${generateFormat === "single-elimination" ? "active" : ""}`} onClick={() => setGenerateFormat("single-elimination")}>Single Elim</button>
                      <button type="button" className={`format-pill ${generateFormat === "round-robin" ? "active" : ""}`} onClick={() => setGenerateFormat("round-robin")}>Round Robin</button>
                    </div>
                    <button type="submit" className="btn-gold btn-full" disabled={isGenerating || !selectedId}>{isGenerating ? "Generating..." : "⚡ Generate Stage"}</button>
                    <p className="action-hint">Requires at least 2 participants.</p>
                  </form>
                  {stages.length > 0 && (
                    <div className="stages-nav">
                      {stages.map((stage) => (
                        <button key={stage.id} className={`stage-nav-btn ${selectedStageId === stage.id ? "active" : ""}`} onClick={() => setSelectedStageId(stage.id)}>
                          <span className="stage-nav-seq">#{stage.sequence}</span>
                          <div>
                            <p className="stage-nav-name">{stage.name}</p>
                            <p className="stage-nav-format">{FORMAT_LABELS[stage.format] ?? stage.format}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="tournament-main-panel">
            {activeStage ? (
              <StageDetailPanel stage={activeStage} participants={participants}
                generatedBracket={activeStage.format === "SINGLE_ELIMINATION" ? generatedBracket : null} />
            ) : (
              <div className="empty-state large">
                <span className="empty-icon">🏆</span>
                <p>Generate a stage to get started.</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Add participants first, then use the Stages tab.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!activeTournament && tournaments.length === 0 && (
        <div className="empty-state large"><span className="empty-icon">🏟️</span><p>No tournaments yet. Create your first event!</p></div>
      )}
    </motion.div>
  );
}

function SportsPage({ sports }: { sports: SportDefinition[] }) {
  const [activeView, setActiveView] = useState<PrimaryView | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => sports.filter((s) => {
    const matchView = activeView === "ALL" || s.primaryView === activeView;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    return matchView && matchSearch;
  }), [sports, activeView, search]);
  const views: Array<PrimaryView | "ALL"> = ["ALL", "BRACKET", "HYBRID", "STANDINGS", "LEADERBOARD"];
  return (
    <motion.div className="page-sports" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <h1 className="page-title">Sports Catalog</h1>
      <p className="page-sub">{sports.length} sports across all competition formats.</p>
      <div className="sports-controls">
        <div className="pill-row">
          {views.map((view) => (
            <button key={view} className={`pill-btn ${activeView === view ? "active" : ""}`}
              style={activeView === view && view !== "ALL" ? { "--pill-color": VIEW_COLORS[view] } as any : {}}
              onClick={() => setActiveView(view)}>{view === "ALL" ? "All Sports" : view}</button>
          ))}
        </div>
        <input className="field-input search-input" placeholder="Search sports..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="sport-grid-v2">
        <AnimatePresence>{filtered.map((s, i) => <SportCard key={s.id} sport={s} index={i} />)}</AnimatePresence>
      </div>
    </motion.div>
  );
}

function PlaygroundPage() {
  const [input, setInput] = useState("Alpha\nBravo\nCharlie\nDelta\nEcho\nFoxtrot\nGolf\nHotel");
  const [bracket, setBracket] = useState<SingleEliminationBracket | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  async function handleGenerate(e: FormEvent) {
    e.preventDefault(); setError("");
    const names = input.split("\n").map((n) => n.trim()).filter(Boolean);
    if (names.length < 2) { setError("Enter at least 2 participants."); return; }
    try { setIsGenerating(true); const b = await generateSingleEliminationBracket(names); setBracket(b); }
    catch { setError("Could not generate bracket. Check API is running."); }
    finally { setIsGenerating(false); }
  }
  return (
    <motion.div className="page-playground" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <h1 className="page-title">Bracket Lab</h1>
      <p className="page-sub">Instantly visualize single-elimination brackets. No database required.</p>
      <div className="playground-layout">
        <div className="playground-input-col">
          <form onSubmit={handleGenerate} className="action-card">
            <label className="field-label">Participants (one per line)</label>
            <textarea className="field-input field-textarea" value={input} onChange={(e) => setInput(e.target.value)} rows={12} placeholder={"Team A\nTeam B\n..."} />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-cyan btn-full" disabled={isGenerating}>{isGenerating ? "Generating..." : "⚡ Generate Bracket"}</button>
          </form>
          {bracket && (
            <div className="bracket-stats-box">
              <div className="bsb-row"><span>Participants</span><strong>{bracket.participantCount}</strong></div>
              <div className="bsb-row"><span>Total Slots</span><strong>{bracket.slots}</strong></div>
              <div className="bsb-row"><span>Byes</span><strong>{bracket.byeCount}</strong></div>
              <div className="bsb-row"><span>Rounds</span><strong>{bracket.rounds.length}</strong></div>
            </div>
          )}
        </div>
        <div className="playground-bracket-col">
          {bracket ? (
            <motion.div className="bracket-result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <h3 className="bracket-result-title">{bracket.rounds[bracket.rounds.length - 1]?.title ?? "Bracket"}</h3>
              <div className="bracket-scroll"><BracketCanvas bracket={bracket} /></div>
            </motion.div>
          ) : (
            <div className="bracket-placeholder">
              <div className="bp-inner"><span className="bp-icon">🎯</span><p>Your bracket will appear here</p><p className="bp-hint">Enter participants and click Generate</p></div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [sports, setSports] = useState<SportDefinition[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([fetchSports(), fetchTournaments()])
      .then(([s, t]) => { setSports(s); setTournaments(t); })
      .catch(() => setError("Could not connect to API. Make sure the backend is running on port 4000."));
  }, []);
  function handleTournamentCreated(t: Tournament) { setTournaments((prev) => [t, ...prev]); setPage("tournament"); }
  return (
    <div className="app-root">
      <Nav page={page} setPage={setPage} />
      <main className="app-main">
        {error && <motion.div className="api-error-banner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>⚠️ {error}</motion.div>}
        <AnimatePresence mode="wait">
          {page === "home" && <HomePage key="home" sports={sports} tournaments={tournaments} setPage={setPage} />}
          {page === "create" && <CreatePage key="create" sports={sports} onCreated={handleTournamentCreated} />}
          {page === "tournament" && <TournamentPage key="tournament" tournaments={tournaments} sports={sports} />}
          {page === "sports" && <SportsPage key="sports" sports={sports} />}
          {page === "playground" && <PlaygroundPage key="playground" />}
        </AnimatePresence>
      </main>
      <footer className="app-footer">
        <p>Zemo Tournament OS · {sports.length} Sports · Built with Arena Pulse Design System</p>
      </footer>
    </div>
  );
}