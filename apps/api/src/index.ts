import cors from "cors";
import express from "express";
import { z } from "zod";
import { sportsCatalog } from "./data/sports.js";
import { buildSingleEliminationBracket } from "./engine/singleElimination.js";
import { buildRoundRobinFixtures } from "./engine/roundRobin.js";
import { calculateStandings, calculateLeaderboard } from "./engine/standings.js";
import {
  addParticipants,
  createTournament,
  generateSingleEliminationStage,
  generateRoundRobinStage,
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

app.get("/", (_request, response) => {
  response.status(200).json({
    name: "Zemo Tournament Engine API",
    version: "0.1.0",
    description: "Sports tournament bracket and leaderboard management",
    endpoints: {
      health: "/health",
      sports: "/api/sports",
      tournaments: "/api/tournaments",
      documentation: "https://github.com/Abhishek131005/Bracket_Generator"
    },
    frontend: "http://localhost:5173"
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
  const tournaments = await listTournaments();
  response.status(200).json({ data: tournaments });
});

app.get("/api/tournaments/:id", async (request, response) => {
  const tournament = await getTournamentById(request.params.id);
  if (!tournament) {
    response.status(404).json({ message: "Tournament not found." });
    return;
  }
  response.status(200).json({ data: tournament });
});

const createTournamentSchema = z.object({
  name: z.string().min(3).max(120),
  sportId: z.number().int().positive()
});

app.post("/api/tournaments", async (request, response) => {
  const parsedBody = createTournamentSchema.safeParse(request.body);
  if (!parsedBody.success) {
    response.status(400).json({ message: "Invalid payload.", issues: parsedBody.error.issues });
    return;
  }
  try {
    const tournament = await createTournament(parsedBody.data);
    response.status(201).json({ data: tournament });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not create tournament." });
  }
});

// ── Participants ──────────────────────────────────────────────────────────────

const addParticipantsSchema = z.object({
  names: z.array(z.string().min(1).max(120)).min(1).max(256)
});

app.get("/api/tournaments/:id/participants", async (request, response) => {
  try {
    const participants = await listParticipants(request.params.id);
    response.status(200).json({ data: participants });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not fetch participants." });
  }
});

app.post("/api/tournaments/:id/participants", async (request, response) => {
  const parsedBody = addParticipantsSchema.safeParse(request.body);
  if (!parsedBody.success) {
    response.status(400).json({ message: "Invalid payload.", issues: parsedBody.error.issues });
    return;
  }
  try {
    const participants = await addParticipants({
      tournamentId: request.params.id,
      participantNames: parsedBody.data.names
    });
    response.status(200).json({ data: participants, count: participants.length });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not add participants." });
  }
});

// ── Stages ────────────────────────────────────────────────────────────────────

app.get("/api/tournaments/:id/stages", async (request, response) => {
  try {
    const stages = await listStages(request.params.id);
    response.status(200).json({ data: stages, count: stages.length });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not fetch stages." });
  }
});

const stageNameSchema = z.object({
  stageName: z.string().min(1).max(120).optional()
});

app.post("/api/tournaments/:id/stages/single-elimination", async (request, response) => {
  const parsedBody = stageNameSchema.safeParse(request.body ?? {});
  if (!parsedBody.success) {
    response.status(400).json({ message: "Invalid payload.", issues: parsedBody.error.issues });
    return;
  }
  try {
    const stageData = await generateSingleEliminationStage({
      tournamentId: request.params.id,
      stageName: parsedBody.data.stageName
    });
    response.status(201).json({ data: stageData });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not generate stage." });
  }
});

app.post("/api/tournaments/:id/stages/round-robin", async (request, response) => {
  const parsedBody = stageNameSchema.safeParse(request.body ?? {});
  if (!parsedBody.success) {
    response.status(400).json({ message: "Invalid payload.", issues: parsedBody.error.issues });
    return;
  }
  try {
    const stageData = await generateRoundRobinStage({
      tournamentId: request.params.id,
      stageName: parsedBody.data.stageName
    });
    response.status(201).json({ data: stageData });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not generate round-robin stage." });
  }
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

app.get("/api/stages/:stageId/fixtures", async (request, response) => {
  try {
    const fixtures = await listFixturesByStage(request.params.stageId);
    response.status(200).json({ data: fixtures });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not fetch fixtures." });
  }
});

const updateFixtureSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
});

app.patch("/api/fixtures/:fixtureId/result", async (request, response) => {
  const parsedBody = updateFixtureSchema.safeParse(request.body);
  if (!parsedBody.success) {
    response.status(400).json({ message: "Invalid payload.", issues: parsedBody.error.issues });
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
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not update fixture result." });
  }
});

// ── Standings ─────────────────────────────────────────────────────────────────

app.get("/api/stages/:stageId/standings", async (request, response) => {
  try {
    const standings = await getStandingsByStage(request.params.stageId);
    response.status(200).json({ data: standings });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not calculate standings." });
  }
});

// ── Performance Entries (Leaderboard sports) ──────────────────────────────────

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
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not fetch performances." });
  }
});

app.post("/api/stages/:stageId/performances", async (request, response) => {
  const parsedBody = addPerformanceSchema.safeParse(request.body);
  if (!parsedBody.success) {
    response.status(400).json({ message: "Invalid payload.", issues: parsedBody.error.issues });
    return;
  }
  try {
    const entry = await addPerformanceEntry({
      stageId: request.params.stageId,
      ...parsedBody.data,
    });
    response.status(201).json({ data: entry });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not add performance entry." });
  }
});

app.delete("/api/performances/:entryId", async (request, response) => {
  try {
    await deletePerformanceEntry(request.params.entryId);
    response.status(200).json({ message: "Deleted." });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not delete entry." });
  }
});

// ── Quick bracket generator (stateless) ──────────────────────────────────────

const createBracketSchema = z.object({
  participants: z.array(
    z.object({
      name: z.string().min(1).max(120),
      seed: z.number().int().positive().optional()
    })
  ).min(2).max(128)
});

app.post("/api/brackets/single-elimination", (request, response) => {
  const parsedBody = createBracketSchema.safeParse(request.body);
  if (!parsedBody.success) {
    response.status(400).json({ message: "Invalid payload.", issues: parsedBody.error.issues });
    return;
  }
  try {
    const bracket = buildSingleEliminationBracket(parsedBody.data.participants);
    response.status(200).json({ data: bracket });
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : "Could not build bracket." });
  }
});

app.listen(port, () => {
  console.log(`Zemo API listening on port ${port}`);
});