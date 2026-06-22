"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function BetaPage() {
  const [email, setEmail] = useState("");
  const [wantsToCommission, setWantsToCommission] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), wantsToCommission }),
      });
      const data = await res.json();
      if (res.status === 201) {
        setState("success");
      } else if (res.status === 200 && data.alreadyRegistered) {
        setState("already");
      } else {
        setErrorMsg(data.error ?? "Something went wrong. Try again.");
        setState("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  }

  const isSubmitted = state === "success" || state === "already";

  return (
    <main style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.18) 0%, transparent 70%), #090b12",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {/* Content */}
      <div style={{ width: "100%", maxWidth: 620, padding: "48px 24px 80px" }}>

        {/* Badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "#c9b6ff", background: "rgba(124,58,237,0.14)",
            border: "1px solid rgba(124,58,237,0.30)", borderRadius: 30, padding: "7px 16px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", animation: "pulse 2s infinite", flexShrink: 0 }} />
            Beta · Replay Season
          </span>
        </div>

        {/* Hero text */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{
            fontSize: "clamp(44px, 10vw, 72px)",
            fontWeight: 900, lineHeight: 0.96,
            letterSpacing: "-0.03em", color: "#f6f7fb", margin: "0 0 20px",
          }}>
            Be a<br />
            <span style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Founding GM.
            </span>
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "#9aa3bd", margin: 0, maxWidth: 480, marginInline: "auto" }}>
            Help us build the best PWHL fantasy experience before we go live.
            Beta leagues use a real historical PWHL season — full stats, real players, real games.
            Spots are limited.
          </p>
        </div>

        {/* Stats strip */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "clamp(16px, 5vw, 40px)",
          marginBottom: 40, flexWrap: "wrap",
        }}>
          {[
            { icon: "🏒", label: "8-Team Leagues" },
            { icon: "🎯", label: "13-Round Snake Draft" },
            { icon: "📊", label: "Real PWHL Stats" },
          ].map(({ icon, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#7c8aa8", letterSpacing: "0.04em" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Commissioner callout */}
        <div style={{
          background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.22)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 24,
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>🏆</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#c4b5fd", marginBottom: 4 }}>
              Looking for league commissioners
            </div>
            <p style={{ fontSize: 13, color: "#8b93a7", lineHeight: 1.5, margin: 0 }}>
              Commissioners set up leagues, customize scoring, send invites, and run the draft.
              If you want to be in the GM seat from day one, check the box below.
            </p>
          </div>
        </div>

        {/* Sign-up card */}
        <div className="rebrand-card" style={{ padding: "32px 32px 28px" }}>
          {isSubmitted ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>
                {state === "already" ? "👋" : "🎉"}
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f3f5fb", margin: "0 0 12px" }}>
                {state === "already" ? "You're already on the list." : "You're on the list."}
              </h2>
              <p style={{ fontSize: 15, color: "#9aa3bd", lineHeight: 1.6, margin: "0 0 24px" }}>
                {state === "already"
                  ? "We already have your email. We'll be in touch when beta opens."
                  : wantsToCommission
                  ? "Commissioner spots fill fast — we'll reach out to you first when beta opens."
                  : "We'll email you when beta access opens. Get ready to run your franchise."}
              </p>
              <Link href="/" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 14, color: "#a78bfa", textDecoration: "none", fontWeight: 600,
              }}>
                ← Back to PWHL GM
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#c9d1e0", marginBottom: 8 }}>
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "#111827", border: "1px solid rgba(148,163,184,0.18)",
                    borderRadius: 10, padding: "13px 15px",
                    fontSize: 15, color: "#f3f5fb",
                    outline: "none", transition: "border-color 0.15s",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.55)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(148,163,184,0.18)")}
                />
              </div>

              <div style={{
                background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.18)",
                borderRadius: 10, padding: "14px 16px", marginBottom: 24,
                cursor: "pointer",
              }}
                onClick={() => setWantsToCommission(v => !v)}
              >
                <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 2,
                    border: wantsToCommission ? "none" : "2px solid rgba(148,163,184,0.35)",
                    background: wantsToCommission ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {wantsToCommission && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 3 }}>
                      I'd like to be a league commissioner for beta testing
                    </div>
                    <div style={{ fontSize: 12, color: "#7c8aa8", lineHeight: 1.5 }}>
                      Commissioners create leagues, invite up to 7 friends, and run the draft.
                    </div>
                  </div>
                </label>
              </div>

              {state === "error" && (
                <div style={{
                  background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)",
                  borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                  fontSize: 13, color: "#fca5a5",
                }}>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={state === "loading"}
                style={{
                  width: "100%", padding: "15px 24px",
                  background: state === "loading" ? "rgba(124,58,237,0.5)" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
                  color: "#fff", border: "none", borderRadius: 11,
                  fontSize: 16, fontWeight: 700, cursor: state === "loading" ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "opacity 0.15s",
                }}
              >
                {state === "loading" ? (
                  <>
                    <span style={{
                      width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite",
                      display: "inline-block", flexShrink: 0,
                    }} />
                    Claiming your spot…
                  </>
                ) : (
                  <>
                    Claim My Spot
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                    </svg>
                  </>
                )}
              </button>

              <p style={{ textAlign: "center", fontSize: 12, color: "#6f788e", margin: "16px 0 0" }}>
                No spam. Ever. We&apos;ll only email you about beta access.
              </p>
            </form>
          )}
        </div>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: 12.5, color: "#555f78", marginTop: 32, lineHeight: 1.6 }}>
          PWHL GM is a free-to-play fantasy platform built by fans of the{" "}
          <span style={{ color: "#7c8aa8" }}>Professional Women&apos;s Hockey League</span>.
          <br />Not affiliated with the PWHL.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </main>
  );
}
