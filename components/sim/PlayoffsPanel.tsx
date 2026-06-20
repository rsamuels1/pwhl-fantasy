"use client";

import Link from "next/link";

interface Props {
  leagueId: string;
}

export default function PlayoffsPanel({ leagueId }: Props) {
  return (
    <div
      style={{
        background: "rgba(30, 30, 46, 0.5)",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        borderRadius: 12,
        padding: 32,
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: 28, fontWeight: 700, marginTop: 0, marginBottom: 16, color: "#e2e8f0" }}>
        🏆 Playoffs In Progress
      </h2>

      <p style={{ fontSize: 15, color: "#94a3b8", marginBottom: 24 }}>
        The playoff tournament is underway. Head to the bracket view to see matchups and advance rounds.
      </p>

      <Link
        href={`/league/${leagueId}/bracket`}
        style={{
          display: "inline-block",
          padding: "12px 28px",
          background: "#d97706",
          color: "#fff",
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
          transition: "opacity 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        View Bracket →
      </Link>
    </div>
  );
}
