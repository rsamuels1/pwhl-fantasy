import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeStandings } from "@/lib/playoffs/seeding";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import type { Matchup } from "@prisma/client";

function computeStreaks(
  teamIds: string[],
  matchups: Matchup[]
): Map<string, { type: "W" | "L" | "T"; count: number } | null> {
  const map = new Map<string, { type: "W" | "L" | "T"; count: number } | null>();
  for (const teamId of teamIds) {
    const played = matchups
      .filter(
        (m) =>
          (m.homeTeamId === teamId || m.awayTeamId === teamId) &&
          m.homeScore !== null &&
          !m.isPlayoff
      )
      .sort((a, b) => b.week - a.week);

    if (played.length === 0) { map.set(teamId, null); continue; }

    const first = played[0];
    const myScore = first.homeTeamId === teamId ? first.homeScore! : first.awayScore!;
    const oppScore = first.homeTeamId === teamId ? first.awayScore! : first.homeScore!;
    const firstType: "W" | "L" | "T" = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "T";

    let count = 0;
    for (const m of played) {
      const ms = m.homeTeamId === teamId ? m.homeScore! : m.awayScore!;
      const os = m.homeTeamId === teamId ? m.awayScore! : m.homeScore!;
      const result: "W" | "L" | "T" = ms > os ? "W" : ms < os ? "L" : "T";
      if (result === firstType) count++;
      else break;
    }

    map.set(teamId, { type: firstType, count });
  }
  return map;
}

export default async function StandingsPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await requireAuth(`/league/${leagueId}/standings`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: { teams: true },
  });

  if (!league) notFound();

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    include: { homeTeam: true, awayTeam: true },
  });

  const standings = computeStandings(league.teams, matchups);
  const streaks = computeStreaks(league.teams.map((t) => t.id), matchups);

  const playoffSettings = (league.playoffSettings ?? null) as { teamsInPlayoff?: number } | null;
  const playoffCutoff = playoffSettings?.teamsInPlayoff ?? null;
  const playoffsStarted = league.playoffStatus !== "NOT_STARTED";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Standings</h1>
          {playoffCutoff !== null && !playoffsStarted && (
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Top {playoffCutoff} teams qualify for playoffs
            </span>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr style={{ color: "#64748b", textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Team</th>
                <th style={thStyle}>Record</th>
                <th style={thStyle}>PF</th>
                <th style={{ ...thStyle, display: "none" }} className="standings-hide-mobile">PA</th>
                <th style={thStyle}>Streak</th>
                {!playoffsStarted && playoffCutoff !== null && (
                  <th style={thStyle} className="standings-hide-mobile">Gap</th>
                )}
              </tr>
            </thead>
            <tbody>
              {standings.map((s, index) => {
                const isMe = s.fantasyTeamId === myTeam.id;
                const streak = streaks.get(s.fantasyTeamId) ?? null;
                const inPlayoffs = playoffCutoff !== null && index < playoffCutoff;
                const onBubble = playoffCutoff !== null && index === playoffCutoff;
                const nextAbove = index > 0 ? standings[index - 1] : null;
                const gapToNext = nextAbove ? (nextAbove.points - s.points).toFixed(1) : null;

                let playoffChip: { label: string; color: string; bg: string } | null = null;
                if (playoffCutoff !== null) {
                  if (playoffsStarted) {
                    playoffChip = inPlayoffs
                      ? { label: "IN", color: "#34d399", bg: "rgba(52,211,153,0.1)" }
                      : { label: "OUT", color: "#64748b", bg: "rgba(100,116,139,0.1)" };
                  } else {
                    if (inPlayoffs && !onBubble) {
                      playoffChip = { label: "IN", color: "#34d399", bg: "rgba(52,211,153,0.1)" };
                    } else if (onBubble || (playoffCutoff !== null && index === playoffCutoff - 1 && standings.length > playoffCutoff)) {
                      playoffChip = null; // handled by bubble row styling
                    }
                  }
                }

                const streakColor = streak?.type === "W" ? "#34d399" : streak?.type === "L" ? "#f87171" : "#94a3b8";

                return (
                  <tr
                    key={s.fantasyTeamId}
                    style={{
                      background: isMe ? "rgba(99,102,241,0.08)" : "transparent",
                      borderBottom: !playoffsStarted && playoffCutoff !== null && index === playoffCutoff - 1
                        ? "2px dashed rgba(99,102,241,0.3)"
                        : "1px solid rgba(148,163,184,0.08)",
                    }}
                  >
                    <td style={{ ...tdStyle, color: "#475569", fontWeight: 700 }}>{index + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: isMe ? 700 : undefined, color: isMe ? "#a5b4fc" : "#e2e8f0" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {s.teamName}
                        {isMe && <span style={{ fontSize: 10, color: "#6366f1" }}>YOU</span>}
                        {playoffChip && (
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: "1px 5px", borderRadius: 3,
                            color: playoffChip.color, background: playoffChip.bg,
                          }}>
                            {playoffChip.label}
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>
                      {s.wins}–{s.losses}{s.ties > 0 ? `–${s.ties}` : ""}
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>{s.pointsFor.toFixed(1)}</td>
                    <td style={{ ...tdStyle, display: "none" }} className="standings-hide-mobile">
                      {s.pointsAgainst.toFixed(1)}
                    </td>
                    <td style={{ ...tdStyle, color: streakColor, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {streak ? `${streak.type}${streak.count}` : "—"}
                    </td>
                    {!playoffsStarted && playoffCutoff !== null && (
                      <td style={{ ...tdStyle, color: "#475569", fontSize: 12 }} className="standings-hide-mobile">
                        {index === 0 ? "—" : gapToNext === "0.0" ? "tied" : `-${gapToNext}`}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!playoffsStarted && playoffCutoff !== null && (
          <p style={{ fontSize: 12, color: "#475569", marginTop: 14, marginBottom: 0 }}>
            — — — playoff line — — — &nbsp; dashed line separates the top {playoffCutoff} from the rest
          </p>
        )}
      </section>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: 20,
};

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  fontSize: 14,
  color: "#e2e8f0",
};
