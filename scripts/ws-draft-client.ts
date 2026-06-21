// scripts/ws-draft-client.ts
// Non-interactive WebSocket draft participant for automated agent testing.
// Unlike draft-cli.ts this runs headlessly — it picks automatically when
// it's on the clock and exits cleanly when the draft completes.
//
// Usage:
//   npx tsx scripts/ws-draft-client.ts \
//     --league <leagueId> \
//     --team <teamId> \
//     [--start]              # send START after joining (commissioner only)
//     [--picks "id1,id2,…"]  # preferred player IDs in priority order
//
// Pick resolution order:
//   1. First un-drafted player from --picks list
//   2. First player returned by LIST_AVAILABLE (server's best-available ranking)
//
// All confusion entries (errors, unexpected states) print to stderr
// and are summarised at exit.

import WebSocket from "ws";
import type {
  ClientMessage,
  ServerMessage,
  DraftState,
  PlayerSummary,
} from "../lib/draft/messages";

// ---- Args ----------------------------------------------------------------

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const leagueId = arg("--league");
const teamId = arg("--team");
const autoStart = process.argv.includes("--start");
const picksArg = arg("--picks") ?? "";
const preferredPicks = picksArg
  ? picksArg.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

if (!leagueId || !teamId) {
  console.error(
    "Usage: --league <leagueId> --team <teamId> [--start] [--picks 'id1,id2,...']"
  );
  process.exit(1);
}

// ---- State ---------------------------------------------------------------

const port = process.env.DRAFT_PORT ?? "8080";
const ws = new WebSocket(`ws://localhost:${port}?league=${leagueId}`);

let state: DraftState | null = null;
let awaitingAvailable = false; // we sent LIST_AVAILABLE and are waiting for AVAILABLE
let myPickCount = 0;
const confusionLog: string[] = [];

// ---- Helpers -------------------------------------------------------------

const tag = `agent:${teamId.slice(-6)}`;

function log(msg: string) {
  console.log(`[${tag}] ${msg}`);
}

function confused(what: string, expected: string, got: string) {
  const entry = `[CONFUSED] ${what} | expected: ${expected} | got: ${got}`;
  confusionLog.push(entry);
  console.error(entry);
}

function send(m: ClientMessage) {
  ws.send(JSON.stringify(m));
}

function isMyTurn(s: DraftState): boolean {
  return s.order.find((o) => o.overall === s.currentOverall)?.fantasyTeamId === teamId;
}

function firstUndraftedPreferred(draftedIds: string[]): string | null {
  for (const id of preferredPicks) {
    if (!draftedIds.includes(id)) return id;
  }
  return null;
}

// ---- Pick logic ----------------------------------------------------------

function tryPick(available?: PlayerSummary[]) {
  if (!state || !isMyTurn(state) || state.status !== "IN_PROGRESS") return;

  // Preferred list first
  const preferred = firstUndraftedPreferred(state.draftedPlayerIds);
  if (preferred) {
    log(
      `picking preferred ${preferred.slice(-6)} at overall #${state.currentOverall}`
    );
    send({ type: "MAKE_PICK", overall: state.currentOverall, playerId: preferred });
    myPickCount++;
    return;
  }

  // Need the server's available list to fall back to best-available
  if (!available) {
    if (!awaitingAvailable) {
      log(
        `preferred list exhausted — requesting available players for pick #${state.currentOverall}`
      );
      awaitingAvailable = true;
      send({ type: "LIST_AVAILABLE" });
    }
    return;
  }

  const best = available[0];
  if (best) {
    log(
      `picking best available ${best.id.slice(-6)} (${best.name}) at overall #${state.currentOverall}`
    );
    send({ type: "MAKE_PICK", overall: state.currentOverall, playerId: best.id });
    myPickCount++;
  } else {
    confused(
      `pick #${state.currentOverall} — no players available`,
      "at least one player in LIST_AVAILABLE response",
      "empty array"
    );
  }
}

// ---- WebSocket events ----------------------------------------------------

ws.on("open", () => {
  log(`connected to league ${leagueId!.slice(-6)}`);
  send({ type: "JOIN", fantasyTeamId: teamId! });
  if (preferredPicks.length > 0) {
    log(`queuing ${preferredPicks.length} preferred picks`);
    send({ type: "SET_QUEUE", playerIds: preferredPicks });
  }
  if (autoStart) {
    log("sending START (commissioner)");
    send({ type: "START" });
  }
});

ws.on("message", (raw) => {
  let msg: ServerMessage;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    confused(
      "WebSocket message parse",
      "valid JSON",
      raw.toString().slice(0, 120)
    );
    return;
  }

  switch (msg.type) {
    case "STATE": {
      state = msg.state;

      if (msg.state.status === "COMPLETE") {
        log(`draft complete — made ${myPickCount} picks`);
        printSummaryAndExit();
        return;
      }

      if (msg.state.status === "IN_PROGRESS" && isMyTurn(msg.state)) {
        const secsLeft =
          msg.state.expiresAt != null
            ? Math.round((msg.state.expiresAt - Date.now()) / 1000)
            : null;
        log(
          `on the clock — pick #${msg.state.currentOverall}` +
            (secsLeft != null ? ` (${secsLeft}s remaining)` : "")
        );
        awaitingAvailable = false;
        tryPick();
      }
      break;
    }

    case "PICK_MADE": {
      state = msg.state;
      const p = msg.pick;
      const mine = p.fantasyTeamId === teamId;
      log(
        `pick #${p.overall}: team ${p.fantasyTeamId.slice(-6)} → player ${p.playerId.slice(-6)}` +
          (p.auto ? " (auto)" : "") +
          (mine ? " ← MINE" : "")
      );

      if (msg.state.status === "COMPLETE") {
        log(`draft complete — made ${myPickCount} picks`);
        printSummaryAndExit();
        return;
      }

      if (isMyTurn(msg.state)) {
        awaitingAvailable = false;
        tryPick();
      }
      break;
    }

    case "AVAILABLE": {
      if (!awaitingAvailable) return; // unsolicited; ignore
      awaitingAvailable = false;
      if (state && isMyTurn(state)) tryPick(msg.players);
      break;
    }

    case "ERROR": {
      confused(
        `server error at pick #${state?.currentOverall ?? "?"}`,
        "success",
        `${msg.code}: ${msg.message}`
      );
      // If our overall was stale, re-try with the current state
      if (msg.code === "STALE_PICK" && state && isMyTurn(state)) {
        log("stale pick — retrying with current overall");
        awaitingAvailable = false;
        tryPick();
      }
      break;
    }
  }
});

ws.on("close", () => {
  log("disconnected");
  printSummaryAndExit();
});

ws.on("error", (e) => {
  console.error(`[${tag}] socket error: ${e.message}`);
  process.exit(1);
});

// ---- Exit summary --------------------------------------------------------

function printSummaryAndExit() {
  log("=== DRAFT SUMMARY ===");
  log(`Picks made by this agent: ${myPickCount}`);

  if (state) {
    const mine = state.completed.filter((p) => p.fantasyTeamId === teamId);
    for (const p of mine) {
      log(`  #${p.overall} R${p.round}: player ${p.playerId.slice(-6)}${p.auto ? " (AUTO)" : ""}`);
    }
    const autoCount = state.completed.filter((p) => p.auto).length;
    const totalPicks = state.completed.length;
    log(`Total picks so far: ${totalPicks} (${autoCount} auto-picked by server)`);
  }

  if (confusionLog.length > 0) {
    console.error(`\n=== CONFUSION LOG (${confusionLog.length} entries) ===`);
    for (const entry of confusionLog) console.error(entry);
  } else {
    log("CONFUSION LOG: clean — no errors encountered");
  }

  ws.terminate();
  process.exit(0);
}
