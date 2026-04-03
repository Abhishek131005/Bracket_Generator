import { sportsCatalog } from "../src/data/sports.js";
import { prisma } from "../src/db.js";
import {
  addParticipants,
  createTournament,
  generateDoubleEliminationStage,
  generateLeaguePlusPlayoffStage,
  generateRoundRobinStage,
  generateSingleEliminationStage,
  generateSwissStage,
} from "../src/repositories/tournaments.js";

type Technique = {
  id: string;
  run: (tournamentId: string) => Promise<unknown>;
};

type Failure = {
  sportId: number;
  sportName: string;
  technique: string;
  message: string;
};

const techniques: Technique[] = [
  {
    id: "single-elimination",
    run: (tournamentId) =>
      generateSingleEliminationStage({
        tournamentId,
        stageName: "Smoke SE",
      }),
  },
  {
    id: "double-elimination",
    run: (tournamentId) =>
      generateDoubleEliminationStage({
        tournamentId,
        stageName: "Smoke DE",
      }),
  },
  {
    id: "round-robin",
    run: (tournamentId) =>
      generateRoundRobinStage({
        tournamentId,
        stageName: "Smoke RR",
      }),
  },
  {
    id: "swiss",
    run: (tournamentId) =>
      generateSwissStage({
        tournamentId,
        stageName: "Smoke SW",
        totalRounds: 3,
      }),
  },
  {
    id: "league-plus-playoff",
    run: (tournamentId) =>
      generateLeaguePlusPlayoffStage({
        tournamentId,
        stageName: "Smoke LPP",
      }),
  },
];

function namesForSport(sportId: number): string[] {
  return Array.from({ length: 8 }, (_, i) => `Team ${sportId}-${i + 1}`);
}

async function run(): Promise<void> {
  const failures: Failure[] = [];
  let executed = 0;

  for (const sport of sportsCatalog) {
    const tournament = await createTournament({
      name: `Smoke ${sport.id} ${Date.now()}`,
      sportId: sport.id,
    });

    try {
      await addParticipants({
        tournamentId: tournament.id,
        participantNames: namesForSport(sport.id),
      });

      for (const technique of techniques) {
        executed += 1;
        try {
          await technique.run(tournament.id);
        } catch (error) {
          failures.push({
            sportId: sport.id,
            sportName: sport.name,
            technique: technique.id,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    } finally {
      await prisma.tournament.delete({ where: { id: tournament.id } }).catch(() => undefined);
    }
  }

  console.log(`Executed ${executed} sport-technique combinations.`);

  if (failures.length === 0) {
    console.log("All combinations passed.");
    return;
  }

  console.log(`Failures: ${failures.length}`);
  for (const failure of failures) {
    console.log(
      `[sport:${failure.sportId} ${failure.sportName}] [${failure.technique}] ${failure.message}`
    );
  }

  process.exitCode = 1;
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
