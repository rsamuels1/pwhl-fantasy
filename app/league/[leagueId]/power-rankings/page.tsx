import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { computePowerRankings } from "@/lib/power-rankings";

export default async function PowerRankingsPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const { leagueId } = params;
  const user = await requireAuth(`/league/${leagueId}/power-rankings`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: { teams: { select: { id: true, name: true } } },
  });
  if (!league) notFound();

  const matchups = await prisma.matchup.findMany({ where: { leagueId } });

  const rankings = computePowerRankings(league.teams, matchups);
  const hasData = rankings.some((r) => r.lastWeekScore !== null);

  const maxWeek = matchups
    .filter((m) => !m.isPlayoff && m.homeScore !== null)
    .reduce((max, m) => Math.max(max, m.week), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Power Rankings</h1>
        {maxWeek > 0 && (
          <span style={{ fontSize: 13, color: "var(--faint)" }}>
            After Week {maxWeek}
          </span>
        )}
      </div>

      {!hasData ? (
        <div style={{
          padding: "28px 20px", borderRadius: 16,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          textAlign: "center", color: "var(--faint)", fontSize: 14,
        }}>
          Power rankings update after each week is scored. Check back once the season is underway.
        </div>
      ) : (
        <section style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20, overflow: "hidden",
        }}>
          {rankings.map((row, i) => {
            const isMe = row.fantasyTeamId === myTeam.id;
            const isLast = i === rankings.length - 1;

            const trendIcon =
              row.trend === "up" ? "↑" :
              row.trend === "down" ? "↓" :
              row.trend === "same" ? "→" : null;
            const trendColor =
              row.trend === "up" ? "#34d399" :
              row.trend === "down" ? "#f87171" : "var(--faint)";

            return (
              <div
                key={row.fantasyTeamId}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px",
                  background: isMe ? "rgba(143,193,232,0.08)" : "transparent",
                  borderLeft: isMe ? "3px solid var(--accent)" : "3px solid transparent",
                  borderBottom: isLast ? "none" : "1px solid var(--border)",
                }}
              >
                {/* Rank */}
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                  background: row.rank === 1 ? "rgba(251,191,36,0.2)" :
                               row.rank === 2 ? "var(--border)" :
                               row.rank === 3 ? "rgba(205,127,50,0.15)" :
                               "var(--surface)",
                  color: row.rank === 1 ? "#fbbf24" :
                         row.rank === 2 ? "var(--dim)" :
                         row.rank === 3 ? "#cd7f32" : "var(--faint)",
                }}>
                  {row.rank}
                </span>

                {/* Trend */}
                <span style={{ width: 16, fontSize: 14, fontWeight: 700, color: trendColor, flexShrink: 0, textAlign: "center" }}>
                  {trendIcon ?? <span style={{ fontSize: 9, color: "#334155" }}>NEW</span>}
                </span>

                {/* Team name */}
                <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 500, color: isMe ? "var(--text)" : "var(--muted)" }}>
                  {row.teamName}
                </span>

                {/* Last week */}
                <div style={{ textAlign: "right", minWidth: 52 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>
                    {row.lastWeekScore !== null ? row.lastWeekScore.toFixed(1) : "–"}
                  </div>
                  <div style={{ fontSize: 10, color: "#334155" }}>last wk</div>
                </div>

                {/* 2-week avg */}
                <div style={{ textAlign: "right", minWidth: 52 }}>
                  <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--dim)" }}>
                    {row.last2WeeksAvg !== null ? row.last2WeeksAvg.toFixed(1) : "–"}
                  </div>
                  <div style={{ fontSize: 10, color: "#334155" }}>2-wk avg</div>
                </div>

                {/* Season avg */}
                <div style={{ textAlign: "right", minWidth: 52 }}>
                  <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--faint)" }}>
                    {row.seasonAvg.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 10, color: "#334155" }}>season</div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <p style={{ fontSize: 12, color: "#334155", textAlign: "center", margin: 0 }}>
        Ranked by last week's score · updates each time a week is scored
      </p>
    </div>
  );
}
