// scripts/draft-cli.ts
// A terminal client for the draft server. Open one per team in separate terminals.
//
//   npm run draft-cli -- --league <leagueId> --team <teamId>
//   npm run draft-cli -- --league <leagueId> --team <teamId> --start   # commissioner
//
// Commands once connected:
//   list [search]   show available players (optionally filter by last name)
//   pick <playerId> draft a player (only works when you're on the clock)
//   start           start the draft (any client can send; usually commissioner)
//   state           reprint the current board
//   quit            disconnect

import WebSocket from "ws";
import * as readline from "node:readline";
import type {
  ClientMessage,
  ServerMessage,
  DraftState,
  PlayerSummary,
} from "../lib/draft/messages";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const leagueId = arg("--league");
const teamId = arg("--team");
const autoStart = process.argv.includes("--start");

if (!leagueId || !teamId) {
  console.error("Usage: --league <leagueId> --team <teamId> [--start]");
  process.exit(1);
}

const port = process.env.DRAFT_PORT ?? "8080";
const ws = new WebSocket(`ws://localhost:${port}?league=${leagueId}`);

let lastState: DraftState | null = null;
let lastAvailable: PlayerSummary[] = [];

const send = (m: ClientMessage) => ws.send(JSON.stringify(m));

function renderState(s: DraftState) {
  const onClock = s.order.find((o) => o.overall === s.currentOverall);
  const mine = onClock?.fantasyTeamId === teamId;
  const secsLeft =
    s.expiresAt != null ? Math.max(0, Math.round((s.expiresAt - Date.now()) / 1000)) : null;

  console.log("\n--------------------------------------------");
  console.log(`status: ${s.status}   pick ${s.currentOverall}/${s.order.length}`);
  if (s.status === "IN_PROGRESS") {
    console.log(
      `on the clock: ${onClock?.fantasyTeamId === teamId ? "YOU" : onClock?.fantasyTeamId}` +
        (secsLeft != null ? `   (${secsLeft}s left)` : "")
    );
    if (mine) console.log(">>> YOUR PICK — type: pick <playerId>  (or: list)");
  }
  const recent = s.completed.slice(-5);
  if (recent.length) {
    console.log("recent picks:");
    for (const p of recent) {
      console.log(
        `  #${p.overall} R${p.round}  team ${p.fantasyTeamId.slice(-6)}  player ${p.playerId.slice(-6)}${p.auto ? "  (auto)" : ""}`
      );
    }
  }
  console.log("--------------------------------------------");
}

function renderAvailable(players: PlayerSummary[]) {
  console.log("\navailable players:");
  for (const p of players) {
    console.log(`  ${p.id}  ${p.position.padEnd(7)} ${p.team ?? "FA"}  ${p.name}`);
  }
  console.log(`(${players.length} shown)\n`);
}

ws.on("open", () => {
  console.log(`Connected as team ${teamId.slice(-6)} in league ${leagueId.slice(-6)}.`);
  send({ type: "JOIN", fantasyTeamId: teamId });
  if (autoStart) {
    console.log("Starting draft...");
    send({ type: "START" });
  }
  prompt();
});

ws.on("message", (raw) => {
  let msg: ServerMessage;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  switch (msg.type) {
    case "STATE":
      lastState = msg.state;
      renderState(msg.state);
      break;
    case "PICK_MADE":
      lastState = msg.state;
      console.log(
        `\n*** pick #${msg.pick.overall}: team ${msg.pick.fantasyTeamId.slice(-6)} took player ${msg.pick.playerId.slice(-6)}${msg.pick.auto ? " (auto)" : ""} ***`
      );
      renderState(msg.state);
      break;
    case "AVAILABLE":
      lastAvailable = msg.players;
      renderAvailable(msg.players);
      break;
    case "ERROR":
      console.log(`\n[error: ${msg.code}] ${msg.message}`);
      break;
  }
  prompt();
});

ws.on("close", () => {
  console.log("Disconnected.");
  process.exit(0);
});
ws.on("error", (e) => {
  console.error("Socket error:", e.message);
  process.exit(1);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function prompt() {
  rl.question("> ", (line) => {
    const [cmd, ...rest] = line.trim().split(/\s+/);
    switch (cmd) {
      case "list":
        send({ type: "LIST_AVAILABLE", search: rest[0] });
        break;
      case "pick": {
        if (!lastState) {
          console.log("no state yet");
          break;
        }
        const playerId = rest[0];
        if (!playerId) {
          console.log("usage: pick <playerId>");
          break;
        }
        send({ type: "MAKE_PICK", overall: lastState.currentOverall, playerId });
        break;
      }
      case "start":
        send({ type: "START" });
        break;
      case "state":
        if (lastState) renderState(lastState);
        break;
      case "quit":
      case "exit":
        ws.close();
        return;
      case "":
        break;
      default:
        console.log("commands: list [search] | pick <playerId> | start | state | quit");
    }
    if (cmd !== "quit" && cmd !== "exit") prompt();
  });
}
