import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMultiEventConfig,
  DEFAULT_EVENT_NAMES,
} from "./multiEventPoints.js";

describe("buildMultiEventConfig", () => {
  it("throws when participantCount < 2", () => {
    assert.throws(
      () => buildMultiEventConfig(1, ["100m"]),
      /at least 2 participants/i
    );
  });

  it("throws when no valid event names supplied", () => {
    assert.throws(
      () => buildMultiEventConfig(4, ["", "  "]),
      /at least one event name/i
    );
  });

  it("throws when eventNames array is empty", () => {
    assert.throws(
      () => buildMultiEventConfig(4, []),
      /at least one event name/i
    );
  });

  it("uses DEFAULT_EVENT_NAMES when no events argument passed", () => {
    const config = buildMultiEventConfig(8);
    assert.equal(config.events.length, DEFAULT_EVENT_NAMES.length);
    assert.deepEqual(
      config.events.map((e) => e.name),
      DEFAULT_EVENT_NAMES
    );
  });

  it("returns correct participantCount", () => {
    const config = buildMultiEventConfig(12, ["Sprint", "Jump"]);
    assert.equal(config.participantCount, 12);
  });

  it("trims and filters whitespace-only names", () => {
    const config = buildMultiEventConfig(4, ["  100m  ", "", "  ", "Long Jump"]);
    assert.equal(config.events.length, 2);
    assert.equal(config.events[0].name, "100m");
    assert.equal(config.events[1].name, "Long Jump");
  });

  it("deduplicates event names", () => {
    const config = buildMultiEventConfig(4, ["Sprint", "Sprint", "Jump"]);
    assert.equal(config.events.length, 2);
  });

  it("assigns sequential zero-based indexes", () => {
    const config = buildMultiEventConfig(4, ["A", "B", "C"]);
    assert.deepEqual(
      config.events.map((e) => e.index),
      [0, 1, 2]
    );
  });

  it("works with a single event", () => {
    const config = buildMultiEventConfig(2, ["Final"]);
    assert.equal(config.events.length, 1);
    assert.equal(config.events[0].name, "Final");
    assert.equal(config.events[0].index, 0);
  });

  it("handles large participant count and many events", () => {
    const events = Array.from({ length: 10 }, (_, i) => `Event ${i + 1}`);
    const config = buildMultiEventConfig(64, events);
    assert.equal(config.participantCount, 64);
    assert.equal(config.events.length, 10);
  });
});
