#!/usr/bin/env node

/**
 * Stress test for WebSocket reconnection.
 *
 * Spawns a single draft, makes 5 picks, then forcibly kills and reconnects
 * the socket 10 times, verifying that state is restored correctly each time.
 *
 * Usage:
 *   npx tsx scripts/stress-test-reconnect.ts [--ws ws://localhost:8080]
 */

import { WebSocket } from "ws";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateSnakeOrder, rostersToRounds } from "../lib/draft/snake";
import { DEFAULT_SCORING } from "../lib/scoring";
import type { ClientMessage, ServerMessage, DraftState } from "../lib/draft/messages";

const prisma = new PrismaClient();

interface Args {
  ws: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    ws: "ws://localhost:8080",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ws") {
      result.ws = args[i + 1]!;
      i++;
    }
  }

  return result;
}

const DEV_PASSWORD_HASH = bcrypt.hashSync("password", 10);
const ROSTER_SETTINGS = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };
const PICK_TIMER_SECS = 10;

interface ReconnectResult {
  attempt: number;
  reconnectMs: number;
  expectedOverall: number;
  actualOverall: number | null;
  passed: boolean;
}

async function seedDraftLeague(): Promise<{ leagueId: string; commissionerTeamId: string; otherTeamIds: string[] }> {
  const commissioner = await prisma.user.upsert({
    where: { email: "commish-stress@dev.local" },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: "commish-stress@dev.local",
      displayName: "Stress Commish",
      passwordHash: DEV_PASSWORD_HASH,
    },
  });

  const league = await prisma.fantasyLeague.create({
    data: {
      name: `Reconnect Stress Test ${Date.now()}`,
      maxTeams: 4,
      status: "PRE_DRAFT",
      commissionerId: commissioner.id,
      scoringSettings: DEFAULT_SCORING as object,
      rosterSettings: ROSTER_SETTINGS,
    },
  });

  const teams = [];
  for (let i = 1; i <= 4; i++) {
    const owner =
      i === 1
        ? commissioner
        : await prisma.user.upsert({
            where: { email: `owner-stress-${i}@dev.local` },
            update: { passwordHash: DEV_PASSWORD_HASH },
            create: {
              email: `owner-stress-${i}@dev.local`,
              displayName: `Owner ${i}`,
              passwordHash: DEV_PASSWORD_HASH,
            },
          });

    const team = await prisma.fantasyTeam.create({
      data: {
        name: `Team ${i}`,
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
    commissionerTeamId: teams[0].id,
    otherTeamIds: teams.slice(1).map((t) => t.id),
  };
}

async function sendMakePick(ws: WebSocket, overall: number, playerId: string): Promise<void> {
  return new Promise((resolve) => {
    const handler = (event: any) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === "PICK_MADE" || msg.type === "ERROR") {
          ws.removeEventListener("message", handler);
          resolve();
        }
      } catch {}
    };
    ws.addEventListener("message", handler as any);
    ws.send(JSON.stringify({ type: "MAKE_PICK", overall, playerId } satisfies ClientMessage));
  });
}

async function waitForState(ws: WebSocket): Promise<DraftState> {
  return new Promise((resolve) => {
    const handler = (event: any) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === "STATE") {
          ws.removeEventListener("message", handler);
          resolve(msg.state);
        }
      } catch {}
    };
    ws.addEventListener("message", handler as any);
    if (ws.readyState === WebSocket.OPEN) {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "JOIN", fantasyTeamId: "" } satisfies ClientMessage));
        }
      }, 100);
    }
  });
}

async function runStressTest() {
  const args = parseArgs();
  console.log(`\n🔄 WebSocket Reconnect Stress Test`);
  console.log(`   WS: ${args.ws}\n`);

  // Seed league
  console.log("🌱 Seeding test league...");
  const { leagueId, commissionerTeamId, otherTeamIds } = await seedDraftLeague();
  console.log(`✅ Seeded league ${leagueId.slice(-6)}\n`);

  // Connect commissioner and start draft
  console.log("🔌 Starting draft...");
  let draftState: DraftState | null = null;
  const commissionerWs = new WebSocket(`${args.ws}?league=${leagueId}`);

  await new Promise<void>((resolve) => {
    commissionerWs.onopen = () => {
      commissionerWs.send(
        JSON.stringify({ type: "JOIN", fantasyTeamId: commissionerTeamId } satisfies ClientMessage)
      );
    };
    commissionerWs.onmessage = ((event: any) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === "STATE" && msg.state.status === "PENDING") {
          draftState = msg.state;
          commissionerWs.send(JSON.stringify({ type: "START" } satisfies ClientMessage));
          resolve();
        }
      } catch {}
    }) as any;
  });

  // Connect other teams and have them pick once each to advance currentOverall
  console.log("🎯 Making initial picks...");
  const otherWss = [];
  for (let i = 0; i < otherTeamIds.length; i++) {
    const ws = new WebSocket(`${args.ws}?league=${leagueId}`);
    otherWss.push(ws);

    await new Promise<void>((resolve) => {
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "JOIN", fantasyTeamId: otherTeamIds[i] } satisfies ClientMessage));
      };
      ws.onmessage = ((event: any) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          if (msg.type === "STATE" && msg.state.status === "IN_PROGRESS") {
            draftState = msg.state;
            const onClockSlot = msg.state.order.find((s) => s.overall === msg.state.currentOverall);
            if (onClockSlot?.fantasyTeamId === otherTeamIds[i]) {
              ws.send(JSON.stringify({ type: "LIST_AVAILABLE" } satisfies ClientMessage));
            }
            resolve();
          } else if (msg.type === "AVAILABLE" && msg.players.length > 0 && draftState) {
            const onClockSlot = draftState!.order.find((s) => s.overall === draftState!.currentOverall);
            if (onClockSlot?.fantasyTeamId === otherTeamIds[i]) {
              ws.send(
                JSON.stringify({
                  type: "MAKE_PICK",
                  overall: draftState!.currentOverall,
                  playerId: msg.players[0].id,
                } satisfies ClientMessage)
              );
            }
          }
        } catch {}
      }) as any;
    });
  }
  console.log(`✅ Draft started, currentOverall = ${(draftState as any)?.currentOverall}\n`);

  // Stress test: reconnect 10 times on commissioner socket
  console.log("⚡ Reconnect stress test (10 cycles)...\n");
  const results: ReconnectResult[] = [];

  for (let attempt = 1; attempt <= 10; attempt++) {
    const expectedOverall = (draftState as any)?.currentOverall || attempt + 1;

    // Kill socket
    const killStart = Date.now();
    commissionerWs.close();
    await new Promise((r) => setTimeout(r, 100)); // brief pause

    // Reconnect
    const reconnectStart = Date.now();
    const newWs = new WebSocket(`${args.ws}?league=${leagueId}`);

    const result: ReconnectResult = {
      attempt,
      reconnectMs: 0,
      expectedOverall,
      actualOverall: null,
      passed: false,
    };

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Reconnect timeout"));
        }, 5000);

        newWs.onopen = () => {
          newWs.send(
            JSON.stringify({ type: "JOIN", fantasyTeamId: commissionerTeamId } satisfies ClientMessage)
          );
        };

        newWs.onmessage = ((event: any) => {
          try {
            const msg = JSON.parse(event.data as string) as ServerMessage;
            if (msg.type === "STATE") {
              clearTimeout(timeout);
              result.reconnectMs = Date.now() - reconnectStart;
              result.actualOverall = msg.state.currentOverall;
              draftState = msg.state;

              result.passed =
                msg.state.currentOverall === expectedOverall &&
                result.reconnectMs < 500;

              newWs.close();
              setTimeout(() => resolve(), 100);
            }
          } catch {}
        }) as any;

        newWs.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("WebSocket error"));
        };
      });
    } catch (e) {
      result.passed = false;
    }

    results.push(result);

    const status = result.passed ? "✓" : "✗";
    const speedMs = result.reconnectMs;
    console.log(
      `  ${status} Attempt ${attempt}/10: ${speedMs}ms, overall ${result.actualOverall}/${result.expectedOverall}`
    );
  }

  // Clean up
  commissionerWs.close();
  for (const ws of otherWss) ws.close();

  // Report
  console.log("\n" + "=".repeat(50));
  const passed = results.every((r) => r.passed);
  const avgReconnectMs = Math.round(results.reduce((a, r) => a + r.reconnectMs, 0) / results.length);

  if (passed) {
    console.log(`✅ All reconnects passed`);
    console.log(`   Average reconnect time: ${avgReconnectMs}ms`);
    process.exit(0);
  } else {
    console.log(`❌ Reconnect stress test failed`);
    const failed = results.filter((r) => !r.passed);
    console.log(`   ${failed.length} failures:`);
    for (const r of failed) {
      console.log(`     Attempt ${r.attempt}: overall mismatch or timeout`);
    }
    process.exit(1);
  }
}

runStressTest()
  .catch((e) => {
    console.error("Test error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
