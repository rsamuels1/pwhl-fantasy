import { describe, it, expect, beforeEach, vi } from "vitest";
import { bumpSeason, renewLeague, RenewalBlockedError } from "../lib/services/renewal-service";

// ── bumpSeason (pure) ──────────────────────────────────────────────────────

describe("bumpSeason", () => {
  it("increments both years", () => {
    expect(bumpSeason("2026-27")).toBe("2027-28");
  });

  it("handles year rollover at 99→00", () => {
    expect(bumpSeason("2099-00")).toBe("2100-01");
  });

  it("returns input unchanged for unrecognised formats", () => {
    expect(bumpSeason("unknown")).toBe("unknown");
  });

  it("pads single-digit end year", () => {
    expect(bumpSeason("2008-09")).toBe("2009-10");
  });
});

// ── renewLeague (with mocked Prisma) ──────────────────────────────────────

function makeLeague(overrides: Partial<{
  playoffStatus: string;
  season: string;
  childLeagues: Array<{ id: string }>;
}> = {}) {
  return {
    id: "league-1",
    name: "Test League",
    season: "2026-27",
    commissionerId: "commish-1",
    draftType: "SNAKE" as const,
    maxTeams: 8,
    scoringSettings: { goals: 3 },
    rosterSettings: { forward: 3 },
    playoffSettings: { teamsInPlayoff: 4 },
    scoringMode: "VP",
    rulesVersion: 1,
    scoringVersion: 1,
    playoffStatus: "COMPLETE",
    childLeagues: [],
    ...overrides,
  };
}

function makePrisma(league: ReturnType<typeof makeLeague>) {
  const created: Record<string, unknown>[] = [];
  return {
    fantasyLeague: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(league),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const row = { id: "new-league-id", ...data };
        created.push(row);
        return Promise.resolve(row);
      }),
    },
    _created: created,
  } as unknown as Parameters<typeof renewLeague>[2];
}

describe("renewLeague — happy path", () => {
  it("creates a child league with parentLeagueId set", async () => {
    const league = makeLeague();
    const prisma = makePrisma(league);
    const result = await renewLeague("league-1", {}, prisma);
    expect(result.newLeagueId).toBe("new-league-id");
    const call = (prisma as any).fantasyLeague.create.mock.calls[0][0].data;
    expect(call.parentLeagueId).toBe("league-1");
  });

  it("bumps the season string by default", async () => {
    const prisma = makePrisma(makeLeague());
    await renewLeague("league-1", {}, prisma);
    const call = (prisma as any).fantasyLeague.create.mock.calls[0][0].data;
    expect(call.season).toBe("2027-28");
  });

  it("respects season override", async () => {
    const prisma = makePrisma(makeLeague());
    await renewLeague("league-1", { season: "custom-season" }, prisma);
    const call = (prisma as any).fantasyLeague.create.mock.calls[0][0].data;
    expect(call.season).toBe("custom-season");
  });

  it("respects name override", async () => {
    const prisma = makePrisma(makeLeague());
    await renewLeague("league-1", { name: "New League Name" }, prisma);
    const call = (prisma as any).fantasyLeague.create.mock.calls[0][0].data;
    expect(call.name).toBe("New League Name");
  });

  it("copies settings from parent", async () => {
    const prisma = makePrisma(makeLeague());
    await renewLeague("league-1", {}, prisma);
    const call = (prisma as any).fantasyLeague.create.mock.calls[0][0].data;
    expect(call.scoringSettings).toEqual({ goals: 3 });
    expect(call.rosterSettings).toEqual({ forward: 3 });
    expect(call.maxTeams).toBe(8);
    expect(call.commissionerId).toBe("commish-1");
  });

  it("new league has PRE_DRAFT status and NOT_STARTED playoff status", async () => {
    const prisma = makePrisma(makeLeague());
    await renewLeague("league-1", {}, prisma);
    const call = (prisma as any).fantasyLeague.create.mock.calls[0][0].data;
    expect(call.status).toBe("PRE_DRAFT");
    expect(call.playoffStatus).toBe("NOT_STARTED");
  });

  it("draftStartsAt defaults to null when not overridden", async () => {
    const prisma = makePrisma(makeLeague());
    await renewLeague("league-1", {}, prisma);
    const call = (prisma as any).fantasyLeague.create.mock.calls[0][0].data;
    expect(call.draftStartsAt).toBeNull();
  });
});

describe("renewLeague — blocked cases", () => {
  it("throws RenewalBlockedError when playoffs not complete", async () => {
    const league = makeLeague({ playoffStatus: "IN_PROGRESS" });
    const prisma = makePrisma(league);
    await expect(renewLeague("league-1", {}, prisma)).rejects.toBeInstanceOf(RenewalBlockedError);
  });

  it("returns existing child ID when already renewed (double-renewal guard)", async () => {
    const league = makeLeague({ childLeagues: [{ id: "existing-child" }] });
    const prisma = makePrisma(league);
    const result = await renewLeague("league-1", {}, prisma);
    expect(result.newLeagueId).toBe("existing-child");
    expect((prisma as any).fantasyLeague.create).not.toHaveBeenCalled();
  });
});
