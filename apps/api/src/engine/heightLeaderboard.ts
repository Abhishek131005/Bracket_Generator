// HEIGHT_DESC_WITH_COUNTBACK engine
// Implements the standard IAAF / World Athletics high-jump countback rule.
//
// A participant's result is described by four numbers:
//   maxHeightCleared  – the best height cleared (metres or centimetres, your choice – be consistent)
//   failuresAtMax     – number of failures BEFORE clearing the best height  (0 = cleared first time)
//   totalFailures     – total failed attempts across ALL heights
//   totalAttempts     – total jumps taken (failures + clearances combined)
//
// Countback tie-breaking priority (rules §181.8 of IAAF Technical Rules):
//   1. Higher maxHeightCleared wins              (DESC)
//   2. Fewer failures at the decisive height     (ASC)
//   3. Fewer total failures across the event     (ASC)
//   4. Fewer total attempts across the event     (ASC)
//   5. True tie → shared rank (jump-off in real competition; we award the same rank)
//
// Storing countback data
// ──────────────────────
// Each PerformanceEntry stores:
//   metricValue → maxHeightCleared
//   metadata    → JSON string: { failuresAtMax, totalFailures, totalAttempts }
//
// Use parseHeightMetadata() to convert the raw metadata string before calling
// calculateHeightLeaderboard().

export interface HeightEntryMetadata {
  failuresAtMax: number;
  totalFailures: number;
  totalAttempts: number;
}

export interface HeightEntry {
  participantId: string;
  participantName: string;
  maxHeightCleared: number;
  failuresAtMax: number;
  totalFailures: number;
  totalAttempts: number;
}

export interface HeightResult extends HeightEntry {
  rank: number;
}

/**
 * Parse the JSON metadata string from a PerformanceEntry record.
 * Returns safe defaults (no failures, one attempt) when the field is absent
 * or malformed so callers never have to null-check.
 */
export function parseHeightMetadata(raw: string | null): HeightEntryMetadata {
  if (!raw) return { failuresAtMax: 0, totalFailures: 0, totalAttempts: 1 };
  try {
    const parsed = JSON.parse(raw);
    return {
      failuresAtMax: Number(parsed.failuresAtMax ?? 0),
      totalFailures: Number(parsed.totalFailures ?? 0),
      totalAttempts: Number(parsed.totalAttempts ?? 1),
    };
  } catch {
    return { failuresAtMax: 0, totalFailures: 0, totalAttempts: 1 };
  }
}

/**
 * Rank athletes by height with IAAF countback tie-breaking.
 *
 * Returns a new sorted array — the input is not mutated.
 */
export function calculateHeightLeaderboard(entries: HeightEntry[]): HeightResult[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => {
    // 1. Higher height cleared is better
    if (b.maxHeightCleared !== a.maxHeightCleared) return b.maxHeightCleared - a.maxHeightCleared;
    // 2. Fewer failures at the decisive height
    if (a.failuresAtMax !== b.failuresAtMax) return a.failuresAtMax - b.failuresAtMax;
    // 3. Fewer total failures
    if (a.totalFailures !== b.totalFailures) return a.totalFailures - b.totalFailures;
    // 4. Fewer total attempts
    if (a.totalAttempts !== b.totalAttempts) return a.totalAttempts - b.totalAttempts;
    // 5. True tie — alphabetical for determinism (jump-off decides in real competition)
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
