import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  GeneratedSingleEliminationStage,
  GeneratedDoubleEliminationStage,
  GeneratedRoundRobinStage,
  GeneratedSwissStage,
  GeneratedLeaguePlusPlayoffStage,
  GeneratedHeatsPlusFinalStage,
  GeneratedMultiEventPointsStage,
  TournamentStage,
} from "../types";
import {
  createTournament,
  addParticipantsToTournament,
  generateSingleEliminationStageForTournament,
  generateRoundRobinStageForTournament,
  generateDoubleEliminationStageForTournament,
  generateSwissStageForTournament,
  generateLeaguePlusPlayoffStageForTournament,
  generateHeatsPlusFinalStageForTournament,
  generateMultiEventPointsStageForTournament,
  generateDirectFinalStageForTournament,
  generateJudgedLeaderboardStageForTournament,
  generatePlayoffStage,
  updateFixtureResult,
  regenerateSwissRoundPairings,
  addPerformanceEntry,
  deletePerformanceEntry,
  setStageStatus,
  deleteTournament,
  deleteStage,
  deleteParticipant,
} from "../api";

type AnyGeneratedStage =
  | GeneratedSingleEliminationStage
  | GeneratedDoubleEliminationStage
  | GeneratedRoundRobinStage
  | GeneratedSwissStage
  | GeneratedLeaguePlusPlayoffStage
  | GeneratedHeatsPlusFinalStage
  | GeneratedMultiEventPointsStage
  | { stage: TournamentStage };
import { queryKeys } from "./useQueries";

// ── Create Tournament ─────────────────────────────────────────────────────────

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; sportId: number }) => createTournament(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.tournaments }); },
  });
}

// ── Add Participants ──────────────────────────────────────────────────────────

export function useAddParticipants(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => addParticipantsToTournament(tournamentId, names),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.participants(tournamentId) }); },
  });
}

// ── Generate Stage (all formats) ──────────────────────────────────────────────

type GenerateStagePayload =
  | { format: "single-elimination"; stageName?: string }
  | { format: "round-robin"; stageName?: string }
  | { format: "double-elimination"; stageName?: string }
  | { format: "swiss"; stageName?: string; totalRounds?: number }
  | { format: "league-plus-playoff"; stageName?: string }
  | { format: "heats-plus-final"; stageName?: string; participantsPerHeat?: number }
  | { format: "multi-event-points"; stageName?: string; eventNames?: string[] }
  | { format: "direct-final"; stageName?: string }
  | { format: "judged-leaderboard"; stageName?: string };

export function useGenerateStage(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation<AnyGeneratedStage, Error, GenerateStagePayload>({
    mutationFn: (payload: GenerateStagePayload): Promise<AnyGeneratedStage> => {
      const { format, stageName } = payload;
      if (format === "single-elimination")
        return generateSingleEliminationStageForTournament(tournamentId, stageName);
      if (format === "round-robin")
        return generateRoundRobinStageForTournament(tournamentId, stageName);
      if (format === "double-elimination")
        return generateDoubleEliminationStageForTournament(tournamentId, stageName);
      if (format === "swiss")
        return generateSwissStageForTournament(tournamentId, stageName, (payload as any).totalRounds);
      if (format === "league-plus-playoff")
        return generateLeaguePlusPlayoffStageForTournament(tournamentId, stageName);
      if (format === "heats-plus-final")
        return generateHeatsPlusFinalStageForTournament(tournamentId, stageName, (payload as any).participantsPerHeat);
      if (format === "multi-event-points")
        return generateMultiEventPointsStageForTournament(tournamentId, stageName, (payload as any).eventNames);
      if (format === "direct-final")
        return generateDirectFinalStageForTournament(tournamentId, stageName);
      if (format === "judged-leaderboard")
        return generateJudgedLeaderboardStageForTournament(tournamentId, stageName);
      throw new Error(`Unknown format: ${format}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.stages(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.tournaments });   // tournament status may change
    },
  });
}

// ── Generate Playoff Stage ────────────────────────────────────────────────────

export function useGeneratePlayoff(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      leagueStageId,
      playoffTeamCount,
      stageName,
    }: {
      leagueStageId: string;
      playoffTeamCount: number;
      stageName?: string;
    }) => generatePlayoffStage(tournamentId, leagueStageId, playoffTeamCount, stageName),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.stages(tournamentId) }); },
  });
}

// ── Update Fixture Result ─────────────────────────────────────────────────────

export function useUpdateFixture(stageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      fixtureId,
      homeScore,
      awayScore,
      confirmReset,
    }: {
      fixtureId: string;
      homeScore: number;
      awayScore: number;
      confirmReset?: boolean;
    }) => updateFixtureResult(fixtureId, homeScore, awayScore, confirmReset),
    onSuccess: () => {
      // Invalidate fixtures AND standings (scores affect both)
      qc.invalidateQueries({ queryKey: queryKeys.fixtures(stageId) });
      qc.invalidateQueries({ queryKey: queryKeys.standings(stageId) });
      // A result can move the stage (and tournament) to IN_PROGRESS / COMPLETED.
      qc.invalidateQueries({ queryKey: ["stages"] });
      qc.invalidateQueries({ queryKey: queryKeys.tournaments });
    },
  });
}

// ── Regenerate Swiss Pairings ─────────────────────────────────────────────────

export function useRegenerateSwissPairings(stageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roundIndex: number) => regenerateSwissRoundPairings(stageId, roundIndex),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.fixtures(stageId) }); },
  });
}

// ── Performance Entries ───────────────────────────────────────────────────────

export function useAddPerformance(stageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      participantId,
      metricValue,
      unit,
      fixtureId,
      metadata,
    }: {
      participantId: string;
      metricValue: number;
      unit?: string;
      fixtureId?: string;
      metadata?: string;
    }) => addPerformanceEntry(stageId, participantId, metricValue, unit, fixtureId, metadata),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.performances(stageId) });
      qc.invalidateQueries({ queryKey: ["stages"] });
      qc.invalidateQueries({ queryKey: queryKeys.tournaments });
    },
  });
}

export function useDeletePerformance(stageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => deletePerformanceEntry(entryId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.performances(stageId) }); },
  });
}

// ── Stage status (organiser closes / reopens a leaderboard stage) ─────────────

export function useSetStageStatus(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, status }: { stageId: string; status: "IN_PROGRESS" | "COMPLETED" }) =>
      setStageStatus(stageId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.stages(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.tournaments });
    },
  });
}

// ── Deleting ──────────────────────────────────────────────────────────────────

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tournamentId: string) => deleteTournament(tournamentId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.tournaments }); },
  });
}

export function useDeleteStage(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stageId: string) => deleteStage(stageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.stages(tournamentId) });
      qc.invalidateQueries({ queryKey: queryKeys.tournaments });   // status may fall back to DRAFT
    },
  });
}

export function useDeleteParticipant(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) => deleteParticipant(participantId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.participants(tournamentId) }); },
  });
}
