"use client";

import { useState } from "react";

interface RivalInfo {
  teamId: string;
  teamName: string;
  matchupCount: number;
  record: { wins: number; losses: number; ties: number };
}

interface Props {
  rival: RivalInfo | null;
  compact?: boolean; // If true, show just the badge; if false, include record detail
}

export function RivalBadge({ rival, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!rival) return null;

  const recordStr = `${rival.record.wins}-${rival.record.losses}${rival.record.ties > 0 ? `-${rival.record.ties}` : ""}`;

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
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(251,146,60,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(251,146,60,0.1)";
        }}
        title={`Played vs ${rival.teamName} ${rival.matchupCount} times`}
      >
        🔥 Rival
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "rgba(251,146,60,0.08)",
          border: "1px solid rgba(251,146,60,0.2)",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          color: "#fb923c",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(251,146,60,0.12)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(251,146,60,0.08)";
        }}
      >
        <span>🔥 Rival: {rival.teamName}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
          {expanded ? "▼" : "▶"}
        </span>
      </button>

      {expanded && (
        <div
          style={{
            padding: "12px 14px",
            background: "rgba(251,146,60,0.04)",
            border: "1px solid rgba(251,146,60,0.15)",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <p style={{ margin: "0 0 4px", color: "#94a3b8", fontSize: 11 }}>
              HEAD-TO-HEAD RECORD
            </p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
              {recordStr} ({rival.matchupCount} matchups)
            </p>
          </div>
          <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>
            Most-played opponent in the season
          </p>
        </div>
      )}
    </div>
  );
}
