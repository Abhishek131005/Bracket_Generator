import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useState } from "react";
import { createTournament } from "../api";
import { SportPickerModal } from "../components/SportPickerModal";
import { FORMAT_LABELS, VIEW_COLORS } from "../constants";
import type { SportDefinition, Tournament } from "../types";

export function CreatePage({ sports, onCreated }: {
  sports: SportDefinition[];
  onCreated: (t: Tournament) => void;
}) {
  const [tournamentName, setTournamentName] = useState("");
  const [selectedSportId, setSelectedSportId] = useState<number | "">("");
  const [showPicker, setShowPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Tournament | null>(null);
  const selectedSport = sports.find((s) => s.id === Number(selectedSportId)) ?? null;

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
      <div className="create-hero">
        <h1 className="page-title">Launch a Tournament</h1>
        <p className="page-sub">Choose your sport, name your event, and Zemo handles the rest.</p>
      </div>
      <div className="create-layout">
        <div className="create-form-wrap">
          <form onSubmit={handleSubmit} className="create-form-v2">
            <div className="form-field">
              <label className="field-label">Tournament Name</label>
              <input className="field-input" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)}
                placeholder="e.g. Inter-College Basketball Cup 2025" />
            </div>
            <div className="form-field">
              <label className="field-label">Select Sport</label>
              <button type="button" className={`sport-picker-trigger ${selectedSport ? "has-value" : ""}`}
                onClick={() => setShowPicker(true)}>
                {selectedSport ? (
                  <span className="spt-selected">
                    <span className="spt-dot" style={{ background: VIEW_COLORS[selectedSport.primaryView] ?? "#fff" }} />
                    <span className="spt-name">{selectedSport.name}</span>
                    <span className="spt-format">{FORMAT_LABELS[selectedSport.format] ?? selectedSport.format}</span>
                  </span>
                ) : (
                  <span className="spt-placeholder">
                    <span className="spt-icon">🏅</span>
                    Browse {sports.length} sports…
                  </span>
                )}
                <span className="spt-arrow">⌄</span>
              </button>
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
            {success && (
              <motion.div className="form-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                ✓ <strong>{success.name}</strong> created! Head to Tournament Hub.
              </motion.div>
            )}
            <button type="submit" className="btn-primary btn-full" disabled={isSaving}>
              {isSaving ? "Creating..." : "Create Tournament →"}
            </button>
          </form>
        </div>
        <div className="create-info">
          <h3 className="info-title">How it works</h3>
          <div className="info-steps">
            {[
              { n: "01", t: "Pick your sport", d: "Zemo auto-selects the right competition format and ranking logic." },
              { n: "02", t: "Add participants", d: "Paste team/player names in bulk. Seeding is handled automatically." },
              { n: "03", t: "Generate stages", d: "Choose Single Elim, Double Elim, Round Robin, Swiss, or League+Playoff." },
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
      <AnimatePresence>
        {showPicker && (
          <SportPickerModal sports={sports} selectedId={selectedSportId}
            onSelect={(id) => setSelectedSportId(id)} onClose={() => setShowPicker(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
