import { useQuery } from "@tanstack/react-query";
import {
  fetchSports,
  fetchTournaments,
  fetchTournamentParticipants,
  fetchTournamentStages,
  fetchStageFixtures,
  fetchStageStandings,
  fetchStagePerformances,
} from "../api";

// ── Query keys ───────────────────────────────────────────────────────────────
// Centralised here so mutations can reference them precisely for invalidation.

export const queryKeys = {
  sports: ["sports"] as const,
  tournaments: ["tournaments"] as const,
  participants: (tournamentId: string) => ["participants", tournamentId] as const,
  stages: (tournamentId: string) => ["stages", tournamentId] as const,
  fixtures: (stageId: string) => ["fixtures", stageId] as const,
  standings: (stageId: string) => ["standings", stageId] as const,
  performances: (stageId: string) => ["performances", stageId] as const,
};

// ── Sports ───────────────────────────────────────────────────────────────────

export function useSports() {
  return useQuery({
    queryKey: queryKeys.sports,
    queryFn: fetchSports,
    staleTime: Infinity, // sports catalog never changes at runtime
  });
}

// ── Tournaments ───────────────────────────────────────────────────────────────

export function useTournaments() {
  return useQuery({
    queryKey: queryKeys.tournaments,
    queryFn: fetchTournaments,
  });
}

// ── Participants ──────────────────────────────────────────────────────────────

export function useParticipants(tournamentId: string) {
  return useQuery({
    queryKey: queryKeys.participants(tournamentId),
    queryFn: () => fetchTournamentParticipants(tournamentId),
    enabled: !!tournamentId,
  });
}

// ── Stages ────────────────────────────────────────────────────────────────────

export function useStages(tournamentId: string) {
  return useQuery({
    queryKey: queryKeys.stages(tournamentId),
    queryFn: () => fetchTournamentStages(tournamentId),
    enabled: !!tournamentId,
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

export function useFixtures(stageId: string) {
  return useQuery({
    queryKey: queryKeys.fixtures(stageId),
    queryFn: () => fetchStageFixtures(stageId),
    enabled: !!stageId,
    staleTime: 10_000, // fixtures change frequently during live scoring
  });
}

// ── Standings ─────────────────────────────────────────────────────────────────

export function useStandings(stageId: string) {
  return useQuery({
    queryKey: queryKeys.standings(stageId),
    queryFn: () => fetchStageStandings(stageId),
    enabled: !!stageId,
    staleTime: 10_000,
  });
}

// ── Performances ──────────────────────────────────────────────────────────────

export function usePerformances(stageId: string) {
  return useQuery({
    queryKey: queryKeys.performances(stageId),
    queryFn: () => fetchStagePerformances(stageId),
    enabled: !!stageId,
    staleTime: 10_000,
  });
}
