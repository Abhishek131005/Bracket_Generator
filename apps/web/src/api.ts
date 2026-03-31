import {
  GeneratedSingleEliminationStage,
  SingleEliminationBracket,
  SportDefinition,
  Tournament,
  TournamentParticipant,
  TournamentStage
} from "./types";

type ApiListResponse<T> = {
  data: T[];
};

type ApiItemResponse<T> = {
  data: T;
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed.");
  }

  return response.json() as Promise<T>;
}

export async function fetchSports(): Promise<SportDefinition[]> {
  const response = await fetch("/api/sports");
  const body = await parseResponse<ApiListResponse<SportDefinition>>(response);
  return body.data;
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const response = await fetch("/api/tournaments");
  const body = await parseResponse<ApiListResponse<Tournament>>(response);
  return body.data;
}

export async function createTournament(payload: { name: string; sportId: number }): Promise<Tournament> {
  const response = await fetch("/api/tournaments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await parseResponse<ApiItemResponse<Tournament>>(response);
  return body.data;
}

export async function fetchTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  const response = await fetch(`/api/tournaments/${tournamentId}/participants`);
  const body = await parseResponse<ApiListResponse<TournamentParticipant>>(response);
  return body.data;
}

export async function addParticipantsToTournament(tournamentId: string, names: string[]): Promise<TournamentParticipant[]> {
  const response = await fetch(`/api/tournaments/${tournamentId}/participants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ names })
  });

  const body = await parseResponse<ApiListResponse<TournamentParticipant>>(response);
  return body.data;
}

export async function fetchTournamentStages(tournamentId: string): Promise<TournamentStage[]> {
  const response = await fetch(`/api/tournaments/${tournamentId}/stages`);
  const body = await parseResponse<ApiListResponse<TournamentStage>>(response);
  return body.data;
}

export async function generateSingleEliminationStageForTournament(
  tournamentId: string,
  stageName?: string
): Promise<GeneratedSingleEliminationStage> {
  const response = await fetch(`/api/tournaments/${tournamentId}/stages/single-elimination`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(stageName ? { stageName } : {})
  });

  const body = await parseResponse<ApiItemResponse<GeneratedSingleEliminationStage>>(response);
  return body.data;
}

export async function generateSingleEliminationBracket(participants: string[]): Promise<SingleEliminationBracket> {
  const response = await fetch("/api/brackets/single-elimination", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      participants: participants.map((name) => ({ name }))
    })
  });

  const body = await parseResponse<ApiItemResponse<SingleEliminationBracket>>(response);
  return body.data;
}

