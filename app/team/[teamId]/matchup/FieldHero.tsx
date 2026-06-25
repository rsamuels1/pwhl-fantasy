import Link from "next/link";
import { LogoShield } from "@/components/LogoShield";
import LiveScoreRefresh from "@/components/LiveScoreRefresh";
import { ScoreDisplay } from "@/components/ScoreDisplay";
import type { ActiveMatchup } from "@/lib/services/dashboard";

export function FieldHero({ matchup, teamId, leagueId, gamesThisNight }: { matchup: ActiveMatchup; teamId: string; leagueId: string; gamesThisNight?: number }) {
  const isUpcoming = matchup.status === "upcoming";
  const isSetupPhase = !!matchup.isSetupPhase;
  const showDash = isSetupPhase;
  const standings = matchup.weeklyStandings;
  const myRank = standings.findIndex((s) => s.teamId === matchup.myTeam.id) + 1;
  const total = standings.length;
  const { wins, losses, ties } = matchup.myRecord;

  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
  const dateRange = `${fmt(matchup.period.startsAt)} – ${fmt(new Date(new Date(matchup.period.endsAt).getTime() - 1))}`;
  const weekLabel = matchup.isPlayoff && matchup.roundLabel ? matchup.roundLabel : `Week ${matchup.week}`;

  const myScoreDisplay = showDash ? "—" : isUpcoming ? matchup.myProjected.toFixed(1) : matchup.myTeam.score.toFixed(1);
  const scoreLabel = showDash ? "Games starting soon" : isUpcoming ? "Projected FP" : "Points earned";
  const recordColor = wins > losses ? "var(--accent-strong)" : losses > wins ? "var(--red)" : "var(--muted)";
  const myScoreColor = showDash ? "var(--dim)" : recordColor;

  const startersWithGames = matchup.myPlayers.filter(
    (p) => p.slot !== "BENCH" && p.slot !== "IR" && (p.gamesThisPeriod ?? 0) > 0
  ).length;

  const topScorer = !isUpcoming && !isSetupPhase
    ? matchup.myPlayers
        .filter((p) => p.slot !== "BENCH" && p.slot !== "IR" && p.points > 0)
        .sort((a, b) => b.points - a.points)[0] ?? null
    : null;

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "var(--card)",
      border: "1px solid var(--accent-border)",
      borderRadius: 22,
      boxShadow: "0 40px 90px -45px rgba(0,0,0,0.8)",
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(620px 280px at 18% -20%, rgba(143,193,232,0.20), transparent 70%), radial-gradient(560px 260px at 92% 120%, rgba(143,193,232,0.16), transparent 70%), radial-gradient(400px 200px at 50% 100%, rgba(212,175,55,0.07), transparent 70%)" }} />

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 26px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <LogoShield size={24} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)" }}>
            {weekLabel} · {dateRange}
          </span>
        </div>
        {isUpcoming && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gold)", background: "rgba(245,201,123,0.12)", border: "1px solid rgba(245,201,123,0.32)", borderRadius: 30, padding: "6px 13px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.4" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            Set lineup now
          </span>
        )}
        {isSetupPhase && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gold)", background: "rgba(245,201,123,0.12)", border: "1px solid rgba(245,201,123,0.32)", borderRadius: 30, padding: "6px 13px" }}>
            Games starting soon
          </span>
        )}
        {!isUpcoming && !isSetupPhase && <LiveScoreRefresh />}
      </div>

      <div style={{ position: "relative", padding: "28px 30px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 22 }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, var(--accent-deep), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "var(--accent-ink)", boxShadow: "0 8px 20px -8px rgba(143,193,232,0.5)", flexShrink: 0 }}>
            {matchup.myTeam.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>{matchup.myTeam.name}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--accent-strong)", background: "rgba(143,193,232,0.18)", borderRadius: 5, padding: "2px 7px" }}>YOU</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 3 }}>
              <span style={{ color: "var(--faint)", fontWeight: 400 }}>W-L vs field: </span>
              <span style={{ color: recordColor, fontWeight: 700 }}>{wins}–{losses}{ties > 0 ? `–${ties}` : ""}</span>
              {myRank > 0 && <span style={{ color: "var(--faint)" }}> · #{myRank} of {total} this week</span>}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div className="font-stats" style={{ fontSize: showDash ? "clamp(24px, 6vw, 32px)" : "clamp(48px, 6vw, 64px)", fontWeight: 700, lineHeight: 0.82 }}>
            {!isUpcoming && !isSetupPhase ? (
              <ScoreDisplay value={parseFloat(myScoreDisplay)} color={myScoreColor} />
            ) : (
              <span style={{ color: myScoreColor }}>{myScoreDisplay}</span>
            )}
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginTop: 6 }}>
            {scoreLabel}
          </div>
        </div>

        <p style={{ fontSize: "0.75rem", color: "var(--faint)", textAlign: "center", margin: "0 0 12px" }}>
          Fantasy points (FP) decide who wins the week. Winning earns Victory Points (VP) in the standings.
        </p>

        {isSetupPhase ? (
          <p style={{ fontSize: "0.75rem", color: "var(--faint)", textAlign: "center", margin: "0 0 12px" }}>
            {gamesThisNight && gamesThisNight > 0
              ? `Scores appear once tonight's games go final · ${gamesThisNight} game${gamesThisNight !== 1 ? "s" : ""} tonight`
              : "Scores update as PWHL games are played this week"}
          </p>
        ) : !isUpcoming && (wins > 0 || losses > 0) ? (
          <p style={{ fontSize: "0.75rem", color: "var(--faint)", textAlign: "center", margin: "0 0 12px" }}>
            You beat {wins} team{wins !== 1 ? "s'" : "'s"} score{wins !== 1 ? "s" : ""} and lost to {losses} this week. Most points wins.
          </p>
        ) : null}

        {topScorer && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", marginBottom: 20 }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(143,193,232,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "var(--accent-strong)", flexShrink: 0 }}>
              {topScorer.slot === "GOALIE" ? "G" : topScorer.slot === "DEFENSE" ? "D" : "F"}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Leading · <strong style={{ color: "var(--text)", fontWeight: 700 }}>{topScorer.name.split(" ").pop()}</strong>
            </span>
            <span className="font-stats" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-strong)" }}>
              {topScorer.points.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "18px 30px 24px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontSize: 12.5, color: "var(--dim)", minWidth: 160 }}>
          {isUpcoming
            ? <>Set your lineup before puck drop — you have <strong style={{ color: "var(--gold)", fontWeight: 700 }}>{startersWithGames} starter{startersWithGames !== 1 ? "s" : ""}</strong> with games this period.</>
            : <>{startersWithGames} starter{startersWithGames !== 1 ? "s" : ""} active this period.</>
          }
        </span>
        <Link href={`/league/${leagueId}/matchups`} style={{
          background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
          padding: "12px 20px", borderRadius: 11, fontSize: 14, fontWeight: 600, textDecoration: "none",
          whiteSpace: "nowrap",
        }}>
          View schedule
        </Link>
        {isUpcoming && (
          <Link href={`/team/${teamId}/lineup`} style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-deep))", color: "var(--accent-ink)",
            padding: "12px 22px", borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
          }}>
            Set lineup
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </Link>
        )}
      </div>
    </div>
  );
}
