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
  // Default simulated date to 1 minute past the next unscored period end.
  const nextPending = periods.find(
    (p) => p.status === "SCORING_PENDING" || p.status === "ACTIVE"
  );
  const defaultDate = nextPending
    ? new Date(nextPending.period.endsAt.getTime() + 60_000).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16);
  const [simulatedDate, setSimulatedDate] = useState(defaultDate);

  async function call(action: "start" | "advance") {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/leagues/${leagueId}/season/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulatedDate: new Date(simulatedDate).toISOString(), action }),
    });
    const data = await res.json() as { message?: string; state?: SeasonState; error?: string };
    setLoading(false);
    if (!res.ok || data.error) { setError(data.error ?? "Request failed."); return; }
    if (data.state) onResult(data.state, data.message ?? "Done.");
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
      {error && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#f87171" }}>{error}</p>}
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    background: bg, border: "none", borderRadius: 10,
    color: "#fff", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  };
}
