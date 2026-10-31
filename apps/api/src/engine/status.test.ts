import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveStageStatus, deriveTournamentStatus } from "./status.js";

const fx = (status: string, extra: Record<string, unknown> = {}) => ({ status, ...extra });

describe("deriveStageStatus — fixture-based formats", () => {
  const base = { format: "SINGLE_ELIMINATION", current: "DRAFT" as const, performanceCount: 0 };

  it("stays DRAFT until a match is played", () => {
    assert.equal(deriveStageStatus({ ...base, fixtures: [fx("SCHEDULED"), fx("PENDING")] }), "DRAFT");
  });

  it("becomes IN_PROGRESS after the first result", () => {
    assert.equal(deriveStageStatus({ ...base, fixtures: [fx("COMPLETED"), fx("SCHEDULED")] }), "IN_PROGRESS");
  });

  it("becomes COMPLETED when every match is completed or a bye", () => {
    assert.equal(deriveStageStatus({ ...base, fixtures: [fx("COMPLETED"), fx("AUTO_ADVANCE"), fx("COMPLETED")] }), "COMPLETED");
  });

  it("falls back to IN_PROGRESS when a completed stage gains an unplayed match (e.g. a Swiss round)", () => {
    assert.equal(
      deriveStageStatus({ format: "SWISS", current: "COMPLETED", performanceCount: 0, fixtures: [fx("COMPLETED"), fx("SCHEDULED")] }),
      "IN_PROGRESS"
    );
  });

  it("ignores the dormant grand-final reset when the first grand final is decided", () => {
    const fixtures = [
      fx("COMPLETED", { code: "WR1M1" }),
      fx("COMPLETED", { code: "GF1M1" }),
      fx("PENDING", { code: "GF1M2", leftParticipantId: null, rightParticipantId: null }),
    ];
    assert.equal(deriveStageStatus({ ...base, format: "DOUBLE_ELIMINATION", fixtures }), "COMPLETED");
  });

  it("waits for the reset match once it has been activated", () => {
    const fixtures = [
      fx("COMPLETED", { code: "GF1M1" }),
      fx("SCHEDULED", { code: "GF1M2", leftParticipantId: "a", rightParticipantId: "b" }),
    ];
    assert.equal(deriveStageStatus({ ...base, format: "DOUBLE_ELIMINATION", fixtures }), "IN_PROGRESS");
  });

  it("does not complete before the grand final is played", () => {
    const fixtures = [
      fx("COMPLETED", { code: "WR1M1" }),
      fx("PENDING", { code: "GF1M1" }),
      fx("PENDING", { code: "GF1M2" }),
    ];
    assert.equal(deriveStageStatus({ ...base, format: "DOUBLE_ELIMINATION", fixtures }), "IN_PROGRESS");
  });
});

describe("deriveStageStatus — leaderboard formats", () => {
  const base = { format: "HEATS_PLUS_FINAL", fixtures: [] as { status: string }[] };

  it("starts when the first entry is recorded", () => {
    assert.equal(deriveStageStatus({ ...base, current: "DRAFT", performanceCount: 1 }), "IN_PROGRESS");
  });

  it("stays DRAFT with no entries", () => {
    assert.equal(deriveStageStatus({ ...base, current: "DRAFT", performanceCount: 0 }), "DRAFT");
  });

  it("never completes on its own and keeps a manual COMPLETED", () => {
    assert.equal(deriveStageStatus({ ...base, current: "IN_PROGRESS", performanceCount: 9 }), "IN_PROGRESS");
    assert.equal(deriveStageStatus({ ...base, current: "COMPLETED", performanceCount: 9 }), "COMPLETED");
  });
});

describe("deriveTournamentStatus", () => {
  const stage = (status: string, format = "SINGLE_ELIMINATION", sequence = 1) => ({ status, format, sequence });

  it("is DRAFT with no stages", () => {
    assert.equal(deriveTournamentStatus({ current: "DRAFT", stages: [] }), "DRAFT");
  });

  it("is IN_PROGRESS once any stage has started", () => {
    assert.equal(deriveTournamentStatus({ current: "DRAFT", stages: [stage("IN_PROGRESS")] }), "IN_PROGRESS");
  });

  it("is COMPLETED when every stage is complete", () => {
    assert.equal(deriveTournamentStatus({ current: "IN_PROGRESS", stages: [stage("COMPLETED")] }), "COMPLETED");
  });

  it("is not COMPLETED while only the league stage of a league + playoff exists", () => {
    assert.equal(
      deriveTournamentStatus({ current: "IN_PROGRESS", stages: [stage("COMPLETED", "LEAGUE_PLUS_PLAYOFF", 1)] }),
      "IN_PROGRESS"
    );
  });

  it("is COMPLETED once the playoff stage after the league is also complete", () => {
    assert.equal(
      deriveTournamentStatus({
        current: "IN_PROGRESS",
        stages: [stage("COMPLETED", "LEAGUE_PLUS_PLAYOFF", 1), stage("COMPLETED", "SINGLE_ELIMINATION", 2)],
      }),
      "COMPLETED"
    );
  });

  it("drops back to IN_PROGRESS when a new unfinished stage is added", () => {
    assert.equal(deriveTournamentStatus({ current: "COMPLETED", stages: [stage("COMPLETED"), stage("DRAFT", "SWISS", 2)] }), "IN_PROGRESS");
  });

  it("never changes a cancelled tournament", () => {
    assert.equal(deriveTournamentStatus({ current: "CANCELLED", stages: [stage("COMPLETED")] }), "CANCELLED");
  });
});
