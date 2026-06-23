"use client";

import { useState, useEffect } from "react";
import type { FirstResultContext } from "@/lib/services/dashboard";

interface Props {
  userId: string;
  leagueId: string;
  ctx: FirstResultContext;
}

export default function FirstResultCard({ userId, leagueId, ctx }: Props) {
  const [visible, setVisible] = useState(false);
  const storageKey = `first-result-seen-${userId}-${leagueId}`;

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) setVisible(true);
  }, [storageKey]);

  if (!visible) return null;

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
  };

  return (
    <div style={{
      background: "rgba(143,193,232,0.06)",
      border: "1px solid var(--accent-border)",
      borderRadius: 16, padding: "16px 20px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)" }}>
          Your first scored week
        </span>
        <button
          onClick={() => { localStorage.setItem(storageKey, "1"); setVisible(false); }}
          aria-label="Dismiss"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--faint)", fontSize: 16, padding: "4px 8px", lineHeight: 1,
            minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>

      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
        You finished {ordinal(ctx.weekRank)} of {ctx.teamCount} teams this week.
        Your starters earned <strong style={{ color: "var(--text)" }}>{ctx.myScore.toFixed(1)} FP</strong>.
        {ctx.topContributor && (
          <> <strong style={{ color: "var(--text)" }}>{ctx.topContributor.name}</strong> led
          your week with {ctx.topContributor.fp.toFixed(1)} FP.</>
        )}
      </p>

      <p style={{ fontSize: 12, color: "var(--dim)", margin: 0, lineHeight: 1.6 }}>
        Fantasy standings rank all {ctx.teamCount} teams each week — not just your opponent —
        so every point matters. Set a full lineup and pick up players with more games next week to climb.
      </p>

      {ctx.actionableGap && (
        <p style={{ fontSize: 12, color: "#f5c97b", margin: 0 }}>
          Tip: {ctx.actionableGap}
        </p>
      )}
    </div>
  );
}
