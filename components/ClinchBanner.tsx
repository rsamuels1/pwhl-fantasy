"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Props {
  leagueId: string;
  season: string;
  seed: number;
  clinchWeek: number;
  teamName: string;
  bracketHref: string;
}

export default function ClinchBanner({ leagueId, season, seed, clinchWeek, teamName, bracketHref }: Props) {
  const [visible, setVisible] = useState(false);
  const storageKey = `clinch-seen-${leagueId}-${season}`;

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) setVisible(true);
  }, [storageKey]);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
  }

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(95,169,140,0.12), rgba(95,169,140,0.06))",
      border: "1px solid rgba(95,169,140,0.35)",
      borderRadius: 16, padding: "16px 20px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 24 }}>🏒</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#7fc2a6", letterSpacing: "-0.01em" }}>
            PLAYOFF BERTH CLINCHED
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            {teamName} clinched the {ordinal(seed)} seed in Week {clinchWeek}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href={bracketHref} style={{
          fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
          background: "rgba(95,169,140,0.15)", color: "#7fc2a6",
          border: "1px solid rgba(95,169,140,0.3)", textDecoration: "none",
        }}>
          View bracket →
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss clinch banner"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#64748b", fontSize: 18, padding: "4px 8px", lineHeight: 1,
            minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
