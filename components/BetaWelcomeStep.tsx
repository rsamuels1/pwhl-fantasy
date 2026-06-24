"use client";

import Link from "next/link";

interface Props {
  onContinue: () => void;
}

export default function BetaWelcomeStep({ onContinue }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Eyebrow badge with pulse */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
          color: "var(--accent-strong)", background: "rgba(143,193,232,0.14)",
          border: "1px solid rgba(143,193,232,0.30)", borderRadius: 30, padding: "7px 16px",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "pulse 2s infinite", flexShrink: 0 }} />
          Beta · Replay Season
        </span>
      </div>

      {/* Heading */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 800, color: "var(--text)" }}>
          You're in. Welcome, Founding GM.
        </h1>
      </div>

      {/* Intro paragraph */}
      <p style={{
        fontSize: 15, lineHeight: 1.6, color: "var(--dim)", margin: 0, textAlign: "center",
        maxWidth: 500, marginInline: "auto",
      }}>
        You're shaping PWHL GM before launch. Your feedback goes straight into the product. This league uses four real weeks from 2025-26 with actual player stats—compressed so you experience a full season in weeks, not months.
      </p>

      {/* Three info cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12,
        marginTop: 8,
      }}>
        <div style={betaCard}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>⏪</div>
          <div style={betaCardTitle}>Real PWHL stats. Condensed timeline.</div>
          <div style={betaCardBody}>
            Four weeks of 2025-26 data, full snake draft, weekly head-to-head VP scoring.
          </div>
        </div>

        <div style={betaCard}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>💬</div>
          <div style={betaCardTitle}>Send us feedback. All of it.</div>
          <div style={betaCardBody}>
            Use the feedback button in the bottom-right corner. Bugs, confusion, missing features — we read every one.
          </div>
        </div>

        <div style={betaCard}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🏒</div>
          <div style={betaCardTitle}>Draft from all 12 teams in November.</div>
          <div style={betaCardBody}>
            The expansion draft just dropped — Detroit, Hamilton, Las Vegas &amp; San Jose join the PWHL for 2026-27. Founding GMs draft from all 12 teams and get priority access on opening day.
          </div>
        </div>
      </div>

      {/* Step count hint */}
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--faint)", margin: 0 }}>
        4 quick steps to your league — takes about 2 minutes.
      </p>

      {/* CTA and secondary link */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", marginTop: 4 }}>
        <button
          onClick={onContinue}
          className="button-primary"
          style={{ width: "100%", maxWidth: 300 }}
        >
          Build my league →
        </button>
        <Link
          href="/league-rules"
          style={{
            fontSize: 13, color: "var(--accent)", textDecoration: "none", fontWeight: 600,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-strong)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent)")}
        >
          What's a replay league?
        </Link>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

const betaCard: React.CSSProperties = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: "16px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const betaCardTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.3,
};

const betaCardBody: React.CSSProperties = {
  fontSize: 12, color: "var(--dim)", lineHeight: 1.5,
};
