#!/usr/bin/env npx tsx
// Competitive draft agents for the beta test league.
// Connects one WebSocket agent per team (2-8), each with a distinct pick strategy.
// Run: npx tsx scripts/draft-agents.ts

import WebSocket from "ws";
import { PrismaClient } from "@prisma/client";

const LEAGUE_ID = "cmr45zdl70002zzjls64zcz9k";
const WS_URL = process.env.NEXT_PUBLIC_DRAFT_WS_URL ?? "wss://pwhl-draft-server.onrender.com";
const ROSTER_SETTINGS = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };

// Players reserved for the human (Team 1) — agents will never pick these
const RESERVED_FOR_HUMAN = new Set([
  "cmqeagrdw001512fpbj4qs57v", // Hilary Knight
]);

// Teams 2-8 (Team 1 is the human commissioner)
const AGENT_TEAMS = [
  { id: "cmr45zdyt0007zzjliu3rqj4a", name: "Team 2", strategy: "bpa" },
  { id: "cmr45ze6e000azzjlxfqu0nsn", name: "Team 3", strategy: "forward-heavy" },
  { id: "cmr45zee5000dzzjljhqji1yi", name: "Team 4", strategy: "bpa" },
  { id: "cmr45zelo000gzzjl9yhx4pp0", name: "Team 5", strategy: "goalie-early" },
  { id: "cmr45zet4000jzzjlg13o3epr", name: "Team 6", strategy: "defense-heavy" },
  { id: "cmr45zf0n000mzzjloka8gpow", name: "Team 7", strategy: "bpa" },
  { id: "cmr45zf86000pzzjlsv2lo9us", name: "Team 8", strategy: "forward-heavy" },
];

interface PlayerStats {
  id: string;
  position: "FORWARD" | "DEFENSE" | "GOALIE";
  fp: number; // season fantasy points proxy
}

// Load all player FP rankings once from the DB
async function loadPlayerRankings(prisma: PrismaClient): Promise<PlayerStats[]> {
  const players = await prisma.player.findMany({
    where: { active: true },
    select: {
      id: true,
      position: true,
      statLines: {
        where: { game: { season: "2025-26" } },
        select: {
          goals: true, assists: true, win: true, shutout: true,
          saves: true, goalsAgainst: true, powerPlayPts: true,
          shots: true, hits: true, blocks: true,
        },
      },
    },
  });

  return players.map((p) => {
    // Use actual scoring weights from the default scoring settings
    const fp = p.statLines.reduce((sum, sl) => {
      return sum
        + (sl.goals ?? 0) * 3
        + (sl.assists ?? 0) * 2
        + (sl.powerPlayPts ?? 0) * 0.5
        + (sl.shots ?? 0) * 0.5
        + (sl.hits ?? 0) * 0.25
        + (sl.blocks ?? 0) * 0.25
        + (sl.win ? 4 : 0)
        + (sl.shutout ? 3 : 0)
        + (sl.saves ?? 0) * 0.2
        + (sl.goalsAgainst ?? 0) * -1;
    }, 0);
    return { id: p.id, position: p.position as PlayerStats["position"], fp };
  });
}

// Given a team's current picks, figure out what slots still need filling
function needsForPicks(
  pickedPositions: Array<"FORWARD" | "DEFENSE" | "GOALIE">
): { forward: number; defense: number; goalie: number; util: number; bench: number } {
  const filled = { forward: 0, defense: 0, goalie: 0, util: 0, bench: 0 };
  for (const pos of pickedPositions) {
    if (pos === "FORWARD" && filled.forward < ROSTER_SETTINGS.forward) filled.forward++;
    else if (pos === "DEFENSE" && filled.defense < ROSTER_SETTINGS.defense) filled.defense++;
    else if (pos === "GOALIE" && filled.goalie < ROSTER_SETTINGS.goalie) filled.goalie++;
    else if (pos !== "GOALIE" && filled.util < ROSTER_SETTINGS.util) filled.util++;
    else filled.bench++;
  }
  return {
    forward: ROSTER_SETTINGS.forward - filled.forward,
    defense: ROSTER_SETTINGS.defense - filled.defense,
    goalie: ROSTER_SETTINGS.goalie - filled.goalie,
    util: ROSTER_SETTINGS.util - filled.util,
    bench: ROSTER_SETTINGS.bench - filled.bench,
  };
}

// Pick the best available player given strategy and roster needs
function selectPlayer(
  available: Array<{ id: string; position: "FORWARD" | "DEFENSE" | "GOALIE" }>,
  myPicks: Array<{ position: "FORWARD" | "DEFENSE" | "GOALIE" }>,
  rankings: PlayerStats[],
  strategy: string,
  pickNumber: number // which pick we're on (1 = round 1, etc.)
): string | null {
  const rankMap = new Map(rankings.map((r) => [r.id, r]));
  const needs = needsForPicks(myPicks.map((p) => p.position));
  const totalPicks = myPicks.length;

  // Score each available player
  const scored = available
    .filter((p) => !RESERVED_FOR_HUMAN.has(p.id))
    .map((p) => {
    const rank = rankMap.get(p.id);
    const baseFp = rank?.fp ?? 0;
    let score = baseFp;

    // Positional urgency: boost players at positions still needed for starting slots
    const isGoalieNeeded = needs.goalie > 0;
    const isDefenseNeeded = needs.defense > 0;
    const isForwardNeeded = needs.forward > 0 || needs.util > 0;

    // Never take a second goalie — heavy penalty once the G slot is filled
    const alreadyHaveGoalie = myPicks.some((mp) => mp.position === "GOALIE");
    if (p.position === "GOALIE" && alreadyHaveGoalie) {
      score -= 9999;
    }

    // Strategy-specific boosts
    if (strategy === "goalie-early" && p.position === "GOALIE" && !alreadyHaveGoalie && totalPicks < 4) {
      score += 500; // grab top goalie in round 1-2
    } else if (strategy === "defense-heavy" && p.position === "DEFENSE" && needs.defense > 0) {
      score += 150;
    } else if (strategy === "forward-heavy" && p.position === "FORWARD" && needs.forward > 0) {
      score += 100;
    }

    // Late-draft urgency: fill remaining starting slots
    if (totalPicks >= 8 && p.position === "GOALIE" && isGoalieNeeded) score += 800;
    else if (totalPicks >= 10 && p.position === "DEFENSE" && isDefenseNeeded) score += 400;
    else if (p.position === "GOALIE" && isGoalieNeeded && totalPicks >= 5) score += 300;

    return { ...p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.id ?? null;
}

interface DraftState {
  status: string;
  currentOverall: number;
  order: Array<{ overall: number; fantasyTeamId: string }>;
  completed: Array<{ overall: number; fantasyTeamId: string; playerId: string }>;
  draftedPlayerIds: string[];
}

class DraftAgent {
  private ws: WebSocket | null = null;
  private rankings: PlayerStats[] = [];
  private pendingAvailableResolve: ((players: Array<{ id: string; position: "FORWARD" | "DEFENSE" | "GOALIE" }>) => void) | null = null;
  private picking = false;
  private reconnectDelay = 1000;

  constructor(
    private readonly teamId: string,
    private readonly teamName: string,
    private readonly strategy: string,
    private readonly allRankings: PlayerStats[],
    private readonly playerPositions: Map<string, "FORWARD" | "DEFENSE" | "GOALIE">
  ) {
    this.rankings = allRankings;
  }

  connect() {
    const url = `${WS_URL}?league=${LEAGUE_ID}`;
    console.log(`[${this.teamName}] Connecting to ${url}`);
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      console.log(`[${this.teamName}] Connected, joining...`);
      this.reconnectDelay = 1000;
      this.send({ type: "JOIN", fantasyTeamId: this.teamId });
    });

    this.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(msg);
      } catch {}
    });

    this.ws.on("close", (code, reason) => {
      console.log(`[${this.teamName}] Disconnected (${code}): ${reason}. Reconnecting in ${this.reconnectDelay}ms...`);
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 15000);
    });

    this.ws.on("error", (err) => {
      console.error(`[${this.teamName}] WS error:`, err.message);
    });
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: { type: string; state?: DraftState; players?: Array<{ id: string; position: "FORWARD" | "DEFENSE" | "GOALIE" }>; pick?: object; code?: string; message?: string }) {
    if (msg.type === "AVAILABLE" && this.pendingAvailableResolve) {
      this.pendingAvailableResolve(msg.players ?? []);
      this.pendingAvailableResolve = null;
      return;
    }

    if (msg.type === "STATE" || msg.type === "PICK_MADE") {
      const state = msg.state;
      if (!state) return;
      void this.onState(state);
    }

    if (msg.type === "ERROR") {
      console.error(`[${this.teamName}] Error: ${msg.code} — ${msg.message}`);
      this.picking = false;
    }
  }

  private async onState(state: DraftState) {
    if (state.status !== "IN_PROGRESS") return;
    if (this.picking) return;

    const slot = state.order[state.currentOverall - 1];
    if (!slot || slot.fantasyTeamId !== this.teamId) return;

    this.picking = true;

    // Small human-like delay (0.5–2s) before picking
    const delay = 500 + Math.random() * 1500;
    await new Promise((r) => setTimeout(r, delay));

    try {
      // Request available players from server
      const available = await this.getAvailable();

      // Figure out which players I've already picked
      const myCompletedPicks = state.completed
        .filter((c) => c.fantasyTeamId === this.teamId)
        .map((c) => ({ position: this.playerPositions.get(c.playerId) ?? "FORWARD" as const }));

      const playerId = selectPlayer(available, myCompletedPicks, this.rankings, this.strategy, myCompletedPicks.length + 1);

      if (!playerId) {
        console.error(`[${this.teamName}] No player to pick!`);
        return;
      }

      const playerRank = this.rankings.find((r) => r.id === playerId);
      console.log(`[${this.teamName}] Pick ${state.currentOverall}: ${playerId} (${playerRank?.position ?? "?"}, ${playerRank?.fp?.toFixed(1) ?? "?"} FP)`);

      this.send({ type: "MAKE_PICK", overall: state.currentOverall, playerId });
    } finally {
      // Reset after a short window to allow PICK_MADE to arrive
      setTimeout(() => { this.picking = false; }, 2000);
    }
  }

  private getAvailable(): Promise<Array<{ id: string; position: "FORWARD" | "DEFENSE" | "GOALIE" }>> {
    return new Promise((resolve) => {
      this.pendingAvailableResolve = resolve;
      this.send({ type: "LIST_AVAILABLE" });
      // Timeout safety: if AVAILABLE never arrives, resolve with empty
      setTimeout(() => {
        if (this.pendingAvailableResolve) {
          this.pendingAvailableResolve = null;
          resolve([]);
        }
      }, 5000);
    });
  }
}

async function main() {
  const prisma = new PrismaClient();
  console.log("Loading player rankings from DB...");
  const rankings = await loadPlayerRankings(prisma);
  console.log(`Loaded ${rankings.length} players.`);

  // Build position lookup map
  const playerPositions = new Map<string, "FORWARD" | "DEFENSE" | "GOALIE">();
  for (const r of rankings) playerPositions.set(r.id, r.position);

  await prisma.$disconnect();

  // Connect all agents
  for (const team of AGENT_TEAMS) {
    const agent = new DraftAgent(team.id, team.name, team.strategy, rankings, playerPositions);
    agent.connect();
    // Stagger connections slightly
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("\nAll agents connected. They will pick when it's their turn.");
  console.log("Press Ctrl+C to stop.\n");

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\nShutting down agents...");
    process.exit(0);
  });
}

main().catch(console.error);
