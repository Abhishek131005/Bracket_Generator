import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildBracketFromFixtures, buildDEBracketFromFixtures } from "../bracketUtils";
import { FORMAT_LABELS } from "../constants";
import { useFixtures } from "../hooks/useQueries";
import { useGeneratePlayoff } from "../hooks/useMutations";
import { useAppStore } from "../store";
import type {
  DoubleEliminationBracket,
  SingleEliminationBracket,
  TournamentParticipant,
  TournamentStage,
} from "../types";
import { BracketCanvas } from "./BracketCanvas";
import { DEBracketCanvas } from "./DEBracketCanvas";
import { FixturesView } from "./FixturesView";
import { HeatsView } from "./HeatsView";
import { LeaderboardView } from "./LeaderboardView";
import { MultiEventView } from "./MultiEventView";
import { StandingsView } from "./StandingsView";

export function StageDetailPanel({
  stage, participants, tournamentId,
}: {
  stage: TournamentStage;
  participants: TournamentParticipant[];
  tournamentId: string;
}) {
  const setSelectedStageId = useAppStore((s) => s.setSelectedStageId);
  const generatePlayoff = useGeneratePlayoff(tournamentId);

  const isLeaderboard = ["DIRECT_FINAL", "HEATS_PLUS_FINAL", "MULTI_EVENT_POINTS", "JUDGED_LEADERBOARD"].includes(stage.format);
  const isHeatsPlusFinal = stage.format === "HEATS_PLUS_FINAL";
  const isMultiEvent = stage.format === "MULTI_EVENT_POINTS";
  const isPointsTable = ["ROUND_ROBIN", "SWISS", "LEAGUE_PLUS_PLAYOFF"].includes(stage.format);
  const isBracket = stage.format === "SINGLE_ELIMINATION";
  const isDEBracket = stage.format === "DOUBLE_ELIMINATION";
  const isLeaguePlusPlayoff = stage.format === "LEAGUE_PLUS_PLAYOFF";

  // Fixtures from TanStack Query (shared cache — no double requests)
  const { data: fixtures = [] } = useFixtures(isBracket || isDEBracket ? stage.id : "");

  const [liveBracket, setLiveBracket] = useState<SingleEliminationBracket | null>(null);
  const [liveDEBracket, setLiveDEBracket] = useState<DoubleEliminationBracket | null>(null);
  const [playoffCount, setPlayoffCount] = useState("4");
  const [playoffError, setPlayoffError] = useState("");

  const tabs = useMemo(() => {
    const t: string[] = [];
    if (!isLeaderboard) t.push("fixtures");
    if (isPointsTable) t.push("standings");
    if (isBracket) t.push("bracket");
    if (isDEBracket) t.push("de-bracket");
    if (isHeatsPlusFinal) t.push("heats");
    if (isMultiEvent) t.push("multi-event");
    if (isLeaderboard) t.push("leaderboard");
    if (isLeaguePlusPlayoff) t.push("playoff");
    return t;
  }, [stage.format]);

  const [activeTab, setActiveTab] = useState(tabs[0] ?? "fixtures");
  useEffect(() => { if (!tabs.includes(activeTab)) setActiveTab(tabs[0] ?? "fixtures"); }, [stage.id]);

  // Rebuild bracket whenever fixtures data changes from the cache
  useEffect(() => {
    if (isBracket && fixtures.length > 0) {
      setLiveBracket(buildBracketFromFixtures(fixtures, participants.length));
    }
    if (isDEBracket && fixtures.length > 0) {
      setLiveDEBracket(buildDEBracketFromFixtures(fixtures, participants.length));
    }
  }, [fixtures, isBracket, isDEBracket, participants.length]);

  const handleFixturesChanged = useCallback(() => {
    // FixturesView invalidates the fixtures query after mutations —
    // the useEffect above will rebuild the bracket automatically.
  }, []);

  async function handleGeneratePlayoff() {
    const count = parseInt(playoffCount);
    if (isNaN(count) || count < 2) { setPlayoffError("Enter a valid team count (min 2)."); return; }
    setPlayoffError("");
    generatePlayoff.mutate(
      { leagueStageId: stage.id, playoffTeamCount: count },
      {
        onSuccess: (result) => {
          const newStage = "stage" in result ? result.stage : null;
          if (newStage) setSelectedStageId(newStage.id);
        },
        onError: (err) => setPlayoffError(err instanceof Error ? err.message : "Could not generate playoff."),
      }
    );
  }

  return (
    <div className="stage-detail-panel">
      <div className="stage-detail-header">
        <h3 className="stage-detail-name">{stage.name}</h3>
        <span className="stage-format-chip">{FORMAT_LABELS[stage.format] ?? stage.format}</span>
        <span className={`stage-status-badge status-${stage.status.toLowerCase()}`}>{stage.status}</span>
      </div>
      <div className="tab-row">
        {tabs.map((tab) => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}>
            {tab === "fixtures" ? "Fixtures"
              : tab === "standings" ? "Standings"
              : tab === "bracket" ? "Bracket"
              : tab === "de-bracket" ? "DE Bracket"
              : tab === "heats" ? "Heat Sheet"
              : tab === "multi-event" ? "Events"
              : tab === "leaderboard" ? "Results"
              : "Playoff"}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {activeTab === "fixtures" && !isLeaderboard && (
          <motion.div key="fx" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FixturesView stageId={stage.id} isSwiss={isLeaderboard ? false : stage.format === "SWISS"} onFixturesChanged={handleFixturesChanged} />
          </motion.div>
        )}
        {activeTab === "standings" && isPointsTable && (
          <motion.div key="st" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StandingsView stageId={stage.id} />
          </motion.div>
        )}
        {activeTab === "bracket" && isBracket && (
          <motion.div key="br" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {liveBracket ? (
              <div className="bracket-section">
                <div className="bracket-meta">
                  <span>{liveBracket.participantCount} participants</span>
                  <span>{liveBracket.slots} slots</span>
                  <span>{liveBracket.byeCount} byes</span>
                  <span style={{ color: "var(--accent-lime)", borderColor: "rgba(199,244,100,0.3)" }}>✓ Live — updates with scores</span>
                </div>
                <div className="bracket-scroll"><BracketCanvas bracket={liveBracket} /></div>
              </div>
            ) : (
              <div className="empty-state"><span className="empty-icon">🎯</span><p>No fixtures found. Generate this stage first.</p></div>
            )}
          </motion.div>
        )}
        {activeTab === "de-bracket" && isDEBracket && (
          <motion.div key="de" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {liveDEBracket ? (
              <div className="bracket-section">
                <div className="bracket-meta">
                  <span>{liveDEBracket.participantCount} participants</span>
                  <span>{liveDEBracket.slots} slots</span>
                  <span>{liveDEBracket.byeCount} byes</span>
                  <span>{liveDEBracket.winnersRounds.length} WB rounds</span>
                  <span>{liveDEBracket.losersRounds.length} LB rounds</span>
                  <span style={{ color: "var(--accent-coral)", borderColor: "rgba(255,107,53,0.3)" }}>✓ Live — updates with scores</span>
                </div>
                <div className="bracket-scroll"><DEBracketCanvas bracket={liveDEBracket} /></div>
              </div>
            ) : (
              <div className="empty-state"><span className="empty-icon">🎯</span><p>No fixtures found. Generate this stage first.</p></div>
            )}
          </motion.div>
        )}
        {activeTab === "heats" && isHeatsPlusFinal && (
          <motion.div key="ht" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <HeatsView stage={stage} />
          </motion.div>
        )}
        {activeTab === "multi-event" && isMultiEvent && (
          <motion.div key="me" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <MultiEventView stage={stage} participants={participants} />
          </motion.div>
        )}
        {activeTab === "leaderboard" && isLeaderboard && (
          <motion.div key="lb" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LeaderboardView stageId={stage.id} participants={participants} rankingRule={stage.rankingRule} />
          </motion.div>
        )}
        {activeTab === "playoff" && isLeaguePlusPlayoff && (
          <motion.div key="po" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ padding: "1.5rem" }}>
              <h4 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: "1.1rem", letterSpacing: "0.06em", color: "var(--accent-gold)", marginBottom: "1rem" }}>
                Generate Playoff Bracket
              </h4>
              <p style={{ fontSize: "0.84rem", color: "var(--text-dim)", marginBottom: "1.25rem" }}>
                Generate a single-elimination playoff from the top N teams by standings.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <label className="field-label">Top teams to qualify</label>
                  <input className="field-input" type="number" min="2" max="32" value={playoffCount}
                    onChange={(e) => setPlayoffCount(e.target.value)} style={{ maxWidth: "80px" }} />
                </div>
                <button className="btn-gold" onClick={handleGeneratePlayoff} disabled={generatePlayoff.isPending} style={{ marginTop: "1.4rem" }}>
                  {generatePlayoff.isPending ? "Generating..." : "⚡ Generate Playoff"}
                </button>
              </div>
              {playoffError && <p className="form-error" style={{ marginTop: "0.75rem" }}>{playoffError}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
