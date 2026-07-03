"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SetPasswordPage() {
  const router = useRouter();
  const [returnTo, setReturnTo] = useState("/dashboard");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rt = params.get("returnTo");
    if (rt && rt.startsWith("/")) setReturnTo(rt);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setStatus(data?.error || "Unable to set password. Try again.");
      } else {
        router.push(returnTo);
      }
    } catch {
      setStatus("Unable to set password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>Set your password</h2>
        <p style={{ color: "var(--faint)", marginTop: 0, marginBottom: 24, fontSize: 13, lineHeight: 1.6 }}>
          Add a password so you can sign in directly next time — no email needed.
        </p>

        {status && (
          <p role="alert" style={{ color: "#f87171", marginBottom: 14, fontSize: 13, padding: "10px 14px", borderRadius: 8, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)" }}>
            {status}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <label style={labelStyle}>
            New password
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
              autoFocus
            />
          </label>

          <label style={labelStyle}>
            Confirm password
            <input
              style={inputStyle}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Same password again"
              autoComplete="new-password"
              required
            />
          </label>

          <button
            type="submit"
            style={buttonStyle}
            disabled={loading || !password || !confirm}
          >
            {loading ? "Saving…" : "Set password →"}
          </button>
        </form>

        <Link
          href={returnTo}
          style={{ display: "block", marginTop: 16, color: "var(--faint)", fontSize: 12, textDecoration: "none" }}
        >
          Skip for now →
        </Link>
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
