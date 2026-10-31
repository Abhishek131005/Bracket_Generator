/**
 * Bracket progression helpers (pure) — used when a result is saved or corrected.
 */

/** Which side won, or null for an unplayed fixture / a draw. */
export function winnerSide(leftScore: number | null | undefined, rightScore: number | null | undefined): "left" | "right" | null {
  if (leftScore == null || rightScore == null) return null;
  if (leftScore === rightScore) return null;
  return leftScore > rightScore ? "left" : "right";
}

/**
 * Single elimination: where does the winner of (roundIndex, matchIndex) go?
 * Match m of round r feeds match ceil(m/2) of round r+1; odd matches fill the left slot, even the right.
 */
export function singleEliminationNext(roundIndex: number, matchIndex: number): { roundIndex: number; matchIndex: number; slot: "left" | "right" } {
  return {
    roundIndex: roundIndex + 1,
    matchIndex: Math.ceil(matchIndex / 2),
    slot: matchIndex % 2 === 1 ? "left" : "right",
  };
}

export interface RoutedFixture {
  code?: string | null;
  winnerGoesTo?: string | null;
  loserGoesTo?: string | null;
}

/**
 * Double elimination: every fixture that can receive a participant (directly or indirectly)
 * from `startCode`, following winnerGoesTo / loserGoesTo. The optional grand-final reset match
 * (GF1M2) is not routed explicitly, so it is included whenever GF1M1 is affected.
 */
export function collectDescendantCodes(startCode: string, fixtures: RoutedFixture[]): Set<string> {
  const byCode = new Map<string, RoutedFixture>();
  for (const f of fixtures) if (f.code) byCode.set(f.code, f);

  const seen = new Set<string>();
  const stack = [startCode];
  while (stack.length > 0) {
    const code = stack.pop()!;
    const fixture = byCode.get(code);
    if (!fixture) continue;
    for (const target of [fixture.winnerGoesTo, fixture.loserGoesTo]) {
      if (target && !seen.has(target)) {
        seen.add(target);
        stack.push(target);
      }
    }
  }

  if ((seen.has("GF1M1") || startCode === "GF1M1") && byCode.has("GF1M2")) seen.add("GF1M2");
  return seen;
}

/** Raised when a correction would invalidate matches that were already played. */
export class DownstreamPlayedError extends Error {
  readonly code = "DOWNSTREAM_PLAYED";
  constructor(public readonly affected: number) {
    super(
      `Changing the winner of this match will reset ${affected} later match${affected === 1 ? "" : "es"} that ${
        affected === 1 ? "has" : "have"
      } already been played.`
    );
  }
}
