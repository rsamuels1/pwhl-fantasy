"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WelcomeFlow() {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);

  const dismiss = async () => {
    if (dismissing) return;
    setDismissing(true);
    try {
      await fetch("/api/user/onboarding", { method: "POST" });
    } catch {}
    router.refresh();
  };

  return (
    <section style={{
      background: "rgba(99,102,241,0.06)",
      border: "1px solid rgba(99,102,241,0.18)",
      borderRadius: 20,
      padding: "28px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px" }}>
          Welcome to PWHL Fantasy
        </p>
        <h2 style={{ margin: "0 0 6px", fontSize: "clamp(1.2rem, 3vw, 1.6rem)", fontWeight: 800 }}>
          Fantasy hockey for the PWHL
        </h2>
      </div>

      {/* 3 orientation cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <div style={infoCard}>
          <div style={cardIcon}>🏒</div>
          <div style={cardTitle}>What this is</div>
          <div style={cardBody}>
            Draft real PWHL players. Set a weekly lineup. Compete with friends.
          </div>
        </div>

        <div style={infoCard}>
          <div style={cardIcon}>🏆</div>
          <div style={cardTitle}>How you win</div>
          <div style={cardBody}>
            You earn Victory Points for winning your matchup <em>and</em> for
            being one of the top scorers each week.{" "}
            <Link href="/league-rules" style={{ color: "#a5b4fc" }}>Learn more →</Link>
          </div>
        </div>

        <div style={infoCard}>
          <div style={cardIcon}>⚡</div>
          <div style={cardTitle}>Two ways to start</div>
          <div style={cardBody}>
            Create a league with friends, or join one with an invite link.
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Link href="/create-league" className="button-primary" onClick={dismiss}>
          Start a league
        </Link>
        <Link href="/join-league" className="button-secondary" onClick={dismiss}>
          Have an invite? Join
        </Link>
        <Link
          href="/create-league?replay=1"
          style={{ fontSize: 13, color: "#475569", textDecoration: "none", marginLeft: 4 }}
          onClick={dismiss}
        >
          Just exploring? Try a replay league
        </Link>
      </div>

      <button
        onClick={dismiss}
        disabled={dismissing}
        style={{
          alignSelf: "flex-start",
          background: "none",
          border: "none",
          color: "#334155",
          fontSize: 12,
          cursor: "pointer",
          padding: 0,
          textDecoration: "underline",
        }}
      >
        {dismissing ? "Saving…" : "Skip intro"}
      </button>
    </section>
  );
}

const infoCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(148,163,184,0.1)",
  borderRadius: 14,
  padding: "16px 18px",
};
const cardIcon: React.CSSProperties = { fontSize: 24, marginBottom: 8 };
const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 };
const cardBody: React.CSSProperties = { fontSize: 13, color: "#94a3b8", lineHeight: 1.5 };
