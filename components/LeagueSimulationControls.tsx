"use client";

import { useState } from "react";

export default function LeagueSimulationControls({ leagueId }: { leagueId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const runSimulation = async (action: "nextWeek" | "all") => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "Simulation failed.");
      } else {
        setMessage(data.message || "Simulation complete.");
      }
    } catch (error) {
      setMessage("Unable to run simulation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 16, padding: 18, background: "var(--bg-raised)", borderRadius: 18 }}>
      <p style={{ margin: 0, color: "var(--dim)" }}>
        Run last season simulation weeks from the current league state.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button
          type="button"
          disabled={loading}
          onClick={() => runSimulation("nextWeek")}
          style={buttonStyle}
        >
          {loading ? "Simulating…" : "Simulate next week"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => runSimulation("all")}
          style={{ ...buttonStyle, background: "#1d4ed8" }}
        >
          {loading ? "Simulating…" : "Simulate all remaining weeks"}
        </button>
      </div>
      {message && <p style={{ margin: 0, color: "var(--text)" }}>{message}</p>}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 14,
  background: "var(--accent)",
  color: "var(--accent-ink)",
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};
