import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { getChampion, getBracketWinnerPath } from "../bracketUtils";
import type { SingleEliminationBracket } from "../types";

type MatchClickHandler = (
  fixtureId: string,
  leftLabel: string | null,
  rightLabel: string | null,
  leftScore: number | null,
  rightScore: number | null
) => void;

export function BracketCanvas({
  bracket,
  onMatchClick,
}: {
  bracket: SingleEliminationBracket;
  onMatchClick?: MatchClickHandler;
}) {
  const MATCH_W = 200; const MATCH_H = 88; const ROUND_GAP = 80;
  const MATCH_GAP = 24; const PAD_TOP = 32; const PAD_LEFT = 24;
  const rounds = bracket.rounds; const numRounds = rounds.length;

  const champion = useMemo(() => getChampion(bracket), [bracket]);
  const winnerPath = useMemo(() => getBracketWinnerPath(bracket), [bracket]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
      {champion && (
        <div className="bracket-champion-banner">
          <span className="bracket-champion-trophy">🏆</span>
          <span className="bracket-champion-name">{champion}</span>
          <span className="bracket-champion-label">Champion</span>
        </div>
      )}

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
          <filter id="path-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Connectors */}
        {rounds.map((round, rIdx) => {
          if (rIdx >= rounds.length - 1) return null;
          return round.matches.map((match, mIdx) => {
            const targetIdx = Math.floor(mIdx / 2);
            const targetMatch = rounds[rIdx + 1]?.matches[targetIdx];
            const isOnPath =
              winnerPath.has(match.id) && targetMatch && winnerPath.has(targetMatch.id);

            const x1 = getMatchX(rIdx) + MATCH_W;
            const y1 = getMatchY(rIdx, mIdx) + MATCH_H / 2;
            const x2 = getMatchX(rIdx + 1);
            const y2 = getMatchY(rIdx + 1, targetIdx) + MATCH_H / 2;
            const midX = (x1 + x2) / 2;

            return (
              <motion.path
                key={`conn-${rIdx}-${mIdx}`}
                d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                fill="none"
                stroke={isOnPath ? "rgba(199,244,100,0.85)" : "rgba(199,244,100,0.22)"}
                strokeWidth={isOnPath ? 2.5 : 1.5}
                strokeDasharray={isOnPath ? undefined : "4 3"}
                filter={isOnPath ? "url(#path-glow)" : undefined}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: rIdx * 0.15 + mIdx * 0.05, duration: 0.5 }}
              />
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
            const isTBD = !match.left.participantName || !match.right.participantName;
            const canClick = !!onMatchClick && !isAuto && !isTBD;
            const isHovered = hoveredId === match.id;
            const isOnPath = winnerPath.has(match.id);
            const extMatch = match as any;
            const winner = extMatch._winner as string | null;
            const leftScore = extMatch._leftScore as number | null;
            const rightScore = extMatch._rightScore as number | null;
            const leftIsWinner = isDone && winner === match.left.participantName;
            const rightIsWinner = isDone && winner === match.right.participantName;

            return (
              <motion.g
                key={match.id}
                style={{ cursor: canClick ? "pointer" : "default" }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: rIdx * 0.12 + mIdx * 0.06, duration: 0.3, type: "spring" }}
                onClick={() => {
                  if (!canClick) return;
                  onMatchClick!(match.id, match.left.participantName, match.right.participantName, leftScore, rightScore);
                }}
                onMouseEnter={() => canClick && setHoveredId(match.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Card body */}
                <rect
                  x={x} y={y} width={MATCH_W} height={MATCH_H} rx={10}
                  fill={isFinal ? "url(#final-grad)" : "url(#card-grad)"}
                  stroke={
                    isHovered ? "rgba(199,244,100,0.65)"
                    : isOnPath ? "rgba(199,244,100,0.45)"
                    : isFinal ? "rgba(244,211,94,0.5)"
                    : isAuto ? "rgba(199,244,100,0.35)"
                    : isDone ? "rgba(199,244,100,0.3)"
                    : "rgba(255,255,255,0.12)"
                  }
                  strokeWidth={isFinal || isHovered ? 1.5 : 1}
                />

                {/* Winner row highlight */}
                {leftIsWinner && (
                  <rect x={x + 1} y={y + 1} width={MATCH_W - 2} height={MATCH_H / 2 - 1} rx={9}
                    fill="url(#winner-grad)" opacity={0.9} />
                )}
                {rightIsWinner && (
                  <rect x={x + 1} y={y + MATCH_H / 2} width={MATCH_W - 2} height={MATCH_H / 2 - 1} rx={9}
                    fill="url(#winner-grad)" opacity={0.9} />
                )}

                {/* Divider */}
                <line
                  x1={x + 8} y1={y + MATCH_H / 2} x2={x + MATCH_W - 8} y2={y + MATCH_H / 2}
                  stroke="rgba(255,255,255,0.08)" strokeWidth="1"
                />

                {/* Left participant */}
                <text
                  x={x + 10} y={y + MATCH_H / 2 - 14}
                  fill={leftIsWinner ? "#c7f464" : match.left.participantName ? "#f4f1de" : "rgba(255,255,255,0.35)"}
                  fontSize="11" fontFamily="Manrope, sans-serif"
                  fontWeight={leftIsWinner ? "800" : "600"}
                  dominantBaseline="middle"
                >
                  {(match.left.participantName ?? "TBD").slice(0, 22)}
                </text>

                {/* Right participant */}
                <text
                  x={x + 10} y={y + MATCH_H / 2 + 14}
                  fill={rightIsWinner ? "#c7f464" : match.right.participantName ? "#f4f1de" : "rgba(255,255,255,0.35)"}
                  fontSize="11" fontFamily="Manrope, sans-serif"
                  fontWeight={rightIsWinner ? "800" : "600"}
                  dominantBaseline="middle"
                >
                  {(match.right.participantName ?? "TBD").slice(0, 22)}
                </text>

                {/* Scores */}
                {isDone && leftScore !== null && rightScore !== null && (
                  <>
                    <text
                      x={x + MATCH_W - 12} y={y + MATCH_H / 2 - 14}
                      fill={leftIsWinner ? "#c7f464" : "rgba(255,255,255,0.6)"}
                      fontSize="12" fontFamily="'Space Mono', monospace" fontWeight="700"
                      textAnchor="end" dominantBaseline="middle"
                    >{leftScore}</text>
                    <text
                      x={x + MATCH_W - 12} y={y + MATCH_H / 2 + 14}
                      fill={rightIsWinner ? "#c7f464" : "rgba(255,255,255,0.6)"}
                      fontSize="12" fontFamily="'Space Mono', monospace" fontWeight="700"
                      textAnchor="end" dominantBaseline="middle"
                    >{rightScore}</text>
                    <rect x={x + MATCH_W - 52} y={y + MATCH_H / 2 - 8} width={28} height={16} rx={8}
                      fill="rgba(199,244,100,0.12)" />
                    <text
                      x={x + MATCH_W - 38} y={y + MATCH_H / 2}
                      fill="#c7f464" fontSize="7.5" fontFamily="Manrope, sans-serif" fontWeight="800"
                      textAnchor="middle" dominantBaseline="middle" letterSpacing="0.5"
                    >FT</text>
                  </>
                )}

                {/* Click hint on hover for unplayed matches */}
                {isHovered && !isDone && !isAuto && (
                  <>
                    <rect x={x + MATCH_W - 62} y={y + MATCH_H - 20} width={56} height={14} rx={7}
                      fill="rgba(199,244,100,0.18)" />
                    <text
                      x={x + MATCH_W - 34} y={y + MATCH_H - 13}
                      fill="#c7f464" fontSize="7.5" fontFamily="Manrope, sans-serif" fontWeight="800"
                      textAnchor="middle" dominantBaseline="middle" letterSpacing="0.5"
                    >+ SCORE</text>
                  </>
                )}

                {/* Auto BYE badge */}
                {isAuto && (
                  <g>
                    <rect x={x + MATCH_W - 58} y={y + 5} width={52} height={16} rx={8}
                      fill="rgba(199,244,100,0.18)" />
                    <text
                      x={x + MATCH_W - 32} y={y + 13}
                      fill="#c7f464" fontSize="8" fontFamily="Manrope, sans-serif" fontWeight="700"
                      textAnchor="middle" dominantBaseline="middle"
                    >AUTO BYE</text>
                  </g>
                )}
              </motion.g>
            );
          });
        })}

        {/* Round title labels */}
        {rounds.map((round, rIdx) => (
          <text
            key={`label-${rIdx}`}
            x={getMatchX(rIdx) + MATCH_W / 2} y={PAD_TOP - 12}
            fill={rIdx === rounds.length - 1 ? "#f4d35e" : "rgba(255,255,255,0.45)"}
            fontSize="11" fontFamily="Bebas Neue, sans-serif" letterSpacing="2"
            textAnchor="middle" dominantBaseline="middle"
          >
            {round.title.toUpperCase()}
          </text>
        ))}
      </svg>
    </div>
  );
}
