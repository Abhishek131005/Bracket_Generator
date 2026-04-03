import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useEffect, useState } from "react";
import {
  addParticipantsToTournament,
  fetchTournamentParticipants,
  fetchTournamentStages,
  generateDoubleEliminationStageForTournament,
  generateHeatsPlusFinalStageForTournament,
  generateMultiEventPointsStageForTournament,
  generateLeaguePlusPlayoffStageForTournament,
  generateRoundRobinStageForTournament,
  generateSingleEliminationStageForTournament,
  generateSwissStageForTournament,
} from "../api";
import { StageDetailPanel } from "../components/StageDetailPanel";
import { FORMAT_LABELS } from "../constants";
import type { SingleEliminationBracket, SportDefinition, Tournament, TournamentParticipant, TournamentStage } from "../types";

type GenerateFormat =
  | "single-elimination"
  | "round-robin"
  | "double-elimination"
  | "swiss"
  | "league-plus-playoff"
  | "heats-plus-final"
  | "multi-event-points";

const GENERATE_FORMATS: { id: GenerateFormat; label: string }[] = [
  { id: "single-elimination", label: "Single Elim" },
  { id: "double-elimination", label: "Double Elim" },
  { id: "round-robin", label: "Round Robin" },
  { id: "swiss", label: "Swiss" },
  { id: "league-plus-playoff", label: "League + PO" },
  { id: "heats-plus-final", label: "Heats + Final" },
  { id: "multi-event-points", label: "Multi-Event" },
];

export function TournamentPage({ tournaments, sports }: { tournaments: Tournament[]; sports: SportDefinition[] }) {
  const [selectedId, setSelectedId] = useState(tournaments[0]?.id ?? "");
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [stages, setStages] = useState<TournamentStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [stageName, setStageName] = useState("");
  const [swissRounds, setSwissRounds] = useState("");
  const [heatsPerHeat, setHeatsPerHeat] = useState("");
  const [multiEventNames, setMultiEventNames] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateFormat, setGenerateFormat] = useState<GenerateFormat>("single-elimination");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mainTab, setMainTab] = useState<"participants" | "stages">("participants");

  const activeTournament = tournaments.find((t) => t.id === selectedId) ?? null;
  const activeStage = stages.find((s) => s.id === selectedStageId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true); setSelectedStageId(null);
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
        setStages((prev) => mergeStages(prev, result.stage));
        setSelectedStageId(result.stage.id);
      } else if (generateFormat === "round-robin") {
        const result = await generateRoundRobinStageForTournament(selectedId, stageName || undefined);
        setStages((prev) => mergeStages(prev, result.stage));
        setSelectedStageId(result.stage.id);
      } else if (generateFormat === "double-elimination") {
        const result = await generateDoubleEliminationStageForTournament(selectedId, stageName || undefined);
        setStages((prev) => mergeStages(prev, result.stage));
        setSelectedStageId(result.stage.id);
      } else if (generateFormat === "swiss") {
        const rounds = swissRounds ? parseInt(swissRounds) : undefined;
        const result = await generateSwissStageForTournament(selectedId, stageName || undefined, rounds);
        setStages((prev) => mergeStages(prev, result.stage));
        setSelectedStageId(result.stage.id);
      } else if (generateFormat === "league-plus-playoff") {
        const result = await generateLeaguePlusPlayoffStageForTournament(selectedId, stageName || undefined);
        setStages((prev) => mergeStages(prev, result.leagueStage));
        setSelectedStageId(result.leagueStage.id);
      } else if (generateFormat === "heats-plus-final") {
        const perHeat = heatsPerHeat ? parseInt(heatsPerHeat) : undefined;
        const result = await generateHeatsPlusFinalStageForTournament(selectedId, stageName || undefined, perHeat);
        setStages((prev) => mergeStages(prev, result.stage));
        setSelectedStageId(result.stage.id);
      } else if (generateFormat === "multi-event-points") {
        const names = multiEventNames.split(",").map((n) => n.trim()).filter(Boolean);
        const result = await generateMultiEventPointsStageForTournament(
          selectedId,
          stageName || undefined,
          names.length ? names : undefined
        );
        setStages((prev) => mergeStages(prev, result.stage));
        setSelectedStageId(result.stage.id);
      }
      setStageName(""); setMainTab("stages");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not generate stage. Add at least 2 participants first."); }
    finally { setIsGenerating(false); }
  }

  function mergeStages(prev: TournamentStage[], newStage: TournamentStage): TournamentStage[] {
    return Array.from(new Map([newStage, ...prev].map((s) => [s.id, s])).values()).sort((a, b) => a.sequence - b.sequence);
  }

  function handlePlayoffGenerate(newStage: TournamentStage, _bracket: SingleEliminationBracket) {
    setStages((prev) => mergeStages(prev, newStage));
    setSelectedStageId(newStage.id);
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
                    <textarea className="field-input field-textarea" value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder={"Team Alpha\nTeam Bravo\nTeam Charlie"} rows={5} />
                    <button type="submit" className="btn-lime btn-full" disabled={isAdding || !selectedId}>
                      {isAdding ? "Adding..." : "Add Participants"}
                    </button>
                  </form>
                  <div className="participant-list-compact">
                    {participants.length === 0 ? <p className="sidebar-empty">No participants yet.</p> : (
                      participants.map((p, i) => (
                        <motion.div key={p.id} className="participant-row"
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
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
                    <input className="field-input" value={stageName} onChange={(e) => setStageName(e.target.value)}
                      placeholder="Stage name (optional)" />
                    <div className="format-select-row" style={{ flexWrap: "wrap", gap: "0.35rem" }}>
                      {GENERATE_FORMATS.map((f) => (
                        <button key={f.id} type="button"
                          className={`format-pill ${generateFormat === f.id ? "active" : ""}`}
                          onClick={() => setGenerateFormat(f.id)}>{f.label}</button>
                      ))}
                    </div>
                    {generateFormat === "swiss" && (
                      <input className="field-input" type="number" min="1" max="20" value={swissRounds}
                        onChange={(e) => setSwissRounds(e.target.value)} placeholder="Rounds (default: auto)" />
                    )}
                    {generateFormat === "heats-plus-final" && (
                      <input className="field-input" type="number" min="2" max="32" value={heatsPerHeat}
                        onChange={(e) => setHeatsPerHeat(e.target.value)} placeholder="Athletes per heat (default: 8)" />
                    )}
                    {generateFormat === "multi-event-points" && (
                      <input className="field-input" value={multiEventNames}
                        onChange={(e) => setMultiEventNames(e.target.value)}
                        placeholder="Events: 100m, 200m, Long Jump (default: 3 events)" />
                    )}
                    <button type="submit" className="btn-gold btn-full" disabled={isGenerating || !selectedId}>
                      {isGenerating ? "Generating..." : "⚡ Generate Stage"}
                    </button>
                    <p className="action-hint">Requires at least 2 participants.</p>
                  </form>
                  {stages.length > 0 && (
                    <div className="stages-nav">
                      {stages.map((stage) => (
                        <button key={stage.id}
                          className={`stage-nav-btn ${selectedStageId === stage.id ? "active" : ""}`}
                          onClick={() => setSelectedStageId(stage.id)}>
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
              <StageDetailPanel
                stage={activeStage}
                participants={participants}
                onPlayoffGenerate={handlePlayoffGenerate}
                tournamentId={selectedId}
              />
            ) : (
              <div className="empty-state large">
                <span className="empty-icon">🏆</span>
                <p>Generate a stage to get started.</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                  Add participants first, then use the Stages tab.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {!activeTournament && tournaments.length === 0 && (
        <div className="empty-state large">
          <span className="empty-icon">🏟️</span>
          <p>No tournaments yet. Create your first event!</p>
        </div>
      )}
    </motion.div>
  );
}
