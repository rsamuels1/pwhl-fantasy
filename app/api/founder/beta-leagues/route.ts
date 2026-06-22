import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_SCORING } from "@/lib/scoring/index";

function pickRandomWeeks(total: number, count: number): number[] {
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).sort((a, b) => a - b);
}

// POST /api/founder/beta-leagues
// Creates an 8-team beta league with replay mode, random 4-week selection,
// and 1-week playoff rounds. Draft date must be within July 6–12, 2026.
export async function POST(req: NextRequest) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json() as {
    name?: string;
    commissionerEmail?: string;
    draftStartsAt?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }
  if (!body.commissionerEmail?.trim()) {
    return NextResponse.json({ error: "Missing commissionerEmail" }, { status: 400 });
  }
  if (!body.draftStartsAt) {
    return NextResponse.json({ error: "Missing draftStartsAt" }, { status: 400 });
  }

  const draftDate = new Date(body.draftStartsAt);
  if (isNaN(draftDate.getTime())) {
    return NextResponse.json({ error: "Invalid draftStartsAt date" }, { status: 400 });
  }

  // Validate draft date is within July 6–12, 2026.
  const minDate = new Date("2026-07-06T00:00:00Z");
  const maxDate = new Date("2026-07-12T23:59:59Z");
  if (draftDate < minDate || draftDate > maxDate) {
    return NextResponse.json(
      { error: "draftStartsAt must be within July 6–12, 2026" },
      { status: 400 }
    );
  }

  const email = body.commissionerEmail.trim().toLowerCase();

  // The 2025-26 fixture has 20 derived weeks — pick 4 randomly.
  const betaWeekIndices = pickRandomWeeks(20, 4);

  const scoringSettings = {
    ...DEFAULT_SCORING,
    betaWeekIndices,
  };

  const playoffSettings = {
    teamsInPlayoff: 4,
    topSeedsWithBye: 0,
    higherSeedWinsTies: true,
    roundDurationPeriods: 1,
  };

  const rosterSettings = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };

  // Upsert commissioner user.
  const commissioner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, displayName: email.split("@")[0] },
  });

  // Create the league.
  const league = await prisma.fantasyLeague.create({
    data: {
      name: body.name.trim(),
      season: "2025-26",
      maxTeams: 8,
      isReplay: true,
      betaStatus: "ACTIVE",
      scoringMode: "VTF",
      draftType: "SNAKE",
      commissionerId: commissioner.id,
      draftStartsAt: draftDate,
      scoringSettings,
      rosterSettings,
      playoffSettings,
    },
  });

  // Create 8 teams. Team 1 is owned by the commissioner.
  // Teams 2–8 get placeholder bot users (isBot=true) that will be replaced
  // when the founder assigns real beta testers via the Beta Users tab.
  const teamNames = ["Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6", "Team 7", "Team 8"];
  for (let i = 0; i < teamNames.length; i++) {
    let ownerId: string;
    if (i === 0) {
      ownerId = commissioner.id;
    } else {
      // Create a bot placeholder user with a synthetic email scoped to the league.
      const botEmail = `bot-${i + 1}-${league.id}@beta.pwhlgm.internal`;
      const botUser = await prisma.user.upsert({
        where: { email: botEmail },
        update: {},
        create: { email: botEmail, displayName: `Slot ${i + 1}` },
      });
      ownerId = botUser.id;
    }

    await prisma.fantasyTeam.create({
      data: {
        leagueId: league.id,
        name: teamNames[i],
        draftOrder: i + 1,
        ownerId,
        isBot: i !== 0,
      },
    });
  }

  // Create a Draft skeleton row (no totalRounds field on Draft model).
  await prisma.draft.create({
    data: {
      leagueId: league.id,
      status: "PENDING",
      currentPick: 1,
    },
  });

  const commissionerInviteUrl = `/login?returnTo=/league/${league.id}/admin`;

  return NextResponse.json({
    leagueId: league.id,
    commissionerInviteUrl,
    betaWeekIndices,
  });
}
