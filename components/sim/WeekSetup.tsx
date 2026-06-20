"use client";

import Link from "next/link";
import type { ScoringPeriod } from "@/lib/scoring/periods";

interface Props {
  leagueId: string;
  period: ScoringPeriod;
  weekNumber: number;
  commTeamId?: string;
  commTeamName?: string;
  onSimulate: () => void;
  isSimulating: boolean;
}

export default function WeekSetup({
  leagueId,
  period,
  weekNumber,
  commTeamId,
  commTeamName,
  onSimulate,
  isSimulating,
}: Props) {
  const startDate = period.startsAt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const endDate = period.endsAt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
      {/* Left column: Lineup + CTA */}
      <div>
        <div
          style={{
            background: "rgba(30, 30, 46, 0.5)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 12, color: "#cbd5e1" }}>
            Your Lineup
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#94a3b8" }}>
            📋 Set your active players and bench for Week {weekNumber} ({startDate} – {endDate})
          </p>
          {commTeamId && (
            <Link
              href={`/team/${commTeamId}/lineup`}
              style={{
                display: "inline-block",
                padding: "8px 16px",
                background: "rgba(99, 102, 241, 0.1)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                color: "#a5b4fc",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Edit Lineup →
            </Link>
          )}
        </div>

        {/* Simulate button */}
        <button
          onClick={onSimulate}
          disabled={isSimulating}
          style={{
            width: "100%",
            padding: "16px 20px",
            background: isSimulating ? "#6366f1" : "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            cursor: isSimulating ? "wait" : "pointer",
            opacity: isSimulating ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          ⚡ Simulate Week {weekNumber} →
        </button>
      </div>

      {/* Right column: Matchup preview */}
      <div
        style={{
          background: "rgba(30, 30, 46, 0.5)",
          border: "1px solid rgba(148, 163, 184, 0.2)",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 16, color: "#cbd5e1" }}>
          This Week's Matchup
        </h3>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
          <p style={{ margin: 0, marginBottom: 8 }}>📊 You vs. Field (Vertical Trade Format)</p>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            All teams compete for the highest score this week. Projected scores will update as the week progresses.
          </p>
        </div>

        {/* Quick actions */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(148, 163, 184, 0.1)" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1", margin: "0 0 12px 0" }}>Quick Links</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {commTeamId && (
              <Link
                href={`/team/${commTeamId}/roster`}
                style={{
                  fontSize: 13,
                  color: "#a5b4fc",
                  textDecoration: "none",
                  padding: "6px 0",
                }}
              >
                → Waiver Wire & Free Agents
              </Link>
            )}
            <Link
              href={`/league/${leagueId}/standings`}
              style={{
                fontSize: 13,
                color: "#a5b4fc",
                textDecoration: "none",
                padding: "6px 0",
              }}
            >
              → Current Standings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
