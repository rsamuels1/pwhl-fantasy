"use client";
// components/ChampionshipBanner.tsx
// Full-screen overlay shown once to the league champion.
// Rendered via ReactDOM.createPortal into document.body.
// Dismissed via localStorage key.

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

interface Props {
  leagueId: string;
  teamName: string;
  season: string;
  record: string; // e.g. "9-3"
  trophiesHref: string;
}

export default function ChampionshipBanner({
  leagueId,
  teamName,
  season,
  record,
  trophiesHref,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const storageKey = `${leagueId}-champion-seen`;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem(storageKey)) {
      setVisible(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (visible) cardRef.current?.focus();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted || !visible) return null;

  function dismiss() {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
  }

  const confettiCount = 24;
  const confettiColors = ["#f5c97b", "#f87171", "#60a5fa", "#34d399", "#c084fc", "#fb923c"];

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.80)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      {/* Confetti pieces */}
      {Array.from({ length: confettiCount }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 1.8;
        const duration = 2 + Math.random() * 2;
        const color = confettiColors[i % confettiColors.length];
        const size = 6 + Math.floor(Math.random() * 8);
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{
              position: "fixed",
              top: "-20px",
              left: `${left}%`,
              width: size,
              height: size * 0.6,
              background: color,
              borderRadius: 2,
              opacity: 0,
              animation: `confettiFall ${duration}s ${delay}s ease-in forwards`,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* Champion card */}
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="champion-dialog-title"
        className="rebrand-card"
        style={{
          position: "relative",
          maxWidth: 420,
          width: "calc(100% - 32px)",
          padding: "36px 32px",
          borderRadius: 24,
          border: "2px solid rgba(212,175,55,0.50)",
          background: "linear-gradient(135deg, rgba(245,201,123,0.10), rgba(245,158,11,0.04))",
          textAlign: "center",
          boxShadow: "0 40px 120px -30px rgba(212,175,55,0.30)",
          zIndex: 1,
          outline: "none",
        }}
      >
        <div aria-hidden="true" style={{ fontSize: 56, marginBottom: 12, lineHeight: 1 }}>🏆</div>
        <div
          className="font-stats"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--gold)",
            marginBottom: 8,
          }}
        >
          League Champion
        </div>
        <div
          id="champion-dialog-title"
          style={{
            fontSize: "clamp(22px, 5vw, 28px)",
            fontWeight: 800,
            color: "var(--text)",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            marginBottom: 8,
          }}
        >
          {teamName}
        </div>
        <div style={{ fontSize: 14, color: "var(--dim)", marginBottom: 4 }}>
          {season} Season · {record}
        </div>
        <div style={{ fontSize: 13, color: "var(--faint)", marginBottom: 28, lineHeight: 1.5 }}>
          Congratulations on an incredible season. This one goes in the trophy cabinet.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href={trophiesHref}
            onClick={dismiss}
            style={{
              display: "block",
              padding: "13px 0",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(212,175,55,0.85), rgba(245,158,11,0.75))",
              color: "#1a1207",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            View your trophy cabinet →
          </Link>
          <button
            onClick={dismiss}
            style={{
              display: "block",
              width: "100%",
              padding: "12px 0",
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "var(--muted)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Celebrate!
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
}
