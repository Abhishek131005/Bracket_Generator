// MULTI_EVENT_POINTS engine
// Defines and validates the structure for multi-event competitions
// (e.g., Athletics decathlon, CrossFit multi-workout) where participants
// accumulate points across multiple independent events.
//
// Each event maps 1-to-1 with a Fixture row in the DB (code = "event-N",
// leftLabel = event name). The repository enriches the structure with Fixture
// IDs after creation so that PerformanceEntry.fixtureId can group scores by event.

export const DEFAULT_EVENT_NAMES = ["Event 1", "Event 2", "Event 3"];

export interface MultiEventDef {
  index: number;
  name: string;
}

// Shape stored in stage.config (repository adds `id` to each event after DB insert)
export interface MultiEventPointsStructure {
  format: "MULTI_EVENT_POINTS";
  participantCount: number;
  eventCount: number;
  events: (MultiEventDef & { id: string })[];
}

/**
 * Validate and normalise event names.
 *
 * Returns a plain config without fixture IDs. The repository calls this, then
 * creates the Fixture rows and enriches each entry with the resulting `id`.
 */
export function buildMultiEventConfig(
  participantCount: number,
  eventNames: string[] = DEFAULT_EVENT_NAMES
): { participantCount: number; events: MultiEventDef[] } {
  if (participantCount < 2) {
    throw new Error("At least 2 participants are required.");
  }
  const trimmed = eventNames.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    throw new Error("At least one event name is required.");
  }
  const unique = [...new Set(trimmed)];
  return {
    participantCount,
    events: unique.map((name, index) => ({ index, name })),
  };
}
