"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [returnTo, setReturnTo] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(params.get("returnTo") ?? "");
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (showPassword && password && password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = { email, displayName, returnTo };
      if (showPassword && password) {
        body.password = password;
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.error || "Unable to create account.");
      } else if (data.sent) {
        setSent(true);
      } else {
        router.push(data.redirectTo ?? "/dashboard");
      }
    } catch {
      setStatus("Unable to create account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const loginHref = returnTo
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/login";

  return (
    <main style={pageStyle}>
      <style>{`
        @media (max-width: 640px) {
          .login-layout { grid-template-columns: 1fr !important; }
          .login-pitch { border-right: none !important; border-bottom: 1px solid var(--border) !important; }
        }
      `}</style>
      <div style={layoutStyle} className="login-layout">

        {/* Left — pitch */}
        <div style={pitchStyle} className="login-pitch">
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
              PWHL GM
            </p>
            <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 800, lineHeight: 1.15, margin: 0, color: "var(--text)" }}>
              Build your franchise.<br />Win the championship.
            </h1>
            <p style={{ marginTop: 14, fontSize: 15, color: "var(--dim)", lineHeight: 1.7 }}>
              Create your account, join a league before the draft, and pick real PWHL players to build your roster.
            </p>
            <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8, background: "var(--bg-raised)", border: "1px solid var(--border)", fontSize: 12, color: "var(--faint)" }}>
              Season starts November 2026 · Draft week TBD · or{" "}
              <Link href="/create-league" style={{ color: "var(--accent-strong)", textDecoration: "none" }}>
                play a replay season right now →
              </Link>
            </div>
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
              <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>Create account</h2>
              <p style={{ color: "var(--faint)", marginTop: 0, marginBottom: 4, fontSize: 13 }}>
                We&apos;ll email you a sign-in link — no password needed.
              </p>
              <p style={{ color: "var(--faint)", marginTop: 0, marginBottom: 20, fontSize: 13 }}>
                Already have one?{" "}
                <Link href={loginHref} style={{ color: "var(--accent-strong)", textDecoration: "none", fontWeight: 600 }}>
                  Sign in →
                </Link>
              </p>

              {status && (
                <p style={{ color: "#f87171", marginBottom: 14, fontSize: 13, padding: "10px 14px", borderRadius: 8, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)" }}>
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

                <label style={labelStyle}>
                  Display name{" "}
                  <span style={{ fontWeight: 400, color: "var(--faint)" }}>(optional)</span>
                  <input
                    style={inputStyle}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your public name in the league"
                    autoComplete="nickname"
                  />
                </label>

                {/* Optional password disclosure */}
                {showPassword && (
                  <label style={labelStyle}>
                    Password{" "}
                    <span style={{ fontWeight: 400, color: "var(--faint)" }}>(optional)</span>
                    <input
                      style={inputStyle}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                  </label>
                )}

                <button
                  type="submit"
                  style={buttonStyle}
                  disabled={loading || !email}
                >
                  {loading ? "Creating account…" : "Create account →"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
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
                  {showPassword ? "Remove password" : "Add a password (optional)"}
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
