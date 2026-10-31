import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DownstreamPlayedError, collectDescendantCodes, singleEliminationNext, winnerSide } from "./progression.js";
import { buildDoubleEliminationBracket } from "./doubleElimination.js";

describe("winnerSide", () => {
  it("returns the higher scorer, or null for draws and unplayed fixtures", () => {
    assert.equal(winnerSide(3, 1), "left");
    assert.equal(winnerSide(0, 2), "right");
    assert.equal(winnerSide(2, 2), null);
    assert.equal(winnerSide(null, null), null);
    assert.equal(winnerSide(1, null), null);
  });
});

describe("singleEliminationNext", () => {
  it("odd matches feed the left slot, even matches the right, of match ceil(m/2)", () => {
    assert.deepEqual(singleEliminationNext(1, 1), { roundIndex: 2, matchIndex: 1, slot: "left" });
    assert.deepEqual(singleEliminationNext(1, 2), { roundIndex: 2, matchIndex: 1, slot: "right" });
    assert.deepEqual(singleEliminationNext(1, 3), { roundIndex: 2, matchIndex: 2, slot: "left" });
    assert.deepEqual(singleEliminationNext(2, 2), { roundIndex: 3, matchIndex: 1, slot: "right" });
  });
});

describe("collectDescendantCodes (double elimination)", () => {
  const bracket = buildDoubleEliminationBracket(Array.from({ length: 8 }, (_, i) => ({ name: `P${i + 1}` })));
  const fixtures = bracket.allRounds.flatMap((r) => r.matches).map((m) => ({
    code: m.id,
    winnerGoesTo: m.winnerGoesTo,
    loserGoesTo: m.loserGoesTo,
  }));

  it("a winners round 1 match affects winners round 2, the losers bracket, and the grand final", () => {
    const d = collectDescendantCodes("WR1M1", fixtures);
    assert.ok(d.has("WR2M1"));
    assert.ok(d.has("LR1M1"));
    assert.ok(d.has("GF1M1"));
    assert.ok(d.has("GF1M2"), "reset match is included when the grand final is affected");
  });

  it("never includes the match itself or unrelated first-round matches", () => {
    const d = collectDescendantCodes("WR1M1", fixtures);
    assert.ok(!d.has("WR1M1"));
    assert.ok(!d.has("WR1M2"));
    assert.ok(!d.has("WR1M4"));
  });

  it("the grand final only affects its reset match", () => {
    assert.deepEqual([...collectDescendantCodes("GF1M1", fixtures)], ["GF1M2"]);
  });

  it("the reset match has no descendants", () => {
    assert.equal(collectDescendantCodes("GF1M2", fixtures).size, 0);
  });

  it("unknown codes yield nothing", () => {
    assert.equal(collectDescendantCodes("NOPE", fixtures).size, 0);
  });
});

describe("DownstreamPlayedError", () => {
  it("carries a code, a count and a readable message", () => {
    const one = new DownstreamPlayedError(1);
    assert.equal(one.code, "DOWNSTREAM_PLAYED");
    assert.equal(one.affected, 1);
    assert.match(one.message, /1 later match that has/);
    assert.match(new DownstreamPlayedError(3).message, /3 later matches that have/);
  });
});
