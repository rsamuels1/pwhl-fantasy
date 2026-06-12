import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

export default async function MatchupsPage({ params }: { params: { leagueId: string } }) {
  const { leagueId } = params;
  const user = await requireAuth(`/league/${leagueId}/matchups`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  const nowMs = getReplayNow(league, await getDevNow());

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    orderBy: [{ week: "asc" }, { startsAt: "asc" }],
    include: { homeTeam: true, awayTeam: true },
  });

  const regularMatchups = matchups.filter((m) => !m.isPlayoff);
  const playoffMatchups = matchups.filter((m) => m.isPlayoff);

  // Group regular season by week
  const byWeek = new Map<number, typeof regularMatchups>();
  for (const m of regularMatchups) {
    const arr = byWeek.get(m.week) ?? [];
    arr.push(m);
    byWeek.set(m.week, arr);
  }

  // Find "current" week using sim date
  const started = regularMatchups.filter((m) => new Date(m.startsAt).getTime() <= nowMs);
  const currentWeek = started.length > 0
    ? Math.max(...started.map((m) => m.week))
    : regularMatchups.length > 0
    ? Math.min(...regularMatchups.map((m) => m.week))
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <h1 style={{ fontSize: 24, margin: 0 }}>Schedule</h1>

      {/* Regular season */}
      {byWeek.size === 0 ? (
        <div style={card}>
          <p style={{ color: "#64748b", margin: 0 }}>No matchups scheduled yet.</p>
        </div>
      ) : (
        [...byWeek.entries()].map(([week, weekMatchups]) => {
          const isCurrent = week === currentWeek;
          const period = weekMatchups[0];
          const dateRange = `${fmtDate(new Date(period.startsAt))} – ${fmtDate(new Date(period.endsAt))}`;

          return (
            <section key={week} style={{
              ...card,
              border: isCurrent
                ? "1px solid rgba(99,102,241,0.3)"
                : "1px solid rgba(148,163,184,0.14)",
              background: isCurrent
                ? "rgba(99,102,241,0.04)"
                : "rgba(255,255,255,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Week {week}</span>
                <span style={{ fontSize: 12, color: "#475569" }}>{dateRange}</span>
                {isCurrent && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                    background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                  }}>
                    Current
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {weekMatchups.map((m) => {
                  const scored = m.homeScore !== null && m.awayScore !== null;
                  const homeIsMe = m.homeTeamId === myTeam.id;
                  const awayIsMe = m.awayTeamId === myTeam.id;
                  const isMyMatchup = homeIsMe || awayIsMe;
                  const homeWon = scored && m.homeScore! > m.awayScore!;
                  const awayWon = scored && m.awayScore! > m.homeScore!;

                  return (
                    <div key={m.id} style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto 1fr",
                      alignItems: "center",
                      gap: "4px 10px",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: isMyMatchup ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)",
                      border: isMyMatchup ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(148,163,184,0.06)",
                    }}>
                      {/* Home */}
                      <div style={{ textAlign: "right", minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: homeIsMe ? 700 : 500,
                          color: homeIsMe ? "#e2e8f0" : "#94a3b8",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {m.homeTeam.name}
                        </div>
                        {scored && (
                          <div style={{
                            fontSize: 17, fontWeight: 800,
                            color: homeWon ? "#e2e8f0" : "#475569",
                            fontVariantNumeric: "tabular-nums",
                          }}>
                            {m.homeScore!.toFixed(1)}
                          </div>
                        )}
                      </div>

                      {/* Middle */}
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textAlign: "center", letterSpacing: "0.5px", minWidth: 36 }}>
                        {scored ? "FINAL" : "VS"}
                      </div>

                      {/* Away */}
                      <div style={{ textAlign: "left", minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: awayIsMe ? 700 : 500,
                          color: awayIsMe ? "#e2e8f0" : "#94a3b8",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {m.awayTeam.name}
                        </div>
                        {scored && (
                          <div style={{
                            fontSize: 17, fontWeight: 800,
                            color: awayWon ? "#e2e8f0" : "#475569",
                            fontVariantNumeric: "tabular-nums",
                          }}>
                            {m.awayScore!.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {/* Playoffs */}
      {playoffMatchups.length > 0 && (
        <section style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px", color: "#e2e8f0" }}>Playoffs</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {playoffMatchups.map((m) => {
              const scored = m.homeScore !== null && m.awayScore !== null;
              const homeWon = scored && m.homeScore! > m.awayScore!;
              const awayWon = scored && m.awayScore! > m.homeScore!;
              const roundLabel = m.round != null ? `Round ${m.round}` : "Playoffs";

              return (
                <div key={m.id} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: "4px 10px",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(148,163,184,0.06)",
                }}>
                  <div style={{ textAlign: "right", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.homeTeam.name}
                    </div>
                    {scored && (
                      <div style={{ fontSize: 17, fontWeight: 800, color: homeWon ? "#e2e8f0" : "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {m.homeScore!.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "center", minWidth: 44 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: "0.5px" }}>
                      {scored ? "FINAL" : "VS"}
                    </div>
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{roundLabel} · Wk {m.week}</div>
                  </div>
                  <div style={{ textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.awayTeam.name}
                    </div>
                    {scored && (
                      <div style={{ fontSize: 17, fontWeight: 800, color: awayWon ? "#e2e8f0" : "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {m.awayScore!.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: 20,
};
