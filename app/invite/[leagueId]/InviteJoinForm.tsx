"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailLocked = Boolean(prefillEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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

      {error && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>}

      <button
        type="submit"
        className="button-primary"
        disabled={loading || !teamName || !email}
      >
        {loading ? "Joining…" : "Join league →"}
      </button>
    </form>
  );
}
