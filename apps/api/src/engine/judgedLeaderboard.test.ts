import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildJudgedParticipants,
  calculateJudgedLeaderboard,
  type JudgedParticipant,
} from "./judgedLeaderboard.js";

// Helper: build a JudgedParticipant directly from score list
function participant(name: string, scores: number[]): JudgedParticipant {
  return {
    participantId: name.toLowerCase().replace(/\s/g, "-"),
    participantName: name,
    scores: scores.map((s, i) => ({ judgeId: `judge-${i + 1}`, score: s })),
  };
}

// ── buildJudgedParticipants ───────────────────────────────────────────────────

describe("buildJudgedParticipants", () => {
  it("returns empty array for empty input", () => {
    assert.deepEqual(buildJudgedParticipants([]), []);
  });

  it("groups entries by participantId", () => {
    const entries = [
      { participantId: "a1", participantName: "Alice", metricValue: 8.0, metadata: null },
      { participantId: "a1", participantName: "Alice", metricValue: 7.5, metadata: null },
      { participantId: "b1", participantName: "Bob",   metricValue: 9.0, metadata: null },
    ];
    const result = buildJudgedParticipants(entries);
    assert.equal(result.length, 2);
    const alice = result.find((p) => p.participantId === "a1")!;
    assert.equal(alice.scores.length, 2);
    assert.equal(alice.scores[0].score, 8.0);
    assert.equal(alice.scores[1].score, 7.5);
  });

  it("extracts judgeId from metadata JSON when present", () => {
    const entries = [
      {
        participantId: "a1",
        participantName: "Alice",
        metricValue: 8.0,
        metadata: JSON.stringify({ judgeId: "Judge Kim" }),
      },
    ];
    const result = buildJudgedParticipants(entries);
    assert.equal(result[0].scores[0].judgeId, "Judge Kim");
  });

  it("falls back to generated judgeId when metadata is null", () => {
    const entries = [
      { participantId: "a1", participantName: "Alice", metricValue: 8.0, metadata: null },
    ];
    const result = buildJudgedParticipants(entries);
    assert.equal(result[0].scores[0].judgeId, "judge-1");
  });

  it("falls back to generated judgeId when metadata is invalid JSON", () => {
    const entries = [
      { participantId: "a1", participantName: "Alice", metricValue: 8.0, metadata: "{bad" },
    ];
    const result = buildJudgedParticipants(entries);
    assert.match(result[0].scores[0].judgeId, /^judge-/);
  });
});

// ── calculateJudgedLeaderboard ────────────────────────────────────────────────

describe("calculateJudgedLeaderboard", () => {
  it("returns empty array for empty input", () => {
    assert.deepEqual(calculateJudgedLeaderboard([]), []);
  });

  it("ranks single participant as #1", () => {
    const result = calculateJudgedLeaderboard([participant("Alice", [8.0, 9.0])]);
    assert.equal(result.length, 1);
    assert.equal(result[0].rank, 1);
  });

  it("higher average score ranks first", () => {
    const result = calculateJudgedLeaderboard([
      participant("Bob",   [7.0, 7.0, 7.0]),
      participant("Alice", [9.0, 9.0, 9.0]),
      participant("Carol", [8.0, 8.0, 8.0]),
    ]);
    assert.equal(result[0].participantName, "Alice");
    assert.equal(result[1].participantName, "Carol");
    assert.equal(result[2].participantName, "Bob");
    assert.equal(result[0].rank, 1);
    assert.equal(result[2].rank, 3);
  });

  it("correctly computes average finalScore", () => {
    const result = calculateJudgedLeaderboard([participant("Alice", [7.0, 9.0, 8.0])]);
    assert.equal(result[0].finalScore, 8.0);   // (7+9+8)/3 = 8.000
  });

  it("correctly computes sum when aggregate=sum", () => {
    const result = calculateJudgedLeaderboard(
      [participant("Alice", [7.0, 9.0, 8.0])],
      { aggregate: "sum" }
    );
    assert.equal(result[0].finalScore, 24.0);
  });

  it("rawTotal is always the unmodified sum regardless of drop options", () => {
    const result = calculateJudgedLeaderboard(
      [participant("Alice", [5.0, 9.0, 8.0])],
      { dropLowest: true }
    );
    assert.equal(result[0].rawTotal, 22.0);
    assert.ok(result[0].finalScore !== 22.0); // finalScore differs (drop applied)
  });

  it("dropLowest removes the lowest score before averaging", () => {
    // Scores: 5, 8, 9 → drop 5 → average of (8, 9) = 8.5
    const result = calculateJudgedLeaderboard(
      [participant("Alice", [5.0, 8.0, 9.0])],
      { dropLowest: true }
    );
    assert.equal(result[0].finalScore, 8.5);
  });

  it("dropHighest removes the highest score before averaging", () => {
    // Scores: 5, 8, 10 → drop 10 → average of (5, 8) = 6.5
    const result = calculateJudgedLeaderboard(
      [participant("Alice", [5.0, 8.0, 10.0])],
      { dropHighest: true }
    );
    assert.equal(result[0].finalScore, 6.5);
  });

  it("dropLowest + dropHighest both applied", () => {
    // Scores: 4, 7, 8, 10 → drop 4 and 10 → average of (7, 8) = 7.5
    const result = calculateJudgedLeaderboard(
      [participant("Alice", [4.0, 7.0, 8.0, 10.0])],
      { dropLowest: true, dropHighest: true }
    );
    assert.equal(result[0].finalScore, 7.5);
  });

  it("does not drop when fewer scores remain than drop count", () => {
    // Only 1 score, drop flags set — should not crash, score kept as-is
    const result = calculateJudgedLeaderboard(
      [participant("Alice", [8.0])],
      { dropLowest: true, dropHighest: true }
    );
    assert.equal(result[0].finalScore, 8.0);
    assert.equal(result[0].judgeCount, 1);
  });

  it("participant with zero scores gets finalScore = 0 and ranks last", () => {
    const noScores: JudgedParticipant = {
      participantId: "ghost",
      participantName: "Ghost",
      scores: [],
    };
    const result = calculateJudgedLeaderboard([
      participant("Alice", [8.0]),
      noScores,
    ]);
    assert.equal(result[0].participantName, "Alice");
    assert.equal(result[1].participantName, "Ghost");
    assert.equal(result[1].finalScore, 0);
  });

  it("tied final scores produce shared rank", () => {
    const result = calculateJudgedLeaderboard([
      participant("Alice", [8.0, 8.0]),
      participant("Bob",   [8.0, 8.0]),
    ]);
    assert.equal(result[0].rank, 1);
    assert.equal(result[1].rank, 1);
  });

  it("rank skips after a tie (1, 1, 3 — not 1, 1, 2)", () => {
    const result = calculateJudgedLeaderboard([
      participant("Alice", [9.0]),
      participant("Bob",   [9.0]),
      participant("Carol", [7.0]),
    ]);
    const ranks = result.map((r) => r.rank);
    assert.deepEqual(ranks, [1, 1, 3]);
  });

  it("tie broken alphabetically within tied group", () => {
    const result = calculateJudgedLeaderboard([
      participant("Zara",  [8.0]),
      participant("Alice", [8.0]),
    ]);
    assert.equal(result[0].participantName, "Alice");
    assert.equal(result[1].participantName, "Zara");
  });

  it("does not mutate the input array", () => {
    const input = [
      participant("Bob",   [7.0]),
      participant("Alice", [9.0]),
    ];
    const names = input.map((p) => p.participantName);
    calculateJudgedLeaderboard(input);
    assert.deepEqual(input.map((p) => p.participantName), names);
  });

  it("judgeCount matches the number of scores submitted", () => {
    const result = calculateJudgedLeaderboard([participant("Alice", [7, 8, 9, 8, 7])]);
    assert.equal(result[0].judgeCount, 5);
  });
});
