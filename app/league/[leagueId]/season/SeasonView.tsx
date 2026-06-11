"use client";

import { useState } from "react";
import type { SeasonState, PeriodState } from "@/lib/season/lifecycle";
import SeasonControls from "./SeasonControls";

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "#64748b",
  ACTIVE: "#f59e0b",
  SCORING_PENDING: "#a78bfa",
  COMPLETE: "#34d399",
  PRE_SEASON: "#64748b",
  IN_PROGRESS: "#f59e0b",
  COMPLETE_SEASON: "#34d399",
};

const STATUS_LABELS: Record<string, string> = {
  UPCOMING: "Upcoming",
  ACTIVE: "Active",
  SCORING_PENDING: "Scoring due",
  COMPLETE: "Complete",
  PRE_SEASON: "Pre-season",
  IN_PROGRESS: "In progress",
};

interface Props {
  leagueId: string;
  initialState: SeasonState;
  isDev: boolean;
}

export default function SeasonView({ leagueId, initialState, isDev }: Props) {
  const [state, setState] = useState(initialState);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  // Re-hydrate dates since they're serialized as strings by Next.js
  const periods: PeriodState[] = state.periods.map((p) => ({
    ...p,
    period: {
      ...p.period,
      startsAt: new Date(p.period.startsAt),
      endsAt: new Date(p.period.endsAt),
    },
  }));

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);

  const lifecycleColor =
    state.lifecycleStatus === "COMPLETE"
      ? STATUS_COLORS.COMPLETE
      : state.lifecycleStatus === "IN_PROGRESS"
      ? STATUS_COLORS.ACTIVE
      : STATUS_COLORS.UPCOMING;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Season</h1>
        <span style={{ fontSize: 13, fontWeight: 600, color: lifecycleColor }}>
          {STATUS_LABELS[state.lifecycleStatus] ?? state.lifecycleStatus}
        </span>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          {state.completedWeeks}/{state.totalWeeks} weeks complete
        </span>
      </div>

      {lastMessage && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", fontSize: 13, color: "#6ee7b7" }}>
          {lastMessage}
        </div>
      )}

      {/* Period table */}
      {periods.length === 0 ? (
        <div style={panel}>
          <p style={{ color: "#64748b", margin: 0 }}>
            No periods found for this league's season. Make sure the 2025-26 fixture is loaded
            and the league's <code>season</code> field matches.
          </p>
        </div>
      ) : (
        <div style={panel}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 14 }}>
            Scoring periods
          </div>

          <div style={{ overflowX: "auto" }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 80px 80px 100px", gap: 8, padding: "0 8px 8px", borderBottom: "1px solid rgba(148,163,184,0.1)", fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 390 }}>
            <span>Wk</span>
            <span>Dates</span>
            <span>Games</span>
            <span>Final</span>
            <span>Status</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4, minWidth: 390 }}>
            {periods.map(({ period, status, gamesTotal, gamesFinal }) => {
              const isActive = status === "ACTIVE";
              const color = STATUS_COLORS[status] ?? "#64748b";
              return (
                <div
                  key={period.week}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr 80px 80px 100px",
                    gap: 8, padding: "9px 8px", borderRadius: 8,
                    background: isActive ? "rgba(245,158,11,0.06)" : "transparent",
                    border: isActive ? "1px solid rgba(245,158,11,0.15)" : "1px solid transparent",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 700, color: isActive ? "#f59e0b" : "#94a3b8" }}>
                    {period.week}
                  </span>
                  <span style={{ fontSize: 13, color: "#cbd5e1" }}>
                    {fmt(period.startsAt)} – {fmt(period.endsAt)}
                  </span>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>{gamesTotal}</span>
                  <span style={{ fontSize: 13, color: gamesFinal === gamesTotal && gamesTotal > 0 ? "#34d399" : "#94a3b8" }}>
                    {gamesFinal}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, padding: "2px 8px", borderRadius: 6, textAlign: "center" }}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* Dev test harness */}
      {isDev && (
        <SeasonControls
          leagueId={leagueId}
          periods={periods}
          onResult={(newState, msg) => {
            setState(newState);
            setLastMessage(msg);
          }}
        />
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(148,163,184,0.1)",
  borderRadius: 14,
  padding: 16,
};
