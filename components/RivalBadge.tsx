"use client";

interface RivalInfo {
  teamId: string;
  teamName: string;
  matchupCount: number;
  record: { wins: number; losses: number; ties: number };
}

interface Props {
  rival: RivalInfo | null;
  compact?: boolean; // If true, show just the badge; if false, show expanded inline
  lastResultAgainstRival?: { won: boolean; myScore: number; oppScore: number } | null;
}

export function RivalBadge({ rival, compact = false, lastResultAgainstRival = null }: Props) {
  if (!rival) return null;

  const showCelebratory = lastResultAgainstRival?.won;

  if (compact) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          paddingLeft: 8,
          paddingRight: 10,
          paddingTop: 4,
          paddingBottom: 4,
          background: "rgba(251,146,60,0.1)",
          border: "1px solid rgba(251,146,60,0.3)",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          color: "#fb923c",
          transition: "all 0.15s",
        }}
        title={`Played vs ${rival.teamName} ${rival.matchupCount} times`}
      >
        🔥 Rival
      </div>
    );
  }

  // Expanded non-compact view — always visible
  return (
    <div
      style={{
        padding: "14px 16px",
        background: showCelebratory
          ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(52,211,153,0.04))"
          : "rgba(251,146,60,0.06)",
        border: showCelebratory
          ? "1px solid rgba(34,197,94,0.3)"
          : "1px solid rgba(251,146,60,0.2)",
        borderRadius: 10,
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>🔥</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: showCelebratory ? "#34d399" : "#fb923c" }}>
            {showCelebratory ? "Rivalry Win!" : "Your rival this week"}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            {rival.teamName}
          </div>
        </div>
      </div>

      {lastResultAgainstRival && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            background: showCelebratory ? "rgba(34,197,94,0.08)" : "rgba(251,146,60,0.04)",
            borderRadius: 8,
            border: showCelebratory ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(251,146,60,0.15)",
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
              This week
            </div>
            <div
              className="font-stats"
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: showCelebratory ? "#34d399" : "#e2e8f0",
              }}
            >
              {lastResultAgainstRival.myScore.toFixed(1)} – {lastResultAgainstRival.oppScore.toFixed(1)}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
