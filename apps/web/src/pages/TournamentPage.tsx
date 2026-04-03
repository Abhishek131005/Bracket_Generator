import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useEffect, useState } from "react";
import { StageDetailPanel } from "../components/StageDetailPanel";
import { FORMAT_LABELS } from "../constants";
import { useParticipants, useStages, useTournaments } from "../hooks/useQueries";
import { useAddParticipants, useGenerateStage } from "../hooks/useMutations";
import { useAppStore } from "../store";
import type { TournamentStage } from "../types";

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

export function TournamentPage() {
  const selectedId = useAppStore((s) => s.selectedTournamentId);
  const setSelectedId = useAppStore((s) => s.setSelectedTournamentId);
  const selectedStageId = useAppStore((s) => s.selectedStageId);
  const setSelectedStageId = useAppStore((s) => s.setSelectedStageId);

  const { data: tournaments = [] } = useTournaments();
  const { data: participants = [], isLoading: loadingParticipants } = useParticipants(selectedId);
  const { data: stages = [], isLoading: loadingStages } = useStages(selectedId);

  const addParticipants = useAddParticipants(selectedId);
  const generateStage = useGenerateStage(selectedId);

  const [bulkInput, setBulkInput] = useState("");
  const [stageName, setStageName] = useState("");
  const [swissRounds, setSwissRounds] = useState("");
  const [heatsPerHeat, setHeatsPerHeat] = useState("");
  const [multiEventNames, setMultiEventNames] = useState("");
  const [generateFormat, setGenerateFormat] = useState<GenerateFormat>("single-elimination");
  const [addError, setAddError] = useState("");
  const [genError, setGenError] = useState("");
  const [mainTab, setMainTab] = useState<"participants" | "stages">("participants");

  // Initialise selected tournament to first on load
  useEffect(() => {
    if (!selectedId && tournaments.length > 0) setSelectedId(tournaments[0].id);
  }, [tournaments, selectedId]);

  // Auto-select first stage when stages load for a new tournament
  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) setSelectedStageId(stages[0].id);
  }, [stages]);

  const activeTournament = tournaments.find((t) => t.id === selectedId) ?? null;
  const activeStage = stages.find((s) => s.id === selectedStageId) ?? null;

  function handleTournamentChange(id: string) {
    setSelectedId(id);   // also resets selectedStageId via store action
    setMainTab("participants");
  }

  async function handleAddParticipants(e: FormEvent) {
    e.preventDefault();
    setAddError("");
    const names = bulkInput.split("\n").map((n) => n.trim()).filter(Boolean);
    if (!names.length) return;
    addParticipants.mutate(names, {
      onSuccess: () => setBulkInput(""),
      onError: (err) => setAddError(err instanceof Error ? err.message : "Could not add participants."),
    });
  }

  async function handleGenerateStage(e: FormEvent) {
    e.preventDefault();
    setGenError("");

    const payload = (() => {
      if (generateFormat === "swiss")
        return { format: generateFormat, stageName: stageName || undefined, totalRounds: swissRounds ? parseInt(swissRounds) : undefined };
      if (generateFormat === "heats-plus-final")
        return { format: generateFormat, stageName: stageName || undefined, participantsPerHeat: heatsPerHeat ? parseInt(heatsPerHeat) : undefined };
      if (generateFormat === "multi-event-points") {
        const names = multiEventNames.split(",").map((n) => n.trim()).filter(Boolean);
        return { format: generateFormat, stageName: stageName || undefined, eventNames: names.length ? names : undefined };
      }
      return { format: generateFormat, stageName: stageName || undefined };
    })();

    generateStage.mutate(payload as any, {
      onSuccess: (result) => {
        setStageName("");
        setMainTab("stages");
        // Select the newly created stage
        const newStage: TournamentStage = "stage" in result ? result.stage : (result as any).leagueStage;
        if (newStage) setSelectedStageId(newStage.id);
      },
      onError: (err) => setGenError(err instanceof Error ? err.message : "Could not generate stage. Add at least 2 participants first."),
    });
  }

  const loading = loadingParticipants || loadingStages;

  return (
    <motion.div className="page-tournament" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="tournament-selector-row">
        <h1 className="page-title">Tournament Hub</h1>
        <select className="field-select tournament-picker" value={selectedId} onChange={(e) => handleTournamentChange(e.target.value)}>
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
                    {addError && <p className="form-error">{addError}</p>}
                    <button type="submit" className="btn-lime btn-full" disabled={addParticipants.isPending || !selectedId}>
                      {addParticipants.isPending ? "Adding..." : "Add Participants"}
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
                    {genError && <p className="form-error">{genError}</p>}
                    <button type="submit" className="btn-gold btn-full" disabled={generateStage.isPending || !selectedId}>
                      {generateStage.isPending ? "Generating..." : "⚡ Generate Stage"}
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
