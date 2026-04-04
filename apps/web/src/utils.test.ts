import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatTime,
  formatHeight,
  computeJudgedFinalScore,
  rankHeightEntries,
  buildJudgedRows,
} from "./utils.js";
import type { PerformanceEntry } from "./types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(
  id: string,
  participantId: string,
  participantName: string,
  metricValue: number,
  metadata: Record<string, unknown> | null = null
): PerformanceEntry {
  return {
    id,
    stageId: "stage-1",
    participantId,
    participantName,
    metricValue,
    unit: null,
    rank: null,
    metadata,
    createdAt: new Date().toISOString(),
  };
}

// ── formatTime ────────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats sub-60s correctly", () => {
    assert.equal(formatTime(9.58), "9.58s");
    assert.equal(formatTime(0), "0.00s");
    assert.equal(formatTime(59.99), "59.99s");
  });

  it("formats exactly 60s as 1:00.00", () => {
    assert.equal(formatTime(60), "1:00.00");
  });

  it("formats over 60s with minutes prefix", () => {
    assert.equal(formatTime(65.3), "1:05.30");
    assert.equal(formatTime(3661), "61:01.00");
  });

  it("returns — for non-finite or negative values", () => {
    assert.equal(formatTime(-1), "—");
    assert.equal(formatTime(NaN), "—");
    assert.equal(formatTime(Infinity), "—");
  });
});

// ── formatHeight ──────────────────────────────────────────────────────────────

describe("formatHeight", () => {
  it("formats height with 2 decimal places", () => {
    assert.equal(formatHeight(2.35), "2.35m");
    assert.equal(formatHeight(2), "2.00m");
    assert.equal(formatHeight(0.5), "0.50m");
  });

  it("returns — for invalid values", () => {
    assert.equal(formatHeight(-1), "—");
    assert.equal(formatHeight(NaN), "—");
    assert.equal(formatHeight(Infinity), "—");
  });
});

// ── computeJudgedFinalScore ───────────────────────────────────────────────────

describe("computeJudgedFinalScore", () => {
  it("returns 0 for empty scores", () => {
    assert.equal(computeJudgedFinalScore([]), 0);
  });

  it("averages scores by default", () => {
    assert.equal(computeJudgedFinalScore([8, 9, 10]), 9);
    assert.equal(computeJudgedFinalScore([7.5, 8.5]), 8);
  });

  it("sums scores when aggregate is 'sum'", () => {
    assert.equal(computeJudgedFinalScore([8, 9, 10], { aggregate: "sum" }), 27);
  });

  it("drops lowest score before averaging", () => {
    // [6, 8, 9, 10] → drop 6 → avg(8,9,10) = 9
    assert.equal(computeJudgedFinalScore([6, 8, 9, 10], { dropLowest: true }), 9);
  });

  it("drops highest score before averaging", () => {
    // [6, 8, 9, 10] → drop 10 → avg(6,8,9) = 23/3
    const result = computeJudgedFinalScore([6, 8, 9, 10], { dropHighest: true });
    assert.ok(Math.abs(result - (6 + 8 + 9) / 3) < 0.001);
  });

  it("drops both highest and lowest", () => {
    // [5, 7, 8, 9, 10] → drop 5 and 10 → avg(7,8,9) = 8
    assert.equal(computeJudgedFinalScore([5, 7, 8, 9, 10], { dropLowest: true, dropHighest: true }), 8);
  });

  it("does not drop if only one score remains after drops", () => {
    // [5, 10] with both drops — cannot drop when only 1 left
    // dropLowest first: [10], then dropHighest can't (length 1), result = 10
    assert.equal(computeJudgedFinalScore([5, 10], { dropLowest: true, dropHighest: true }), 10);
  });

  it("handles single score", () => {
    assert.equal(computeJudgedFinalScore([9.5]), 9.5);
  });
});

// ── rankHeightEntries ─────────────────────────────────────────────────────────

describe("rankHeightEntries", () => {
  it("returns empty array for no entries", () => {
    assert.deepEqual(rankHeightEntries([]), []);
  });

  it("ranks by height descending", () => {
    const entries = [
      makeEntry("a", "p1", "Alice", 2.35, { failuresAtMax: 0, totalFailures: 1, totalAttempts: 4 }),
      makeEntry("b", "p2", "Bob", 2.30, { failuresAtMax: 1, totalFailures: 2, totalAttempts: 5 }),
    ];
    const ranked = rankHeightEntries(entries);
    assert.equal(ranked[0].participantName, "Alice");
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].participantName, "Bob");
    assert.equal(ranked[1].rank, 2);
  });

  it("applies countback: fewer failures at max wins on equal height", () => {
    const entries = [
      makeEntry("a", "p1", "Alice", 2.35, { failuresAtMax: 1, totalFailures: 3, totalAttempts: 6 }),
      makeEntry("b", "p2", "Bob", 2.35, { failuresAtMax: 0, totalFailures: 1, totalAttempts: 3 }),
    ];
    const ranked = rankHeightEntries(entries);
    assert.equal(ranked[0].participantName, "Bob");
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].participantName, "Alice");
    assert.equal(ranked[1].rank, 2);
  });

  it("applies countback level 2: fewer total failures wins on equal height + failuresAtMax", () => {
    const entries = [
      makeEntry("a", "p1", "Alice", 2.35, { failuresAtMax: 0, totalFailures: 3, totalAttempts: 6 }),
      makeEntry("b", "p2", "Bob", 2.35, { failuresAtMax: 0, totalFailures: 1, totalAttempts: 4 }),
    ];
    const ranked = rankHeightEntries(entries);
    assert.equal(ranked[0].participantName, "Bob");
    assert.equal(ranked[1].participantName, "Alice");
  });

  it("awards shared rank for true tie (Barshim/Tamberi scenario)", () => {
    const entries = [
      makeEntry("a", "p1", "Barshim", 2.37, { failuresAtMax: 0, totalFailures: 3, totalAttempts: 9 }),
      makeEntry("b", "p2", "Tamberi", 2.37, { failuresAtMax: 0, totalFailures: 3, totalAttempts: 9 }),
      makeEntry("c", "p3", "Third", 2.33, { failuresAtMax: 0, totalFailures: 1, totalAttempts: 5 }),
    ];
    const ranked = rankHeightEntries(entries);
    const gold = ranked.filter((r) => r.rank === 1);
    assert.equal(gold.length, 2, "should be 2 gold medalists");
    assert.ok(gold.map((r) => r.participantName).includes("Barshim"));
    assert.ok(gold.map((r) => r.participantName).includes("Tamberi"));
    assert.equal(ranked.find((r) => r.participantName === "Third")?.rank, 3);
  });

  it("safely parses metadata from JSON string (wire format)", () => {
    // The API sends metadata as a JSON string; our util must handle that too
    const entries = [
      {
        ...makeEntry("a", "p1", "Alice", 2.35),
        metadata: JSON.stringify({ failuresAtMax: 0, totalFailures: 1, totalAttempts: 3 }) as unknown as Record<string, unknown>,
      },
      makeEntry("b", "p2", "Bob", 2.30, { failuresAtMax: 0, totalFailures: 0, totalAttempts: 2 }),
    ];
    const ranked = rankHeightEntries(entries as PerformanceEntry[]);
    assert.equal(ranked[0].participantName, "Alice");
  });
});

// ── buildJudgedRows ───────────────────────────────────────────────────────────

describe("buildJudgedRows", () => {
  it("groups entries by participant and computes average", () => {
    const entries = [
      makeEntry("s1", "p1", "Alice", 8.5, { judgeId: "Judge A" }),
      makeEntry("s2", "p1", "Alice", 9.0, { judgeId: "Judge B" }),
      makeEntry("s3", "p2", "Bob", 7.0, { judgeId: "Judge A" }),
      makeEntry("s4", "p2", "Bob", 8.0, { judgeId: "Judge B" }),
    ];
    const rows = buildJudgedRows(entries);
    assert.equal(rows.length, 2);
    const alice = rows.find((r) => r.participantName === "Alice")!;
    assert.ok(alice);
    assert.equal(alice.judgeScores.length, 2);
    assert.ok(Math.abs(alice.finalScore - 8.75) < 0.001);
  });

  it("ranks by final score descending", () => {
    const entries = [
      makeEntry("s1", "p1", "Alice", 7.0, { judgeId: "J1" }),
      makeEntry("s2", "p2", "Bob", 9.0, { judgeId: "J1" }),
    ];
    const rows = buildJudgedRows(entries);
    assert.equal(rows[0].participantName, "Bob");
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[1].participantName, "Alice");
    assert.equal(rows[1].rank, 2);
  });

  it("returns empty for no entries", () => {
    assert.deepEqual(buildJudgedRows([]), []);
  });

  it("parses judgeId from JSON string metadata", () => {
    const entries = [
      {
        ...makeEntry("s1", "p1", "Alice", 9.0),
        metadata: '{"judgeId":"Judge X"}' as unknown as Record<string, unknown>,
      },
    ];
    const rows = buildJudgedRows(entries as PerformanceEntry[]);
    assert.equal(rows[0].judgeScores[0].judgeId, "Judge X");
  });
});
