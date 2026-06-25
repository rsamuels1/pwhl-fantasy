// components/TrophyCard.tsx
// Displays a single trophy award — type label, season, brief description.

import type { TrophyType } from "@prisma/client";

interface Props {
  type: TrophyType;
  season: string;
  data?: Record<string, unknown>;
}

const TROPHY_META: Record<TrophyType, { label: string; icon: string; description: (data: Record<string, unknown>) => string }> = {
  CHAMPION: {
    label: "League Champion",
    icon: "🏆",
    description: (d) =>
      d.opponentTeamName
        ? `Won the championship over ${d.opponentTeamName} (${(d.score as number).toFixed(1)}–${(d.opponentScore as number).toFixed(1)}).`
        : "Won the league championship.",
  },
  BEST_RECORD: {
    label: "Best Record",
    icon: "★",
    description: (d) =>
      d.wins !== undefined
        ? `Finished the regular season ${d.wins}–${d.losses} with ${(d.totalFp as number).toFixed(1)} FP.`
        : "Best win-loss record in the regular season.",
  },
  TOP_SCORER: {
    label: "Top Scorer",
    icon: "🔥",
    description: (d) =>
      d.totalFp !== undefined
        ? `Led the league with ${(d.totalFp as number).toFixed(1)} total FP this season.`
        : "Highest total fantasy points in the regular season.",
  },
  MOST_IMPROVED: {
    label: "Most Improved",
    icon: "📈",
    description: (d) =>
      d.improvement !== undefined
        ? `Second-half average was +${d.improvement} FP/week better than the first half.`
        : "Biggest improvement from the first half to the second half of the season.",
  },
  MOST_TRANSACTIONS: {
    label: "Most Active GM",
    icon: "⚙",
    description: (d) =>
      d.count !== undefined
        ? `Made ${d.count} roster moves (adds + drops) over the season.`
        : "Most roster transactions during the regular season.",
  },
};

export default function TrophyCard({ type, season, data = {} }: Props) {
  const meta = TROPHY_META[type];
  if (!meta) return null;

  return (
    <div
      className="rebrand-card"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 18px",
        border: "1px solid rgba(212,175,55,0.25)",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(212,175,55,0.07), rgba(212,175,55,0.02))",
      }}
    >
      <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1, marginTop: 2 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{meta.label}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--faint)",
              background: "var(--bg-raised)",
              borderRadius: 6,
              padding: "2px 7px",
              letterSpacing: "0.05em",
            }}
          >
            {season}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 4, lineHeight: 1.5 }}>
          {meta.description(data)}
        </div>
      </div>
    </div>
  );
}
