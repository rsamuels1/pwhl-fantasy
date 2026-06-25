"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  leagueId: string;
  currentRound?: number;
  totalRounds?: number;
}

export default function PlayoffsPanel({ leagueId, currentRound = 1, totalRounds = 2 }: Props) {
  const router = useRouter();
  const [isScoring, setIsScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAllScored = currentRound > totalRounds;
  const roundLabel = currentRound === totalRounds ? "Championship" : `Round ${currentRound}`;
  const buttonLabel = `Score ${roundLabel}`;

  const handleAdvanceRound = async () => {
    setIsScoring(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/advance-playoff-round`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to advance playoff round");
        setIsScoring(false);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsScoring(false);
    }
  };

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
      <h2 style={{ fontSize: 28, fontWeight: 700, marginTop: 0, marginBottom: 16, color: "var(--text)" }}>
        🏆 Playoffs In Progress
      </h2>

      <p style={{ fontSize: 15, color: "var(--dim)", marginBottom: 24 }}>
        {isAllScored
          ? "The playoff tournament is complete!"
          : `Round ${currentRound} of ${totalRounds} — score the matchups to advance.`}
      </p>

      {error && (
        <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 16 }}>
          Error: {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {!isAllScored && (
          <button
            onClick={handleAdvanceRound}
            disabled={isScoring}
            style={{
              padding: "12px 28px",
              background: isScoring ? "#666666" : "#10b981",
              color: "var(--accent-ink)",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor: isScoring ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
              opacity: isScoring ? 0.6 : 1,
            }}
            onMouseEnter={(e) => !isScoring && (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => !isScoring && (e.currentTarget.style.opacity = "1")}
          >
            {isScoring ? "Scoring..." : buttonLabel}
          </button>
        )}

        <Link
          href={`/league/${leagueId}/bracket`}
          style={{
            display: "inline-block",
            padding: "12px 28px",
            background: "#d97706",
            color: "var(--accent-ink)",
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
    </div>
  );
}
