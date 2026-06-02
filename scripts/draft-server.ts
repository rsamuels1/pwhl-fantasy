// scripts/draft-server.ts
// Starts the draft websocket server for local development.
//   npm run draft-server
// Then connect clients to ws://localhost:8080?league=<leagueId>.
//
// To run a full local draft you need a league in the DB with: a Draft row,
// FantasyTeams that have draftOrder set (1..N), and rosterSettings on the league
// summing to the number of rounds. See scripts/seed-draft.ts (build next) to
// create a throwaway league against the mock players.

import { startDraftServer } from "../lib/draft/server";

const port = Number(process.env.DRAFT_PORT ?? 8080);
startDraftServer(port);
