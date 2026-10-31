/**
 * Seed script — populates the database with demo tournament data.
 * Run via:  npm run seed -w apps/api
 *
 * Safe to run multiple times — clears existing seed data first
 * by deleting tournaments whose names start with "[Demo]".
 *
 * Everything is built through the same repository functions the API uses
 * (stage generators + updateFixtureResult + addPerformanceEntry), so the demo data
 * has correct seeding, byes, bracket progression and tournament/stage statuses
 * instead of hand-written rows that can drift from the real behaviour.
 */

import bcrypt from "bcryptjs";
import { prisma } from "./db.js";
import { sportsCatalog } from "./data/sports.js";
import {
  addPerformanceEntry,
  generateDoubleEliminationStage,
  generateLeaderboardStage,
  generateLeaguePlusPlayoffStage,
  generateSingleEliminationStage,
  listFixturesByStage,
  refreshTournamentStatus,
  updateFixtureResult,
} from "./repositories/tournaments.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sport(name: string) {
  const s = sportsCatalog.find((sp) => sp.name === name);
  if (!s) throw new Error(`Sport not found: ${name}`);
  return s;
}

async function createTournamentWithParticipants(name: string, sportId: number, participantNames: string[]) {
  const s = sportsCatalog.find((sp) => sp.id === sportId)!;
  const tournament = await prisma.tournament.create({
    data: {
      name,
      sportId,
      sportName: s.name,
      format: s.format,
      rankingRule: s.rankingRule,
      status: "DRAFT", // moves to IN_PROGRESS by itself when the first result is recorded
    },
  });

  const participants = await prisma.$transaction(
    participantNames.map((pName, i) =>
      prisma.participant.create({
        data: { tournamentId: tournament.id, name: pName, seed: i + 1, type: "INDIVIDUAL" },
      })
    )
  );

  return { tournament, participants };
}

/** Score fixtures in order through the real result path (advances winners, updates statuses). */
async function score(fixtures: { id: string }[], scores: [number, number][]) {
  for (let i = 0; i < Math.min(fixtures.length, scores.length); i++) {
    await updateFixtureResult({ fixtureId: fixtures[i].id, homeScore: scores[i][0], awayScore: scores[i][1] });
  }
}

// ── Seed data ─────────────────────────────────────────────────────────────────

async function seedSingleElimination() {
  console.log("  → Single Elimination: All England Badminton Championship (quarter-finals played)");
  const { tournament } = await createTournamentWithParticipants(
    "[Demo] All England Badminton Championship",
    sport("Badminton").id,
    ["Viktor Axelsen", "Shi Yuqi", "Jonatan Christie", "Anders Antonsen", "Lakshya Sen", "Lee Zii Jia", "Kunlavut Vitidsarn", "H.S. Prannoy"]
  );

  const { stage } = await generateSingleEliminationStage({ tournamentId: tournament.id, stageName: "Knockout Stage" });

  // Quarter-finals are round 1 (1v8, 4v5, 2v7, 3v6); play them so the semi-finals are populated.
  const fixtures = await listFixturesByStage(stage.id);
  const quarterFinals = fixtures.filter((f) => f.roundIndex === 1).sort((a, b) => a.matchIndex - b.matchIndex);
  await score(quarterFinals, [[21, 14], [21, 18], [17, 21], [19, 21]]);
}

async function seedSingleEliminationWithByes() {
  console.log("  → Single Elimination with byes: Table Tennis Open (5 players)");
  const { tournament } = await createTournamentWithParticipants(
    "[Demo] Table Tennis Open (byes)",
    sport("Table Tennis").id,
    ["Ma Long", "Fan Zhendong", "Tomokazu Harimoto", "Hugo Calderano", "Truls Moregard"]
  );
  // No results: shows seeds 1-3 already waiting in the semi-finals.
  await generateSingleEliminationStage({ tournamentId: tournament.id, stageName: "Knockout Stage" });
}

async function seedDoubleElimination() {
  console.log("  → Double Elimination: World 8 Ball Pool Championship (winners round 1 played)");
  const { tournament } = await createTournamentWithParticipants(
    "[Demo] World 8 Ball Pool Championship",
    sport("8 Ball Pool").id,
    ["Fedor Gorst", "Shane Van Boening", "Ko Pin Yi", "Joshua Filler", "Albin Ouschan", "Niels Feijen", "Alex Pagulayan", "Carlo Biado"]
  );

  const { stage } = await generateDoubleEliminationStage({ tournamentId: tournament.id, stageName: "Main Event" });

  // Play winners round 1 so the losers bracket starts to fill.
  const fixtures = await listFixturesByStage(stage.id);
  const winnersRound1 = fixtures.filter((f) => f.roundIndex === 1).sort((a, b) => a.matchIndex - b.matchIndex);
  await score(winnersRound1, [[9, 5], [9, 7], [6, 9], [9, 3]]);
}

async function seedLeague() {
  console.log("  → League + Playoff: Premier League (first two matchdays played)");
  const { tournament } = await createTournamentWithParticipants(
    "[Demo] Premier League Group Stage",
    sport("Football").id,
    ["Arsenal", "Manchester City", "Liverpool", "Chelsea", "Tottenham", "Aston Villa"]
  );

  const { leagueStage } = await generateLeaguePlusPlayoffStage({ tournamentId: tournament.id, stageName: "League Stage" });

  const fixtures = await listFixturesByStage(leagueStage.id);
  const early = fixtures
    .filter((f) => f.roundIndex <= 2)
    .sort((a, b) => a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex);
  // includes a couple of draws so the table shows W/D/L columns properly
  await score(early, [[2, 1], [1, 1], [3, 0], [0, 2], [2, 2], [1, 0]]);
}

async function seedHeightLeaderboard() {
  console.log("  → Direct Final (Height): World Athletics High Jump");
  const { tournament, participants } = await createTournamentWithParticipants(
    "[Demo] World Athletics High Jump Final",
    sport("High Jump").id,
    ["Mutaz Essa Barshim", "Gianmarco Tamberi", "Woo Sanghyeok", "JuVaughn Harrison", "Norbert Kobielski", "Andriy Protsenko"]
  );

  const { stage } = await generateLeaderboardStage({ tournamentId: tournament.id, stageName: "Final", format: "DIRECT_FINAL" });

  // Barshim and Tamberi tie on every countback criterion and share gold (as in Tokyo 2021).
  const results = [
    { name: "Mutaz Essa Barshim", height: 2.37, fam: 0, tf: 1, ta: 8 },
    { name: "Gianmarco Tamberi", height: 2.37, fam: 0, tf: 1, ta: 8 },
    { name: "Woo Sanghyeok", height: 2.35, fam: 1, tf: 2, ta: 9 },
    { name: "JuVaughn Harrison", height: 2.33, fam: 0, tf: 1, ta: 7 },
    { name: "Norbert Kobielski", height: 2.3, fam: 0, tf: 2, ta: 8 },
    { name: "Andriy Protsenko", height: 2.28, fam: 1, tf: 3, ta: 9 },
  ];

  for (const result of results) {
    const participant = participants.find((p) => p.name === result.name);
    if (!participant) throw new Error(`Participant not found: ${result.name}`);
    await addPerformanceEntry({
      stageId: stage.id,
      participantId: participant.id,
      metricValue: result.height,
      unit: "m",
      metadata: JSON.stringify({ failuresAtMax: result.fam, totalFailures: result.tf, totalAttempts: result.ta }),
    });
  }
}

async function seedJudgedLeaderboard() {
  console.log("  → Judged Event: Indian Classical Arts Festival");
  const { tournament, participants } = await createTournamentWithParticipants(
    "[Demo] Indian Classical Arts Festival",
    sport("Indian Artyrst").id,
    ["Priya Sharma", "Ananya Iyer", "Kavya Nair", "Divya Menon", "Riya Patel", "Sneha Krishnan"]
  );

  const { stage } = await generateLeaderboardStage({ tournamentId: tournament.id, stageName: "Final", format: "JUDGED_LEADERBOARD" });

  // Scores are keyed by the participants above (the previous seed used other names, so nothing was ever saved).
  const judgeScores: Record<string, number[]> = {
    "Priya Sharma": [9.1, 9.3, 9.2, 9.0],
    "Ananya Iyer": [8.9, 9.0, 8.8, 9.1],
    "Kavya Nair": [8.7, 8.9, 8.8, 8.6],
    "Divya Menon": [8.5, 8.4, 8.6, 8.5],
    "Riya Patel": [8.2, 8.3, 8.1, 8.4],
    "Sneha Krishnan": [8.0, 8.1, 7.9, 8.2],
  };

  const judges = ["Judge A", "Judge B", "Judge C", "Judge D"];
  for (const participant of participants) {
    const scores = judgeScores[participant.name];
    if (!scores) throw new Error(`No judge scores defined for ${participant.name}`);
    for (let j = 0; j < scores.length; j++) {
      await addPerformanceEntry({
        stageId: stage.id,
        participantId: participant.id,
        metricValue: scores[j],
        unit: "pts",
        metadata: JSON.stringify({ judgeId: judges[j] }),
      });
    }
  }
}

const DEMO_PASSWORD = "demo1234";
const DEMO_USERS = [
  { email: "admin@zemo.io", name: "Demo Admin", role: "ADMIN" as const },
  { email: "organizer@zemo.io", name: "Demo Organizer", role: "ORGANIZER" as const },
  { email: "referee@zemo.io", name: "Demo Referee", role: "REFEREE" as const },
  { email: "viewer@zemo.io", name: "Demo Viewer", role: "VIEWER" as const },
];

async function seedDemoUsers() {
  console.log("  → Demo users (admin / organizer / referee / viewer @zemo.io, password: demo1234)");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const user of DEMO_USERS) {
    // upsert so re-running the seed also repairs a demo account whose role was changed
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: { ...user, passwordHash },
    });
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Zemo seed script starting…\n");

  // Clear previous demo data
  const existing = await prisma.tournament.findMany({
    where: { name: { startsWith: "[Demo]" } },
    select: { id: true },
  });
  if (existing.length > 0) {
    console.log(`  → Removing ${existing.length} existing demo tournament(s)…`);
    await prisma.tournament.deleteMany({ where: { name: { startsWith: "[Demo]" } } });
  }

  await seedDemoUsers();
  await seedSingleElimination();
  await seedSingleEliminationWithByes();
  await seedDoubleElimination();
  await seedLeague();
  await seedHeightLeaderboard();
  await seedJudgedLeaderboard();

  // make sure every demo tournament's status reflects its stages
  const demos = await prisma.tournament.findMany({ where: { name: { startsWith: "[Demo]" } }, select: { id: true } });
  for (const t of demos) await refreshTournamentStatus(t.id);

  console.log(`\n✅ Seed complete. Demo accounts (password ${DEMO_PASSWORD}):`);
  for (const u of DEMO_USERS) console.log(`   ${u.email.padEnd(20)} ${u.role}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
