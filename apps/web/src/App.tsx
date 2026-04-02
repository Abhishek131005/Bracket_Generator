import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addParticipantsToTournament,
  createTournament,
  fetchSports,
  fetchTournamentParticipants,
  fetchTournamentStages,
  fetchTournaments,
  generateSingleEliminationBracket,
  generateDoubleEliminationBracket,
  generateSingleEliminationStageForTournament,
  generateRoundRobinStageForTournament,
  generateDoubleEliminationStageForTournament,
  generateSwissStageForTournament,
  generateLeaguePlusPlayoffStageForTournament,
  generatePlayoffStage,
  regenerateSwissRoundPairings,
  fetchStageFixtures,
  updateFixtureResult,
  fetchStageStandings,
  fetchStagePerformances,
  addPerformanceEntry,
  deletePerformanceEntry,
} from "./api";
import {
  DoubleEliminationBracket,
  DERound,
  GeneratedSingleEliminationStage,
  GeneratedDoubleEliminationStage,
  PrimaryView,
  SingleEliminationBracket,
  SportDefinition,
  StageFixture,
  StandingRow,
  PerformanceEntry,
  Tournament,
  TournamentParticipant,
  TournamentStage,
  BracketRound,
  BracketMatch,
} from "./types";

type Page = "home" | "create" | "tournament" | "sports" | "playground";

type GenerateFormat =
  | "single-elimination"
  | "round-robin"
  | "double-elimination"
  | "swiss"
  | "league-plus-playoff";

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

const VIEW_ICONS: Record<string, string> = {
  BRACKET: "🏆",
  HYBRID: "⚽",
  STANDINGS: "♟️",
  LEADERBOARD: "🏁",
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

// ── Bracket reconstruction from fixtures ─────────────────────────────────────

/**
 * Rebuild a SingleEliminationBracket display object purely from persisted fixtures.
 * This means the Bracket tab always reflects the latest scores & winner advancement.
 */
function buildBracketFromFixtures(
  fixtures: StageFixture[],
  participantCount: number
): SingleEliminationBracket | null {
  if (!fixtures.length) return null;

  // Group by roundIndex
  const roundMap = new Map<number, StageFixture[]>();
  for (const f of fixtures) {
    if (!roundMap.has(f.roundIndex)) roundMap.set(f.roundIndex, []);
    roundMap.get(f.roundIndex)!.push(f);
  }

  const sortedRoundIndices = Array.from(roundMap.keys()).sort((a, b) => a - b);
  const totalRounds = sortedRoundIndices.length;
  const slots = Math.pow(2, totalRounds);

  const rounds: BracketRound[] = sortedRoundIndices.map((roundIndex, rIdx) => {
    const roundFixtures = roundMap.get(roundIndex)!.sort((a, b) => a.matchIndex - b.matchIndex);
    const isFinal = rIdx === totalRounds - 1;
    const isSemi = rIdx === totalRounds - 2;
    const roundSize = roundFixtures.length * 2;

    let title = `Round of ${roundSize}`;
    if (isFinal) title = "Final";
    else if (isSemi) title = "Semi Final";
    else if (roundSize === 8) title = "Quarter Final";

    const matches: BracketMatch[] = roundFixtures.map((f) => {
      // Determine the winner for completed matches
      let winner: string | null = null;
      if (f.status === "COMPLETED" && f.leftScore !== null && f.rightScore !== null) {
        winner = f.leftScore > f.rightScore
          ? (f.leftLabel ?? null)
          : f.rightScore > f.leftScore
          ? (f.rightLabel ?? null)
          : null; // draw — no winner highlighted
      }
      if (f.status === "AUTO_ADVANCE") {
        winner = f.leftLabel && f.leftLabel !== "TBD" ? f.leftLabel : f.rightLabel ?? null;
      }

      return {
        id: f.id,
        roundIndex: f.roundIndex,
        matchIndex: f.matchIndex,
        left: {
          seed: null,
          participantName: f.leftLabel ?? null,
        },
        right: {
          seed: null,
          participantName: f.rightLabel ?? null,
        },
        status: f.status as BracketMatch["status"],
        autoAdvanceWinner: f.status === "AUTO_ADVANCE" ? winner : null,
        // Attach winner info for rendering
        _winner: winner,
        _leftScore: f.leftScore,
        _rightScore: f.rightScore,
      } as BracketMatch & { _winner: string | null; _leftScore: number | null; _rightScore: number | null };
    });

    return { roundIndex, title, matches };
  });

  return {
    format: "SINGLE_ELIMINATION",
    participantCount,
    slots,
    byeCount: slots - participantCount,
    rounds,
  };
}

// ── Sport Picker Modal ────────────────────────────────────────────────────────

function SportPickerModal({
  sports,
  selectedId,
  onSelect,
  onClose,
}: {
  sports: SportDefinition[];
  selectedId: number | "";
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<PrimaryView | "ALL">("ALL");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const views: Array<PrimaryView | "ALL"> = ["ALL", "BRACKET", "HYBRID", "STANDINGS", "LEADERBOARD"];

  const filtered = useMemo(
    () =>
      sports.filter((s) => {
        const matchView = activeView === "ALL" || s.primaryView === activeView;
        const matchSearch =
          !search ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.format.toLowerCase().includes(search.toLowerCase());
        return matchView && matchSearch;
      }),
    [sports, activeView, search]
  );

  return (
    <motion.div
      className="sport-picker-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="sport-picker-modal"
        initial={{ opacity: 0, y: 48, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: "spring", damping: 28, stiffness: 340 }}
      >
        <div className="spm-header">
          <div>
            <h2 className="spm-title">Choose a Sport</h2>
            <p className="spm-sub">{filtered.length} of {sports.length} sports shown</p>
          </div>
          <button className="spm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="spm-search-wrap">
          <span className="spm-search-icon">🔍</span>
          <input
            ref={inputRef}
            className="spm-search"
            placeholder="Search sports or formats…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="spm-search-clear" onClick={() => setSearch("")} aria-label="Clear search">✕</button>
          )}
        </div>

        <div className="spm-filters">
          {views.map((v) => {
            const count = v === "ALL" ? sports.length : sports.filter((s) => s.primaryView === v).length;
            const color = v !== "ALL" ? VIEW_COLORS[v] : undefined;
            return (
              <button
                key={v}
                className={`spm-filter-pill ${activeView === v ? "active" : ""}`}
                style={activeView === v && color ? ({ "--pill-c": color } as any) : {}}
                onClick={() => setActiveView(v)}
              >
                {v !== "ALL" && <span className="spm-filter-icon">{VIEW_ICONS[v]}</span>}
                <span>{v === "ALL" ? "All" : v.charAt(0) + v.slice(1).toLowerCase()}</span>
                <span className="spm-filter-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="spm-grid-wrap">
          {filtered.length === 0 ? (
            <div className="spm-empty">
              <span>🤔</span>
              <p>No sports match "<strong>{search}</strong>"</p>
            </div>
          ) : (
            <div className="spm-grid">
              {filtered.map((sport, i) => {
                const color = VIEW_COLORS[sport.primaryView] ?? "#fff";
                const isSelected = selectedId === sport.id;
                return (
                  <motion.button
                    key={sport.id}
                    className={`spm-card ${isSelected ? "selected" : ""}`}
                    style={{ "--sc": color } as any}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.007, duration: 0.16 }}
                    onClick={() => { onSelect(sport.id); onClose(); }}
                    whileHover={{ y: -3, transition: { duration: 0.12 } }}
                    whileTap={{ scale: 0.96 }}
                  >
                    {isSelected && (
                      <motion.span
                        className="spm-card-check"
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 420 }}
                      >
                        ✓
                      </motion.span>
                    )}
                    <div className="spm-card-glow" />
                    <span className="spm-card-id">#{sport.id}</span>
                    <h3 className="spm-card-name">{sport.name}</h3>
                    <div className="spm-card-footer">
                      <span
                        className="spm-card-tag"
                        style={{ color, background: `${color}18`, border: `1px solid ${color}38` }}
                      >
                        {sport.primaryView}
                      </span>
                      <span className="spm-card-format">{FORMAT_LABELS[sport.format] ?? sport.format}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── BracketCanvas (Single Elimination) ───────────────────────────────────────

function BracketCanvas({ bracket }: { bracket: SingleEliminationBracket }) {
  const MATCH_W = 200; const MATCH_H = 88; const ROUND_GAP = 80;
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
          <linearGradient id="winner-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(199,244,100,0.22)" />
            <stop offset="100%" stopColor="rgba(199,244,100,0.04)" />
          </linearGradient>
        </defs>

        {/* Connectors */}
        {rounds.map((round, rIdx) => {
          if (rIdx >= rounds.length - 1) return null;
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

        {/* Match cards */}
        {rounds.map((round, rIdx) => {
          const isFinal = rIdx === rounds.length - 1;
          return round.matches.map((match, mIdx) => {
            const x = getMatchX(rIdx); const y = getMatchY(rIdx, mIdx);
            const isAuto = match.status === "AUTO_ADVANCE";
            const isDone = match.status === "COMPLETED";
            const extMatch = match as any;
            const winner = extMatch._winner as string | null;
            const leftScore = extMatch._leftScore as number | null;
            const rightScore = extMatch._rightScore as number | null;
            const leftIsWinner = isDone && winner === match.left.participantName;
            const rightIsWinner = isDone && winner === match.right.participantName;

            return (
              <motion.g key={match.id} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: rIdx * 0.12 + mIdx * 0.06, duration: 0.3, type: "spring" }}>

                {/* Card background */}
                <rect x={x} y={y} width={MATCH_W} height={MATCH_H} rx={10}
                  fill={isFinal ? "url(#final-grad)" : "url(#card-grad)"}
                  stroke={
                    isFinal ? "rgba(244,211,94,0.5)"
                    : isAuto ? "rgba(199,244,100,0.35)"
                    : isDone ? "rgba(199,244,100,0.3)"
                    : "rgba(255,255,255,0.12)"
                  }
                  strokeWidth={isFinal ? 1.5 : 1} />

                {/* Winner highlight row — top half */}
                {leftIsWinner && (
                  <rect x={x + 1} y={y + 1} width={MATCH_W - 2} height={MATCH_H / 2 - 1} rx={9}
                    fill="url(#winner-grad)" opacity={0.9} />
                )}
                {/* Winner highlight row — bottom half */}
                {rightIsWinner && (
                  <rect x={x + 1} y={y + MATCH_H / 2} width={MATCH_W - 2} height={MATCH_H / 2 - 1} rx={9}
                    fill="url(#winner-grad)" opacity={0.9} />
                )}

                {/* Divider line */}
                <line x1={x + 8} y1={y + MATCH_H / 2} x2={x + MATCH_W - 8} y2={y + MATCH_H / 2}
                  stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                {/* Left participant name */}
                <text x={x + 10} y={y + MATCH_H / 2 - 14}
                  fill={leftIsWinner ? "#c7f464" : match.left.participantName ? "#f4f1de" : "rgba(255,255,255,0.35)"}
                  fontSize="11" fontFamily="Manrope, sans-serif"
                  fontWeight={leftIsWinner ? "800" : "600"}
                  dominantBaseline="middle">
                  {(match.left.participantName ?? "TBD").slice(0, 22)}
                </text>

                {/* Right participant name */}
                <text x={x + 10} y={y + MATCH_H / 2 + 14}
                  fill={rightIsWinner ? "#c7f464" : match.right.participantName ? "#f4f1de" : "rgba(255,255,255,0.35)"}
                  fontSize="11" fontFamily="Manrope, sans-serif"
                  fontWeight={rightIsWinner ? "800" : "600"}
                  dominantBaseline="middle">
                  {(match.right.participantName ?? "TBD").slice(0, 22)}
                </text>

                {/* Score display */}
                {isDone && leftScore !== null && rightScore !== null && (
                  <>
                    <text x={x + MATCH_W - 12} y={y + MATCH_H / 2 - 14}
                      fill={leftIsWinner ? "#c7f464" : "rgba(255,255,255,0.6)"}
                      fontSize="12" fontFamily="'Space Mono', monospace" fontWeight="700"
                      textAnchor="end" dominantBaseline="middle">
                      {leftScore}
                    </text>
                    <text x={x + MATCH_W - 12} y={y + MATCH_H / 2 + 14}
                      fill={rightIsWinner ? "#c7f464" : "rgba(255,255,255,0.6)"}
                      fontSize="12" fontFamily="'Space Mono', monospace" fontWeight="700"
                      textAnchor="end" dominantBaseline="middle">
                      {rightScore}
                    </text>
                    {/* FT badge */}
                    <rect x={x + MATCH_W - 52} y={y + MATCH_H / 2 - 8} width={28} height={16} rx={8}
                      fill="rgba(199,244,100,0.12)" />
                    <text x={x + MATCH_W - 38} y={y + MATCH_H / 2}
                      fill="#c7f464" fontSize="7.5" fontFamily="Manrope, sans-serif" fontWeight="800"
                      textAnchor="middle" dominantBaseline="middle" letterSpacing="0.5">FT</text>
                  </>
                )}

                {/* Auto BYE badge */}
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

        {/* Round title labels */}
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

// ── Double Elimination Bracket Canvas ────────────────────────────────────────

function DEBracketCanvas({ bracket }: { bracket: DoubleEliminationBracket }) {
  const MATCH_W = 200;
  const MATCH_H = 76;
  const ROUND_GAP = 72;
  const MATCH_GAP = 22;
  const PAD_X = 32;
  const PAD_Y = 48;
  const SECTION_GAP = 52;

  type SectionSpec = {
    rounds: DERound[];
    label: string;
    accent: string;
    yStart: number;
    maxMatches: number;
    sectionH: number;
  };

  const buildSection = (rounds: DERound[], label: string, accent: string, yStart: number): SectionSpec => {
    const maxMatches = rounds.length > 0 ? Math.max(...rounds.map((r) => r.matches.length)) : 1;
    const slotH = MATCH_H + MATCH_GAP;
    const sectionH = PAD_Y + maxMatches * slotH + MATCH_GAP;
    return { rounds, label, accent, yStart, maxMatches, sectionH };
  };

  const wbSpec = buildSection(bracket.winnersRounds, "WINNERS BRACKET", "#c7f464", 0);
  const lbSpec = buildSection(bracket.losersRounds, "LOSERS BRACKET", "#ff6b35", wbSpec.sectionH + SECTION_GAP);
  const gfSpec = buildSection([bracket.grandFinal], "GRAND FINAL", "#f4d35e", wbSpec.sectionH + SECTION_GAP + lbSpec.sectionH + SECTION_GAP);
  const sections: SectionSpec[] = [wbSpec, lbSpec, gfSpec];

  const getMatchX = (rIdx: number) => PAD_X + rIdx * (MATCH_W + ROUND_GAP);
  const getMatchY = (spec: SectionSpec, rIdx: number, mIdx: number) => {
    const rm = spec.rounds[rIdx]?.matches.length ?? 1;
    const slotH = MATCH_H + MATCH_GAP;
    const totalH = spec.maxMatches * slotH;
    const offset = (totalH - rm * slotH) / 2;
    return spec.yStart + PAD_Y + offset + mIdx * slotH;
  };

  const maxRoundCount = Math.max(wbSpec.rounds.length, lbSpec.rounds.length, 1);
  const totalW = PAD_X * 2 + maxRoundCount * (MATCH_W + ROUND_GAP) - ROUND_GAP + MATCH_W;
  const totalH = gfSpec.yStart + gfSpec.sectionH + 16;

  const renderConnectors = (spec: SectionSpec) =>
    spec.rounds.flatMap((round, rIdx) => {
      if (rIdx >= spec.rounds.length - 1) return [];
      return round.matches.map((_, mIdx) => {
        const x1 = getMatchX(rIdx) + MATCH_W;
        const y1 = getMatchY(spec, rIdx, mIdx) + MATCH_H / 2;
        const targetIdx = Math.floor(mIdx / 2);
        const x2 = getMatchX(rIdx + 1);
        const y2 = getMatchY(spec, rIdx + 1, targetIdx) + MATCH_H / 2;
        const midX = (x1 + x2) / 2;
        return (
          <motion.path key={`conn-${spec.label}-r${rIdx}-m${mIdx}`}
            d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
            fill="none" stroke={`${spec.accent}60`} strokeWidth="1.8" strokeDasharray="5 3"
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.1 + rIdx * 0.09 + mIdx * 0.04, duration: 0.5 }} />
        );
      });
    });

  const renderSectionHeader = (spec: SectionSpec) => (
    <g key={`hdr-${spec.label}`}>
      {spec.yStart > 0 && (
        <line x1={0} y1={spec.yStart + 2} x2={totalW} y2={spec.yStart + 2}
          stroke={`${spec.accent}1a`} strokeWidth="1" />
      )}
      <rect x={PAD_X} y={spec.yStart + 7} width={spec.label.length * 7.2 + 22} height={17} rx={8.5}
        fill={`${spec.accent}14`} stroke={`${spec.accent}30`} strokeWidth="1" />
      <text x={PAD_X + 11} y={spec.yStart + 15.5} fill={spec.accent}
        fontSize="9" fontFamily="'Bebas Neue', sans-serif" letterSpacing="2.5" dominantBaseline="middle">
        {spec.label}
      </text>
      {spec.rounds.map((round, rIdx) => (
        <text key={`rtitle-${spec.label}-${rIdx}`} x={getMatchX(rIdx) + MATCH_W / 2} y={spec.yStart + PAD_Y - 10}
          fill="rgba(255,255,255,0.40)" fontSize="9.5" fontFamily="'Manrope', sans-serif"
          fontWeight="700" textAnchor="middle" dominantBaseline="middle" letterSpacing="0.3">
          {round.title.toUpperCase()}
        </text>
      ))}
    </g>
  );

  const renderCards = (spec: SectionSpec) =>
    spec.rounds.flatMap((round, rIdx) =>
      round.matches.map((match, mIdx) => {
        const x = getMatchX(rIdx); const y = getMatchY(spec, rIdx, mIdx);
        const isGF = round.bracket === "GRAND_FINAL";
        const isAuto = match.status === "AUTO_ADVANCE";
        const accent = spec.accent;
        const hasLeft = !!match.leftLabel && match.leftLabel !== "TBD";
        const hasRight = !!match.rightLabel && match.rightLabel !== "TBD";
        return (
          <motion.g key={`card-${spec.label}-${match.id}-${rIdx}-${mIdx}`}
            initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 + rIdx * 0.07 + mIdx * 0.04, duration: 0.25, type: "spring" }}>
            <rect x={x} y={y} width={MATCH_W} height={MATCH_H} rx={9}
              fill={isGF ? "rgba(244,211,94,0.08)" : "rgba(255,255,255,0.05)"}
              stroke={isGF ? "rgba(244,211,94,0.55)" : isAuto ? `${accent}50` : `${accent}2a`}
              strokeWidth={isGF ? 1.5 : 1} />
            <rect x={x} y={y + 3} width={3} height={MATCH_H - 6} rx={1.5} fill={`${accent}70`} />
            <line x1={x + 10} y1={y + MATCH_H / 2} x2={x + MATCH_W - 10} y2={y + MATCH_H / 2}
              stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            {match.leftSeed != null && (
              <text x={x + 13} y={y + MATCH_H / 2 - 13} fill={accent} fontSize="8.5"
                fontFamily="'Space Mono', monospace" fontWeight="700" dominantBaseline="middle">
                S{match.leftSeed}
              </text>
            )}
            {match.rightSeed != null && (
              <text x={x + 13} y={y + MATCH_H / 2 + 13} fill={accent} fontSize="8.5"
                fontFamily="'Space Mono', monospace" fontWeight="700" dominantBaseline="middle">
                S{match.rightSeed}
              </text>
            )}
            <text x={x + (match.leftSeed != null ? 34 : 13)} y={y + MATCH_H / 2 - 13}
              fill={hasLeft ? "#f0ede5" : "rgba(255,255,255,0.27)"} fontSize="11.5"
              fontFamily="'Manrope', sans-serif" fontWeight={hasLeft ? "600" : "400"} dominantBaseline="middle">
              {(match.leftLabel ?? "TBD").slice(0, 22)}
            </text>
            <text x={x + (match.rightSeed != null ? 34 : 13)} y={y + MATCH_H / 2 + 13}
              fill={hasRight ? "#f0ede5" : "rgba(255,255,255,0.27)"} fontSize="11.5"
              fontFamily="'Manrope', sans-serif" fontWeight={hasRight ? "600" : "400"} dominantBaseline="middle">
              {(match.rightLabel ?? "TBD").slice(0, 22)}
            </text>
            {isAuto && (
              <>
                <rect x={x + MATCH_W - 62} y={y + 6} width={56} height={14} rx={7} fill={`${accent}20`} />
                <text x={x + MATCH_W - 34} y={y + 13} fill={accent} fontSize="7.5"
                  fontFamily="'Manrope', sans-serif" fontWeight="800"
                  textAnchor="middle" dominantBaseline="middle" letterSpacing="0.6">AUTO BYE</text>
              </>
            )}
          </motion.g>
        );
      })
    );

  return (
    <div className="bracket-canvas-wrap">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} width="100%"
        style={{ minWidth: Math.max(totalW, 600), overflow: "visible", display: "block" }}>
        {sections.map((spec) => <g key={`conns-${spec.label}`}>{renderConnectors(spec)}</g>)}
        {sections.map((spec) => renderSectionHeader(spec))}
        {sections.map((spec) => <g key={`cards-${spec.label}`}>{renderCards(spec)}</g>)}
      </svg>
    </div>
  );
}

// ── Fixtures View ─────────────────────────────────────────────────────────────

function FixturesView({ stageId, isSwiss, onFixturesChanged }: {
  stageId: string;
  isSwiss?: boolean;
  onFixturesChanged?: (fixtures: StageFixture[]) => void;
}) {
  const [fixtures, setFixtures] = useState<StageFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rePairing, setRePairing] = useState<number | null>(null);

  const loadFixtures = useCallback(() => {
    setLoading(true);
    fetchStageFixtures(stageId)
      .then((data) => {
        setFixtures(data);
        onFixturesChanged?.(data);
      })
      .catch(() => setError("Could not load fixtures."))
      .finally(() => setLoading(false));
  }, [stageId]);

  useEffect(() => { loadFixtures(); }, [loadFixtures]);

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
      await updateFixtureResult(fixtureId, hs, as_);
      setEditingId(null);
      // Re-fetch all fixtures so bracket & winner advancement are reflected
      const refreshed = await fetchStageFixtures(stageId);
      setFixtures(refreshed);
      onFixturesChanged?.(refreshed);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save."); }
    finally { setSaving(false); }
  }

  async function handleSwissRePair(roundIndex: number) {
    try {
      setRePairing(roundIndex); setError("");
      const newFixtures = await regenerateSwissRoundPairings(stageId, roundIndex);
      setFixtures(newFixtures);
      onFixturesChanged?.(newFixtures);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not generate pairings."); }
    finally { setRePairing(null); }
  }

  if (loading) return <div className="empty-state"><span className="empty-icon">⏳</span><p>Loading fixtures...</p></div>;
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
                  onClick={() => handleSwissRePair(roundIdx)} disabled={rePairing === roundIdx}>
                  {rePairing === roundIdx ? "Pairing..." : "⚡ Generate Pairings"}
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
                          <button className="btn-save-score" onClick={() => handleSave(f.id)} disabled={saving}>
                            {saving ? "..." : "✓ Save"}
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

// ── Standings View ────────────────────────────────────────────────────────────

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

// ── Leaderboard View ──────────────────────────────────────────────────────────

function LeaderboardView({ stageId, participants, rankingRule }: {
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

// ── Stage Detail Panel ────────────────────────────────────────────────────────

function StageDetailPanel({
  stage, participants,
  onPlayoffGenerate, tournamentId,
}: {
  stage: TournamentStage;
  participants: TournamentParticipant[];
  onPlayoffGenerate?: (stage: TournamentStage, bracket: SingleEliminationBracket) => void;
  tournamentId: string;
}) {
  const isLeaderboard = ["DIRECT_FINAL", "HEATS_PLUS_FINAL", "MULTI_EVENT_POINTS", "JUDGED_LEADERBOARD"].includes(stage.format);
  const isPointsTable = ["ROUND_ROBIN", "SWISS", "LEAGUE_PLUS_PLAYOFF"].includes(stage.format);
  const isBracket = stage.format === "SINGLE_ELIMINATION";
  const isDEBracket = stage.format === "DOUBLE_ELIMINATION";
  const isSwiss = stage.format === "SWISS";
  const isLeaguePlusPlayoff = stage.format === "LEAGUE_PLUS_PLAYOFF";

  // Live bracket built from fixtures — replaces the old prop-based approach
  const [liveBracket, setLiveBracket] = useState<SingleEliminationBracket | null>(null);
  const [bracketLoading, setBracketLoading] = useState(false);

  const [playoffCount, setPlayoffCount] = useState("4");
  const [generatingPlayoff, setGeneratingPlayoff] = useState(false);
  const [playoffError, setPlayoffError] = useState("");

  const tabs = useMemo(() => {
    const t: string[] = [];
    if (!isLeaderboard) t.push("fixtures");
    if (isPointsTable) t.push("standings");
    if (isBracket) t.push("bracket");
    if (isDEBracket) t.push("de-bracket");
    if (isLeaderboard) t.push("leaderboard");
    if (isLeaguePlusPlayoff) t.push("playoff");
    return t;
  }, [stage.format]);

  const [activeTab, setActiveTab] = useState(tabs[0] ?? "fixtures");
  useEffect(() => { if (!tabs.includes(activeTab)) setActiveTab(tabs[0] ?? "fixtures"); }, [stage.id]);

  // Load bracket from fixtures whenever stage changes or bracket tab is opened
  const loadBracketFromFixtures = useCallback(async (fixtures?: StageFixture[]) => {
    if (!isBracket) return;
    setBracketLoading(true);
    try {
      const data = fixtures ?? await fetchStageFixtures(stage.id);
      const built = buildBracketFromFixtures(data, participants.length);
      setLiveBracket(built);
    } finally {
      setBracketLoading(false);
    }
  }, [stage.id, isBracket, participants.length]);

  // Fetch bracket on mount / stage switch
  useEffect(() => {
    if (isBracket) loadBracketFromFixtures();
  }, [stage.id, isBracket]);

  // Called by FixturesView after any score save — keeps bracket in sync
  const handleFixturesChanged = useCallback((fixtures: StageFixture[]) => {
    if (isBracket) loadBracketFromFixtures(fixtures);
  }, [isBracket, loadBracketFromFixtures]);

  // Switch to bracket tab and refresh when bracket tab clicked
  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    if (tab === "bracket" && isBracket) loadBracketFromFixtures();
  };

  async function handleGeneratePlayoff() {
    const count = parseInt(playoffCount);
    if (isNaN(count) || count < 2) { setPlayoffError("Enter a valid team count (min 2)."); return; }
    try {
      setGeneratingPlayoff(true); setPlayoffError("");
      const result = await generatePlayoffStage(tournamentId, stage.id, count);
      onPlayoffGenerate?.(result.stage, result.bracket);
    } catch (err) { setPlayoffError(err instanceof Error ? err.message : "Could not generate playoff."); }
    finally { setGeneratingPlayoff(false); }
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
            onClick={() => handleTabClick(tab)}>
            {tab === "fixtures" ? "Fixtures"
              : tab === "standings" ? "Standings"
              : tab === "bracket" ? "Bracket"
              : tab === "de-bracket" ? "DE Bracket"
              : tab === "leaderboard" ? "Leaderboard"
              : "Playoff"}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {activeTab === "fixtures" && !isLeaderboard && (
          <motion.div key="fx" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FixturesView
              stageId={stage.id}
              isSwiss={isSwiss}
              onFixturesChanged={handleFixturesChanged}
            />
          </motion.div>
        )}
        {activeTab === "standings" && isPointsTable && (
          <motion.div key="st" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StandingsView stageId={stage.id} />
          </motion.div>
        )}
        {activeTab === "bracket" && isBracket && (
          <motion.div key="br" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {bracketLoading ? (
              <div className="empty-state"><span className="empty-icon">⏳</span><p>Loading bracket...</p></div>
            ) : liveBracket ? (
              <div className="bracket-section">
                <div className="bracket-meta">
                  <span>{liveBracket.participantCount} participants</span>
                  <span>{liveBracket.slots} slots</span>
                  <span>{liveBracket.byeCount} byes</span>
                  <span style={{ color: "var(--accent-lime)", borderColor: "rgba(199,244,100,0.3)" }}>
                    ✓ Live — updates with scores
                  </span>
                </div>
                <div className="bracket-scroll">
                  <BracketCanvas bracket={liveBracket} />
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">🎯</span>
                <p>No fixtures found. Generate this stage first.</p>
              </div>
            )}
          </motion.div>
        )}
        {activeTab === "de-bracket" && isDEBracket && (
          <motion.div key="de" className="tab-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="empty-state">
              <span className="empty-icon">🎯</span>
              <p>Generate this stage to see the DE bracket.</p>
            </div>
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
                <button className="btn-gold" onClick={handleGeneratePlayoff} disabled={generatingPlayoff} style={{ marginTop: "1.4rem" }}>
                  {generatingPlayoff ? "Generating..." : "⚡ Generate Playoff"}
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

// ── StatCard & SportCard ──────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <motion.div className="stat-card" style={{ "--accent": accent } as any}
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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

// ── Nav ───────────────────────────────────────────────────────────────────────

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

// ── Home Page ─────────────────────────────────────────────────────────────────

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
          <motion.p className="hero-eyebrow" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            ⚡ Zemo Tournament Command Center
          </motion.p>
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

// ── Create Page ───────────────────────────────────────────────────────────────

function CreatePage({ sports, onCreated }: { sports: SportDefinition[]; onCreated: (t: Tournament) => void }) {
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

// ── Tournament Page ───────────────────────────────────────────────────────────

const GENERATE_FORMATS: { id: GenerateFormat; label: string }[] = [
  { id: "single-elimination", label: "Single Elim" },
  { id: "double-elimination", label: "Double Elim" },
  { id: "round-robin", label: "Round Robin" },
  { id: "swiss", label: "Swiss" },
  { id: "league-plus-playoff", label: "League + PO" },
];

function TournamentPage({ tournaments, sports }: { tournaments: Tournament[]; sports: SportDefinition[] }) {
  const [selectedId, setSelectedId] = useState(tournaments[0]?.id ?? "");
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [stages, setStages] = useState<TournamentStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [stageName, setStageName] = useState("");
  const [swissRounds, setSwissRounds] = useState("");
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

// ── Sports Page ───────────────────────────────────────────────────────────────

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
        <input className="field-input search-input" placeholder="Search sports..." value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="sport-grid-v2">
        <AnimatePresence>{filtered.map((s, i) => <SportCard key={s.id} sport={s} index={i} />)}</AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Playground Page ───────────────────────────────────────────────────────────

function PlaygroundPage() {
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

// ── App ───────────────────────────────────────────────────────────────────────

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