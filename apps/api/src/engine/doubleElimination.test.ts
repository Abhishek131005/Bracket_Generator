import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDoubleEliminationBracket } from "./doubleElimination.js";
import { collectDescendantCodes } from "./progression.js";

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}` }));
const matchesOf = (b: ReturnType<typeof buildDoubleEliminationBracket>) => b.allRounds.flatMap((r) => r.matches);

describe("buildDoubleEliminationBracket — shape", () => {
  it("rejects fewer than 2 participants", () => {
    assert.throws(() => buildDoubleEliminationBracket(names(1)));
  });

  it("8 players: 3 winners rounds, 4 losers rounds, grand final + reset", () => {
    const b = buildDoubleEliminationBracket(names(8));
    assert.deepEqual(b.winnersRounds.map((r) => r.matches.length), [4, 2, 1]);
    assert.deepEqual(b.losersRounds.map((r) => r.matches.length), [2, 2, 1, 1]);
    assert.deepEqual(b.grandFinal.matches.map((m) => m.id), ["GF1M1", "GF1M2"]);
  });

  it("every match id is unique", () => {
    for (const n of [4, 5, 8, 12, 16]) {
      const ids = matchesOf(buildDoubleEliminationBracket(names(n))).map((m) => m.id);
      assert.equal(new Set(ids).size, ids.length, `n=${n}`);
    }
  });
});

describe("buildDoubleEliminationBracket — seeding", () => {
  it("winners round 1 of an 8-player bracket is 1v8, 4v5, 2v7, 3v6", () => {
    const b = buildDoubleEliminationBracket(names(8));
    const pairs = b.winnersRounds[0].matches.map((m) => [m.leftSeed, m.rightSeed]);
    assert.deepEqual(pairs, [[1, 8], [4, 5], [2, 7], [3, 6]]);
  });

  it("seeds 1 and 2 cannot meet before the winners final", () => {
    for (const n of [4, 8, 16]) {
      const b = buildDoubleEliminationBracket(names(n));
      const matches = matchesOf(b);
      const seedsFeeding = (code: string): number[] => {
        const feeders = matches.filter((m) => m.bracket === "WINNERS" && m.winnerGoesTo === code);
        if (feeders.length === 0) {
          const m = matches.find((x) => x.id === code)!;
          return [m.leftSeed, m.rightSeed].filter((s): s is number => s !== null);
        }
        return feeders.flatMap((f) => seedsFeeding(f.id));
      };
      const final = b.winnersRounds[b.winnersRounds.length - 1].matches[0];
      const sides = matches.filter((m) => m.bracket === "WINNERS" && m.winnerGoesTo === final.id).map((m) => seedsFeeding(m.id));
      assert.equal(sides.length, 2, `n=${n}`);
      assert.ok(sides[0].includes(1) !== sides[1].includes(1), `n=${n}: seed 1 on exactly one side`);
      assert.ok(sides[0].includes(1) !== sides[0].includes(2), `n=${n}: seeds 1 and 2 on opposite sides`);
    }
  });

  it("gives byes to the top seeds", () => {
    const b = buildDoubleEliminationBracket(names(6));
    const byeMatches = b.winnersRounds[0].matches.filter((m) => m.status === "AUTO_ADVANCE");
    assert.deepEqual(byeMatches.map((m) => m.autoAdvanceWinner).sort(), ["P1", "P2"]);
    assert.equal(b.byeCount, 2);
  });

  it("places every participant exactly once in winners round 1", () => {
    for (const n of [3, 5, 8, 11]) {
      const b = buildDoubleEliminationBracket(names(n));
      const placed = b.winnersRounds[0].matches.flatMap((m) => [m.leftLabel, m.rightLabel]).filter(Boolean);
      assert.equal(new Set(placed).size, n, `n=${n}`);
    }
  });
});

describe("buildDoubleEliminationBracket — routing graph", () => {
  it("every route points at a match that exists", () => {
    for (const n of [4, 8, 16]) {
      const matches = matchesOf(buildDoubleEliminationBracket(names(n)));
      const ids = new Set(matches.map((m) => m.id));
      for (const m of matches) {
        if (m.winnerGoesTo) assert.ok(ids.has(m.winnerGoesTo), `${m.id} -> ${m.winnerGoesTo}`);
        if (m.loserGoesTo) assert.ok(ids.has(m.loserGoesTo), `${m.id} -> ${m.loserGoesTo}`);
      }
    }
  });

  it("no match receives more than two participants", () => {
    for (const n of [4, 8, 16]) {
      const matches = matchesOf(buildDoubleEliminationBracket(names(n)));
      const incoming = new Map<string, number>();
      for (const m of matches) {
        for (const t of [m.winnerGoesTo, m.loserGoesTo]) if (t) incoming.set(t, (incoming.get(t) ?? 0) + 1);
      }
      for (const [code, count] of incoming) assert.ok(count <= 2, `n=${n}: ${code} receives ${count}`);
    }
  });

  it("every match except the grand final feeds the grand final", () => {
    const matches = matchesOf(buildDoubleEliminationBracket(names(8)));
    const routed = matches.map((m) => ({ code: m.id, winnerGoesTo: m.winnerGoesTo, loserGoesTo: m.loserGoesTo }));
    for (const m of matches) {
      if (m.bracket === "GRAND_FINAL") continue;
      assert.ok(collectDescendantCodes(m.id, routed).has("GF1M1") || m.id === "GF1M1", `${m.id} leads to the grand final`);
    }
  });
});
