import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateHeightLeaderboard,
  parseHeightMetadata,
  type HeightEntry,
} from "./heightLeaderboard.js";

// Helper: build a minimal HeightEntry
function entry(
  name: string,
  maxHeight: number,
  failuresAtMax = 0,
  totalFailures = 0,
  totalAttempts = 1
): HeightEntry {
  return {
    participantId: name.toLowerCase().replace(/\s/g, "-"),
    participantName: name,
    maxHeightCleared: maxHeight,
    failuresAtMax,
    totalFailures,
    totalAttempts,
  };
}

// ── parseHeightMetadata ───────────────────────────────────────────────────────

describe("parseHeightMetadata", () => {
  it("returns safe defaults for null", () => {
    const meta = parseHeightMetadata(null);
    assert.deepEqual(meta, { failuresAtMax: 0, totalFailures: 0, totalAttempts: 1 });
  });

  it("returns safe defaults for empty string", () => {
    const meta = parseHeightMetadata("");
    assert.deepEqual(meta, { failuresAtMax: 0, totalFailures: 0, totalAttempts: 1 });
  });

  it("returns safe defaults for invalid JSON", () => {
    const meta = parseHeightMetadata("{not valid json}");
    assert.deepEqual(meta, { failuresAtMax: 0, totalFailures: 0, totalAttempts: 1 });
  });

  it("parses valid JSON correctly", () => {
    const meta = parseHeightMetadata(
      JSON.stringify({ failuresAtMax: 2, totalFailures: 4, totalAttempts: 7 })
    );
    assert.deepEqual(meta, { failuresAtMax: 2, totalFailures: 4, totalAttempts: 7 });
  });

  it("coerces string numbers to number type", () => {
    const meta = parseHeightMetadata(
      JSON.stringify({ failuresAtMax: "1", totalFailures: "3", totalAttempts: "5" })
    );
    assert.equal(typeof meta.failuresAtMax, "number");
    assert.equal(meta.failuresAtMax, 1);
  });
});

// ── calculateHeightLeaderboard ────────────────────────────────────────────────

describe("calculateHeightLeaderboard", () => {
  it("returns empty array for empty input", () => {
    assert.deepEqual(calculateHeightLeaderboard([]), []);
  });

  it("ranks single participant as #1", () => {
    const result = calculateHeightLeaderboard([entry("Alice", 2.0)]);
    assert.equal(result.length, 1);
    assert.equal(result[0].rank, 1);
    assert.equal(result[0].participantName, "Alice");
  });

  it("higher height clears rank first — no tiebreak needed", () => {
    const result = calculateHeightLeaderboard([
      entry("Bob",   1.90),
      entry("Alice", 2.10),
      entry("Carol", 2.00),
    ]);
    assert.equal(result[0].participantName, "Alice");
    assert.equal(result[1].participantName, "Carol");
    assert.equal(result[2].participantName, "Bob");
    assert.equal(result[0].rank, 1);
    assert.equal(result[1].rank, 2);
    assert.equal(result[2].rank, 3);
  });

  it("tiebreak 1: fewer failures at decisive height wins", () => {
    // Both cleared 2.0m, but Alice needed 1 fewer failure
    const result = calculateHeightLeaderboard([
      entry("Bob",   2.0, 2, 3, 6),
      entry("Alice", 2.0, 1, 3, 6),
    ]);
    assert.equal(result[0].participantName, "Alice");
    assert.equal(result[1].participantName, "Bob");
    assert.equal(result[0].rank, 1);
    assert.equal(result[1].rank, 2);
  });

  it("tiebreak 2: fewer total failures wins when failuresAtMax is equal", () => {
    const result = calculateHeightLeaderboard([
      entry("Bob",   2.0, 1, 4, 8),
      entry("Alice", 2.0, 1, 2, 7),
    ]);
    assert.equal(result[0].participantName, "Alice");
    assert.equal(result[1].participantName, "Bob");
  });

  it("tiebreak 3: fewer total attempts wins when total failures are equal", () => {
    const result = calculateHeightLeaderboard([
      entry("Bob",   2.0, 1, 3, 9),
      entry("Alice", 2.0, 1, 3, 7),
    ]);
    assert.equal(result[0].participantName, "Alice");
    assert.equal(result[1].participantName, "Bob");
  });

  it("true tie → shared rank, alphabetical within tied group", () => {
    const result = calculateHeightLeaderboard([
      entry("Zara",  2.0, 1, 3, 5),
      entry("Alice", 2.0, 1, 3, 5),
    ]);
    // Both get rank 1 (true tie)
    assert.equal(result[0].rank, 1);
    assert.equal(result[1].rank, 1);
    // Alphabetical within tied group
    assert.equal(result[0].participantName, "Alice");
    assert.equal(result[1].participantName, "Zara");
  });

  it("rank skips after a tie (1, 1, 3 — not 1, 1, 2)", () => {
    const result = calculateHeightLeaderboard([
      entry("Alice", 2.0, 0, 0, 1),
      entry("Bob",   2.0, 0, 0, 1),  // tied with Alice
      entry("Carol", 1.9, 0, 0, 1),
    ]);
    const ranks = result.map((r) => r.rank);
    assert.deepEqual(ranks, [1, 1, 3]);
  });

  it("does not mutate the input array", () => {
    const input = [
      entry("Bob",   1.8),
      entry("Alice", 2.0),
    ];
    const originalOrder = input.map((e) => e.participantName);
    calculateHeightLeaderboard(input);
    assert.deepEqual(
      input.map((e) => e.participantName),
      originalOrder
    );
  });

  it("handles a realistic high-jump competition correctly", () => {
    // World Athletics scenario
    const result = calculateHeightLeaderboard([
      entry("Tamberi",    2.37, 1, 3, 9),   // cleared 2.37 after 1 failure
      entry("Barshim",    2.37, 1, 3, 9),   // identical — true tie (Tokyo 2020)
      entry("Lysenko",    2.33, 0, 1, 7),
      entry("Ghazal",     2.33, 1, 2, 8),
      entry("Competitor", 2.28, 0, 0, 6),
    ]);

    assert.equal(result[0].rank, 1);
    assert.equal(result[1].rank, 1);  // tied gold (Tamberi & Barshim)
    assert.equal(result[2].rank, 3);  // Lysenko (fewer failures at 2.33)
    assert.equal(result[3].rank, 4);  // Ghazal
    assert.equal(result[4].rank, 5);
  });
});
