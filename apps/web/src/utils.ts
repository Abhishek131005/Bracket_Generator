// Shared utility functions for display formatting and client-side ranking logic

import type { PerformanceEntry } from "./types";

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format seconds to a human-readable time string.
 * - Under 60s: "9.58s" or "65.320s"
 * - 60s and over: "1:05.32"
 */
export function formatTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs.toFixed(2)}s`;
  const secStr = secs < 10 ? `0${secs.toFixed(2)}` : secs.toFixed(2);
  return `${mins}:${secStr}`;
}

/**
 * Format a height value (metres) for display.
 * Trims trailing zeros: 2.00 → "2.00m", 2.35 → "2.35m"
 */
export function formatHeight(metres: number): string {
  if (!isFinite(metres) || metres < 0) return "—";
  return `${metres.toFixed(2)}m`;
}

// ── Judged Leaderboard ────────────────────────────────────────────────────────

/**
 * Compute the final score from a list of judge scores.
 * Optionally drops the single lowest and/or highest score before aggregating.
 */
export function computeJudgedFinalScore(
  scores: number[],
  options: {
    dropLowest?: boolean;
    dropHighest?: boolean;
    aggregate?: "average" | "sum";
  } = {}
): number {
  if (scores.length === 0) return 0;
  const { dropLowest = false, dropHighest = false, aggregate = "average" } = options;
  let working = [...scores].sort((a, b) => a - b);
  if (dropLowest && working.length > 1) working = working.slice(1);
  if (dropHighest && working.length > 1) working = working.slice(0, -1);
  const total = working.reduce((s, v) => s + v, 0);
  return aggregate === "sum" ? total : total / working.length;
}

// ── Height Leaderboard ────────────────────────────────────────────────────────

export interface RankedHeightEntry {
  entryId: string;
  participantId: string;
  participantName: string;
  maxHeightCleared: number;
  failuresAtMax: number;
  totalFailures: number;
  totalAttempts: number;
  rank: number;
}

/**
 * Safely parse height metadata from a PerformanceEntry.
 * metadata on the wire may be a JSON string or already-parsed object.
 */
function parseHeightMeta(meta: unknown): { failuresAtMax: number; totalFailures: number; totalAttempts: number } {
  const defaults = { failuresAtMax: 0, totalFailures: 0, totalAttempts: 1 };
  if (!meta) return defaults;
  let obj: Record<string, unknown>;
  if (typeof meta === "string") {
    try { obj = JSON.parse(meta); } catch { return defaults; }
  } else if (typeof meta === "object") {
    obj = meta as Record<string, unknown>;
  } else {
    return defaults;
  }
  return {
    failuresAtMax: Number(obj.failuresAtMax ?? 0),
    totalFailures: Number(obj.totalFailures ?? 0),
    totalAttempts: Number(obj.totalAttempts ?? 1),
  };
}

/**
 * Rank height entries using the IAAF countback rule (client-side mirror of the API engine).
 * Priority: height DESC → failuresAtMax ASC → totalFailures ASC → totalAttempts ASC → shared rank.
 */
export function rankHeightEntries(entries: PerformanceEntry[]): RankedHeightEntry[] {
  if (entries.length === 0) return [];

  const parsed: RankedHeightEntry[] = entries.map((e) => {
    const meta = parseHeightMeta(e.metadata);
    return {
      entryId: e.id,
      participantId: e.participantId,
      participantName: e.participantName,
      maxHeightCleared: e.metricValue,
      ...meta,
      rank: 1,
    };
  });

  const sorted = [...parsed].sort((a, b) => {
    if (b.maxHeightCleared !== a.maxHeightCleared) return b.maxHeightCleared - a.maxHeightCleared;
    if (a.failuresAtMax !== b.failuresAtMax) return a.failuresAtMax - b.failuresAtMax;
    if (a.totalFailures !== b.totalFailures) return a.totalFailures - b.totalFailures;
    if (a.totalAttempts !== b.totalAttempts) return a.totalAttempts - b.totalAttempts;
    return a.participantName.localeCompare(b.participantName);
  });

  let rank = 1;
  return sorted.map((entry, i) => {
    if (i > 0) {
      const prev = sorted[i - 1];
      const isTied =
        entry.maxHeightCleared === prev.maxHeightCleared &&
        entry.failuresAtMax === prev.failuresAtMax &&
        entry.totalFailures === prev.totalFailures &&
        entry.totalAttempts === prev.totalAttempts;
      if (!isTied) rank = i + 1;
    }
    return { ...entry, rank };
  });
}

/**
 * Group flat PerformanceEntry records by participant for the judged leaderboard.
 * Each entry's metadata.judgeId identifies the judge (parsed safely from string or object).
 */
export interface JudgedParticipantRow {
  participantId: string;
  participantName: string;
  judgeScores: { judgeId: string; score: number; entryId: string }[];
  finalScore: number;
  rank: number;
}

export function buildJudgedRows(
  entries: PerformanceEntry[],
  options: { dropLowest?: boolean; dropHighest?: boolean; aggregate?: "average" | "sum" } = {}
): JudgedParticipantRow[] {
  // Group entries by participant
  const map = new Map<string, { name: string; scores: { judgeId: string; score: number; entryId: string }[] }>();
  for (const e of entries) {
    if (!map.has(e.participantId)) map.set(e.participantId, { name: e.participantName, scores: [] });
    let judgeId = "Judge";
    const meta = e.metadata;
    if (meta && typeof meta === "object" && "judgeId" in meta) {
      judgeId = String((meta as Record<string, unknown>).judgeId);
    } else if (typeof meta === "string") {
      try {
        const parsed = JSON.parse(meta);
        if (parsed.judgeId) judgeId = String(parsed.judgeId);
      } catch { /* keep default */ }
    }
    map.get(e.participantId)!.scores.push({ judgeId, score: e.metricValue, entryId: e.id });
  }

  const rows: Omit<JudgedParticipantRow, "rank">[] = Array.from(map.entries()).map(([participantId, { name, scores }]) => ({
    participantId,
    participantName: name,
    judgeScores: scores,
    finalScore: computeJudgedFinalScore(scores.map((s) => s.score), options),
  }));

  const sorted = [...rows].sort((a, b) => b.finalScore - a.finalScore);

  let rank = 1;
  return sorted.map((row, i) => {
    if (i > 0 && row.finalScore < sorted[i - 1].finalScore) rank = i + 1;
    return { ...row, rank };
  });
}
