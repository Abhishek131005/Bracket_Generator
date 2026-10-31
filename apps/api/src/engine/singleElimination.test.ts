import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSingleEliminationBracket, standardSeedOrder } from "./singleElimination.js";

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}` }));

/** Seeds that can reach match `matchIndex` of `roundIndex` (following the feeder rule ceil(m/2)). */
function seedsInside(bracket: ReturnType<typeof buildSingleEliminationBracket>, roundIndex: number, matchIndex: number): number[] {
  const seeds: number[] = [];
  const r1 = bracket.rounds[0].matches;
  const span = 2 ** (roundIndex - 1);
  for (let m = (matchIndex - 1) * span; m < matchIndex * span; m++) {
    const match = r1[m];
    if (match.left.seed) seeds.push(match.left.seed);
    if (match.right.seed) seeds.push(match.right.seed);
  }
  return seeds;
}

describe("standardSeedOrder", () => {
  it("returns the classic orders", () => {
    assert.deepEqual(standardSeedOrder(2), [1, 2]);
    assert.deepEqual(standardSeedOrder(4), [1, 4, 2, 3]);
    assert.deepEqual(standardSeedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("is a permutation of 1..slots", () => {
    for (const slots of [2, 4, 8, 16, 32, 64, 128]) {
      const sorted = [...standardSeedOrder(slots)].sort((a, b) => a - b);
      assert.deepEqual(sorted, Array.from({ length: slots }, (_, i) => i + 1));
    }
  });

  it("pairs every first-round match so the seeds add up to slots + 1", () => {
    const order = standardSeedOrder(16);
    for (let i = 0; i < order.length; i += 2) assert.equal(order[i] + order[i + 1], 17);
  });
});

describe("buildSingleEliminationBracket — structure", () => {
  it("rejects fewer than 2 participants", () => {
    assert.throws(() => buildSingleEliminationBracket(names(1)));
  });

  it("builds a 2-player bracket with a single final", () => {
    const b = buildSingleEliminationBracket(names(2));
    assert.equal(b.rounds.length, 1);
    assert.equal(b.rounds[0].title, "Final");
    assert.equal(b.byeCount, 0);
  });

  it("builds log2(slots) rounds with halving match counts", () => {
    const b = buildSingleEliminationBracket(names(8));
    assert.deepEqual(b.rounds.map((r) => r.matches.length), [4, 2, 1]);
    assert.deepEqual(b.rounds.map((r) => r.title), ["Quarter Final", "Semi Final", "Final"]);
  });

  it("places every participant exactly once in round 1", () => {
    for (const n of [3, 5, 6, 7, 8, 11, 16, 23]) {
      const b = buildSingleEliminationBracket(names(n));
      const placed = b.rounds[0].matches.flatMap((m) => [m.left.participantName, m.right.participantName]).filter(Boolean);
      assert.equal(placed.length, n, `n=${n}`);
      assert.equal(new Set(placed).size, n, `n=${n}`);
    }
  });

  it("reports the right number of byes", () => {
    assert.equal(buildSingleEliminationBracket(names(5)).byeCount, 3);
    assert.equal(buildSingleEliminationBracket(names(8)).byeCount, 0);
    assert.equal(buildSingleEliminationBracket(names(9)).byeCount, 7);
  });
});

describe("buildSingleEliminationBracket — seeding", () => {
  it("round 1 of an 8-player bracket is 1v8, 4v5, 2v7, 3v6", () => {
    const b = buildSingleEliminationBracket(names(8));
    const pairs = b.rounds[0].matches.map((m) => [m.left.seed, m.right.seed]);
    assert.deepEqual(pairs, [[1, 8], [4, 5], [2, 7], [3, 6]]);
  });

  it("keeps seeds 1 and 2 apart until the final", () => {
    for (const n of [4, 8, 16, 32]) {
      const b = buildSingleEliminationBracket(names(n));
      const semis = b.rounds[b.rounds.length - 2];
      assert.ok(seedsInside(b, semis.roundIndex, 1).includes(1), `n=${n}`);
      assert.ok(!seedsInside(b, semis.roundIndex, 1).includes(2), `n=${n}`);
      assert.ok(seedsInside(b, semis.roundIndex, 2).includes(2), `n=${n}`);
    }
  });

  it("gives the byes to the top seeds", () => {
    const b = buildSingleEliminationBracket(names(5));
    const byeWinners = b.rounds[0].matches.filter((m) => m.status === "AUTO_ADVANCE").map((m) => m.autoAdvanceWinner);
    assert.deepEqual([...byeWinners].sort(), ["P1", "P2", "P3"]);
  });
});

describe("buildSingleEliminationBracket — byes advance into round 2", () => {
  it("3 players: seed 1 waits in the final, seeds 2 v 3 play", () => {
    const b = buildSingleEliminationBracket(names(3));
    const [r1, final] = b.rounds;
    assert.equal(r1.matches[0].status, "AUTO_ADVANCE");
    assert.equal(r1.matches[1].status, "SCHEDULED");
    assert.equal(final.matches[0].left.participantName, "P1");
    assert.equal(final.matches[0].right.participantName, "Winner of previous match");
    assert.equal(final.matches[0].status, "PENDING");
  });

  it("5 players: round 2 match 2 is already fully populated by two bye winners", () => {
    const b = buildSingleEliminationBracket(names(5));
    const r2 = b.rounds[1].matches;
    // match 1: bye winner P1 (left) waiting for winner of 4v5
    assert.equal(r2[0].left.participantName, "P1");
    assert.equal(r2[0].status, "PENDING");
    // match 2: P2 (left) and P3 (right) both advanced by byes
    assert.equal(r2[1].left.participantName, "P2");
    assert.equal(r2[1].right.participantName, "P3");
    assert.equal(r2[1].status, "SCHEDULED");
  });

  it("every bye winner appears in round 2 on the slot implied by its match index", () => {
    for (const n of [3, 5, 6, 7, 9, 12, 13]) {
      const b = buildSingleEliminationBracket(names(n));
      for (const m of b.rounds[0].matches.filter((x) => x.status === "AUTO_ADVANCE")) {
        const target = b.rounds[1].matches[Math.ceil(m.matchIndex / 2) - 1];
        const side = m.matchIndex % 2 === 1 ? target.left : target.right;
        assert.equal(side.participantName, m.autoAdvanceWinner, `n=${n} match ${m.matchIndex}`);
      }
    }
  });

  it("power-of-two brackets leave round 2 entirely pending", () => {
    const b = buildSingleEliminationBracket(names(8));
    for (const m of b.rounds[1].matches) {
      assert.equal(m.status, "PENDING");
      assert.equal(m.left.participantName, "Winner of previous match");
    }
  });
});
