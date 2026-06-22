"use client";

import { useState } from "react";

export function VpExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", marginLeft: "0.5rem" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="How does VP work?"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "1.25rem",
          height: "1.25rem",
          borderRadius: "50%",
          border: "1px solid var(--muted, #888)",
          background: "transparent",
          color: "var(--muted, #888)",
          fontSize: "0.7rem",
          fontWeight: 700,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ?
      </button>
      {open && (
        <span
          style={{
            position: "absolute",
            zIndex: 50,
            background: "var(--surface, #1e1e2e)",
            border: "1px solid var(--border, #333)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            maxWidth: "280px",
            fontSize: "0.8rem",
            lineHeight: 1.5,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <strong>Victory Points (VP)</strong>
          <br />
          Each week you earn VP two ways:
          <ul style={{ margin: "0.4rem 0 0 1rem", padding: 0 }}>
            <li>Win your matchup: <strong>+2 VP</strong></li>
            <li>Tie your matchup: <strong>+1 VP</strong></li>
            <li>Highest score in the league: <strong>+2 VP bonus</strong></li>
            <li>Second-highest score: <strong>+1 VP bonus</strong></li>
          </ul>
          <p style={{ margin: "0.4rem 0 0" }}>
            Maximum 4 VP per week. Standings are ranked by total VP, not wins alone.
          </p>
          <p style={{ margin: "0.4rem 0 0", borderTop: "1px solid rgba(148,163,184,0.12)", paddingTop: "0.4rem", color: "var(--muted, #888)" }}>
            Your weekly <strong style={{ color: "inherit" }}>fantasy points (FP)</strong> total determines who wins each matchup — winning earns you VP for the season standings.
          </p>
          <button
            onClick={() => setOpen(false)}
            style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "var(--muted, #888)", background: "none", border: "none", cursor: "pointer" }}
          >
            Close
          </button>
        </span>
      )}
    </span>
  );
}
