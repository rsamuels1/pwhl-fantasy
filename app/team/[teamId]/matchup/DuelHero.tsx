import Link from "next/link";
import { LogoShield } from "@/components/LogoShield";
import LiveScoreRefresh from "@/components/LiveScoreRefresh";
import { ScoreDisplay } from "@/components/ScoreDisplay";
import type { ActiveMatchup } from "@/lib/services/dashboard";
import { FieldHero } from "./FieldHero";

export function getScoreColor(myScore: number, oppScore: number): string {
  if (myScore > oppScore) return "var(--green)";
  if (myScore < oppScore) return "var(--red)";
  return "var(--text)";
}

export function DuelHero({
  matchup, opponent, teamId, leagueId, myAccentColor, oppAccentColor, gamesThisNight,
}: {
  matchup: ActiveMatchup;
  opponent: NonNullable<ActiveMatchup["opponentTeam"]>;
  teamId: string;
  leagueId: string;
  myAccentColor: string | null;
  oppAccentColor: string | null;
  gamesThisNight?: number;
}) {
  const isUpcoming = matchup.status === "upcoming";
  const isSetupPhase = !!matchup.isSetupPhase;
  const showDash = isSetupPhase;
  const winPct = Math.round(matchup.winProbability * 100);
  const oppPct = 100 - winPct;

  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
  const dateRange = `${fmt(matchup.period.startsAt)} – ${fmt(new Date(new Date(matchup.period.endsAt).getTime() - 1))}`;
  const weekLabel = matchup.isPlayoff && matchup.roundLabel ? matchup.roundLabel : `Week ${matchup.week}`;

  const myScoreDisplay = showDash ? "—" : isUpcoming ? matchup.myProjected.toFixed(1) : matchup.myTeam.score.toFixed(1);
  const oppScoreDisplay = showDash ? "—" : isUpcoming ? matchup.opponentProjected.toFixed(1) : opponent.score.toFixed(1);
  const scoreLabel = showDash ? "Games starting soon" : isUpcoming ? "Projected FP" : "Points earned";
  const myScore = isUpcoming || showDash ? 0 : matchup.myTeam.score;
  const oppScore = isUpcoming || showDash ? 0 : opponent.score;
  const myScoreColor = showDash ? "var(--dim)" : getScoreColor(myScore, oppScore);
  const oppScoreColor = showDash ? "var(--dim)" : getScoreColor(oppScore, myScore);

  const myProj = matchup.myTeam.score + matchup.myProjected;
  const oppProj = opponent.score + matchup.opponentProjected;
  const diff = Math.abs(myProj - oppProj).toFixed(1);
  const marginLabel = myProj >= oppProj ? `+${diff} FP lead` : `${diff} FP back`;

  const delta = matchup.scoreDeltaSinceYesterday;
  const trendArrow = !isSetupPhase && delta !== null && Math.abs(delta) >= 0.5
    ? { label: delta > 0 ? `▲ +${delta.toFixed(1)}` : `▼ ${delta.toFixed(1)}`, color: delta > 0 ? "var(--green)" : "var(--red)" }
    : null;

  const isUpset = !isUpcoming && !isSetupPhase && winPct >= 10 && winPct <= 40;

  const startersWithGames = matchup.myPlayers.filter(
    (p) => p.slot !== "BENCH" && p.slot !== "IR" && (p.gamesThisPeriod ?? 0) > 0
  ).length;

  const topScorer = !isUpcoming && !isSetupPhase
    ? matchup.myPlayers
        .filter((p) => p.slot !== "BENCH" && p.slot !== "IR" && p.points > 0)
        .sort((a, b) => b.points - a.points)[0] ?? null
    : null;

  const seriesRecord = `${matchup.rivalry.wins}–${matchup.rivalry.losses}${matchup.rivalry.ties > 0 ? `–${matchup.rivalry.ties}` : ""}`;

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

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 18, padding: "30px 30px 22px" }}>
        {/* YOU column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, var(--accent-deep), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "var(--accent-ink)", boxShadow: myAccentColor ? `0 0 0 2px ${myAccentColor}, 0 8px 20px -8px rgba(143,193,232,0.5)` : "0 8px 20px -8px rgba(143,193,232,0.5)", flexShrink: 0 }}>
              {matchup.myTeam.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: myAccentColor ?? "var(--text)", letterSpacing: "-0.01em" }}>{matchup.myTeam.name}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--accent-strong)", background: "rgba(143,193,232,0.18)", borderRadius: 5, padding: "2px 7px" }}>YOU</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ color: "var(--faint)", fontWeight: 400 }}>Record: </span>{matchup.myRecord.wins}–{matchup.myRecord.losses}{matchup.myRecord.ties > 0 ? `–${matchup.myRecord.ties}` : ""}
                {seriesRecord !== "0–0" && ` · ${seriesRecord} series`}
              </div>
            </div>
          </div>

          <div>
            <div className="font-stats" style={{ fontSize: 72, fontWeight: 700, lineHeight: 0.82, fontVariantNumeric: "tabular-nums" }}>
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

          {topScorer && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
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

        {/* Center VS column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, alignSelf: "stretch", justifyContent: "center" }}>
          <div style={{ flex: 1, width: 1, background: "linear-gradient(var(--bg), var(--border), var(--bg))", minHeight: 14 }} />
          <div style={{ width: 46, height: 46, borderRadius: "50%", border: "1px solid rgba(167,139,250,0.4)", background: "rgba(143,193,232,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", color: "var(--accent-strong)", flexShrink: 0 }}>
            VS
          </div>
          <div style={{ flex: 1, width: 1, background: "linear-gradient(var(--bg), var(--border), var(--bg))", minHeight: 14 }} />
        </div>

        {/* OPPONENT column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14, textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, flexDirection: "row-reverse" }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #3a4258, #222a3d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "var(--muted)", boxShadow: oppAccentColor ? `0 0 0 2px ${oppAccentColor}` : undefined, flexShrink: 0 }}>
              {opponent.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row-reverse" }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: oppAccentColor ?? "var(--text)", letterSpacing: "-0.01em" }}>{opponent.name}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--dim)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>OPP</span>
              </div>
            </div>
          </div>

          <div>
            <div className="font-stats" style={{ fontSize: 72, fontWeight: 700, lineHeight: 0.82, fontVariantNumeric: "tabular-nums" }}>
              {!isUpcoming && !isSetupPhase ? (
                <ScoreDisplay value={parseFloat(oppScoreDisplay)} color={oppScoreColor} />
              ) : (
                <span style={{ color: oppScoreColor }}>{oppScoreDisplay}</span>
              )}
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginTop: 6 }}>
              {scoreLabel}
            </div>
          </div>

          {!topScorer && <div style={{ height: 40 }} />}
          {topScorer && <div style={{ height: 40 }} />}
        </div>
      </div>

      {/* Win probability bar */}
      <div style={{ position: "relative", padding: "0 30px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)" }}>
            Win Probability
          </span>
          {trendArrow && (
            <span style={{ fontSize: 11, fontWeight: 700, color: trendArrow.color, fontVariantNumeric: "tabular-nums" }}>
              {trendArrow.label} today
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-strong)", fontVariantNumeric: "tabular-nums" }}>{winPct}% — You</span>
          <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)" }}>Projected · {marginLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>Them — {oppPct}%</span>
        </div>
        <div style={{ height: 9, borderRadius: 6, overflow: "hidden", background: "var(--border)" }}>
          <div className="win-prob-bar" style={{ height: "100%", width: `${winPct}%`, background: "linear-gradient(90deg, var(--accent-strong), var(--accent))" }} />
        </div>
        {isUpset && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--amber)", background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.28)", borderRadius: 30, padding: "4px 12px" }}>
              ⚡ {winPct}% chance to steal the win
            </span>
          </div>
        )}
        {isSetupPhase && (
          <p style={{ fontSize: "0.75rem", color: "var(--faint)", textAlign: "center", margin: "12px 0 4px" }}>
            {gamesThisNight && gamesThisNight > 0
              ? `Scores appear once tonight's games go final · ${gamesThisNight} game${gamesThisNight !== 1 ? "s" : ""} tonight`
              : "Scores update as PWHL games are played this week"}
          </p>
        )}
        <p style={{ fontSize: "0.75rem", color: "var(--faint)", textAlign: "center", margin: "12px 0 0" }}>
          Fantasy points (FP) decide who wins the week. Winning earns Victory Points (VP) in the standings.
        </p>
      </div>

      {/* Footer CTA */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "18px 30px 24px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontSize: 12.5, color: "var(--dim)", minWidth: 160 }}>
          {isUpcoming
            ? <>Set your lineup before puck drop — you have <strong style={{ color: "var(--gold)", fontWeight: 700 }}>{startersWithGames} starter{startersWithGames !== 1 ? "s" : ""}</strong> with games this period.</>
            : <>{startersWithGames} starter{startersWithGames !== 1 ? "s" : ""} active this period.</>
          }
        </span>
        <Link href={matchup.isPlayoff ? `/league/${leagueId}/bracket` : `/league/${leagueId}/matchups`} style={{
          background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
          padding: "12px 20px", borderRadius: 11, fontSize: 14, fontWeight: 600, textDecoration: "none",
          whiteSpace: "nowrap",
        }}>
          {matchup.isPlayoff ? "View bracket" : "View schedule"}
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

export function MatchupHero({ matchup, teamId, leagueId, myAccentColor, oppAccentColor, gamesThisNight }: {
  matchup: ActiveMatchup; teamId: string; leagueId: string;
  myAccentColor: string | null; oppAccentColor: string | null;
  gamesThisNight?: number;
}) {
  return matchup.opponentTeam
    ? <DuelHero matchup={matchup} opponent={matchup.opponentTeam} teamId={teamId} leagueId={leagueId} myAccentColor={myAccentColor} oppAccentColor={oppAccentColor} gamesThisNight={gamesThisNight} />
    : <FieldHero matchup={matchup} teamId={teamId} leagueId={leagueId} gamesThisNight={gamesThisNight} />;
}
