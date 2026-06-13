"use client";

import { useState, useTransition } from "react";

interface SimResult {
  leagueId: string;
  champion: string;
  weeks: number;
  playoffRounds: number;
  durationMs: number;
  pass: boolean;
}

export function SimulateCenter() {
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(leagueSize: 4 | 6 | 8) {
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/founder/simulate-season", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leagueSize }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unknown error");
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div>
      <div style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "1.25rem", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.82rem", color: "#888", marginBottom: "1rem", lineHeight: 1.6 }}>
          Creates a throwaway league, auto-drafts all teams using real 2025-26 season data as the player pool, advances through the full regular season and playoffs, and reports the champion. This validates that the entire product flow completes without errors.
          <br /><br />
          <strong style={{ color: "#f59e0b" }}>Requires:</strong> 2025-26 fixture loaded in DB (<code style={{ background: "#0a0a0a", padding: "0 0.3rem" }}>npm run seed-fixture -- --season 2025-26</code>)
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {([4, 6, 8] as const).map((size) => (
            <button
              key={size}
              onClick={() => run(size)}
              disabled={isPending}
              style={{ background: "#0f1a0f", border: "1px solid #2d4a2d", borderRadius: "4px", padding: "0.5rem 1.25rem", color: "#22c55e", fontFamily: "monospace", fontSize: "0.85rem", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}
            >
              Run {size}-Team Sim
            </button>
          ))}
        </div>
      </div>

      {isPending && (
        <div style={{ background: "#111", border: "1px solid #333", borderRadius: "6px", padding: "1rem", color: "#888", fontSize: "0.85rem" }}>
          Running simulation — this may take 15–30 seconds…
        </div>
      )}

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "6px", padding: "1rem", color: "#ef4444", fontSize: "0.85rem" }}>
          ✗ {error}
        </div>
      )}

      {result && (
        <div style={{ background: result.pass ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.1)", border: `1px solid ${result.pass ? "#22c55e" : "#ef4444"}`, borderRadius: "6px", padding: "1.25rem" }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: result.pass ? "#22c55e" : "#ef4444", marginBottom: "0.75rem" }}>
            {result.pass ? "✅ PASS" : "✗ FAIL"} — Full Season Simulation
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
            {[
              { label: "Champion", value: result.champion },
              { label: "Reg Season Weeks", value: String(result.weeks) },
              { label: "Playoff Rounds", value: String(result.playoffRounds) },
              { label: "Duration", value: `${(result.durationMs / 1000).toFixed(1)}s` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#111", border: "1px solid #222", borderRadius: "4px", padding: "0.5rem 0.75rem" }}>
                <div style={{ fontSize: "0.7rem", color: "#666", marginBottom: "0.2rem" }}>{label}</div>
                <div style={{ color: "#ccc", fontWeight: 600, fontSize: "0.85rem" }}>{value}</div>
              </div>
            ))}
          </div>
          <a href={`/founder/leagues/${result.leagueId}`} style={{ color: "#64b5f6", fontSize: "0.8rem" }}>
            Inspect sim league →
          </a>
        </div>
      )}
    </div>
  );
}
