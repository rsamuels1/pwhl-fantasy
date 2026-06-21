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
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(params.get("returnTo") ?? "");
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (password !== confirm) {
      setStatus("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, password, returnTo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.error || "Unable to create account.");
      } else {
        router.push(data.redirectTo ?? "/dashboard");
      }
    } catch {
      setStatus("Unable to create account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";

  return (
    <main style={pageStyle}>
      <style>{`
        @media (max-width: 640px) {
          .login-layout { grid-template-columns: 1fr !important; }
          .login-pitch { border-right: none !important; border-bottom: 1px solid rgba(148,163,184,0.1) !important; }
        }
      `}</style>
      <div style={layoutStyle} className="login-layout">

        {/* Left — pitch */}
        <div style={pitchStyle} className="login-pitch">
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
              PWHL GM
            </p>
            <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 800, lineHeight: 1.15, margin: 0, color: "#f1f5f9" }}>
              Build your franchise.<br />Win the championship.
            </h1>
            <p style={{ marginTop: 14, fontSize: 15, color: "#94a3b8", lineHeight: 1.7 }}>
              Create your account, join a league before the draft, and pick real PWHL players to build your roster.
            </p>
            <div style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.1)", fontSize: 12, color: "#475569" }}>
              Season starts November 2026 · Draft week TBD
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div style={formPanelStyle}>
          <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>Create account</h2>
          <p style={{ color: "#64748b", marginTop: 0, marginBottom: 20, fontSize: 13 }}>
            Already have one?{" "}
            <Link href={loginHref} style={{ color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>
              Sign in →
            </Link>
          </p>

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
              Display name
              <input
                style={inputStyle}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your public name in the league (optional)"
                autoComplete="nickname"
              />
            </label>

            <label style={labelStyle}>
              Password
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </label>

            <label style={labelStyle}>
              Confirm password
              <input
                style={inputStyle}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Same password again"
                autoComplete="new-password"
              />
            </label>

            <button
              type="submit"
              style={buttonStyle}
              disabled={loading || !email || !password || !confirm}
            >
              {loading ? "Creating account…" : "Create account →"}
            </button>
          </form>

          {status && <p style={{ color: "#f87171", marginTop: 14, fontSize: 13 }}>{status}</p>}
        </div>

      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0f1117",
  color: "#e2e8f0",
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
  border: "1px solid rgba(148,163,184,0.12)",
};

const pitchStyle: React.CSSProperties = {
  background: "rgba(99,102,241,0.06)",
  borderRight: "1px solid rgba(148,163,184,0.1)",
  padding: "36px 32px",
  display: "flex",
  flexDirection: "column",
};

const formPanelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  padding: "36px 32px",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  color: "#e2e8f0",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,0.2)",
  background: "#111827",
  color: "#e2e8f0",
  padding: "12px 14px",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  background: "#6366f1",
  color: "#fff",
  padding: "14px 18px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 4,
};
