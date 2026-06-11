"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JoinLeaguePage() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pre-fill league ID from URL param (e.g. from invite link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("league") ?? "";
    if (id) {
      setLeagueId(id);
      // Fetch league name to show context
      fetch(`/api/leagues/list`)
        .then((r) => r.json())
        .then((leagues: { id: string; name: string }[]) => {
          const match = leagues.find((l) => l.id === id);
          if (match) setLeagueName(match.name);
        })
        .catch(() => {});
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      setError("Unable to join league. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-width" style={{ padding: "32px 16px" }}>
      <div className="dashboard-panel" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          {leagueName ? (
            <>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px" }}>
                You're invited
              </p>
              <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>Join {leagueName}</h1>
              <p className="panel-text">Choose a team name and create your account to claim your spot.</p>
            </>
          ) : (
            <>
              <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>Join a league</h1>
              <p className="panel-text">Enter your league ID, choose a team name, and you're in.</p>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
          {!leagueName && (
            <label className="form-label">
              League ID
              <input
                className="form-input"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                required
                placeholder="Paste the league ID from your commissioner"
              />
            </label>
          )}

          <label className="form-label">
            Team name
            <input
              className="form-input"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              placeholder="e.g. Poulin Power Play"
            />
          </label>

          <label className="form-label">
            Your email
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </label>

          <label className="form-label">
            Display name <span style={{ color: "#475569", fontWeight: 400 }}>(optional)</span>
            <input
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your public name in the league"
            />
          </label>

          {error && (
            <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            className="button-primary"
            disabled={loading || !leagueId || !teamName || !email}
          >
            {loading ? "Joining…" : "Join league →"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 13, color: "#475569", textAlign: "center" }}>
          Starting a new league?{" "}
          <a href="/create-league" style={{ color: "#a5b4fc" }}>Create one instead</a>
        </p>
      </div>
    </div>
  );
}
