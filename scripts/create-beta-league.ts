// scripts/create-beta-league.ts
// Creates a single beta replay league and emails the commissioner a 7-day magic link.
//
//   npx tsx scripts/create-beta-league.ts \
//     --name "Ryan's Beta League" \
//     --commissioner ryansamuelson@proton.me \
//     --draft "2026-07-03T01:00:00Z"
//
// Reads RESEND_API_KEY + EMAIL_RESEND_ENABLED from .env.local.

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_SCORING } from "../lib/scoring/index";
import { REPLAY_SEASON } from "../lib/constants";
import { sendBetaWelcome } from "../lib/services/email-service";

const prisma = new PrismaClient();

function pickRandomWeeks(total: number, count: number): number[] {
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).sort((a, b) => a - b);
}

function generateMagicLinkToken(expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + expiresInMs);
  return { rawToken, tokenHash, expiresAt };
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const name = get("--name") ?? "Beta League";
  const commissionerEmail = get("--commissioner");
  const draftIso = get("--draft");

  if (!commissionerEmail) {
    console.error("Usage: npx tsx scripts/create-beta-league.ts --commissioner <email> [--name <name>] [--draft <ISO>]");
    process.exit(1);
  }

  const draftStartsAt = draftIso ? new Date(draftIso) : (() => {
    // Default: 9pm ET tonight = 01:00 UTC tomorrow
    const d = new Date();
    d.setUTCHours(1, 0, 0, 0);
    if (d <= new Date()) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  })();

  console.log(`\nCreating beta league "${name}"`);
  console.log(`  Commissioner: ${commissionerEmail}`);
  console.log(`  Draft at:     ${draftStartsAt.toISOString()}`);

  const betaWeekIndices = pickRandomWeeks(20, 4);

  const scoringSettings = { ...DEFAULT_SCORING, betaWeekIndices };
  const playoffSettings = { teamsInPlayoff: 4, topSeedsWithBye: 0, higherSeedWinsTies: true, roundDurationPeriods: 1 };
  const rosterSettings = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };

  // Upsert commissioner.
  const commissioner = await prisma.user.upsert({
    where: { email: commissionerEmail.toLowerCase() },
    update: {},
    create: { email: commissionerEmail.toLowerCase(), displayName: commissionerEmail.split("@")[0] },
  });

  // Create league.
  const league = await prisma.fantasyLeague.create({
    data: {
      name,
      season: REPLAY_SEASON,
      maxTeams: 8,
      isReplay: true,
      betaStatus: "ACTIVE",
      scoringMode: "VTF",
      draftType: "SNAKE",
      commissionerId: commissioner.id,
      draftStartsAt,
      scoringSettings,
      rosterSettings,
      playoffSettings,
    },
  });

  console.log(`\n  League created: ${league.id}`);

  // Create 8 teams.
  for (let i = 0; i < 8; i++) {
    let ownerId: string;
    if (i === 0) {
      ownerId = commissioner.id;
    } else {
      const botEmail = `bot-${i + 1}-${league.id}@beta.pwhlgm.internal`;
      const bot = await prisma.user.upsert({
        where: { email: botEmail },
        update: {},
        create: { email: botEmail, displayName: `Slot ${i + 1}` },
      });
      ownerId = bot.id;
    }
    await prisma.fantasyTeam.create({
      data: {
        leagueId: league.id,
        name: `Team ${i + 1}`,
        draftOrder: i + 1,
        ownerId,
        isBot: i !== 0,
      },
    });
  }

  // Draft skeleton.
  await prisma.draft.create({
    data: { leagueId: league.id, status: "PENDING", currentPick: 1 },
  });

  // Magic link for commissioner (7-day expiry) — stored on the User row.
  const { rawToken, tokenHash, expiresAt } = generateMagicLinkToken();
  await prisma.user.update({
    where: { id: commissioner.id },
    data: { magicLinkToken: tokenHash, magicLinkExpiresAt: expiresAt },
  });

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://beta.fantasy.dykedb.org";
  const returnTo = `/league/${league.id}/admin`;
  const magicLinkUrl = `${APP_URL}/api/auth/verify?token=${rawToken}&returnTo=${encodeURIComponent(returnTo)}`;

  // Send welcome email.
  await sendBetaWelcome(commissionerEmail, commissioner.displayName, "commissioner", magicLinkUrl);

  console.log(`\n✓ Done!`);
  console.log(`  League ID:   ${league.id}`);
  console.log(`  Magic link:  ${magicLinkUrl}`);
  console.log(`  Email sent to ${commissionerEmail}`);
  console.log(`  Weeks:       ${betaWeekIndices.join(", ")}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
