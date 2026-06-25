import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { computeStandings, getRival } from "@/lib/playoffs/seeding";
import { computeVpStandings } from "@/lib/scoring/vp";
import { RivalBadge } from "@/components/RivalBadge";

const card: React.CSSProperties = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: "20px 18px",
};

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--faint)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px",
  fontSize: 14,
  borderBottom: "1px solid var(--border)",
};

export default async function TeamStandingsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/standings`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: { teams: true },
  });

  if (!league) notFound();

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
  });

  const scoringMode = (league as { scoringMode?: string }).scoringMode ?? "VTF";
  const isVpMode = scoringMode === "VP";

  const standings = computeStandings(league.teams, matchups);
  const vpStandings = isVpMode
    ? computeVpStandings(
        league.teams,
        matchups.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          homeVP: (m as { homeVP?: number | null }).homeVP ?? null,
          awayVP: (m as { awayVP?: number | null }).awayVP ?? null,
          isPlayoff: m.isPlayoff,
        }))
      )
    : null;

  const playoffSettings = (league.playoffSettings ?? null) as {
    teamsInPlayoff?: number;
  } | null;
  const playoffCutoff = playoffSettings?.teamsInPlayoff ?? null;
  const playoffsStarted = league.playoffStatus !== "NOT_STARTED";

  const displayStandings = vpStandings ?? standings;
  const rival = getRival(teamId, league.teams, matchups);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 18, margin: 0, color: "var(--text)" }}>
            {vpStandings ? "Victory Points" : league.name}
          </h2>
          {playoffCutoff !== null && !playoffsStarted && (
            <span style={{ fontSize: 12, color: "var(--faint)" }}>
              Top {playoffCutoff} qualify for playoffs
            </span>
          )}
        </div>
        {vpStandings && (
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--faint)" }}>
            Win matchup +2 VP · 1st place score +2 VP · 2nd place score +1 VP
          </p>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: vpStandings ? 480 : 420 }}>
            <thead>
              <tr style={{ color: "var(--faint)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Team</th>
                {vpStandings ? (
                  <>
                    <th style={thStyle} title="Total VP">VP</th>
                    <th style={thStyle} title="Matchup record">W-L-T</th>
                    <th style={thStyle} title="Matchup VP earned">Mtch VP</th>
                    <th style={thStyle} title="Rank bonus VP earned">Rnk VP</th>
                    <th style={thStyle}>PF</th>
                  </>
                ) : (
                  <>
                    <th style={thStyle}>W</th>
                    <th style={thStyle}>L</th>
                    <th style={thStyle}>T</th>
                    <th style={thStyle}>PF</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {displayStandings.map((s, i) => {
                const isMe = s.fantasyTeamId === teamId;
                const atPlayoffLine = playoffCutoff !== null && !playoffsStarted && i === playoffCutoff - 1;
                const vp = vpStandings ? vpStandings[i] : null;
                return (
                  <tr
                    key={s.fantasyTeamId}
                    style={{
                      background: isMe ? "rgba(143,193,232,0.08)" : "transparent",
                      borderBottom: atPlayoffLine
                        ? "2px dashed rgba(143,193,232,0.3)"
                        : "1px solid var(--border)",
                      outline: isMe ? "1px solid rgba(143,193,232,0.2)" : undefined,
                    }}
                  >
                    <td style={{ ...tdStyle, color: "var(--faint)", fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: isMe ? 700 : undefined, color: isMe ? "var(--accent-strong)" : "var(--text)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {s.teamName}
                        {isMe && <span style={{ fontSize: 10, color: "var(--accent)" }}>YOU</span>}
                        {rival && s.fantasyTeamId === rival.teamId && (
                          <RivalBadge rival={rival} compact />
                        )}
                      </span>
                    </td>
                    {vp ? (
                      <>
                        <td style={{ ...tdStyle, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{vp.totalVP}</td>
                        <td style={{ ...tdStyle, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
                          {vp.wins}–{vp.losses}{vp.ties > 0 ? `–${vp.ties}` : ""}
                        </td>
                        <td style={{ ...tdStyle, color: "var(--accent-strong)", fontVariantNumeric: "tabular-nums" }}>{vp.matchupVP}</td>
                        <td style={{ ...tdStyle, color: "#34d399", fontVariantNumeric: "tabular-nums" }}>{vp.rankVP}</td>
                        <td style={{ ...tdStyle, color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>{vp.pointsFor.toFixed(1)}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...tdStyle, color: "#34d399", fontVariantNumeric: "tabular-nums" }}>{s.wins}</td>
                        <td style={{ ...tdStyle, color: "#f87171", fontVariantNumeric: "tabular-nums" }}>{s.losses}</td>
                        <td style={{ ...tdStyle, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>{s.ties}</td>
                        <td style={{ ...tdStyle, color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>{s.pointsFor.toFixed(1)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {playoffCutoff !== null && !playoffsStarted && (
          <p style={{ fontSize: 11, color: "#334155", margin: "12px 0 0" }}>
            Top {playoffCutoff} teams advance to the playoffs — dashed line marks the cutoff
          </p>
        )}
      </section>

      {rival && (
        <section style={card}>
          <RivalBadge
            rival={rival}
            compact={false}
            lastResultAgainstRival={rival.lastMatchup}
          />
        </section>
      )}
    </div>
  );
}
