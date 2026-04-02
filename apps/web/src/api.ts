import {
  GeneratedSingleEliminationStage,
  GeneratedDoubleEliminationStage,
  GeneratedSwissStage,
  GeneratedLeaguePlusPlayoffStage,
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

type ApiListResponse<T> = { data: T[] };
type ApiItemResponse<T> = { data: T };

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = "Request failed.";
    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        errorMessage = errorBody.message;
        if (errorBody.issues) {
          errorMessage += " Issues: " + JSON.stringify(errorBody.issues);
        }
      }
    } catch {
      const errorText = await response.text();
      errorMessage = errorText || `HTTP ${response.status}`;
    }
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}

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

export async function createTournament(payload: { name: string; sportId: number }): Promise<Tournament> {
  const res = await fetch("/api/tournaments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse<ApiItemResponse<Tournament>>(res);
  return body.data;
}

export async function fetchTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  const res = await fetch(`/api/tournaments/${tournamentId}/participants`);
  const body = await parseResponse<ApiListResponse<TournamentParticipant>>(res);
  return body.data;
}

export async function addParticipantsToTournament(
  tournamentId: string,
  names: string[]
): Promise<TournamentParticipant[]> {
  const res = await fetch(`/api/tournaments/${tournamentId}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names }),
  });
  const body = await parseResponse<ApiListResponse<TournamentParticipant>>(res);
  return body.data;
}

export async function fetchTournamentStages(tournamentId: string): Promise<TournamentStage[]> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages`);
  const body = await parseResponse<ApiListResponse<TournamentStage>>(res);
  return body.data;
}

export async function generateSingleEliminationStageForTournament(
  tournamentId: string,
  stageName?: string
): Promise<GeneratedSingleEliminationStage> {
  const res = await fetch(`/api/tournaments/${tournamentId}/stages/single-elimination`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roundIndex }),
  });
  const body = await parseResponse<ApiListResponse<StageFixture>>(res);
  return body.data;
}

export async function fetchStageFixtures(stageId: string): Promise<StageFixture[]> {
  const res = await fetch(`/api/stages/${stageId}/fixtures`);
  const body = await parseResponse<ApiListResponse<StageFixture>>(res);
  return body.data;
}

export async function updateFixtureResult(
  fixtureId: string,
  homeScore: number,
  awayScore: number
): Promise<StageFixture> {
  const res = await fetch(`/api/fixtures/${fixtureId}/result`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ homeScore, awayScore }),
  });
  const body = await parseResponse<ApiItemResponse<StageFixture>>(res);
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

export async function addPerformanceEntry(
  stageId: string,
  participantId: string,
  metricValue: number,
  unit?: string
): Promise<PerformanceEntry> {
  const res = await fetch(`/api/stages/${stageId}/performances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId, metricValue, unit }),
  });
  const body = await parseResponse<ApiItemResponse<PerformanceEntry>>(res);
  return body.data;
}

export async function deletePerformanceEntry(entryId: string): Promise<void> {
  const res = await fetch(`/api/performances/${entryId}`, { method: "DELETE" });
  await parseResponse<{ message: string }>(res);
}

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