"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function InviteJoinForm({
  leagueId,
  prefillEmail,
}: {
  leagueId: string;
  prefillEmail?: string;
}) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailLocked = Boolean(prefillEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          teamName,
          ownerEmail: email,
          ownerName: displayName || email.split("@")[0],
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to join league");
      } else {
        router.push(data.redirectTo ?? "/dashboard");
      }
    } catch {
      setError("Unable to join. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
      <label className="form-label">
        Team name
        <input
          className="form-input"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          required
          autoFocus
          placeholder="e.g. Poulin Power Play"
        />
      </label>

      <label className="form-label">
        Your email
        <input
          className="form-input"
          type="email"
          value={email}
          onChange={emailLocked ? undefined : (e) => setEmail(e.target.value)}
          readOnly={emailLocked}
          required
          placeholder="you@example.com"
          style={emailLocked ? { opacity: 0.6, cursor: "default" } : undefined}
        />
        {emailLocked && (
          <span style={{ fontSize: 11, color: "var(--faint)", marginTop: -4 }}>
            This is the email your invitation was sent to.
          </span>
        )}
      </label>

      <label className="form-label">
        Display name <span style={{ color: "var(--faint)", fontWeight: 400 }}>(optional)</span>
        <input
          className="form-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your public name"
        />
      </label>

      <label className="form-label">
        Password{" "}
        <span style={{ color: "var(--faint)", fontWeight: 400 }}>(leave blank if already signed in)</span>
        <input
          className="form-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
      </label>

      {error && <p role="alert" style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}

      <button
        type="submit"
        className="button-primary"
        disabled={loading || !teamName || !email}
      >
        {loading ? "Joining…" : "Join league →"}
      </button>

      <p style={{ fontSize: 12, color: "var(--faint)", margin: 0 }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--accent-strong)", textDecoration: "none" }}>
          Sign in first →
        </Link>
      </p>
    </form>
  );
}
