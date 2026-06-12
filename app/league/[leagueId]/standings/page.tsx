import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeRace } from "@/lib/playoffs/seeding";
import { computeVpStandings } from "@/lib/scoring/vp";
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

  // VP standings are always authoritative — sort by totalVP, then pointsFor.
  const vpStandings = computeVpStandings(
    league.teams,
    matchups.map((m) => ({
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
      homeScore: m.homeScore, awayScore: m.awayScore,
      homeVP: (m as { homeVP?: number | null }).homeVP ?? null,
      awayVP: (m as { awayVP?: number | null }).awayVP ?? null,
      isPlayoff: m.isPlayoff,
    }))
  );
  // Map VP standings to the Standing shape so race computation works.
  const standings = vpStandings.map((s) => ({
    fantasyTeamId: s.fantasyTeamId,
    teamName: s.teamName,
    points: s.totalVP,
    wins: s.wins,
    losses: s.losses,
    ties: s.ties,
    pointsFor: s.pointsFor,
    pointsAgainst: 0,
  }));
  const streaks = computeStreaks(league.teams.map((t) => t.id), matchups);

  const playoffSettings = (league.playoffSettings ?? null) as { teamsInPlayoff?: number } | null;
  const playoffCutoff = playoffSettings?.teamsInPlayoff ?? null;
  const playoffsStarted = league.playoffStatus !== "NOT_STARTED";

  // Playoff race indicators — only meaningful once results exist and before playoffs.
  const hasResults = matchups.some((m) => !m.isPlayoff && m.homeScore !== null);
  const race =
    playoffCutoff !== null && hasResults && !playoffsStarted
      ? computeRace(standings, matchups, playoffCutoff)
      : null;

  // Banner summarizing the user's own playoff status.
  const myRaceIdx = vpStandings.findIndex((s) => s.fantasyTeamId === myTeam.id);
  const myRace = race?.get(myTeam.id) ?? null;
  let myBanner: { text: string; color: string; bg: string } | null = null;
  if (myRace && myRaceIdx >= 0) {
    const rank = myRaceIdx + 1;
    if (myRace.status === "clinched") {
      myBanner = { text: `🎉 You've clinched a playoff spot (currently #${rank}).`, color: "#34d399", bg: "rgba(52,211,153,0.08)" };
    } else if (myRace.status === "eliminated") {
      myBanner = { text: `You've been eliminated from playoff contention (#${rank}).`, color: "#f87171", bg: "rgba(248,113,113,0.07)" };
    } else if (myRace.status === "in" || myRace.status === "bubble") {
      const cushion = myRace.cushion ?? 0;
      myBanner = cushion > 0
        ? { text: `In the playoff picture at #${rank} — ${cushion.toFixed(1)} ${cushion === 1 ? "game" : "games"} clear of the bubble.`, color: "#818cf8", bg: "rgba(99,102,241,0.08)" }
        : { text: `On the playoff bubble at #${rank} — hold your spot.`, color: "#f59e0b", bg: "rgba(245,158,11,0.08)" };
    } else {
      const gb = myRace.gamesBack ?? 0;
      myBanner = { text: `On the outside at #${rank} — ${gb.toFixed(1)} ${gb === 1 ? "game" : "games"} back of the playoff line.`, color: "#f59e0b", bg: "rgba(245,158,11,0.08)" };
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {myBanner && (
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: myBanner.bg, border: `1px solid ${myBanner.color}33`,
          fontSize: 13, fontWeight: 600, color: myBanner.color,
        }}>
          {myBanner.text}
        </div>
      )}

      {/* ── Victory Points standings (always authoritative) ── */}
      <section style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Standings</h1>
          {playoffCutoff !== null && !playoffsStarted && (
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Top {playoffCutoff} qualify for playoffs
            </span>
          )}
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#475569" }}>
          Win matchup +2 VP · 1st place weekly score +2 VP · 2nd place score +1 VP
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr style={{ color: "#64748b", textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Team</th>
                <th style={thStyle} title="Total Victory Points">VP</th>
                <th style={thStyle}>W-L-T</th>
                <th style={thStyle} title="Matchup VP earned">Mtch VP</th>
                <th style={thStyle} title="Weekly rank bonus VP">Rnk VP</th>
                <th style={thStyle}>PF</th>
                <th style={thStyle}>Streak</th>
                {!playoffsStarted && playoffCutoff !== null && (
                  <th style={thStyle} className="standings-hide-mobile">Gap</th>
                )}
              </tr>
            </thead>
            <tbody>
              {vpStandings.map((s, index) => {
                const isMe = s.fantasyTeamId === myTeam.id;
                const streak = streaks.get(s.fantasyTeamId) ?? null;
                const inPlayoffs = playoffCutoff !== null && index < playoffCutoff;
                const onBubble = playoffCutoff !== null && index === playoffCutoff;
                const nextAbove = index > 0 ? vpStandings[index - 1] : null;
                const gapToNext = nextAbove ? (nextAbove.totalVP - s.totalVP) : null;

                let playoffChip: { label: string; color: string; bg: string } | null = null;
                const raceInfo = race?.get(s.fantasyTeamId) ?? null;
                if (playoffCutoff !== null) {
                  if (playoffsStarted) {
                    playoffChip = inPlayoffs
                      ? { label: "IN", color: "#34d399", bg: "rgba(52,211,153,0.1)" }
                      : { label: "OUT", color: "#64748b", bg: "rgba(100,116,139,0.1)" };
                  } else if (raceInfo?.status === "clinched") {
                    playoffChip = { label: "✓ CLINCHED", color: "#34d399", bg: "rgba(52,211,153,0.12)" };
                  } else if (raceInfo?.status === "eliminated") {
                    playoffChip = { label: "✗ ELIM", color: "#f87171", bg: "rgba(248,113,113,0.1)" };
                  } else if (raceInfo?.status === "bubble" || onBubble) {
                    playoffChip = { label: "BUBBLE", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
                  } else if (inPlayoffs) {
                    playoffChip = { label: "IN", color: "#34d399", bg: "rgba(52,211,153,0.1)" };
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
                    <td style={{ ...tdStyle, fontWeight: 800, color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>{s.totalVP}</td>
                    <td style={{ ...tdStyle, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
                      {s.wins}–{s.losses}{s.ties > 0 ? `–${s.ties}` : ""}
                    </td>
                    <td style={{ ...tdStyle, color: "#818cf8", fontVariantNumeric: "tabular-nums" }}>{s.matchupVP}</td>
                    <td style={{ ...tdStyle, color: "#34d399", fontVariantNumeric: "tabular-nums" }}>{s.rankVP}</td>
                    <td style={{ ...tdStyle, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{s.pointsFor.toFixed(1)}</td>
                    <td style={{ ...tdStyle, color: streakColor, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {streak ? `${streak.type}${streak.count}` : "—"}
                    </td>
                    {!playoffsStarted && playoffCutoff !== null && (
                      <td style={{ ...tdStyle, color: "#475569", fontSize: 12 }} className="standings-hide-mobile">
                        {index === 0 ? "—" : gapToNext === 0 ? "tied" : `-${gapToNext} VP`}
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
            Dashed line separates the top {playoffCutoff} (playoff qualifiers) from the rest
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
