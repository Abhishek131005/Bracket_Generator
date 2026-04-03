// HEATS_PLUS_FINAL engine
// Distributes participants into heats using serpentine seeding (standard in
// swimming and athletics) so that the fastest seeds are spread evenly across heats.

export interface HeatParticipant {
  participantId: string;
  participantName: string;
  seed?: number;
  lane: number;
}

export interface Heat {
  heatNumber: number;
  title: string;
  participants: HeatParticipant[];
}

export interface HeatsPlusFinalStructure {
  format: "HEATS_PLUS_FINAL";
  participantCount: number;
  participantsPerHeat: number;
  heatCount: number;
  heats: Heat[];
}

/**
 * Distribute participants into heats using serpentine seeding.
 *
 * Serpentine example — 8 participants, 2 heats of 4:
 *   Forward:   seed 1 → H1, seed 2 → H2
 *   Backward:  seed 3 → H2, seed 4 → H1
 *   Forward:   seed 5 → H1, seed 6 → H2
 *   Backward:  seed 7 → H2, seed 8 → H1
 *   Result:  H1 = [1,4,5,8]  H2 = [2,3,6,7]
 *
 * Within each heat, lane numbers are assigned 1..N in the order participants
 * appear (officials draw specific lanes in real events; we provide the list).
 */
export function buildHeatsPlusFinalStructure(
  participants: { id: string; name: string; seed?: number }[],
  participantsPerHeat = 8
): HeatsPlusFinalStructure {
  if (participants.length < 2) {
    throw new Error("At least 2 participants are required.");
  }
  if (participantsPerHeat < 2) {
    throw new Error("participantsPerHeat must be at least 2.");
  }

  // If everyone fits in one heat, cap per-heat count
  const perHeat = Math.min(participantsPerHeat, participants.length);

  // Sort by seed ascending; unseeded participants go last
  const sorted = [...participants].sort((a, b) => {
    if (a.seed == null && b.seed == null) return 0;
    if (a.seed == null) return 1;
    if (b.seed == null) return -1;
    return a.seed - b.seed;
  });

  const heatCount = Math.ceil(sorted.length / perHeat);
  const buckets: (typeof sorted)[] = Array.from({ length: heatCount }, () => []);

  // Serpentine distribution
  let heatIdx = 0;
  let direction = 1;

  for (const participant of sorted) {
    buckets[heatIdx].push(participant);
    const next = heatIdx + direction;
    if (next >= heatCount) {
      direction = -1;
      heatIdx = heatCount - 1;
    } else if (next < 0) {
      direction = 1;
      heatIdx = 0;
    } else {
      heatIdx = next;
    }
  }

  const heats: Heat[] = buckets.map((bucket, i) => ({
    heatNumber: i + 1,
    title: heatCount === 1 ? "Final" : `Heat ${i + 1}`,
    participants: bucket.map((p, laneIdx) => ({
      participantId: p.id,
      participantName: p.name,
      seed: p.seed,
      lane: laneIdx + 1,
    })),
  }));

  return {
    format: "HEATS_PLUS_FINAL",
    participantCount: participants.length,
    participantsPerHeat: perHeat,
    heatCount,
    heats,
  };
}
