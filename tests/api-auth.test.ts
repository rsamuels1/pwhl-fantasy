// tests/api-auth.test.ts
// Smoke tests verifying that API route auth guards return the correct HTTP
// status codes for unauthenticated and unauthorized callers.
//
// Pattern: mock @/lib/db to control what prisma returns, then call the route
// handler directly with a synthetic NextRequest. No DB required.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Prisma mock ───────────────────────────────────────────────────────────────

// Single mock instance shared across tests; individual tests override as needed.
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  fantasyTeam: {
    findFirst: vi.fn(),
  },
  fantasyLeague: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(opts: {
  url?: string;
  method?: string;
  sessionToken?: string;
  body?: unknown;
}): NextRequest {
  const url = opts.url ?? "http://localhost/api/test";
  const req = new NextRequest(url, {
    method: opts.method ?? "GET",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    headers: opts.body ? { "content-type": "application/json" } : undefined,
  });
  if (opts.sessionToken) {
    req.cookies.set("pwhl_session", opts.sessionToken);
  }
  return req;
}

const FAKE_USER = { id: "user-1", email: "test@example.com", displayName: "Test User" };
const FAKE_TEAM = { id: "team-1", leagueId: "league-1", ownerId: "user-1" };
const FAKE_LEAGUE = { id: "league-1", commissionerId: "user-1", playoffStatus: "NOT_STARTED" };
const LEAGUE_ID = "league-1";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no user (unauthenticated)
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.fantasyTeam.findFirst.mockResolvedValue(null);
  mockPrisma.fantasyLeague.findUnique.mockResolvedValue(null);
});

// ── GET /api/leagues/[leagueId]/standings — unauthenticated → 401 ─────────────

describe("GET /api/leagues/[leagueId]/standings", () => {
  it("returns 401 when unauthenticated", async () => {
    const { GET } = await import("../app/api/leagues/[leagueId]/standings/route");
    const req = makeRequest({ url: `http://localhost/api/leagues/${LEAGUE_ID}/standings` });
    const res = await GET(req, { params: { leagueId: LEAGUE_ID } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not a league member", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(FAKE_USER);
    // fantasyTeam.findFirst returns null → not a member
    mockPrisma.fantasyTeam.findFirst.mockResolvedValue(null);

    const { GET } = await import("../app/api/leagues/[leagueId]/standings/route");
    const req = makeRequest({
      url: `http://localhost/api/leagues/${LEAGUE_ID}/standings`,
      sessionToken: "valid-token",
    });
    const res = await GET(req, { params: { leagueId: LEAGUE_ID } });
    expect(res.status).toBe(403);
  });
});

// ── PUT /api/leagues/[leagueId]/lineup — unauthenticated → 401, non-member → 403

describe("PUT /api/leagues/[leagueId]/lineup", () => {
  it("returns 401 when unauthenticated", async () => {
    const { PUT } = await import("../app/api/leagues/[leagueId]/lineup/route");
    const req = makeRequest({
      url: `http://localhost/api/leagues/${LEAGUE_ID}/lineup`,
      method: "PUT",
      body: { teamId: "team-1", playerId: "p1", slot: "FORWARD" },
    });
    const res = await PUT(req, { params: Promise.resolve({ leagueId: LEAGUE_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated non-member tries to set lineup", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(FAKE_USER);
    mockPrisma.fantasyTeam.findFirst.mockResolvedValue(null); // not a member

    const { PUT } = await import("../app/api/leagues/[leagueId]/lineup/route");
    const req = makeRequest({
      url: `http://localhost/api/leagues/${LEAGUE_ID}/lineup`,
      method: "PUT",
      sessionToken: "valid-token",
      body: { teamId: "team-1", playerId: "p1", slot: "FORWARD" },
    });
    const res = await PUT(req, { params: Promise.resolve({ leagueId: LEAGUE_ID }) });
    expect(res.status).toBe(403);
  });
});

// ── POST /api/leagues/[leagueId]/season — non-commissioner → 403 ─────────────

describe("POST /api/leagues/[leagueId]/season", () => {
  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("../app/api/leagues/[leagueId]/season/route");
    const req = makeRequest({
      url: `http://localhost/api/leagues/${LEAGUE_ID}/season`,
      method: "POST",
      body: { action: "start" },
    });
    const res = await POST(req, { params: Promise.resolve({ leagueId: LEAGUE_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated non-commissioner tries to advance season", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(FAKE_USER);
    // League exists but commissionerId is different
    mockPrisma.fantasyLeague.findUnique.mockResolvedValue({
      ...FAKE_LEAGUE,
      commissionerId: "different-user-id",
    });

    const { POST } = await import("../app/api/leagues/[leagueId]/season/route");
    const req = makeRequest({
      url: `http://localhost/api/leagues/${LEAGUE_ID}/season`,
      method: "POST",
      sessionToken: "valid-token",
      body: { action: "start" },
    });
    const res = await POST(req, { params: Promise.resolve({ leagueId: LEAGUE_ID }) });
    expect(res.status).toBe(403);
  });
});

// ── POST /api/leagues/[leagueId]/trades — unauthenticated → 401 ──────────────

describe("POST /api/leagues/[leagueId]/trades", () => {
  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("../app/api/leagues/[leagueId]/trades/route");
    const req = makeRequest({
      url: `http://localhost/api/leagues/${LEAGUE_ID}/trades`,
      method: "POST",
      body: { receivingTeamId: "team-2", items: [] },
    });
    const res = await POST(req, { params: Promise.resolve({ leagueId: LEAGUE_ID }) });
    expect(res.status).toBe(401);
  });
});

// ── POST /api/leagues/[leagueId]/commissioner/force-move — non-commissioner → 403

describe("POST /api/leagues/[leagueId]/commissioner/force-move", () => {
  it("returns 401 when unauthenticated", async () => {
    const { POST } = await import("../app/api/leagues/[leagueId]/commissioner/force-move/route");
    const req = makeRequest({
      url: `http://localhost/api/leagues/${LEAGUE_ID}/commissioner/force-move`,
      method: "POST",
      body: { teamId: "team-1", playerId: "p1", slot: "BENCH" },
    });
    const res = await POST(req, { params: Promise.resolve({ leagueId: LEAGUE_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated non-commissioner calls force-move", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(FAKE_USER);
    mockPrisma.fantasyLeague.findUnique.mockResolvedValue({
      ...FAKE_LEAGUE,
      commissionerId: "different-user-id",
    });

    const { POST } = await import("../app/api/leagues/[leagueId]/commissioner/force-move/route");
    const req = makeRequest({
      url: `http://localhost/api/leagues/${LEAGUE_ID}/commissioner/force-move`,
      method: "POST",
      sessionToken: "valid-token",
      body: { teamId: "team-1", playerId: "p1", slot: "BENCH" },
    });
    const res = await POST(req, { params: Promise.resolve({ leagueId: LEAGUE_ID }) });
    expect(res.status).toBe(403);
  });
});
