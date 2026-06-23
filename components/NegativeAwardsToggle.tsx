"use client";
// components/NegativeAwardsToggle.tsx
// Commissioner toggle: show or hide negative-valence weekly awards (Frozen Stick, Heartbreaker, Collapse).
// Stored in league.scoringSettings.showNegativeAwards JSON field (no schema migration needed).

import { useState } from "react";

export default function NegativeAwardsToggle({
  leagueId,
  defaultValue,
}: {
  leagueId: string;
  defaultValue: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultValue);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleChange(next: boolean) {
    setEnabled(next);
    setStatus("saving");
    try {
      const res = await fetch(`/api/leagues/${leagueId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showNegativeAwards: next }),
      });
      setStatus(res.ok ? "saved" : "error");
      if (!res.ok) setEnabled(!next); // revert on error
    } catch {
      setStatus("error");
      setEnabled(!next);
    }
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleChange(e.target.checked)}
          disabled={status === "saving"}
          style={{ width: 16, height: 16, accentColor: "#a78bfa", cursor: "pointer" }}
        />
        <span style={{ fontSize: 13, color: "var(--text)" }}>
          Show negative awards (🧊 Frozen Stick, 💀 Heartbreaker, 📉 Collapse of the Week)
        </span>
      </label>
      {status === "saving" && (
        <span style={{ fontSize: 11, color: "var(--dim)" }}>Saving…</span>
      )}
      {status === "saved" && (
        <span style={{ fontSize: 11, color: "#5fa98c" }}>Saved</span>
      )}
      {status === "error" && (
        <span style={{ fontSize: 11, color: "#f87171" }}>Failed to save</span>
      )}
    </div>
  );
}
