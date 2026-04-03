import { motion } from "framer-motion";
import { type FormEvent, useState } from "react";
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from "../api";
import { BracketCanvas } from "../components/BracketCanvas";
import { DEBracketCanvas } from "../components/DEBracketCanvas";
import type { DoubleEliminationBracket, SingleEliminationBracket } from "../types";

export function PlaygroundPage() {
  const [input, setInput] = useState("Alpha\nBravo\nCharlie\nDelta\nEcho\nFoxtrot\nGolf\nHotel");
  const [bracket, setBracket] = useState<SingleEliminationBracket | null>(null);
  const [deBracket, setDEBracket] = useState<DoubleEliminationBracket | null>(null);
  const [mode, setMode] = useState<"single" | "double">("single");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate(e: FormEvent) {
    e.preventDefault(); setError(""); setBracket(null); setDEBracket(null);
    const names = input.split("\n").map((n) => n.trim()).filter(Boolean);
    if (names.length < 2) { setError("Enter at least 2 participants."); return; }
    try {
      setIsGenerating(true);
      if (mode === "single") { setBracket(await generateSingleEliminationBracket(names)); }
      else { setDEBracket(await generateDoubleEliminationBracket(names)); }
    } catch { setError("Could not generate bracket. Check API is running."); }
    finally { setIsGenerating(false); }
  }

  const activeBracket = mode === "single" ? bracket : deBracket;

  return (
    <motion.div className="page-playground" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <h1 className="page-title">Bracket Lab</h1>
      <p className="page-sub">Instantly visualize brackets. No database required.</p>
      <div className="playground-layout">
        <div className="playground-input-col">
          <form onSubmit={handleGenerate} className="action-card">
            <label className="field-label">Bracket Type</label>
            <div className="format-select-row">
              <button type="button" className={`format-pill ${mode === "single" ? "active" : ""}`} onClick={() => setMode("single")}>Single Elim</button>
              <button type="button" className={`format-pill ${mode === "double" ? "active" : ""}`} onClick={() => setMode("double")}>Double Elim</button>
            </div>
            <label className="field-label" style={{ marginTop: "0.5rem" }}>Participants (one per line)</label>
            <textarea className="field-input field-textarea" value={input} onChange={(e) => setInput(e.target.value)}
              rows={12} placeholder={"Team A\nTeam B\n..."} />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-cyan btn-full" disabled={isGenerating}>
              {isGenerating ? "Generating..." : "⚡ Generate Bracket"}
            </button>
          </form>
          {activeBracket && (
            <div className="bracket-stats-box">
              <div className="bsb-row"><span>Participants</span><strong>{activeBracket.participantCount}</strong></div>
              <div className="bsb-row"><span>Total Slots</span><strong>{activeBracket.slots}</strong></div>
              <div className="bsb-row"><span>Byes</span><strong>{activeBracket.byeCount}</strong></div>
              {mode === "single" && bracket && <div className="bsb-row"><span>Rounds</span><strong>{bracket.rounds.length}</strong></div>}
              {mode === "double" && deBracket && <>
                <div className="bsb-row"><span>WB Rounds</span><strong>{deBracket.winnersRounds.length}</strong></div>
                <div className="bsb-row"><span>LB Rounds</span><strong>{deBracket.losersRounds.length}</strong></div>
              </>}
            </div>
          )}
        </div>
        <div className="playground-bracket-col">
          {bracket && mode === "single" ? (
            <motion.div className="bracket-result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <h3 className="bracket-result-title">{bracket.rounds[bracket.rounds.length - 1]?.title ?? "Bracket"}</h3>
              <div className="bracket-scroll"><BracketCanvas bracket={bracket} /></div>
            </motion.div>
          ) : deBracket && mode === "double" ? (
            <motion.div className="bracket-result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <h3 className="bracket-result-title">Double Elimination — {deBracket.participantCount} teams</h3>
              <div className="bracket-scroll"><DEBracketCanvas bracket={deBracket} /></div>
            </motion.div>
          ) : (
            <div className="bracket-placeholder">
              <div className="bp-inner">
                <span className="bp-icon">🎯</span>
                <p>Your bracket will appear here</p>
                <p className="bp-hint">Enter participants and click Generate</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
