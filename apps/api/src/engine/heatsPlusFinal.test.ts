import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildHeatsPlusFinalStructure } from "./heatsPlusFinal.js";

// Helper to build a participant list from names (auto-seeds 1..N)
function makeParticipants(names: string[]) {
  return names.map((name, i) => ({ id: `p${i + 1}`, name, seed: i + 1 }));
}

describe("buildHeatsPlusFinalStructure", () => {
  it("throws when fewer than 2 participants", () => {
    assert.throws(
      () => buildHeatsPlusFinalStructure([{ id: "p1", name: "Alice", seed: 1 }]),
      /at least 2/i
    );
  });

  it("throws when participantsPerHeat < 2", () => {
    assert.throws(
      () => buildHeatsPlusFinalStructure(makeParticipants(["A", "B"]), 1),
      /participantsPerHeat/i
    );
  });

  it("returns correct metadata for 8 participants across 2 heats of 4", () => {
    const result = buildHeatsPlusFinalStructure(makeParticipants(
      ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]
    ), 4);

    assert.equal(result.format, "HEATS_PLUS_FINAL");
    assert.equal(result.participantCount, 8);
    assert.equal(result.heatCount, 2);
    assert.equal(result.heats.length, 2);
    assert.equal(result.heats[0].participants.length, 4);
    assert.equal(result.heats[1].participants.length, 4);
  });

  it("serpentine seeding: top seeds spread across heats (8 participants, 2 heats)", () => {
    const result = buildHeatsPlusFinalStructure(makeParticipants(
      ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]
    ), 4);

    // Expected: H1 gets seeds [1,4,5,8], H2 gets seeds [2,3,6,7]
    const h1Seeds = result.heats[0].participants.map((p) => p.seed).sort((a, b) => a! - b!);
    const h2Seeds = result.heats[1].participants.map((p) => p.seed).sort((a, b) => a! - b!);

    assert.deepEqual(h1Seeds, [1, 4, 5, 8]);
    assert.deepEqual(h2Seeds, [2, 3, 6, 7]);
  });

  it("all participants are assigned exactly once (no duplicates, no missing)", () => {
    const participants = makeParticipants(
      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
    );
    const result = buildHeatsPlusFinalStructure(participants, 4);

    const allIds = result.heats.flatMap((h) => h.participants.map((p) => p.participantId));
    const uniqueIds = new Set(allIds);

    assert.equal(allIds.length, 10);
    assert.equal(uniqueIds.size, 10);
  });

  it("lane numbers start at 1 and are consecutive within each heat", () => {
    const result = buildHeatsPlusFinalStructure(makeParticipants(
      ["A", "B", "C", "D", "E", "F"]
    ), 3);

    for (const heat of result.heats) {
      const lanes = heat.participants.map((p) => p.lane).sort((a, b) => a - b);
      const expected = Array.from({ length: heat.participants.length }, (_, i) => i + 1);
      assert.deepEqual(lanes, expected);
    }
  });

  it("single heat when all participants fit (participantsPerHeat >= count)", () => {
    const result = buildHeatsPlusFinalStructure(makeParticipants(["A", "B", "C"]), 10);

    assert.equal(result.heatCount, 1);
    assert.equal(result.heats[0].title, "Final");
    assert.equal(result.heats[0].participants.length, 3);
  });

  it("handles odd participant counts — no participant is lost", () => {
    const result = buildHeatsPlusFinalStructure(makeParticipants(
      ["A", "B", "C", "D", "E"]
    ), 3);

    const total = result.heats.reduce((sum, h) => sum + h.participants.length, 0);
    assert.equal(total, 5);
  });

  it("unseeded participants go last in heat assignment", () => {
    const mixed = [
      { id: "p1", name: "Seeded1", seed: 1 },
      { id: "p2", name: "Seeded2", seed: 2 },
      { id: "p3", name: "Unseeded", seed: undefined },
    ];
    const result = buildHeatsPlusFinalStructure(mixed, 2);

    // All 3 participants should be assigned
    const allIds = result.heats.flatMap((h) => h.participants.map((p) => p.participantId));
    assert.ok(allIds.includes("p3"), "unseeded participant must be assigned");
  });

  it("heat titles are 'Heat N' for multiple heats", () => {
    const result = buildHeatsPlusFinalStructure(makeParticipants(
      ["A", "B", "C", "D"]
    ), 2);

    assert.equal(result.heats[0].title, "Heat 1");
    assert.equal(result.heats[1].title, "Heat 2");
  });
});
