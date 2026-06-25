import type { Upset } from "@/lib/services/upset-service";

interface Props {
  upsets: Upset[];
}

export default function UpsetCard({ upsets }: Props) {
  if (upsets.length === 0) return null;

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span className="section-accent" />
        <h2 style={{ fontSize: 12, margin: 0, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" }}>
          Biggest Upsets
        </h2>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {upsets.map((u, i) => {
          const winner = u.underdogWasHome ? u.homeTeamName : u.awayTeamName;
          const loser = u.underdogWasHome ? u.awayTeamName : u.homeTeamName;
          const winnerScore = u.underdogWasHome ? u.homeScore : u.awayScore;
          const loserScore = u.underdogWasHome ? u.awayScore : u.homeScore;
          const pct = Math.round(u.underdogProbability * 100);

          return (
            <div key={i} style={{
              padding: "10px 12px", borderRadius: 10,
              background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                    {winner}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: 6 }}>
                    def. {loser}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
                    Wk {u.week} · {winnerScore.toFixed(1)}–{loserScore.toFixed(1)}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                    background: "rgba(248,113,113,0.12)", color: "#f87171",
                    border: "1px solid rgba(248,113,113,0.25)",
                  }}>
                    {pct}% underdog
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
