import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeRace } from "@/lib/playoffs/seeding";
import { computeVpStandings } from "@/lib/scoring/vp";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import type { Matchup } from "@prisma/client";
import { VpExplainer } from "@/components/VpExplainer";
import EmptyState from "@/components/EmptyState";
import BubbleWatch from "@/components/BubbleWatch";

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
    // also fetch status for BubbleWatch gating
  });

  if (!league) notFound();

  const isCommissioner = league.commissionerId === user.id;

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
      homeVP: m.homeVP, awayVP: m.awayVP,
      isPlayoff: m.isPlayoff,
      week: m.week,
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

  // BubbleWatch week tracking
  const regularMatchups = matchups.filter((m) => !m.isPlayoff);
  const totalWeeks = regularMatchups.reduce((max, m) => Math.max(max, m.week), 0);
  const scoredWeeksSet = new Set(regularMatchups.filter((m) => m.homeScore !== null).map((m) => m.week));
  const currentWeek = Math.max(0, ...scoredWeeksSet);

  // Banner summarizing the user's own playoff status.
  const myRaceIdx = vpStandings.findIndex((s) => s.fantasyTeamId === myTeam.id);
  const myRace = race?.get(myTeam.id) ?? null;
  let myBanner: { text: string; color: string; bg: string } | null = null;
  if (myRace && myRaceIdx >= 0) {
    const rank = myRaceIdx + 1;
    if (myRace.status === "clinched") {
      myBanner = { text: `You've clinched a playoff spot (currently #${rank}).`, color: "#5fa98c", bg: "rgba(95,169,140,0.08)" };
    } else if (myRace.status === "eliminated") {
      myBanner = { text: `You've been eliminated from playoff contention (#${rank}).`, color: "#d18b7f", bg: "rgba(209,139,127,0.07)" };
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="section-accent" />
            <h1 style={{ fontSize: 12, margin: 0, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)", display: "flex", alignItems: "center" }}>Standings<VpExplainer /></h1>
          </div>
          {playoffCutoff !== null && !playoffsStarted && (
            <span style={{ fontSize: 12, color: "var(--faint)" }}>
              Top {playoffCutoff} qualify for playoffs
            </span>
          )}
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--faint)" }}>
          Win matchup +2 VP · 1st place weekly score +2 VP · 2nd place score +1 VP
        </p>
        <p style={{ margin: "0 0 16px", fontSize: "0.7rem", color: "var(--text-muted, #6b7280)" }}>
          VP = Victory Points · MTCH VP = points for winning your weekly matchup · RNK VP = bonus for top-3 FP finish · PF = total fantasy points scored
        </p>

        {!hasResults ? (
          <EmptyState
            message="Standings will appear once games begin."
            {...(isCommissioner && { actionHref: `/league/${leagueId}/admin`, actionLabel: "Go to admin panel →" })}
          />
        ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 380 }}>
            <thead>
              <tr style={{ color: "var(--faint)", textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Team</th>
                <th style={thStyle} title="Total Victory Points this season. VP determines playoff seeding.">VP</th>
                <th style={thStyle} title="Weekly head-to-head match record (wins–losses–ties).">W-L-T</th>
                <th style={thStyle} title="Victory Points from winning your head-to-head matchup (+2 VP for a win).">MTCH VP</th>
                <th style={thStyle} title="Victory Points from score rank: 1st place in league score gets +2 VP, 2nd gets +1 VP.">RNK VP</th>
                <th style={thStyle} title="Points For — total fantasy points scored this season.">PF</th>
                <th style={thStyle} title="Current win/loss/tie streak (e.g., W2 = two wins in a row).">Streak</th>
                {!playoffsStarted && playoffCutoff !== null && (
                  <th style={thStyle} className="standings-hide-mobile" title="VP difference to the team directly above you (playoff seeding tiebreaker).">Gap</th>
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

                let playoffChip: { label: string; cls: string } | null = null;
                const raceInfo = race?.get(s.fantasyTeamId) ?? null;
                if (playoffCutoff !== null) {
                  if (playoffsStarted) {
                    playoffChip = inPlayoffs
                      ? { label: "IN", cls: "chip-in" }
                      : { label: "OUT", cls: "chip-out" };
                  } else if (raceInfo?.status === "clinched") {
                    playoffChip = { label: "✓ CLINCHED", cls: "chip-clinched" };
                  } else if (raceInfo?.status === "eliminated") {
                    playoffChip = { label: "✗ ELIM", cls: "chip-eliminated" };
                  } else if (raceInfo?.status === "bubble" || onBubble) {
                    playoffChip = { label: "◉ BUBBLE", cls: "chip-bubble" };
                  } else if (inPlayoffs) {
                    playoffChip = { label: "IN", cls: "chip-in" };
                  }
                }

                const streakColor = streak?.type === "W" ? "#5fa98c" : streak?.type === "L" ? "#d18b7f" : "#94a3b8";

                return (
                  <tr
                    key={s.fantasyTeamId}
                    style={{
                      background: isMe ? "var(--accent-dim)" : "transparent",
                      borderBottom: !playoffsStarted && playoffCutoff !== null && index === playoffCutoff - 1
                        ? "2px dashed var(--accent-border)"
                        : "1px solid var(--border)",
                      borderLeft: isMe ? "3px solid var(--accent)" : undefined,
                    }}
                  >
                    <td style={{ ...tdStyle, color: "var(--faint)", fontWeight: 700 }}>{index + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: isMe ? 700 : undefined, color: isMe ? "var(--accent-strong)" : "var(--text)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {s.teamName}
                        {isMe && <span style={{ fontSize: 10, color: "var(--accent)" }}>YOU</span>}
                        {playoffChip && <span className={playoffChip.cls}>{playoffChip.label}</span>}
                        {raceInfo?.magicNumber != null && (
                          <span className="chip-magic" title={`Need ${raceInfo.magicNumber} more VP to clinch a playoff spot`}>
                            Magic: {raceInfo.magicNumber}
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-stats)" }}>{s.totalVP}</td>
                    <td style={{ ...tdStyle, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
                      {s.wins}–{s.losses}{s.ties > 0 ? `–${s.ties}` : ""}
                    </td>
                    <td style={{ ...tdStyle, color: "#818cf8", fontVariantNumeric: "tabular-nums" }}>{s.matchupVP}</td>
                    <td style={{ ...tdStyle, color: "#5fa98c", fontVariantNumeric: "tabular-nums" }}>{s.rankVP}</td>
                    <td style={{ ...tdStyle, color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>{s.pointsFor.toFixed(1)}</td>
                    <td style={{ ...tdStyle, color: streakColor, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {streak ? `${streak.type}${streak.count}` : "—"}
                    </td>
                    {!playoffsStarted && playoffCutoff !== null && (
                      <td style={{ ...tdStyle, color: "var(--faint)", fontSize: 12 }} className="standings-hide-mobile">
                        {index === 0 ? "—" : gapToNext === 0 ? "tied" : `-${gapToNext} VP`}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {!hasResults ? null : !playoffsStarted && playoffCutoff !== null && (
          <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 14, marginBottom: 0 }}>
            Dashed line separates the top {playoffCutoff} (playoff qualifiers) from the rest
          </p>
        )}
      </section>

      {race && !playoffsStarted && (
        <BubbleWatch
          raceMap={race}
          teams={league.teams.map((t) => {
            const s = vpStandings.find((v) => v.fantasyTeamId === t.id);
            return { id: t.id, name: t.name, wins: s?.wins ?? 0, losses: s?.losses ?? 0, ties: s?.ties ?? 0 };
          })}
          isInSeason={league.status === "IN_SEASON"}
          currentWeek={currentWeek}
          totalWeeks={totalWeeks}
        />
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 20,
};

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.10em",
  color: "var(--faint)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  fontSize: 14,
  color: "var(--text)",
};
