import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { getDEChampion } from "../bracketUtils";
import type { DoubleEliminationBracket, DERound } from "../types";

type MatchClickHandler = (
  fixtureId: string,
  leftLabel: string | null,
  rightLabel: string | null,
  leftScore: number | null,
  rightScore: number | null
) => void;

export function DEBracketCanvas({
  bracket,
  onMatchClick,
}: {
  bracket: DoubleEliminationBracket;
  onMatchClick?: MatchClickHandler;
}) {
  const MATCH_W = 200;
  const MATCH_H = 76;
  const ROUND_GAP = 72;
  const MATCH_GAP = 22;
  const PAD_X = 32;
  const PAD_Y = 48;
  const SECTION_GAP = 52;

  const champion = useMemo(() => getDEChampion(bracket), [bracket]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
          <motion.path
            key={`conn-${spec.label}-r${rIdx}-m${mIdx}`}
            d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
            fill="none"
            stroke={`${spec.accent}60`}
            strokeWidth="1.8"
            strokeDasharray="5 3"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.1 + rIdx * 0.09 + mIdx * 0.04, duration: 0.5 }}
          />
        );
      });
    });

  const renderSectionHeader = (spec: SectionSpec) => (
    <g key={`hdr-${spec.label}`}>
      {spec.yStart > 0 && (
        <line x1={0} y1={spec.yStart + 2} x2={totalW} y2={spec.yStart + 2}
          stroke={`${spec.accent}1a`} strokeWidth="1" />
      )}
      <rect
        x={PAD_X} y={spec.yStart + 7}
        width={spec.label.length * 7.2 + 22} height={17} rx={8.5}
        fill={`${spec.accent}14`} stroke={`${spec.accent}30`} strokeWidth="1"
      />
      <text
        x={PAD_X + 11} y={spec.yStart + 15.5}
        fill={spec.accent} fontSize="9" fontFamily="'Bebas Neue', sans-serif"
        letterSpacing="2.5" dominantBaseline="middle"
      >
        {spec.label}
      </text>
      {spec.rounds.map((round, rIdx) => (
        <text
          key={`rtitle-${spec.label}-${rIdx}`}
          x={getMatchX(rIdx) + MATCH_W / 2} y={spec.yStart + PAD_Y - 10}
          fill="rgba(255,255,255,0.40)" fontSize="9.5" fontFamily="'Manrope', sans-serif"
          fontWeight="700" textAnchor="middle" dominantBaseline="middle" letterSpacing="0.3"
        >
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
        const isDone = match.status === "COMPLETED";
        const isTBD = !match.leftLabel || match.leftLabel === "TBD" || !match.rightLabel || match.rightLabel === "TBD";
        const canClick = !!onMatchClick && !isAuto && !isTBD;
        const isHovered = hoveredId === match.id;
        const accent = spec.accent;
        const ext = match as any;
        const winner = ext._winner as string | null;
        const leftScore = ext._leftScore as number | null;
        const rightScore = ext._rightScore as number | null;
        const hasLeft = !!match.leftLabel && match.leftLabel !== "TBD";
        const hasRight = !!match.rightLabel && match.rightLabel !== "TBD";
        const leftIsWinner = (isDone || isAuto) && winner === match.leftLabel;
        const rightIsWinner = (isDone || isAuto) && winner === match.rightLabel;

        return (
          <motion.g
            key={`card-${spec.label}-${match.id}-${rIdx}-${mIdx}`}
            style={{ cursor: canClick ? "pointer" : "default" }}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 + rIdx * 0.07 + mIdx * 0.04, duration: 0.25, type: "spring" }}
            onClick={() => {
              if (!canClick) return;
              onMatchClick!(match.id, match.leftLabel, match.rightLabel, leftScore, rightScore);
            }}
            onMouseEnter={() => canClick && setHoveredId(match.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <rect
              x={x} y={y} width={MATCH_W} height={MATCH_H} rx={9}
              fill={isGF ? "rgba(244,211,94,0.08)" : "rgba(255,255,255,0.05)"}
              stroke={
                isHovered ? `${accent}aa`
                : isGF ? "rgba(244,211,94,0.55)"
                : isDone ? `${accent}50`
                : isAuto ? `${accent}50`
                : `${accent}2a`
              }
              strokeWidth={isGF || isHovered ? 1.5 : 1}
            />
            {leftIsWinner && (
              <rect x={x + 1} y={y + 1} width={MATCH_W - 2} height={MATCH_H / 2 - 1} rx={8}
                fill={`${accent}28`} />
            )}
            {rightIsWinner && (
              <rect x={x + 1} y={y + MATCH_H / 2} width={MATCH_W - 2} height={MATCH_H / 2 - 1} rx={8}
                fill={`${accent}28`} />
            )}
            <rect x={x} y={y + 3} width={3} height={MATCH_H - 6} rx={1.5} fill={`${accent}70`} />
            <line x1={x + 10} y1={y + MATCH_H / 2} x2={x + MATCH_W - 10} y2={y + MATCH_H / 2}
              stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <text
              x={x + 13} y={y + MATCH_H / 2 - 13}
              fill={leftIsWinner ? accent : hasLeft ? "#f0ede5" : "rgba(255,255,255,0.27)"}
              fontSize="11.5" fontFamily="'Manrope', sans-serif"
              fontWeight={leftIsWinner ? "800" : hasLeft ? "600" : "400"}
              dominantBaseline="middle"
            >
              {(match.leftLabel ?? "TBD").slice(0, 22)}
            </text>
            <text
              x={x + 13} y={y + MATCH_H / 2 + 13}
              fill={rightIsWinner ? accent : hasRight ? "#f0ede5" : "rgba(255,255,255,0.27)"}
              fontSize="11.5" fontFamily="'Manrope', sans-serif"
              fontWeight={rightIsWinner ? "800" : hasRight ? "600" : "400"}
              dominantBaseline="middle"
            >
              {(match.rightLabel ?? "TBD").slice(0, 22)}
            </text>
            {isDone && leftScore !== null && rightScore !== null && (
              <>
                <text
                  x={x + MATCH_W - 10} y={y + MATCH_H / 2 - 13}
                  fill={leftIsWinner ? accent : "rgba(255,255,255,0.55)"}
                  fontSize="11" fontFamily="'Space Mono', monospace" fontWeight="700"
                  textAnchor="end" dominantBaseline="middle"
                >{leftScore}</text>
                <text
                  x={x + MATCH_W - 10} y={y + MATCH_H / 2 + 13}
                  fill={rightIsWinner ? accent : "rgba(255,255,255,0.55)"}
                  fontSize="11" fontFamily="'Space Mono', monospace" fontWeight="700"
                  textAnchor="end" dominantBaseline="middle"
                >{rightScore}</text>
                <rect x={x + MATCH_W - 50} y={y + MATCH_H / 2 - 8} width={24} height={14} rx={7}
                  fill={`${accent}18`} />
                <text
                  x={x + MATCH_W - 38} y={y + MATCH_H / 2}
                  fill={accent} fontSize="7" fontFamily="'Manrope', sans-serif" fontWeight="800"
                  textAnchor="middle" dominantBaseline="middle" letterSpacing="0.4"
                >FT</text>
              </>
            )}
            {/* Click hint on hover for unplayed matches */}
            {isHovered && !isDone && !isAuto && (
              <>
                <rect x={x + MATCH_W - 62} y={y + MATCH_H - 18} width={56} height={13} rx={6}
                  fill={`${accent}20`} />
                <text
                  x={x + MATCH_W - 34} y={y + MATCH_H - 12}
                  fill={accent} fontSize="7.5" fontFamily="'Manrope', sans-serif" fontWeight="800"
                  textAnchor="middle" dominantBaseline="middle" letterSpacing="0.5"
                >+ SCORE</text>
              </>
            )}
            {isAuto && (
              <>
                <rect x={x + MATCH_W - 62} y={y + 6} width={56} height={14} rx={7}
                  fill={`${accent}20`} />
                <text
                  x={x + MATCH_W - 34} y={y + 13}
                  fill={accent} fontSize="7.5" fontFamily="'Manrope', sans-serif" fontWeight="800"
                  textAnchor="middle" dominantBaseline="middle" letterSpacing="0.6"
                >AUTO BYE</text>
              </>
            )}
          </motion.g>
        );
      })
    );

  return (
    <div className="bracket-canvas-wrap">
      {champion && (
        <div className="bracket-champion-banner">
          <span className="bracket-champion-trophy">🏆</span>
          <span className="bracket-champion-name">{champion}</span>
          <span className="bracket-champion-label">Champion</span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width="100%"
        style={{ minWidth: Math.max(totalW, 600), overflow: "visible", display: "block" }}
      >
        {sections.map((spec) => <g key={`conns-${spec.label}`}>{renderConnectors(spec)}</g>)}
        {sections.map((spec) => renderSectionHeader(spec))}
        {sections.map((spec) => <g key={`cards-${spec.label}`}>{renderCards(spec)}</g>)}
      </svg>
    </div>
  );
}
