"use client";

import { useState } from "react";
import type { SeasonState } from "@/lib/season/lifecycle";

interface Props {
  leagueId: string;
  periods: SeasonState["periods"];
  onResult: (state: SeasonState, message: string) => void;
  isReplay?: boolean;
  replayCurrentDate?: string; // ISO string from DB
  playoffStatus?: string;
  lifecycleStatus?: string;
}

export default function SeasonControls({ leagueId, periods, onResult, isReplay, replayCurrentDate, playoffStatus, lifecycleStatus }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showStartPlayoffs = lifecycleStatus === "COMPLETE" && playoffStatus === "NOT_STARTED";

  const activePeriod = periods.find((p) => p.status === "ACTIVE");
  const firstPending = periods.find((p) => p.status === "SCORING_PENDING");
  const targetPeriod = activePeriod ?? firstPending;
  const defaultDate = targetPeriod
    ? new Date(targetPeriod.period.endsAt.getTime() + 60_000).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16);
  const [simulatedDate, setSimulatedDate] = useState(defaultDate);

  async function call(action: "start" | "advance" | "set-date", overrideDate?: string) {
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

      if (isReplay) {
        // Replay leagues: DB is the source of truth — no cookie to set.
        // Update the date picker to the next period's morning so the next click is pre-filled.
        if (newTarget) {
          const d = new Date(newTarget.period.startsAt);
          d.setHours(9, 0, 0, 0);
          const morning = d.getTime() >= newTarget.period.startsAt.getTime()
            ? d : new Date(newTarget.period.startsAt.getTime() + 5_000);
          setSimulatedDate(morning.toISOString().slice(0, 16));
        }
      } else {
        // Dev mode: set cookie so other pages pick up the simulated time.
        let cookieDate = new Date(dateToUse).toISOString();
        if (newTarget) {
          const d = new Date(newTarget.period.startsAt);
          d.setHours(9, 0, 0, 0);
          const morning = d.getTime() >= newTarget.period.startsAt.getTime()
            ? d : new Date(newTarget.period.startsAt.getTime() + 5_000);
          cookieDate = morning.toISOString();
          setSimulatedDate(morning.toISOString().slice(0, 16));
        }
        document.cookie = `pwhl_dev_sim_date=${cookieDate}; path=/; max-age=86400`;
      }

      onResult(data.state, data.message ?? "Done.");
    }
  }

  async function handleStartPlayoffs() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/leagues/${leagueId}/start-playoffs`, {
      method: "POST",
    });
    const data = await res.json() as { message?: string; error?: string };
    setLoading(false);
    if (!res.ok || data.error) { setError(data.error ?? "Failed to start playoffs."); return; }
    // Reload the page so bracket + playoffStatus refresh from the server.
    window.location.reload();
  }

  function advanceOneDay() {
    if (isReplay) {
      // Replay: advance the DB date by 1 day without scoring.
      const currentIso = replayCurrentDate ?? simulatedDate;
      const d = new Date(currentIso);
      d.setDate(d.getDate() + 1);
      call("set-date", d.toISOString().slice(0, 16));
    } else {
      // Dev: update the cookie and reload.
      const m = document.cookie.match(/pwhl_dev_sim_date=([^;]+)/);
      const current = m ? new Date(decodeURIComponent(m[1])) : new Date();
      current.setDate(current.getDate() + 1);
      const iso = current.toISOString();
      document.cookie = `pwhl_dev_sim_date=${iso}; path=/; max-age=86400`;
      setSimulatedDate(iso.slice(0, 16));
      window.location.reload();
    }
  }

  const borderColor = isReplay ? "rgba(99,102,241,0.4)" : "rgba(251,191,36,0.4)";
  const bgColor = isReplay ? "rgba(99,102,241,0.04)" : "rgba(251,191,36,0.04)";
  const labelColor = isReplay ? "#a5b4fc" : "#fbbf24";

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 14, padding: 16, background: bgColor }}>
      <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: labelColor, textTransform: "uppercase", letterSpacing: 1 }}>
        {isReplay ? "⏪ Replay controls" : "⚠ Dev controls — test harness only"}
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8" }}>
        {isReplay
          ? "Advance weeks manually. Scores use real historical results."
          : "Drives the production engine with a simulated date. No special code path."}
      </p>

      {/* Quick actions row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>
        {targetPeriod && (
          <button
            onClick={() => {
              const endDate = new Date(targetPeriod.period.endsAt.getTime() + 60_000).toISOString().slice(0, 16);
              setSimulatedDate(endDate);
              call("advance", endDate);
            }}
            disabled={loading}
            style={btn("#f59e0b")}
          >
            {loading ? "…" : activePeriod
              ? `⏭ Score week ${targetPeriod.period.week}`
              : `▶ Score week ${targetPeriod.period.week}`}
          </button>
        )}
        <button onClick={advanceOneDay} disabled={loading} style={btn("#10b981")}>
          +1 Day →
        </button>
        {showStartPlayoffs && (
          <button onClick={handleStartPlayoffs} disabled={loading} style={btn("#a855f7")}>
            {loading ? "…" : "▶ Start Playoffs"}
          </button>
        )}
        {targetPeriod && (
          <span style={{ fontSize: 11, color: "#64748b" }}>
            {activePeriod
              ? `Scores week ${targetPeriod.period.week}`
              : `Scores week ${targetPeriod.period.week}`}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {isReplay ? `Current date` : `Simulated "now"`}
          </span>
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

      {!isReplay && (
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
      )}
      {isReplay && error && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f87171" }}>{error}</p>
      )}
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    background: bg, border: "none", borderRadius: 10,
    color: "#fff", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  };
}
