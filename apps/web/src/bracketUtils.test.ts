import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBracketFromFixtures,
  buildDEBracketFromFixtures,
  getChampion,
  getDEChampion,
  getBracketWinnerPath,
} from "./bracketUtils.js";
import type { StageFixture } from "./types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fx(
  id: string,
  roundIndex: number,
  matchIndex: number,
  leftLabel: string | null,
  rightLabel: string | null,
  leftScore: number | null,
  rightScore: number | null,
  status: StageFixture["status"] = "COMPLETED"
): StageFixture {
  return {
    id,
    roundIndex,
    matchIndex,
    leftParticipantId: leftLabel ? `pid-${leftLabel}` : null,
    rightParticipantId: rightLabel ? `pid-${rightLabel}` : null,
    leftLabel,
    rightLabel,
    leftScore,
    rightScore,
    status,
    autoAdvanceParticipantId: null,
  };
}

// ── 4-team single-elimination bracket ────────────────────────────────────────
// R1: Alice d. Bob 2-0  | Carol d. Dave 3-1
// Final: Alice d. Carol 1-0

const fixtures4: StageFixture[] = [
  fx("m1", 1, 1, "Alice", "Bob", 2, 0),
  fx("m2", 1, 2, "Carol", "Dave", 3, 1),
  fx("final", 2, 1, "Alice", "Carol", 1, 0),
];

describe("buildBracketFromFixtures", () => {
  it("builds correct round structure for 4-team bracket", () => {
    const bracket = buildBracketFromFixtures(fixtures4, 4);
    assert.ok(bracket);
    assert.equal(bracket.rounds.length, 2);
    assert.equal(bracket.rounds[0].matches.length, 2);
    assert.equal(bracket.rounds[1].matches.length, 1);
  });

  it("populates _winner on completed matches", () => {
    const bracket = buildBracketFromFixtures(fixtures4, 4);
    assert.ok(bracket);
    const r1m1 = bracket.rounds[0].matches[0] as any;
    assert.equal(r1m1._winner, "Alice");
    const r1m2 = bracket.rounds[0].matches[1] as any;
    assert.equal(r1m2._winner, "Carol");
    const finalMatch = bracket.rounds[1].matches[0] as any;
    assert.equal(finalMatch._winner, "Alice");
  });

  it("_winner is null for drawn match", () => {
    const drawnFixtures: StageFixture[] = [
      fx("d1", 1, 1, "Alice", "Bob", 1, 1),
      fx("d2", 1, 2, "Carol", "Dave", 0, 0),
      fx("d3", 2, 1, "TBD", "TBD", null, null, "SCHEDULED"),
    ];
    const bracket = buildBracketFromFixtures(drawnFixtures, 4);
    assert.ok(bracket);
    const r1m1 = bracket.rounds[0].matches[0] as any;
    assert.equal(r1m1._winner, null);
  });

  it("handles AUTO_ADVANCE status correctly", () => {
    const byeFixtures: StageFixture[] = [
      fx("b1", 1, 1, "Alice", null, null, null, "AUTO_ADVANCE"),
      fx("b2", 1, 2, "Carol", "Dave", 2, 1),
      fx("b3", 2, 1, "Alice", "Carol", 3, 1),
    ];
    const bracket = buildBracketFromFixtures(byeFixtures, 3);
    assert.ok(bracket);
    const byeMatch = bracket.rounds[0].matches[0] as any;
    assert.equal(byeMatch._winner, "Alice");
  });

  it("returns null for empty fixtures", () => {
    const bracket = buildBracketFromFixtures([], 4);
    assert.equal(bracket, null);
  });

  it("assigns correct round titles", () => {
    const bracket = buildBracketFromFixtures(fixtures4, 4);
    assert.ok(bracket);
    assert.equal(bracket.rounds[0].title, "Semi Final");
    assert.equal(bracket.rounds[1].title, "Final");
  });
});

// ── getChampion ───────────────────────────────────────────────────────────────

describe("getChampion", () => {
  it("returns champion when final is complete", () => {
    const bracket = buildBracketFromFixtures(fixtures4, 4)!;
    assert.equal(getChampion(bracket), "Alice");
  });

  it("returns null when final is not yet played", () => {
    const incomplete: StageFixture[] = [
      fx("m1", 1, 1, "Alice", "Bob", 2, 0),
      fx("m2", 1, 2, "Carol", "Dave", 3, 1),
      fx("final", 2, 1, "Alice", "Carol", null, null, "SCHEDULED"),
    ];
    const bracket = buildBracketFromFixtures(incomplete, 4)!;
    assert.equal(getChampion(bracket), null);
  });

  it("handles 2-team bracket (single match = final)", () => {
    const tiny: StageFixture[] = [fx("only", 1, 1, "Alice", "Bob", 2, 1)];
    const bracket = buildBracketFromFixtures(tiny, 2)!;
    assert.equal(getChampion(bracket), "Alice");
  });
});

// ── getBracketWinnerPath ──────────────────────────────────────────────────────

describe("getBracketWinnerPath", () => {
  it("returns IDs of all matches the champion competed in", () => {
    const bracket = buildBracketFromFixtures(fixtures4, 4)!;
    const path = getBracketWinnerPath(bracket);
    // Alice played m1 (vs Bob) and final
    assert.ok(path.has("m1"), "should include R1 match");
    assert.ok(path.has("final"), "should include final");
    assert.equal(path.size, 2);
  });

  it("does NOT include matches the champion did not play in", () => {
    const bracket = buildBracketFromFixtures(fixtures4, 4)!;
    const path = getBracketWinnerPath(bracket);
    assert.ok(!path.has("m2"), "should not include Carol vs Dave");
  });

  it("returns empty set when final not complete", () => {
    const incomplete: StageFixture[] = [
      fx("m1", 1, 1, "Alice", "Bob", 2, 0),
      fx("m2", 1, 2, "Carol", "Dave", 3, 1),
      fx("final", 2, 1, "Alice", "Carol", null, null, "SCHEDULED"),
    ];
    const bracket = buildBracketFromFixtures(incomplete, 4)!;
    const path = getBracketWinnerPath(bracket);
    assert.equal(path.size, 0);
  });

  it("handles 8-team bracket: path has 3 matches", () => {
    const f8: StageFixture[] = [
      fx("r1a", 1, 1, "A", "B", 2, 0),
      fx("r1b", 1, 2, "C", "D", 1, 0),
      fx("r1c", 1, 3, "E", "F", 3, 1),
      fx("r1d", 1, 4, "G", "H", 2, 1),
      fx("r2a", 2, 1, "A", "C", 2, 0),
      fx("r2b", 2, 2, "E", "G", 1, 0),
      fx("r3",  3, 1, "A", "E", 3, 0),
    ];
    const bracket = buildBracketFromFixtures(f8, 8)!;
    assert.equal(getChampion(bracket), "A");
    const path = getBracketWinnerPath(bracket);
    assert.equal(path.size, 3, "3 rounds = 3 matches in path");
    assert.ok(path.has("r1a"));
    assert.ok(path.has("r2a"));
    assert.ok(path.has("r3"));
  });
});

// ── getDEChampion ─────────────────────────────────────────────────────────────

describe("getDEChampion", () => {
  it("returns GF winner when grand final is complete", () => {
    // Minimal DE: 4 participants, 2 WB rounds, 2 LB rounds, 1 GF match
    // WB R1: Alice d. Bob 2-0; Carol d. Dave 1-0
    // WB R2 (WF): Alice d. Carol 2-0  → Carol drops to LB
    // LB R1: Bob d. Dave 1-0  (Bob was in WB R1 losers)
    // LB Final: Carol d. Bob 3-0
    // GF: Alice d. Carol 2-1
    const deFixtures: StageFixture[] = [
      fx("wb1",  1, 1, "Alice", "Bob",   2, 0),
      fx("wb2",  1, 2, "Carol", "Dave",  1, 0),
      fx("wbf",  2, 1, "Alice", "Carol", 2, 0),
      fx("lb1",  3, 1, "Bob",   "Dave",  1, 0),
      fx("lbf",  4, 1, "Carol", "Bob",   3, 0),
      fx("gf1",  5, 1, "Alice", "Carol", 2, 1),
    ];
    const bracket = buildDEBracketFromFixtures(deFixtures, 4)!;
    assert.equal(getDEChampion(bracket), "Alice");
  });

  it("returns null when grand final not yet played", () => {
    const deFixtures: StageFixture[] = [
      fx("wb1",  1, 1, "Alice", "Bob",   2, 0),
      fx("wb2",  1, 2, "Carol", "Dave",  1, 0),
      fx("wbf",  2, 1, "Alice", "Carol", 2, 0),
      fx("lb1",  3, 1, "Bob",   "Dave",  1, 0),
      fx("lbf",  4, 1, "Carol", "Bob",   3, 0),
      fx("gf1",  5, 1, "Alice", "Carol", null, null, "SCHEDULED"),
    ];
    const bracket = buildDEBracketFromFixtures(deFixtures, 4)!;
    assert.equal(getDEChampion(bracket), null);
  });
});
