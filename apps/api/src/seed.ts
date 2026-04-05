/**
 * Seed script — populates the database with demo tournament data.
 * Run via:  node --import tsx/esm src/seed.ts
 * or:       npm run seed  (add to package.json scripts)
 *
 * Safe to run multiple times — clears existing seed data first
 * by deleting tournaments whose names start with "[Demo]".
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildSingleEliminationBracket } from "./engine/singleElimination.js";
import { buildDoubleEliminationBracket } from "./engine/doubleElimination.js";
import { buildRoundRobinFixtures } from "./engine/roundRobin.js";
import { sportsCatalog } from "./data/sports.js";

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function sport(name: string) {
  const s = sportsCatalog.find((sp) => sp.name === name);
  if (!s) throw new Error(`Sport not found: ${name}`);
  return s;
}

async function createTournamentWithParticipants(
  name: string,
  sportId: number,
  participantNames: string[]
) {
  const s = sportsCatalog.find((sp) => sp.id === sportId)!;
  const tournament = await prisma.tournament.create({
    data: {
      name,
      sportId,
      sportName: s.name,
      format: s.format,
      rankingRule: s.rankingRule,
      status: "IN_PROGRESS",
    },
  });

  const participants = await prisma.$transaction(
    participantNames.map((pName, i) =>
      prisma.participant.create({
        data: {
          tournamentId: tournament.id,
          name: pName,
          seed: i + 1,
          type: "INDIVIDUAL",
        },
      })
    )
  );

  return { tournament, participants };
}

// ── Seed data ─────────────────────────────────────────────────────────────────

async function seedSingleElimination() {
  console.log("  → Single Elimination: All England Badminton Championship");
  const { tournament, participants } = await createTournamentWithParticipants(
    "[Demo] All England Badminton Championship",
    sport("Badminton").id,
    ["Viktor Axelsen", "Shi Yuqi", "Jonatan Christie", "Anders Antonsen", "Lakshya Sen", "Lee Zii Jia", "Kunlavut Vitidsarn", "H.S. Prannoy"]
  );

  const ps = participants.map((p) => ({ id: p.id, name: p.name, seed: p.seed ?? undefined }));
  const bracket = buildSingleEliminationBracket(ps);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      name: "Knockout Stage",
      sequence: 1,
      format: "SINGLE_ELIMINATION",
      rankingRule: "HEAD_TO_HEAD_SCORE",
      status: "IN_PROGRESS",
    },
  });

  // Flatten all fixtures and persist them
  const fixtureData = bracket.rounds.flatMap((round) =>
    round.matches.map((match) => ({
      stageId: stage.id,
      roundIndex: match.roundIndex,
      matchIndex: match.matchIndex,
      leftParticipantId: participants.find((p) => p.name === match.left.participantName)?.id ?? null,
      rightParticipantId: participants.find((p) => p.name === match.right.participantName)?.id ?? null,
      leftLabel: match.left.participantName,
      rightLabel: match.right.participantName,
      status: "SCHEDULED",
    }))
  );
  await prisma.fixture.createMany({ data: fixtureData });

  // Score QF matches so semi-finals are populated
  const qfFixtures = await prisma.fixture.findMany({
    where: { stageId: stage.id, roundIndex: 0 },
    orderBy: { matchIndex: "asc" },
  });
  const qfScores = [[3, 1], [2, 0], [1, 2], [0, 1]];
  for (let i = 0; i < qfFixtures.length; i++) {
    const [ls, rs] = qfScores[i];
    await prisma.fixture.update({
      where: { id: qfFixtures[i].id },
      data: { leftScore: ls, rightScore: rs, status: "COMPLETED" },
    });
  }
}

async function seedDoubleElimination() {
  console.log("  → Double Elimination: World 8 Ball Pool Championship");
  const { tournament, participants } = await createTournamentWithParticipants(
    "[Demo] World 8 Ball Pool Championship",
    sport("8 Ball Pool").id,
    ["Fedor Gorst", "Shane Van Boening", "Ko Pin Yi", "Joshua Filler", "Albin Ouschan", "Niels Feijen", "Alex Pagulayan", "Carlo Biado"]
  );

  const ps = participants.map((p) => ({ id: p.id, name: p.name, seed: p.seed ?? undefined }));
  const bracket = buildDoubleEliminationBracket(ps);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      name: "Main Event",
      sequence: 1,
      format: "DOUBLE_ELIMINATION",
      rankingRule: "HEAD_TO_HEAD_SCORE",
      status: "IN_PROGRESS",
    },
  });

  const roundOffsetByBracket: Record<string, number> = {
    WINNERS: 0,
    LOSERS: bracket.winnersRounds.length,
    GRAND_FINAL: bracket.winnersRounds.length + bracket.losersRounds.length,
  };

  const fixtureData = bracket.allRounds.flatMap((round) =>
    round.matches.map((match) => ({
      stageId: stage.id,
      bracket: match.bracket,
      roundIndex: (roundOffsetByBracket[match.bracket] ?? 0) + match.roundIndex,
      matchIndex: match.matchIndex,
      leftParticipantId: participants.find((p) => p.name === match.leftLabel)?.id ?? null,
      rightParticipantId: participants.find((p) => p.name === match.rightLabel)?.id ?? null,
      leftLabel: match.leftLabel,
      rightLabel: match.rightLabel,
      winnerGoesTo: match.winnerGoesTo,
      loserGoesTo: match.loserGoesTo,
      status: "SCHEDULED",
    }))
  );
  await prisma.fixture.createMany({ data: fixtureData });
}

async function seedRoundRobin() {
  console.log("  → Round Robin: Premier League Group Stage");
  const { tournament, participants } = await createTournamentWithParticipants(
    "[Demo] Premier League Group Stage",
    sport("Football").id,
    ["Arsenal", "Manchester City", "Liverpool", "Chelsea", "Tottenham", "Aston Villa"]
  );

  const ps = participants.map((p) => ({ id: p.id, name: p.name, seed: p.seed ?? undefined }));
  const schedule = buildRoundRobinFixtures(ps);

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      name: "Regular Season",
      sequence: 1,
      format: "ROUND_ROBIN",
      rankingRule: "POINTS_TABLE",
      status: "IN_PROGRESS",
    },
  });

  const fixtureData = schedule.rounds.flatMap((round) =>
    round.matches
      .filter((m) => !m.isBye)
      .map((match) => ({
        stageId: stage.id,
        roundIndex: match.roundIndex,
        matchIndex: match.matchIndex,
        leftParticipantId: match.homeParticipantId,
        rightParticipantId: match.awayParticipantId,
        leftLabel: match.homeLabel,
        rightLabel: match.awayLabel,
        status: "SCHEDULED",
      }))
  );
  await prisma.fixture.createMany({ data: fixtureData });

  // Score first two rounds so standings have data
  const earlyFixtures = await prisma.fixture.findMany({
    where: { stageId: stage.id, roundIndex: { in: [0, 1] } },
  });
  const scores = [[112, 98], [105, 110], [99, 88], [115, 107], [102, 95], [98, 101]];
  for (let i = 0; i < Math.min(earlyFixtures.length, scores.length); i++) {
    await prisma.fixture.update({
      where: { id: earlyFixtures[i].id },
      data: { leftScore: scores[i][0], rightScore: scores[i][1], status: "COMPLETED" },
    });
  }
}

async function seedHeightLeaderboard() {
  console.log("  → Direct Final (Height): World Athletics High Jump");
  const { tournament, participants } = await createTournamentWithParticipants(
    "[Demo] World Athletics High Jump Final",
    sport("High Jump").id,
    ["Mutaz Essa Barshim", "Gianmarco Tamberi", "Woo Sanghyeok", "JuVaughn Harrison", "Norbert Kobielski", "Andriy Protsenko"]
  );

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      name: "Final",
      sequence: 1,
      format: "DIRECT_FINAL",
      rankingRule: "HEIGHT_DESC_WITH_COUNTBACK",
      status: "IN_PROGRESS",
    },
  });

  // Realistic results — Barshim and Tamberi share gold (as in Tokyo 2021)
  const results = [
    { name: "Mutaz Essa Barshim",   height: 2.37, fam: 0, tf: 1, ta: 8 },
    { name: "Gianmarco Tamberi",    height: 2.37, fam: 0, tf: 1, ta: 8 },
    { name: "Woo Sanghyeok",        height: 2.35, fam: 1, tf: 2, ta: 9 },
    { name: "JuVaughn Harrison",    height: 2.33, fam: 0, tf: 1, ta: 7 },
    { name: "Norbert Kobielski",    height: 2.30, fam: 0, tf: 2, ta: 8 },
    { name: "Andriy Protsenko",     height: 2.28, fam: 1, tf: 3, ta: 9 },
  ];

  for (const result of results) {
    const participant = participants.find((p) => p.name === result.name);
    if (!participant) continue;
    await prisma.performanceEntry.create({
      data: {
        stageId: stage.id,
        participantId: participant.id,
        metricValue: result.height,
        unit: "m",
        metadata: JSON.stringify({ failuresAtMax: result.fam, totalFailures: result.tf, totalAttempts: result.ta }),
      },
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

  const stage = await prisma.stage.create({
    data: {
      tournamentId: tournament.id,
      name: "Final",
      sequence: 1,
      format: "JUDGED_LEADERBOARD",
      rankingRule: "JUDGES_SCORE_DESC",
      status: "IN_PROGRESS",
    },
  });

  const judgeScores: Record<string, number[]> = {
    "Simone Biles":    [9.1, 9.3, 9.2, 9.0],
    "Rebeca Andrade":  [8.9, 9.0, 8.8, 9.1],
    "Jordan Chiles":   [8.7, 8.9, 8.8, 8.6],
    "Larisa Iordache": [8.5, 8.4, 8.6, 8.5],
    "Alice Kinsella":  [8.2, 8.3, 8.1, 8.4],
    "Ana Barbosu":     [8.0, 8.1, 7.9, 8.2],
  };

  const judges = ["Judge A", "Judge B", "Judge C", "Judge D"];
  for (const participant of participants) {
    const scores = judgeScores[participant.name] ?? [];
    for (let j = 0; j < scores.length; j++) {
      await prisma.performanceEntry.create({
        data: {
          stageId: stage.id,
          participantId: participant.id,
          metricValue: scores[j],
          unit: null,
          metadata: JSON.stringify({ judgeId: judges[j] }),
        },
      });
    }
  }
}

async function seedDemoUser() {
  console.log("  → Demo user (organizer@zemo.io / password: demo1234)");
  const existing = await prisma.user.findUnique({ where: { email: "organizer@zemo.io" } });
  if (existing) return;
  await prisma.user.create({
    data: {
      email: "organizer@zemo.io",
      name: "Demo Organizer",
      passwordHash: await bcrypt.hash("demo1234", 12),
      role: "ORGANIZER",
    },
  });
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

  await seedDemoUser();
  await seedSingleElimination();
  await seedDoubleElimination();
  await seedRoundRobin();
  await seedHeightLeaderboard();
  await seedJudgedLeaderboard();

  console.log("\n✅ Seed complete. Demo accounts:\n   organizer@zemo.io / demo1234");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
