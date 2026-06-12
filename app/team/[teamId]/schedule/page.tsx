import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { getSeasonState } from "@/lib/season";

interface Props {
  params: Promise<{ teamId: string }>;
}

export default async function SchedulePage({ params }: Props) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/schedule`);
  const team = await requireTeamOwner(teamId, user.id);
  if (!team) notFound();

  const leagueId = team.league.id;
  const leagueInfo = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { isReplay: true, replayCurrentDate: true },
  });
  const nowMs = getReplayNow(leagueInfo, await getDevNow());

  const seasonState = await getSeasonState(leagueId, nowMs, prisma);
  const activePeriod = seasonState.periods.find((p) => p.status === "ACTIVE")?.period ?? null;
  const upcomingPeriod = seasonState.periods.find((p) => p.status === "UPCOMING")?.period ?? null;
  const displayPeriod = activePeriod ?? upcomingPeriod;

  // Active roster — get PWHL team IDs for all rostered players
  const roster = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: teamId },
    include: { player: { include: { team: true } } },
  });

  // Build map: pwhlTeamId → list of players on my roster
  const myPlayersByTeam = new Map<string, { name: string; position: string; slot: string }[]>();
  for (const entry of roster) {
    const pwhlTeamId = entry.player.team?.id;
    if (!pwhlTeamId) continue;
    const existing = myPlayersByTeam.get(pwhlTeamId) ?? [];
    existing.push({
      name: `${entry.player.firstName} ${entry.player.lastName}`,
      position: entry.player.position,
      slot: entry.slot,
    });
    myPlayersByTeam.set(pwhlTeamId, existing);
  }

  // Games for the display period, or upcoming 14 days if no active period
  const periodStart = displayPeriod?.startsAt ?? new Date(nowMs);
  const periodEnd = displayPeriod?.endsAt ?? new Date(nowMs + 14 * 24 * 3600_000);

  const games = await prisma.game.findMany({
    where: {
      startsAt: { gte: periodStart, lt: periodEnd },
      OR: [
        { homeTeamId: { in: [...myPlayersByTeam.keys()] } },
        { awayTeamId: { in: [...myPlayersByTeam.keys()] } },
      ],
    },
    include: {
      homeTeam: { select: { id: true, abbreviation: true, name: true } },
      awayTeam: { select: { id: true, abbreviation: true, name: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  // All games in period (for the progress bar — all teams, not just mine)
  const allPeriodGames = displayPeriod
    ? await prisma.game.findMany({
        where: { startsAt: { gte: periodStart, lt: periodEnd } },
        select: { id: true, startsAt: true, status: true },
      })
    : [];

  const totalGames = allPeriodGames.length;
  const finishedGames = allPeriodGames.filter(
    (g) => new Date(g.startsAt).getTime() <= nowMs
  ).length;
  const progressPct = totalGames > 0 ? Math.round((finishedGames / totalGames) * 100) : 0;

  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(d);
  const fmtTime = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);

  // Group games by calendar day
  const byDay = new Map<string, typeof games>();
  for (const g of games) {
    const key = new Date(g.startsAt).toDateString();
    const arr = byDay.get(key) ?? [];
    arr.push(g);
    byDay.set(key, arr);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>
          {displayPeriod ? `Week ${displayPeriod.week} Schedule` : "Upcoming Schedule"}
        </h1>
        {displayPeriod && (
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            {fmtDate(displayPeriod.startsAt)} – {fmtDate(displayPeriod.endsAt)}
            {activePeriod ? " · Active" : " · Upcoming"}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {displayPeriod && totalGames > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(148,163,184,0.1)",
          borderRadius: 14, padding: "14px 16px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: "#94a3b8", fontWeight: 600 }}>League-wide progress</span>
            <span style={{ color: "#64748b" }}>{finishedGames} / {totalGames} games played</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 999,
              width: `${progressPct}%`,
              background: progressPct === 100 ? "#34d399" : "#6366f1",
              transition: "width 0.4s ease",
            }} />
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#475569" }}>
            {progressPct}% of the week{progressPct === 100 ? " — all games finished" : " complete"}
          </p>
        </div>
      )}

      {/* Games list */}
      {byDay.size === 0 ? (
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.1)",
          borderRadius: 14, padding: 24, textAlign: "center",
          color: "#64748b", fontSize: 14,
        }}>
          No games for your players this period.
        </div>
      ) : (
        [...byDay.entries()].map(([dayKey, dayGames]) => (
          <div key={dayKey}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#475569",
              textTransform: "uppercase", letterSpacing: "0.08em",
              marginBottom: 8,
            }}>
              {fmtDate(new Date(dayKey))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayGames.map((game) => {
                const played = new Date(game.startsAt).getTime() <= nowMs;
                const myHome = myPlayersByTeam.get(game.homeTeamId) ?? [];
                const myAway = myPlayersByTeam.get(game.awayTeamId) ?? [];
                const myTotal = myHome.length + myAway.length;

                return (
                  <div key={game.id} style={{
                    background: played ? "rgba(255,255,255,0.025)" : "rgba(99,102,241,0.05)",
                    border: played
                      ? "1px solid rgba(148,163,184,0.08)"
                      : "1px solid rgba(99,102,241,0.15)",
                    borderRadius: 12, padding: "12px 16px",
                  }}>
                    {/* Matchup row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
                      <TeamSide
                        abbr={game.homeTeam.abbreviation}
                        name={game.homeTeam.name}
                        myPlayers={myHome}
                        align="right"
                        isHome
                      />
                      <div style={{ textAlign: "center", minWidth: 48 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: played ? "#475569" : "#6366f1", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {played ? "Final" : "vs"}
                        </div>
                        {!played && (
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                            {fmtTime(new Date(game.startsAt))}
                          </div>
                        )}
                      </div>
                      <TeamSide
                        abbr={game.awayTeam.abbreviation}
                        name={game.awayTeam.name}
                        myPlayers={myAway}
                        align="left"
                        isHome={false}
                      />
                    </div>

                    {/* My players in this game */}
                    {myTotal > 0 && (
                      <div style={{
                        marginTop: 10, paddingTop: 10,
                        borderTop: "1px solid rgba(148,163,184,0.07)",
                        display: "flex", flexWrap: "wrap", gap: 6,
                      }}>
                        {[...myHome, ...myAway].map((p) => (
                          <span key={p.name} style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: 20,
                            background: "rgba(99,102,241,0.12)",
                            color: p.slot === "BENCH" || p.slot === "IR" ? "#64748b" : "#a5b4fc",
                            border: "1px solid rgba(99,102,241,0.2)",
                          }}>
                            {p.name}
                            <span style={{ color: "#475569", marginLeft: 4 }}>
                              {p.position}{p.slot === "BENCH" ? " · BN" : p.slot === "IR" ? " · IR" : ""}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

    </div>
  );
}

function TeamSide({
  abbr, name, myPlayers, align, isHome,
}: {
  abbr: string;
  name: string;
  myPlayers: { name: string }[];
  align: "left" | "right";
  isHome: boolean;
}) {
  return (
    <div style={{ textAlign: align, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        {myPlayers.length > 0 && align === "left" && (
          <PlayerBadge count={myPlayers.length} />
        )}
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: myPlayers.length > 0 ? "#e2e8f0" : "#64748b",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {abbr}
        </span>
        {myPlayers.length > 0 && align === "right" && (
          <PlayerBadge count={myPlayers.length} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
          background: "rgba(148,163,184,0.08)", color: "#334155",
        }}>
          {isHome ? "HOME" : "AWAY"}
        </span>
        <span style={{
          fontSize: 11, color: "#475569",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {name}
        </span>
      </div>
    </div>
  );
}

function PlayerBadge({ count }: { count: number }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800,
      padding: "1px 6px", borderRadius: 999,
      background: "rgba(99,102,241,0.2)",
      color: "#a5b4fc",
      border: "1px solid rgba(99,102,241,0.35)",
      flexShrink: 0,
    }}>
      {count}
    </span>
  );
}
