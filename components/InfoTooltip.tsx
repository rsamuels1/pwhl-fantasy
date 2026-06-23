"use client";
// components/InfoTooltip.tsx
// Tappable ⓘ button that toggles an inline plain-language explainer.
// 44px minimum touch target; keyboard and screen-reader accessible.

import { useState } from "react";

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="What does this mean?"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 44,
          minHeight: 44,
          padding: "0 10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          color: "var(--dim, #64748b)",
          lineHeight: 1,
          borderRadius: 6,
        }}
      >
        ⓘ
      </button>
      {open && (
        <aside
          style={{
            marginTop: 4,
            padding: "8px 12px",
            background: "rgba(100,116,139,0.10)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--muted, #94a3b8)",
            lineHeight: 1.5,
            maxWidth: 280,
          }}
        >
          {text}
        </aside>
      )}
    </span>
  );
}
