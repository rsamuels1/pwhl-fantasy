"use client";

import { useState, useRef, useEffect } from "react";

export function VpExplainer() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <span ref={containerRef} style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: "0.4rem" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="How does VP work?"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 19,
          height: 19,
          borderRadius: "50%",
          border: open ? "none" : "1px solid var(--dim)",
          background: open ? "var(--accent)" : "transparent",
          color: open ? "var(--accent-ink)" : "var(--dim)",
          fontSize: "0.68rem",
          fontWeight: 700,
          cursor: "pointer",
          lineHeight: 1,
          transition: "background 0.14s, color 0.14s",
          flexShrink: 0,
        }}
      >
        ?
      </button>

      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 11px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 296,
            zIndex: 50,
            background: "var(--card-hover)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "14px 16px",
            boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
            animation: "vpPopIn 0.14s ease-out",
          }}
        >
          {/* Arrow caret */}
          <span style={{
            position: "absolute",
            top: -5,
            left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            width: 9,
            height: 9,
            background: "var(--card-hover)",
            borderTop: "1px solid var(--border)",
            borderLeft: "1px solid var(--border)",
            display: "block",
          }} />

          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            How Victory Points work
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
            {[
              { label: "Win your matchup", value: "+2 VP" },
              { label: "Tie your matchup", value: "+1 VP" },
              { label: "Highest score in the league", value: "+2 VP" },
              { label: "Second-highest score", value: "+1 VP" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <p style={{ margin: 0, fontSize: 11, color: "var(--faint)", lineHeight: 1.5, borderTop: "1px solid var(--border-soft)", paddingTop: 8 }}>
            Your weekly <strong style={{ color: "var(--dim)" }}>fantasy points (FP)</strong> total decides who wins each matchup — winning earns VP toward the season standings. Max 4 VP per week.
          </p>

          <style>{`
            @keyframes vpPopIn {
              from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </span>
      )}
    </span>
  );
}
