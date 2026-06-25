"use client";

import { useState, useEffect } from "react";

interface Props {
  userId: string;
}

const PRIMER_COPY =
  "FP (Fantasy Points) are scored from real PWHL game stats. Each week, your FP total determines your matchup result. Win and rank well to earn VP (Victory Points) — VP drives your league standing. That's how you win.";

export default function VpPrimerCard({ userId }: Props) {
  const [visible, setVisible] = useState(false);
  const storageKey = `vp-primer-seen-${userId}`;

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) setVisible(true);
  }, [storageKey]);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "rgba(143,193,232,0.07)",
        border: "1px solid var(--accent-border)",
        borderRadius: 16,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-strong)" }}>
          How you win in PWHL GM
        </span>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--faint)",
            fontSize: 16,
            padding: "4px 8px",
            lineHeight: 1,
            minWidth: 44,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>

      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
        {PRIMER_COPY}
      </p>

      <button
        onClick={dismiss}
        style={{
          alignSelf: "flex-start",
          fontSize: 12,
          fontWeight: 700,
          padding: "7px 16px",
          borderRadius: 8,
          background: "rgba(143,193,232,0.14)",
          color: "var(--accent-strong)",
          border: "1px solid rgba(143,193,232,0.3)",
          cursor: "pointer",
        }}
      >
        Got it — let&apos;s play
      </button>
    </div>
  );
}
