"use client";

// DEV/TEST harness UI — only rendered when isDev=true (passed from server component).
// Calls /api/leagues/[leagueId]/season/advance with a caller-supplied simulated date.
// This is a thin wrapper over the production advanceSeason engine — no special code path.

import { useState } from "react";
import type { SeasonState } from "@/lib/season/lifecycle";

interface Props {
  leagueId: string;
  periods: SeasonState["periods"];
  onResult: (state: SeasonState, message: string) => void;
}

export default function SeasonControls({ leagueId, periods, onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Default to 1 minute past the ACTIVE period end so one click ends the current week.
  // Fall back to the first SCORING_PENDING period if no active period exists.
  // This handles historical fixture data where all periods are SCORING_PENDING on first load.
  const activePeriod = periods.find((p) => p.status === "ACTIVE");
  const firstPending = periods.find((p) => p.status === "SCORING_PENDING");
  const targetPeriod = activePeriod ?? firstPending;
  const defaultDate = targetPeriod
    ? new Date(targetPeriod.period.endsAt.getTime() + 60_000).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16);
  const [simulatedDate, setSimulatedDate] = useState(defaultDate);

  async function call(action: "start" | "advance", overrideDate?: string) {
    setLoading(true);
    setError(null);
    const dateToUse = overrideDate ?? simulatedDate;
    const res = await fetch(`/api/leagues/${leagueId}/season/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulatedDate: new Date(dateToUse).toISOString(), action }),
    });
    const data = await res.json() as { message?: string; state?: SeasonState; error?: string };
    setLoading(false);
    if (!res.ok || data.error) { setError(data.error ?? "Request failed."); return; }
    if (data.state) {
      document.cookie = `pwhl_dev_sim_date=${new Date(dateToUse).toISOString()}; path=/; max-age=86400`;
      // Auto-advance the date picker to the next target period so the next click
      // is always ready to go without manual input.
      const newPeriods = (data.state.periods as SeasonState["periods"]).map((p) => ({
        ...p,
        period: {
          ...p.period,
          startsAt: new Date(p.period.startsAt),
          endsAt: new Date(p.period.endsAt),
        },
      }));
      const newActive = newPeriods.find((p) => p.status === "ACTIVE");
      const newPending = newPeriods.find((p) => p.status === "SCORING_PENDING");
      const newTarget = newActive ?? newPending;
      if (newTarget) {
        setSimulatedDate(
          new Date(newTarget.period.startsAt.getTime() + 60_000).toISOString().slice(0, 16)
        );
      }
      onResult(data.state, data.message ?? "Done.");
    }
  }

  return (
    <div style={{
      border: "1px dashed rgba(251,191,36,0.4)",
      borderRadius: 14, padding: 16,
      background: "rgba(251,191,36,0.04)",
    }}>
      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: 1 }}>
        ⚠ Dev controls — test harness only
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8" }}>
        Drives the production engine with a simulated date. No special code path.
      </p>
      {/* Quick action: score the next pending or active week with one click */}
      {targetPeriod && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => {
              const endDate = new Date(targetPeriod.period.endsAt.getTime() + 60_000).toISOString().slice(0, 16);
              setSimulatedDate(endDate);
              call("advance", endDate);
            }}
            disabled={loading}
            style={{ ...btn("#f59e0b"), display: "flex", alignItems: "center", gap: 6 }}
          >
            {loading ? "…" : activePeriod
              ? `⏭ End week ${targetPeriod.period.week} now`
              : `▶ Score week ${targetPeriod.period.week}`}
          </button>
          <span style={{ fontSize: 11, color: "#64748b" }}>
            {activePeriod
              ? `Scores the active week and advances to week ${targetPeriod.period.week + 1}`
              : `Scores week ${targetPeriod.period.week} using simulated date`}
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Simulated "now"</span>
          <input
            type="datetime-local"
            value={simulatedDate}
            onChange={(e) => setSimulatedDate(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: 8, color: "#e2e8f0", padding: "6px 10px", fontSize: 13,
            }}
          />
        </label>
        <button onClick={() => call("start")} disabled={loading} style={btn("#6366f1")}>
          {loading ? "…" : "Start season"}
        </button>
        <button onClick={() => call("advance")} disabled={loading} style={btn("#0ea5e9")}>
          {loading ? "…" : "Advance to date"}
        </button>
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => {
            document.cookie = "pwhl_dev_sim_date=; path=/; max-age=0";
            window.location.reload();
          }}
          style={btn("#64748b")}
        >
          Clear sim date
        </button>
        {error && <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{error}</p>}
      </div>
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    background: bg, border: "none", borderRadius: 10,
    color: "#fff", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  };
}
