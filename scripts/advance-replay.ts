// scripts/advance-replay.ts
// Scores N periods for a replay league from the CLI.
//
//   npm run advance-replay -- --league <leagueId> [--weeks N]

import { PrismaClient } from "@prisma/client";
import { getSeasonState, advanceSeason } from "../lib/season";

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const leagueId = arg("--league");
  if (!leagueId) {
    console.error("Usage: npm run advance-replay -- --league <leagueId> [--weeks N]");
    process.exit(1);
  }

  const weeksToAdvance = parseInt(arg("--weeks") ?? "1", 10);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { isReplay: true, replayCurrentDate: true, status: true, name: true },
  });

  if (!league) {
    console.error(`League ${leagueId} not found.`);
    process.exit(1);
  }
  if (!league.isReplay) {
    console.error("This league is not a replay league. Use the season admin panel instead.");
    process.exit(1);
  }
  if (league.status !== "IN_SEASON") {
    console.error(`League status is ${league.status} — start the season first from the admin panel.`);
    process.exit(1);
  }

  const baseMs = league.replayCurrentDate?.getTime() ?? new Date("2025-11-21T00:00:00Z").getTime();
  const state = await getSeasonState(leagueId, baseMs, prisma);

  // Find the next N pending/upcoming periods to advance past
  const toScore = state.periods
    .filter((p) => p.status === "UPCOMING" || p.status === "SCORING_PENDING" || p.status === "ACTIVE")
    .slice(0, weeksToAdvance);

  if (toScore.length === 0) {
    console.log("No periods to advance. Season may be complete or no upcoming periods found.");
    process.exit(0);
  }

  for (const periodState of toScore) {
    // Advance to 1 hour past the period end
    const targetMs = periodState.period.endsAt.getTime() + 3_600_000;
    const result = await advanceSeason(leagueId, targetMs, prisma);
    await prisma.fantasyLeague.update({
      where: { id: leagueId },
      data: { replayCurrentDate: new Date(targetMs) },
    });
    const scored = result.scoredWeeks.length > 0
      ? `Scored week(s) ${result.scoredWeeks.join(", ")}`
      : "No new weeks scored (may already be complete)";
    console.log(`→ ${scored} · simulated date now ${new Date(targetMs).toISOString()}`);
  }

  console.log(`\n✓ Advanced ${toScore.length} period(s) for "${league.name}".`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
