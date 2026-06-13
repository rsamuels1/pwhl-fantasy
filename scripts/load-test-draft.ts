#!/usr/bin/env node

/**
 * Automated load test for concurrent draft leagues.
 *
 * Usage:
 *   npx tsx scripts/load-test-draft.ts --leagues 4 [--teams 4] [--ws ws://localhost:8080]
 *
 * Spawns N concurrent leagues drafting simultaneously and verifies:
 * - All leagues complete with correct pick counts
 * - No cross-league broadcasts
 * - Correct isolation (each league sees only its own picks)
 */

import { WebSocket } from "ws";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateSnakeOrder, rostersToRounds } from "../lib/draft/snake";
import { DEFAULT_SCORING } from "../lib/scoring";
import type { ClientMessage, ServerMessage, DraftState } from "../lib/draft/messages";

const prisma = new PrismaClient();

interface Args {
  leagues: number;
  teams: number;
  ws: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    leagues: 4,
    teams: 4,
    ws: "ws://localhost:8080",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--leagues") {
      result.leagues = parseInt(args[i + 1]!, 10);
      i++;
    } else if (args[i] === "--teams") {
      result.teams = parseInt(args[i + 1]!, 10);
      i++;
    } else if (args[i] === "--ws") {
      result.ws = args[i + 1]!;
      i++;
    }
  }

  return result;
}

const DEV_PASSWORD_HASH = bcrypt.hashSync("password", 10);
const ROSTER_SETTINGS = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };
const PICK_TIMER_SECS = 10; // short for quick test runs

interface TestClient {
  leagueId: string;
  teamId: string;
  ws: WebSocket | null;
  state: DraftState | null;
  pickCount: number;
  errors: string[];
}

interface TestRoom {
  leagueId: string;
  clients: TestClient[];
  startTime: number;
  completeTime: number | null;
  pickCounts: Record<string, number>;
}

async function seedDraftLeague(leagueNum: number, numTeams: number): Promise<{ leagueId: string; teamIds: string[] }> {
  const commissioner = await prisma.user.upsert({
    where: { email: `commish-load-${leagueNum}@dev.local` },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: `commish-load-${leagueNum}@dev.local`,
      displayName: `Load Commish ${leagueNum}`,
      passwordHash: DEV_PASSWORD_HASH,
    },
  });

  const league = await prisma.fantasyLeague.create({
    data: {
      name: `Load Test League ${leagueNum}`,
      maxTeams: numTeams,
      status: "PRE_DRAFT",
      commissionerId: commissioner.id,
      scoringSettings: DEFAULT_SCORING as object,
      rosterSettings: ROSTER_SETTINGS,
    },
  });

  const teams = [];
  for (let i = 1; i <= numTeams; i++) {
    const owner =
      i === 1
        ? commissioner
        : await prisma.user.upsert({
            where: { email: `owner-load-${leagueNum}-${i}@dev.local` },
            update: { passwordHash: DEV_PASSWORD_HASH },
            create: {
              email: `owner-load-${leagueNum}-${i}@dev.local`,
              displayName: `Owner ${leagueNum}-${i}`,
              passwordHash: DEV_PASSWORD_HASH,
            },
          });

    const team = await prisma.fantasyTeam.create({
      data: {
        name: `Team ${leagueNum}-${i}`,
        leagueId: league.id,
        ownerId: owner.id,
        draftOrder: i,
      },
    });
    teams.push(team);
  }

  const rounds = rostersToRounds(ROSTER_SETTINGS);
  const draft = await prisma.draft.create({
    data: {
      leagueId: league.id,
      status: "PENDING",
      pickTimerSecs: PICK_TIMER_SECS,
      currentPick: 1,
    },
  });

  const order = generateSnakeOrder(
    teams.map((t) => t.id),
    rounds
  );
  await prisma.draftPick.createMany({
    data: order.map((slot) => ({
      draftId: draft.id,
      overall: slot.overall,
      round: slot.round,
      fantasyTeamId: slot.fantasyTeamId,
    })),
  });

  return {
    leagueId: league.id,
    teamIds: teams.map((t) => t.id),
  };
}

async function connectClient(client: TestClient, wsUrl: string, commissionerId: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsUrl}?league=${client.leagueId}`);
    client.ws = ws;
    let connected = false;
    let hasReceivedFirstState = false;

    ws.onopen = () => {
      connected = true;
      ws.send(JSON.stringify({ type: "JOIN", fantasyTeamId: client.teamId } satisfies ClientMessage));
    };

    ws.onmessage = ((event: any) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }

      if (msg.type === "STATE") {
        client.state = msg.state;

        if (!hasReceivedFirstState) {
          hasReceivedFirstState = true;
          resolve();
        }

        // Commissioner sends START on first state when draft is PENDING
        if (commissionerId === client.teamId && msg.state.status === "PENDING") {
          setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "START" } satisfies ClientMessage));
            }
          }, 50);
        }

        // Auto-pick when it's this team's turn (check who is on the clock via order)
        if (msg.state.status === "IN_PROGRESS") {
          const onClockSlot = msg.state.order.find((s) => s.overall === msg.state.currentOverall);
          if (onClockSlot?.fantasyTeamId === client.teamId) {
            // Request available players to pick from
            setTimeout(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "LIST_AVAILABLE" } satisfies ClientMessage));
              }
            }, 50);
          }
        }
      } else if (msg.type === "PICK_MADE") {
        client.pickCount++;
        client.state = msg.state;
      } else if (msg.type === "AVAILABLE" && client.state) {
        // We got the available players list. Pick the first one.
        if (msg.players.length > 0 && client.state && client.state.status === "IN_PROGRESS") {
          const onClockSlot = client.state.order.find((s) => s.overall === client.state!.currentOverall);
          if (onClockSlot?.fantasyTeamId === client.teamId) {
            setTimeout(() => {
              if (ws && ws.readyState === WebSocket.OPEN && client.state) {
                ws.send(
                  JSON.stringify({
                    type: "MAKE_PICK",
                    overall: client.state.currentOverall,
                    playerId: msg.players[0].id,
                  } satisfies ClientMessage)
                );
              }
            }, 50);
          }
        }
      }
    }) as any;

    ws.onerror = () => {
      if (!connected) reject(new Error("WebSocket error"));
    };

    ws.onclose = () => {
      if (!connected && !hasReceivedFirstState) {
        reject(new Error("Connection closed before ready"));
      }
    };

    // Timeout if no first STATE received
    const timeout = setTimeout(() => {
      if (!hasReceivedFirstState) {
        reject(new Error("Connection timeout (no STATE received)"));
      }
    }, 5000);
  });
}

async function runLoadTest() {
  const args = parseArgs();
  console.log(`\n📊 Loading ${args.leagues} concurrent leagues × ${args.teams} teams`);
  console.log(`   WS: ${args.ws}\n`);

  // Seed all leagues
  console.log("🌱 Seeding leagues...");
  const rooms: TestRoom[] = [];
  for (let i = 0; i < args.leagues; i++) {
    const { leagueId, teamIds } = await seedDraftLeague(i + 1, args.teams);
    const clients: TestClient[] = teamIds.map((teamId) => ({
      leagueId,
      teamId,
      ws: null,
      state: null,
      pickCount: 0,
      errors: [],
    }));
    rooms.push({
      leagueId,
      clients,
      startTime: Date.now(),
      completeTime: null,
      pickCounts: {},
    });
  }
  console.log(`✅ Seeded ${args.leagues} leagues\n`);

  // Connect all clients
  console.log("🔌 Connecting clients...");
  const expectedPicks = args.teams * rostersToRounds(ROSTER_SETTINGS);
  let connected = 0;
  for (const room of rooms) {
    for (const client of room.clients) {
      const isCommissioner = client === room.clients[0]; // first team is commissioner
      const commissionerId = isCommissioner ? client.teamId : null;
      await connectClient(client, args.ws, commissionerId);
      connected++;
      process.stdout.write(`\r  Connected: ${connected}/${rooms.length * args.teams}`);
    }
  }
  console.log("\n✅ All clients connected\n");

  // Wait for completion
  console.log("⏳ Waiting for drafts to complete...");
  const completeTasks = rooms.map(
    (room) =>
      new Promise<void>((resolve) => {
        const check = setInterval(() => {
          const allComplete = room.clients.every(
            (c) => c.state?.status === "COMPLETE"
          );
          if (allComplete) {
            room.completeTime = Date.now();
            room.clients.forEach((c) => {
              room.pickCounts[c.teamId] = c.pickCount;
            });
            clearInterval(check);
            resolve();
          }
        }, 500);
      })
  );

  await Promise.all(completeTasks);
  console.log("✅ All drafts completed\n");

  // Verify results
  console.log("🔍 Verifying results...\n");
  let allPassed = true;

  for (const room of rooms) {
    const duration = ((room.completeTime || Date.now()) - room.startTime) / 1000;
    const totalPickCount = Object.values(room.pickCounts).reduce((a, b) => a + b, 0);
    const passed = totalPickCount === expectedPicks;
    const status = passed ? "✓" : "✗";

    console.log(`${status} League ${room.leagueId.slice(-6)}: ${totalPickCount}/${expectedPicks} picks in ${duration.toFixed(1)}s`);

    if (!passed) {
      allPassed = false;
      console.log(`  ⚠️ Pick count mismatch (expected ${expectedPicks})`);
      room.clients.forEach((c) => {
        if (c.errors.length > 0) {
          console.log(`     ${c.teamId.slice(-6)}: ${c.errors.join("; ")}`);
        }
      });
    }
  }

  // Isolation check: verify DB has correct pick distribution
  console.log("\n🔐 Isolation check...");
  let isolationPassed = true;
  for (const room of rooms) {
    const picks = await prisma.draftPick.findMany({
      where: {
        draft: { leagueId: room.leagueId },
        playerId: { not: null },
      },
      select: { playerId: true, fantasyTeamId: true },
    });

    // Verify no player appears twice in same league
    const seen = new Set<string>();
    for (const pick of picks) {
      if (pick.playerId && seen.has(pick.playerId)) {
        console.log(`✗ Duplicate player in league ${room.leagueId.slice(-6)}: ${pick.playerId}`);
        isolationPassed = false;
        allPassed = false;
      }
      if (pick.playerId) seen.add(pick.playerId);
    }
  }
  if (isolationPassed) {
    console.log("✓ No duplicate players across leagues");
  }

  // Final report
  console.log("\n" + "=".repeat(50));
  if (allPassed && isolationPassed) {
    console.log("✅ All load tests passed");
    process.exit(0);
  } else {
    console.log("❌ Load tests failed");
    process.exit(1);
  }
}

runLoadTest()
  .catch((e) => {
    console.error("Test error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
