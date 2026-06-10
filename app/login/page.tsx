"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus(data?.error || "Unable to log in.");
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      setStatus("Unable to log in. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>Login or create an account</h1>
        <p style={subheadingStyle}>
          Use your email to register and manage your leagues from a single dashboard.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <label style={labelStyle}>
            Email
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label style={labelStyle}>
            Display name
            <input
              style={inputStyle}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your public name"
            />
          </label>

          <button type="submit" style={buttonStyle} disabled={loading || !email}>
            {loading ? "Logging in…" : "Log in / Register"}
          </button>
        </form>

        {status && <p style={{ color: "#f87171", marginTop: 16 }}>{status}</p>}
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0f1117",
  color: "#e2e8f0",
  padding: "36px 16px",
};

const cardStyle: React.CSSProperties = {
  maxWidth: 620,
  margin: "0 auto",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 24,
  padding: 28,
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
};

const subheadingStyle: React.CSSProperties = {
  color: "#94a3b8",
  marginTop: 8,
  marginBottom: 20,
  lineHeight: 1.7,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 14,
  color: "#e2e8f0",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.2)",
  background: "#111827",
  color: "#e2e8f0",
  padding: "12px 14px",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 16,
  background: "#6366f1",
  color: "#fff",
  padding: "14px 18px",
  fontSize: 15,
  fontWeight: 700,
};
