import cors from "cors";
import express, { type Response } from "express";
import { z } from "zod";
import { sportsCatalog } from "./data/sports.js";
import { buildSingleEliminationBracket } from "./engine/singleElimination.js";
import { buildRoundRobinFixtures } from "./engine/roundRobin.js";
import { buildDoubleEliminationBracket } from "./engine/doubleElimination.js";
import { buildSwissFixtures } from "./engine/swiss.js";
import { calculateStandings, calculateLeaderboard } from "./engine/standings.js";
import {
  addParticipants,
  createTournament,
  generateSingleEliminationStage,
  generateRoundRobinStage,
  generateDoubleEliminationStage,
  generateSwissStage,
  generateLeaguePlusPlayoffStage,
  generatePlayoffStage,
  regenerateSwissRoundPairings,
  getTournamentById,
  listParticipants,
  listStages,
  listTournaments,
  listFixturesByStage,
  updateFixtureResult,
  getStandingsByStage,
  addPerformanceEntry,
  listPerformanceEntries,
  deletePerformanceEntry,
} from "./repositories/tournaments.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

function formatIssuePath(path: (string | number)[]): string {
  if (path.length === 0) {
    return "Request";
  }

  const value = path
    .map((part) => (typeof part === "number" ? `item ${part + 1}` : part))
    .join(" > ");

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatValidationIssue(issue: z.ZodIssue): string {
  const field = formatIssuePath(issue.path);

  if (issue.code === "invalid_type") {
    if (issue.received === "undefined") {
      return `${field} is required.`;
    }
    return `${field} has an invalid value.`;
  }

  if (issue.code === "too_small" && issue.type === "string") {
    if (issue.minimum === 1) {
      return `${field} cannot be empty.`;
    }
    return `${field} must be at least ${issue.minimum} characters long.`;
  }

  if (issue.code === "too_small" && issue.type === "array") {
    return `${field} must include at least ${issue.minimum} item${issue.minimum === 1 ? "" : "s"}.`;
  }

  if (issue.code === "too_small" && issue.type === "number") {
    return `${field} must be at least ${issue.minimum}.`;
  }

  if (issue.code === "too_big" && issue.type === "string") {
    return `${field} must be at most ${issue.maximum} characters long.`;
  }

  if (issue.code === "too_big" && issue.type === "array") {
    return `${field} must include no more than ${issue.maximum} items.`;
  }

  if (issue.code === "too_big" && issue.type === "number") {
    return `${field} must be ${issue.maximum} or less.`;
  }

  return `${field}: ${issue.message}`;
}

function sendValidationError(response: Response, issues: z.ZodIssue[]): void {
  const details = issues.map(formatValidationIssue);

  response.status(400).json({
    message: details[0] ?? "Please review the form values and try again.",
    details,
    issues,
  });
}

function formatOperationMessage(error: unknown, fallback: string): string {
  const rawMessage = error instanceof Error ? error.message : "";

  if (rawMessage.includes("Unknown argument `code`")) {
    return "Stage generation failed because the backend schema is out of sync. Run npm run prisma:generate -w apps/api and npm run db:push -w apps/api, then restart npm run dev.";
  }

  if (rawMessage.includes("Unique constraint failed on the fields: (`stageId`,`roundIndex`,`matchIndex`)")) {
    return "Stage generation failed because duplicate fixture slots were detected. Delete the partially generated stage and try again.";
  }

  if (rawMessage.includes("listen EADDRINUSE")) {
    return "Port 4000 is already in use. Stop the existing backend process and restart npm run dev.";
  }

  if (rawMessage.startsWith("Invalid `prisma.")) {
    return `${fallback} Database schema and generated client may be out of sync. Run npm run prisma:generate -w apps/api and npm run db:push -w apps/api, then restart npm run dev.`;
  }

  return rawMessage || fallback;
}

function sendOperationError(response: Response, error: unknown, fallback: string): void {
  response.status(400).json({ message: formatOperationMessage(error, fallback) });
}

app.get("/", (_request, response) => {
  response.status(200).json({
    name: "Zemo Tournament Engine API",
    version: "0.2.0",
    description: "Sports tournament bracket and leaderboard management",
    endpoints: {
      health: "/health",
      sports: "/api/sports",
      tournaments: "/api/tournaments",
    },
    frontend: "http://localhost:5173",
  });
});

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok", service: "zemo-api" });
});

app.get("/api/sports", (_request, response) => {
  response.status(200).json({ data: sportsCatalog, count: sportsCatalog.length });
});

app.get("/api/formats", (_request, response) => {
  const formats = Array.from(new Set(sportsCatalog.map((sport) => sport.format))).sort();
  response.status(200).json({ data: formats, count: formats.length });
});

// ── Tournaments ──────────────────────────────────────────────────────────────

app.get("/api/tournaments", async (_request, response) => {
  try {
    const tournaments = await listTournaments();
    response.status(200).json({ data: tournaments });
  } catch (error) {
    sendOperationError(response, error, "Could not fetch tournaments.");
  }
});

app.get("/api/tournaments/:id", async (request, response) => {
  try {
    const tournament = await getTournamentById(request.params.id);
    if (!tournament) {
      response.status(404).json({ message: "Tournament not found." });
      return;
    }
    response.status(200).json({ data: tournament });
  } catch (error) {
    sendOperationError(response, error, "Could not fetch tournament.");
  }
});

const createTournamentSchema = z.object({
  name: z.string().min(3).max(120),
  sportId: z.number().int().positive(),
});

app.post("/api/tournaments", async (request, response) => {
  const parsedBody = createTournamentSchema.safeParse(request.body);
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const tournament = await createTournament(parsedBody.data);
    response.status(201).json({ data: tournament });
  } catch (error) {
    sendOperationError(response, error, "Could not create tournament.");
  }
});

// ── Participants ──────────────────────────────────────────────────────────────

const addParticipantsSchema = z.object({
  names: z.array(z.string().min(1).max(120)).min(1).max(256),
});

app.get("/api/tournaments/:id/participants", async (request, response) => {
  try {
    const participants = await listParticipants(request.params.id);
    response.status(200).json({ data: participants });
  } catch (error) {
    sendOperationError(response, error, "Could not fetch participants.");
  }
});

app.post("/api/tournaments/:id/participants", async (request, response) => {
  const parsedBody = addParticipantsSchema.safeParse(request.body);
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const participants = await addParticipants({
      tournamentId: request.params.id,
      participantNames: parsedBody.data.names,
    });
    response.status(200).json({ data: participants, count: participants.length });
  } catch (error) {
    sendOperationError(response, error, "Could not add participants.");
  }
});

// ── Stages ────────────────────────────────────────────────────────────────────

app.get("/api/tournaments/:id/stages", async (request, response) => {
  try {
    const stages = await listStages(request.params.id);
    response.status(200).json({ data: stages, count: stages.length });
  } catch (error) {
    sendOperationError(response, error, "Could not fetch stages.");
  }
});

const stageNameSchema = z.object({
  stageName: z.string().min(1).max(120).optional(),
  totalRounds: z.number().int().min(1).max(20).optional(),
});

app.post("/api/tournaments/:id/stages/single-elimination", async (request, response) => {
  const parsedBody = stageNameSchema.safeParse(request.body ?? {});
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const stageData = await generateSingleEliminationStage({
      tournamentId: request.params.id,
      stageName: parsedBody.data.stageName,
    });
    response.status(201).json({ data: stageData });
  } catch (error) {
    sendOperationError(response, error, "Could not generate stage.");
  }
});

app.post("/api/tournaments/:id/stages/round-robin", async (request, response) => {
  const parsedBody = stageNameSchema.safeParse(request.body ?? {});
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const stageData = await generateRoundRobinStage({
      tournamentId: request.params.id,
      stageName: parsedBody.data.stageName,
    });
    response.status(201).json({ data: stageData });
  } catch (error) {
    sendOperationError(response, error, "Could not generate round-robin stage.");
  }
});

app.post("/api/tournaments/:id/stages/double-elimination", async (request, response) => {
  const parsedBody = stageNameSchema.safeParse(request.body ?? {});
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const stageData = await generateDoubleEliminationStage({
      tournamentId: request.params.id,
      stageName: parsedBody.data.stageName,
    });
    response.status(201).json({ data: stageData });
  } catch (error) {
    sendOperationError(response, error, "Could not generate double-elimination stage.");
  }
});

app.post("/api/tournaments/:id/stages/swiss", async (request, response) => {
  const parsedBody = stageNameSchema.safeParse(request.body ?? {});
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const stageData = await generateSwissStage({
      tournamentId: request.params.id,
      stageName: parsedBody.data.stageName,
      totalRounds: parsedBody.data.totalRounds,
    });
    response.status(201).json({ data: stageData });
  } catch (error) {
    sendOperationError(response, error, "Could not generate Swiss stage.");
  }
});

app.post("/api/tournaments/:id/stages/league-plus-playoff", async (request, response) => {
  const parsedBody = stageNameSchema.safeParse(request.body ?? {});
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const stageData = await generateLeaguePlusPlayoffStage({
      tournamentId: request.params.id,
      stageName: parsedBody.data.stageName,
    });
    response.status(201).json({ data: stageData });
  } catch (error) {
    sendOperationError(response, error, "Could not generate league stage.");
  }
});

const playoffSchema = z.object({
  leagueStageId: z.string().min(1),
  playoffTeamCount: z.number().int().min(2).max(32).default(4),
  stageName: z.string().min(1).max(120).optional(),
});

app.post("/api/tournaments/:id/stages/playoff", async (request, response) => {
  const parsedBody = playoffSchema.safeParse(request.body ?? {});
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const stageData = await generatePlayoffStage(
      request.params.id,
      parsedBody.data.leagueStageId,
      parsedBody.data.playoffTeamCount,
      parsedBody.data.stageName
    );
    response.status(201).json({ data: stageData });
  } catch (error) {
    sendOperationError(response, error, "Could not generate playoff stage.");
  }
});

// ── Swiss Round Re-pairing ────────────────────────────────────────────────────

const swissRePairSchema = z.object({
  roundIndex: z.number().int().min(2),
});

app.post("/api/stages/:stageId/swiss/pair-round", async (request, response) => {
  const parsedBody = swissRePairSchema.safeParse(request.body ?? {});
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const fixtures = await regenerateSwissRoundPairings(
      request.params.stageId,
      parsedBody.data.roundIndex
    );
    response.status(200).json({ data: fixtures });
  } catch (error) {
    sendOperationError(response, error, "Could not generate pairings.");
  }
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

app.get("/api/stages/:stageId/fixtures", async (request, response) => {
  try {
    const fixtures = await listFixturesByStage(request.params.stageId);
    response.status(200).json({ data: fixtures });
  } catch (error) {
    sendOperationError(response, error, "Could not fetch fixtures.");
  }
});

const updateFixtureSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
});

app.patch("/api/fixtures/:fixtureId/result", async (request, response) => {
  const parsedBody = updateFixtureSchema.safeParse(request.body);
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const fixture = await updateFixtureResult({
      fixtureId: request.params.fixtureId,
      homeScore: parsedBody.data.homeScore,
      awayScore: parsedBody.data.awayScore,
    });
    response.status(200).json({ data: fixture });
  } catch (error) {
    sendOperationError(response, error, "Could not update fixture result.");
  }
});

// ── Standings ─────────────────────────────────────────────────────────────────

app.get("/api/stages/:stageId/standings", async (request, response) => {
  try {
    const standings = await getStandingsByStage(request.params.stageId);
    response.status(200).json({ data: standings });
  } catch (error) {
    sendOperationError(response, error, "Could not calculate standings.");
  }
});

// ── Performance Entries ───────────────────────────────────────────────────────

const addPerformanceSchema = z.object({
  participantId: z.string().min(1),
  metricValue: z.number(),
  unit: z.string().max(20).optional(),
  metadata: z.string().max(500).optional(),
});

app.get("/api/stages/:stageId/performances", async (request, response) => {
  try {
    const entries = await listPerformanceEntries(request.params.stageId);
    response.status(200).json({ data: entries });
  } catch (error) {
    sendOperationError(response, error, "Could not fetch performances.");
  }
});

app.post("/api/stages/:stageId/performances", async (request, response) => {
  const parsedBody = addPerformanceSchema.safeParse(request.body);
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const entry = await addPerformanceEntry({
      stageId: request.params.stageId,
      ...parsedBody.data,
    });
    response.status(201).json({ data: entry });
  } catch (error) {
    sendOperationError(response, error, "Could not add performance entry.");
  }
});

app.delete("/api/performances/:entryId", async (request, response) => {
  try {
    await deletePerformanceEntry(request.params.entryId);
    response.status(200).json({ message: "Deleted." });
  } catch (error) {
    sendOperationError(response, error, "Could not delete entry.");
  }
});

// ── Stateless bracket generators ──────────────────────────────────────────────

const createBracketSchema = z.object({
  participants: z
    .array(z.object({ name: z.string().min(1).max(120), seed: z.number().int().positive().optional() }))
    .min(2)
    .max(128),
});

app.post("/api/brackets/single-elimination", (request, response) => {
  const parsedBody = createBracketSchema.safeParse(request.body);
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const bracket = buildSingleEliminationBracket(parsedBody.data.participants);
    response.status(200).json({ data: bracket });
  } catch (error) {
    sendOperationError(response, error, "Could not build bracket.");
  }
});

app.post("/api/brackets/double-elimination", (request, response) => {
  const parsedBody = createBracketSchema.safeParse(request.body);
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const bracket = buildDoubleEliminationBracket(parsedBody.data.participants);
    response.status(200).json({ data: bracket });
  } catch (error) {
    sendOperationError(response, error, "Could not build bracket.");
  }
});

app.post("/api/brackets/round-robin", (request, response) => {
  const parsedBody = createBracketSchema.safeParse(request.body);
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const schedule = buildRoundRobinFixtures(
      parsedBody.data.participants.map((p, i) => ({ id: String(i), name: p.name, seed: p.seed }))
    );
    response.status(200).json({ data: schedule });
  } catch (error) {
    sendOperationError(response, error, "Could not build schedule.");
  }
});

app.post("/api/brackets/swiss", (request, response) => {
  const schema = z.object({
    participants: z
      .array(z.object({ name: z.string().min(1).max(120), seed: z.number().int().positive().optional() }))
      .min(2)
      .max(128),
    totalRounds: z.number().int().min(1).max(20).optional(),
  });
  const parsedBody = schema.safeParse(request.body);
  if (!parsedBody.success) {
    sendValidationError(response, parsedBody.error.issues);
    return;
  }
  try {
    const schedule = buildSwissFixtures(
      parsedBody.data.participants.map((p, i) => ({ id: String(i), name: p.name, seed: p.seed })),
      parsedBody.data.totalRounds
    );
    response.status(200).json({ data: schedule });
  } catch (error) {
    sendOperationError(response, error, "Could not build Swiss schedule.");
  }
});

app.listen(port, () => {
  console.log(`Zemo API listening on port ${port}`);
});