"use client";

import type { RivalInfo } from "@/lib/playoffs/seeding";

interface Props {
  rival: RivalInfo;
  compact?: boolean;
  lastResultAgainstRival?: { won: boolean; myScore: number; oppScore: number } | null;
}

export function RivalBadge({ rival, compact = false, lastResultAgainstRival = null }: Props) {
  const showCelebratory = lastResultAgainstRival?.won;

  if (compact) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 7px",
          background: "rgba(251,146,60,0.1)",
          border: "1px solid rgba(251,146,60,0.3)",
          borderRadius: 5,
          fontSize: 11,
          fontWeight: 700,
          color: "#fb923c",
          letterSpacing: "0.04em",
          verticalAlign: "middle",
        }}
        title="Your closest competition — your scores have been neck-and-neck all season."
      >
        🔥 RIVAL
      </span>
    );
  }

  const { record, avgMargin, gamesPlayed } = rival;
  const seriesLabel = `${record.wins}–${record.losses}${record.ties > 0 ? `–${record.ties}` : ""}`;
  const isDeadEven = record.wins === record.losses;

  return (
    <div
      style={{
        padding: "16px 18px",
        background: showCelebratory
          ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(52,211,153,0.04))"
          : "rgba(251,146,60,0.06)",
        border: showCelebratory
          ? "1px solid rgba(34,197,94,0.3)"
          : "1px solid rgba(251,146,60,0.25)",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>🔥</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: showCelebratory ? "#34d399" : "#fb923c" }}>
            {showCelebratory ? "Rivalry Win!" : "Your Rival"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginTop: 1 }}>
            {rival.teamName}
          </div>
        </div>
      </div>

      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--dim)", lineHeight: 1.5 }}>
        You two can&apos;t shake each other. Across {gamesPlayed} week{gamesPlayed !== 1 ? "s" : ""} your
        scores have landed an average of{" "}
        <strong style={{ color: "var(--text)" }}>{avgMargin.toFixed(1)} points apart</strong> — closer than
        any other team in the league.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            flex: 1,
            minWidth: 100,
            padding: "10px 12px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Season Series
          </div>
          <div className="font-stats" style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
            {seriesLabel}
          </div>
          {isDeadEven && (
            <div style={{ fontSize: 11, color: "#fb923c", marginTop: 2 }}>Dead even.</div>
          )}
        </div>

        {lastResultAgainstRival && (
          <div
            style={{
              flex: 1,
              minWidth: 100,
              padding: "10px 12px",
              background: showCelebratory ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.04)",
              borderRadius: 8,
              border: showCelebratory ? "1px solid rgba(34,197,94,0.2)" : "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              Last Result
            </div>
            <div className="font-stats" style={{ fontSize: 14, fontWeight: 700, color: showCelebratory ? "#34d399" : "#f87171" }}>
              You {lastResultAgainstRival.myScore.toFixed(1)}, them {lastResultAgainstRival.oppScore.toFixed(1)}
            </div>
            <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
              {showCelebratory ? "Won by a whisker." : "Lost by a whisker."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
