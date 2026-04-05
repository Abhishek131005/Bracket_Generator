import {
  GeneratedSingleEliminationStage,
  GeneratedDoubleEliminationStage,
  GeneratedSwissStage,
  GeneratedLeaguePlusPlayoffStage,
  GeneratedHeatsPlusFinalStage,
  GeneratedMultiEventPointsStage,
  SingleEliminationBracket,
  DoubleEliminationBracket,
  SportDefinition,
  Tournament,
  TournamentParticipant,
  TournamentStage,
  StageFixture,
  StandingRow,
  PerformanceEntry,
  GeneratedRoundRobinStage,
} from "./types";
import { useAppStore, type AuthUser } from "./store";

type ApiListResponse<T> = { data: T[] };
type ApiItemResponse<T> = { data: T };

// ── Token plumbing ────────────────────────────────────────────────────────────

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = useAppStore.getState().token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    useAppStore.getState().logout();
    throw new Error("Your session has expired. Please log in again.");
  }
  if (!response.ok) {
    let errorMessage = "Request failed.";
    try {
      const errorBody = await response.json();
      if (Array.isArray(errorBody.details) && errorBody.details.length > 0) {
        errorMessage = errorBody.details.join(" ");
      } else if (errorBody.message) {
        errorMessage = errorBody.message;
      }
    } catch {
      const errorText = await response.text();
      errorMessage = errorText || `HTTP ${response.status}`;
    }
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function registerAccount(payload: {
  email: string;
  password: string;
  name: string;
  role?: string;
}): Promise<AuthResponse> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<AuthResponse>(res);
}

export async function loginAccount(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse<AuthResponse>(res);
}

// ── Sports & Tournaments (read — no auth required) ────────────────────────────

export async function fetchSports(): Promise<SportDefinition[]> {
  const res = await fetch("/api/sports");
  const body = await parseResponse<ApiListResponse<SportDefinition>>(res);
  return body.data;
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const res = await fetch("/api/tournaments");
  const body = await parseResponse<ApiListResponse<Tournament>>(res);
  return body.data;
}

export async function fetchTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  const res = await fetch(`/api/tournaments/${tournamentId}/participants`);
  const body = await parseResponse<ApiListResponse<TournamentParticipant>>(res);
  return body.data;
}

export async function fetchTournamentStages(tournamentId: string): Promise<TournamentStage[]> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages`);
  const body = await parseResponse<ApiListResponse<TournamentStage>>(res);
  return body.data;
}

export async function fetchStageFixtures(stageId: string): Promise<StageFixture[]> {
  const res = await fetch(`/api/stages/${stageId}/fixtures`);
  const body = await parseResponse<ApiListResponse<StageFixture>>(res);
  return body.data;
}

export async function fetchStageStandings(stageId: string): Promise<StandingRow[]> {
  const res = await fetch(`/api/stages/${stageId}/standings`);
  const body = await parseResponse<ApiListResponse<StandingRow>>(res);
  return body.data;
}

export async function fetchStagePerformances(stageId: string): Promise<PerformanceEntry[]> {
  const res = await fetch(`/api/stages/${stageId}/performances`);
  const body = await parseResponse<ApiListResponse<PerformanceEntry>>(res);
  return body.data;
}

// ── Mutations (auth required) ─────────────────────────────────────────────────

export async function createTournament(payload: { name: string; sportId: number }): Promise<Tournament> {
  const res = await fetch("/api/tournaments", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseResponse<ApiItemResponse<Tournament>>(res);
  return body.data;
}

export async function addParticipantsToTournament(
  tournamentId: string,
  names: string[]
): Promise<TournamentParticipant[]> {
  const res = await fetch(`/api/tournaments/${tournamentId}/participants`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ names }),
  });
  const body = await parseResponse<ApiListResponse<TournamentParticipant>>(res);
  return body.data;
}

export async function generateSingleEliminationStageForTournament(
  tournamentId: string,
  stageName?: string
): Promise<GeneratedSingleEliminationStage> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/single-elimination`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(stageName ? { stageName } : {}),
  });
  const body = await parseResponse<ApiItemResponse<GeneratedSingleEliminationStage>>(res);
  return body.data;
}

export async function generateRoundRobinStageForTournament(
  tournamentId: string,
  stageName?: string
): Promise<GeneratedRoundRobinStage> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/round-robin`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(stageName ? { stageName } : {}),
  });
  const body = await parseResponse<ApiItemResponse<GeneratedRoundRobinStage>>(res);
  return body.data;
}

export async function generateDoubleEliminationStageForTournament(
  tournamentId: string,
  stageName?: string
): Promise<GeneratedDoubleEliminationStage> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/double-elimination`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(stageName ? { stageName } : {}),
  });
  const body = await parseResponse<ApiItemResponse<GeneratedDoubleEliminationStage>>(res);
  return body.data;
}

export async function generateSwissStageForTournament(
  tournamentId: string,
  stageName?: string,
  totalRounds?: number
): Promise<GeneratedSwissStage> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/swiss`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ...(stageName ? { stageName } : {}), ...(totalRounds ? { totalRounds } : {}) }),
  });
  const body = await parseResponse<ApiItemResponse<GeneratedSwissStage>>(res);
  return body.data;
}

export async function generateLeaguePlusPlayoffStageForTournament(
  tournamentId: string,
  stageName?: string
): Promise<GeneratedLeaguePlusPlayoffStage> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/league-plus-playoff`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(stageName ? { stageName } : {}),
  });
  const body = await parseResponse<ApiItemResponse<GeneratedLeaguePlusPlayoffStage>>(res);
  return body.data;
}

export async function generatePlayoffStage(
  tournamentId: string,
  leagueStageId: string,
  playoffTeamCount: number,
  stageName?: string
): Promise<GeneratedSingleEliminationStage> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/playoff`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ leagueStageId, playoffTeamCount, ...(stageName ? { stageName } : {}) }),
  });
  const body = await parseResponse<ApiItemResponse<GeneratedSingleEliminationStage>>(res);
  return body.data;
}

export async function regenerateSwissRoundPairings(
  stageId: string,
  roundIndex: number
): Promise<StageFixture[]> {
  const res = await fetch(`/api/stages/${stageId}/swiss/pair-round`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ roundIndex }),
  });
  const body = await parseResponse<ApiListResponse<StageFixture>>(res);
  return body.data;
}

export async function generateHeatsPlusFinalStageForTournament(
  tournamentId: string,
  stageName?: string,
  participantsPerHeat?: number
): Promise<GeneratedHeatsPlusFinalStage> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/heats-plus-final`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      ...(stageName ? { stageName } : {}),
      ...(participantsPerHeat ? { participantsPerHeat } : {}),
    }),
  });
  const body = await parseResponse<ApiItemResponse<GeneratedHeatsPlusFinalStage>>(res);
  return body.data;
}

export async function generateMultiEventPointsStageForTournament(
  tournamentId: string,
  stageName?: string,
  eventNames?: string[]
): Promise<GeneratedMultiEventPointsStage> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/multi-event-points`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      ...(stageName ? { stageName } : {}),
      ...(eventNames?.length ? { eventNames } : {}),
    }),
  });
  const body = await parseResponse<ApiItemResponse<GeneratedMultiEventPointsStage>>(res);
  return body.data;
}

export async function generateDirectFinalStageForTournament(
  tournamentId: string,
  stageName?: string
): Promise<{ stage: TournamentStage }> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/direct-final`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(stageName ? { stageName } : {}),
  });
  const body = await parseResponse<{ data: { stage: TournamentStage } }>(res);
  return body.data;
}

export async function generateJudgedLeaderboardStageForTournament(
  tournamentId: string,
  stageName?: string
): Promise<{ stage: TournamentStage }> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/judged-leaderboard`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(stageName ? { stageName } : {}),
  });
  const body = await parseResponse<{ data: { stage: TournamentStage } }>(res);
  return body.data;
}

export async function updateFixtureResult(
  fixtureId: string,
  homeScore: number,
  awayScore: number
): Promise<StageFixture> {
  const res = await fetch(`/api/fixtures/${fixtureId}/result`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ homeScore, awayScore }),
  });
  const body = await parseResponse<ApiItemResponse<StageFixture>>(res);
  return body.data;
}

export async function addPerformanceEntry(
  stageId: string,
  participantId: string,
  metricValue: number,
  unit?: string,
  fixtureId?: string,
  metadata?: string
): Promise<PerformanceEntry> {
  const res = await fetch(`/api/stages/${stageId}/performances`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      participantId,
      metricValue,
      ...(unit ? { unit } : {}),
      ...(fixtureId ? { fixtureId } : {}),
      ...(metadata ? { metadata } : {}),
    }),
  });
  const body = await parseResponse<ApiItemResponse<PerformanceEntry>>(res);
  return body.data;
}

export async function deletePerformanceEntry(entryId: string): Promise<void> {
  const res = await fetch(`/api/performances/${entryId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await parseResponse<{ message: string }>(res);
}

// ── Stateless bracket generators (no auth needed) ────────────────────────────

export async function generateSingleEliminationBracket(
  participants: string[]
): Promise<SingleEliminationBracket> {
  const res = await fetch("/api/brackets/single-elimination", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participants: participants.map((name) => ({ name })) }),
  });
  const body = await parseResponse<ApiItemResponse<SingleEliminationBracket>>(res);
  return body.data;
}

export async function generateDoubleEliminationBracket(
  participants: string[]
): Promise<DoubleEliminationBracket> {
  const res = await fetch("/api/brackets/double-elimination", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participants: participants.map((name) => ({ name })) }),
  });
  const body = await parseResponse<ApiItemResponse<DoubleEliminationBracket>>(res);
  return body.data;
}
