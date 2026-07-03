"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [returnTo, setReturnTo] = useState("");
  const [email, setEmail] = useState("");
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
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, returnTo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.error || "Unable to send link. Try again.");
      } else {
        setSent(true);
      }
    } catch {
      setStatus("Unable to send link. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const loginHref = returnTo
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/login";

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        {sent ? (
          <>
            <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700 }}>Check your email</h2>
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
          </>
        ) : (
          <>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Forgot your password?</h2>
            <p style={{ color: "var(--faint)", marginTop: 0, marginBottom: 24, fontSize: 13, lineHeight: 1.6 }}>
              Enter your email and we&apos;ll send you a sign-in link. It expires in 15 minutes.
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

              <button
                type="submit"
                style={buttonStyle}
                disabled={loading || !email}
              >
                {loading ? "Sending…" : "Send sign-in link →"}
              </button>
            </form>

            <Link
              href={loginHref}
              style={{ display: "block", marginTop: 16, color: "var(--faint)", fontSize: 12, textDecoration: "none" }}
            >
              ← Back to login
            </Link>
          </>
        )}
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

const cardStyle: React.CSSProperties = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: "36px 32px",
  maxWidth: 480,
  width: "100%",
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
