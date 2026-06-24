"use client";
// components/OpeningDayCard.tsx
// Shown for 72h after the first scoring period starts.
// localStorage key prevents re-showing after dismiss.

import { useState, useEffect } from "react";

interface Props {
  leagueId: string;
  season: string;
  weekCount: number;
  managerCount: number;
  periodStartsAt: string; // ISO string
}

export default function OpeningDayCard({
  leagueId,
  season,
  weekCount,
  managerCount,
  periodStartsAt,
}: Props) {
  const [visible, setVisible] = useState(false);
  const storageKey = `${leagueId}-opening-day-seen`;

  useEffect(() => {
    if (localStorage.getItem(storageKey)) return;
    const startMs = new Date(periodStartsAt).getTime();
    const nowMs = Date.now();
    const seventyTwoHours = 72 * 60 * 60 * 1000;
    if (nowMs - startMs <= seventyTwoHours) {
      setVisible(true);
    }
  }, [storageKey, periodStartsAt]);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
  }

  return (
    <div
      className="alert-amber"
      style={{
        position: "relative",
        padding: "18px 22px",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(500px 200px at 90% -10%, rgba(212,175,55,0.15), transparent 70%)",
        }}
      />
      <div style={{ position: "relative" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--gold)",
            marginBottom: 6,
          }}
        >
          Season Opener
        </div>
        <div
          className="font-stats"
          style={{
            fontSize: "clamp(24px, 5vw, 34px)",
            fontWeight: 700,
            color: "var(--gold)",
            lineHeight: 1.1,
            marginBottom: 8,
          }}
        >
          Welcome to the {season} Season
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            fontSize: 13,
            color: "var(--dim)",
          }}
        >
          <span>{weekCount} weeks · {managerCount} managers</span>
          <span style={{ color: "var(--faint)" }}>Let&apos;s get to work.</span>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss opening day card"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--faint)",
          fontSize: 18,
          padding: "4px 8px",
          lineHeight: 1,
          minWidth: 44,
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
        }}
      >
        ✕
      </button>
    </div>
  );
}
