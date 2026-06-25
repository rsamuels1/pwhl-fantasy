"use client";
// components/InfoTooltip.tsx
// Tappable ⓘ button that toggles an inline plain-language explainer.
// 44px minimum touch target; keyboard and screen-reader accessible.

import { useState } from "react";

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="What does this mean?"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          color: "var(--dim)",
          lineHeight: 1,
          borderRadius: 6,
        }}
      >
        ⓘ
      </button>
      {open && (
        <aside
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 10,
            width: 220,
            padding: "8px 12px",
            background: "rgba(18,22,32,0.97)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.5,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {text}
        </aside>
      )}
    </span>
  );
}
