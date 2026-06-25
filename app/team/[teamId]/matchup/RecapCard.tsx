import type { WeeklyRecap } from "@/lib/services/dashboard";

export function RecapCard({ recap }: { recap: WeeklyRecap }) {
  const won = recap.result === "win";
  const tie = recap.result === "tie";
  const color = won ? "var(--green)" : tie ? "var(--dim)" : "var(--red)";
  const borderColor = won ? "rgba(95,169,140,0.30)" : tie ? "var(--border)" : "rgba(209,139,127,0.25)";
  const verb = won ? "Won" : "Lost";
  const isLeagueHigh = won && recap.highestScore;

  const periodLabel = recap.isPlayoff && recap.roundLabel
    ? recap.roundLabel
    : `Wk ${recap.week}`;

  const recapCopy = won
    ? recap.opponentName
      ? `Took down ${recap.opponentName}.`
      : "Nice work — you outscored the field."
    : "Tough week. You'll bounce back.";

  return (
    <div className={isLeagueHigh ? "recap-card-win" : undefined} style={{
      background: won ? "linear-gradient(135deg, rgba(81,216,138,0.05), transparent)" : "var(--card)",
      border: `1px solid ${isLeagueHigh ? "rgba(212,175,55,0.30)" : borderColor}`,
      borderRadius: 14,
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
          color, padding: "3px 9px", borderRadius: 20, background: `${color}1f`, flexShrink: 0,
        }}>
          {tie ? "TIE" : verb} · {periodLabel}
        </span>
      </div>

      <div>
        <div className="font-stats" style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>
          {recap.myScore.toFixed(1)}
        </div>
        <div style={{ fontSize: 12, color: "var(--dim)" }}>
          {recapCopy}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
        {recap.myTopPerformer && (
          <span style={{ color: "var(--dim)" }}>
            ⭐ {recap.myTopPerformer.name} led with {recap.myTopPerformer.points.toFixed(1)} pts
          </span>
        )}
        {recap.myRank !== null && recap.teamsCount > 0 && (
          <span style={{ color: "var(--faint)" }}>
            #{recap.myRank} of {recap.teamsCount} this week
          </span>
        )}
        {recap.highestScore && recap.myRank === 1 && (
          <span style={{ color: "var(--gold)", fontWeight: 700 }}>
            🏆 League-high score!
          </span>
        )}
      </div>
    </div>
  );
}
