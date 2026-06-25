"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [returnTo, setReturnTo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(params.get("returnTo") ?? "");
    const err = params.get("error");
    if (err === "invalid_token") {
      setStatus(
        "This sign-in link has expired or has already been used. Request a new one below."
      );
    } else if (err === "missing_token") {
      setStatus("Invalid sign-in link. Please request a new one.");
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const body: Record<string, string> = { email, returnTo };
      if (showPassword && password) {
        body.password = password;
      }
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.error || "Unable to log in.");
      } else if (data.sent) {
        setSent(true);
      } else {
        router.push(data.redirectTo ?? "/dashboard");
      }
    } catch {
      setStatus("Unable to log in. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const registerHref = returnTo
    ? `/register?returnTo=${encodeURIComponent(returnTo)}`
    : "/register";

  return (
    <main style={pageStyle}>
      <style>{`
        @media (max-width: 640px) {
          .login-layout { grid-template-columns: 1fr !important; }
          .login-pitch { border-right: none !important; border-bottom: 1px solid var(--border) !important; }
        }
      `}</style>
      <div style={layoutStyle} className="login-layout">

        {/* Left — product pitch */}
        <div style={pitchStyle} className="login-pitch">
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
              PWHL GM
            </p>
            <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 800, lineHeight: 1.15, margin: 0, color: "var(--text)" }}>
              Draft real players.<br />Win your league.
            </h1>
            <p style={{ marginTop: 14, fontSize: 15, color: "var(--dim)", lineHeight: 1.7 }}>
              Scout players. Build a championship roster. Lead your franchise through a full PWHL season.
            </p>
            <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8, background: "var(--bg-raised)", border: "1px solid var(--border)", fontSize: 12, color: "var(--faint)" }}>
              Season starts November 2026 · Draft week TBD · or{" "}
              <Link href="/create-league" style={{ color: "var(--accent-strong)", textDecoration: "none" }}>
                play a replay season right now →
              </Link>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: "🏒", label: "Real PWHL players", detail: "Every skater and goalie from all 12 teams" },
              { icon: "📅", label: "Weekly matchups", detail: "Your team races the whole league's scores each week" },
              { icon: "⚡", label: "Live scoring", detail: "Points update from real game stats as they happen" },
              { icon: "🏆", label: "Playoffs", detail: "Top teams compete in a single-elimination bracket" },
            ].map(({ icon, label, detail }) => (
              <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--faint)" }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div style={formPanelStyle}>
          {sent ? (
            /* Success panel — shown after magic link is sent */
            <div>
              <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 700 }}>
                Check your email
              </h2>
              <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, marginBottom: 8 }}>
                We sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.
              </p>
              <p style={{ fontSize: 12, color: "var(--faint)", marginBottom: 24 }}>
                Check your spam folder if you don&apos;t see it.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                style={{ background: "none", border: "1px solid var(--border)", color: "var(--dim)", fontSize: 13, cursor: "pointer", padding: "8px 14px", borderRadius: 8 }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>Sign in</h2>
              <p style={{ color: "var(--faint)", marginTop: 0, marginBottom: 8, fontSize: 13, lineHeight: 1.6 }}>
                Enter your email and we&apos;ll send you a sign-in link — no password needed.
              </p>
              <p style={{ color: "var(--faint)", marginTop: 0, marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
                Don&apos;t have an account?{" "}
                <Link href={registerHref} style={{ color: "var(--accent-strong)", textDecoration: "none", fontWeight: 600 }}>
                  Create one →
                </Link>
              </p>

              {status && (
                <p role="alert" style={{ color: "#f87171", marginBottom: 14, fontSize: 13, padding: "10px 14px", borderRadius: 8, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)" }}>
                  {status}
                </p>
              )}

              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
                <label style={labelStyle}>
                  Email
                  <input
                    style={inputStyle}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>

                {/* Primary action — magic link */}
                {!showPassword && (
                  <button
                    type="submit"
                    style={buttonStyle}
                    disabled={loading || !email}
                  >
                    {loading ? "Sending…" : "Email me a sign-in link →"}
                  </button>
                )}

                {/* Password fallback — hidden by default */}
                {showPassword && (
                  <>
                    <label style={labelStyle}>
                      Password
                      <input
                        style={inputStyle}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your password"
                        autoComplete="current-password"
                      />
                    </label>
                    <button
                      type="submit"
                      style={buttonStyle}
                      disabled={loading || !email || !password}
                    >
                      {loading ? "Signing in…" : "Sign in →"}
                    </button>
                  </>
                )}

                {/* Toggle between magic link and password */}
                <button
                  type="button"
                  onClick={() => {
                    setShowPassword((v) => {
                      if (v) setPassword(""); // clear on way back to magic link
                      return !v;
                    });
                    setStatus(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--faint)",
                    fontSize: 12,
                    cursor: "pointer",
                    padding: "2px 0",
                    textAlign: "left",
                  }}
                >
                  {showPassword
                    ? "← Email me a sign-in link instead"
                    : "Have a password? Sign in with it instead"}
                </button>
              </form>
            </>
          )}
        </div>

      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px 16px 32px",
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 0,
  maxWidth: 900,
  width: "100%",
  borderRadius: 24,
  overflow: "hidden",
  border: "1px solid var(--border)",
};

const pitchStyle: React.CSSProperties = {
  background: "rgba(143,193,232,0.06)",
  borderRight: "1px solid var(--border)",
  padding: "36px 32px",
  display: "flex",
  flexDirection: "column",
};

const formPanelStyle: React.CSSProperties = {
  background: "var(--bg-raised)",
  padding: "36px 32px",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--text)",
  padding: "12px 14px",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  background: "var(--accent)",
  color: "var(--accent-ink)",
  padding: "14px 18px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 4,
};
