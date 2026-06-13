import { Matchup } from "@prisma/client";

interface Props {
  myTeamId: string;
  opponentTeamId: string;
  opponentName: string;
  matchups: Array<Matchup & { homeTeam?: { name: string }; awayTeam?: { name: string } }>;
  limit?: number;
}

export function HeadToHeadHistory({
  myTeamId,
  opponentTeamId,
  opponentName,
  matchups,
  limit = 5,
}: Props) {
  // Filter to H2H regular season matchups and sort by date descending
  const h2h = matchups
    .filter(
      (m) =>
        !m.isPlayoff &&
        m.homeScore !== null &&
        m.awayScore !== null &&
        ((m.homeTeamId === myTeamId && m.awayTeamId === opponentTeamId) ||
          (m.homeTeamId === opponentTeamId && m.awayTeamId === myTeamId))
    )
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .slice(0, limit);

  if (h2h.length === 0) {
    return (
      <div
        style={{
          padding: "12px 14px",
          background: "rgba(148,163,184,0.04)",
          border: "1px solid rgba(148,163,184,0.1)",
          borderRadius: 8,
          fontSize: 13,
          color: "#94a3b8",
        }}
      >
        No head-to-head matchups yet.
      </div>
    );
  }

  // Compute overall record
  let record = { wins: 0, losses: 0, ties: 0 };
  h2h.forEach((m) => {
    const isHome = m.homeTeamId === myTeamId;
    const myScore = isHome ? m.homeScore! : m.awayScore!;
    const oppScore = isHome ? m.awayScore! : m.homeScore!;

    if (myScore > oppScore) record.wins++;
    else if (oppScore > myScore) record.losses++;
    else record.ties++;
  });

  const recordStr = `${record.wins}-${record.losses}${record.ties > 0 ? `-${record.ties}` : ""}`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>
          Season Series vs {opponentName}
        </p>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
          {recordStr}
        </p>
      </div>

      <div style={{ display: "grid", gap: 6, maxHeight: 300, overflowY: "auto" }}>
        {h2h.map((m) => {
          const isHome = m.homeTeamId === myTeamId;
          const myScore = isHome ? m.homeScore! : m.awayScore!;
          const oppScore = isHome ? m.awayScore! : m.homeScore!;
          const won = myScore > oppScore ? "W" : oppScore > myScore ? "L" : "T";
          const wonColor = won === "W" ? "#34d399" : won === "L" ? "#f87171" : "#fbbf24";

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(148,163,184,0.07)",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              <span style={{ color: wonColor, fontWeight: 700, minWidth: 24 }}>
                {won}
              </span>
              <span style={{ color: "#94a3b8", flex: 1 }}>
                {new Date(m.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              <span style={{ fontWeight: 700, color: "#e2e8f0" }}>
                {myScore} – {oppScore}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
