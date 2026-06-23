"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const PALETTE = [
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#10b981", label: "Emerald" },
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#a855f7", label: "Purple" },
];

interface Props {
  leagueId: string;
  teamId: string;
  currentColor: string | null;
}

export default function TeamColorPicker({ leagueId, teamId, currentColor }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(currentColor);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function pick(color: string | null) {
    setSelected(color);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/teams/${teamId}/color`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accentColor: color }),
      });
      if (!res.ok) {
        setError("Failed to save color.");
        setSelected(currentColor);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 12, color: "var(--dim)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Team color
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {PALETTE.map(({ hex, label }) => (
          <button
            key={hex}
            onClick={() => pick(hex)}
            disabled={isPending}
            aria-label={`Set team color to ${label}`}
            title={label}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: hex, border: "none", cursor: "pointer",
              outline: selected === hex ? `3px solid ${hex}` : "none",
              outlineOffset: 2,
              opacity: isPending ? 0.6 : 1,
              minWidth: 44, minHeight: 44, padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: "50%", background: hex,
              boxShadow: selected === hex ? "0 0 0 2px white inset" : "none",
              display: "block",
            }} />
          </button>
        ))}
        {selected && (
          <button
            onClick={() => pick(null)}
            disabled={isPending}
            title="Remove color"
            style={{
              fontSize: 11, color: "var(--faint)", background: "none", border: "1px solid var(--border)",
              borderRadius: 6, cursor: "pointer", padding: "4px 8px", minWidth: 44, minHeight: 44,
            }}
          >
            Clear
          </button>
        )}
      </div>
      {error && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{error}</p>}
    </div>
  );
}
