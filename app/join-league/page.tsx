"use client";

import { useState } from "react";

interface JoinResponse {
  leagueId: string;
  teamId: string;
  message: string;
}

export default function JoinLeaguePage() {
  const [leagueId, setLeagueId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<JoinResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setResult(null);
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
        setStatus(data?.error || "Failed to join league");
      } else {
        setResult(data);
        setStatus("Joined league successfully.");
      }
    } catch (error) {
      setStatus("Unable to join league. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-width" style={{ padding: "32px 16px" }}>
      <div className="dashboard-panel" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "grid", gap: 14 }}>
          <h1 style={{ margin: 0 }}>Join an existing league</h1>
          <p className="panel-text">Enter a league ID, choose a team name, and create your fantasy team.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18, marginTop: 20 }}>
          <label className="form-label">
            League ID
            <input className="form-input" value={leagueId} onChange={(event) => setLeagueId(event.target.value)} required />
          </label>

          <label className="form-label">
            Team name
            <input className="form-input" value={teamName} onChange={(event) => setTeamName(event.target.value)} required />
          </label>

          <label className="form-label">
            Your email
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="form-label">
            Display name
            <input
              className="form-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
            />
          </label>

          <button type="submit" className="button-primary" disabled={loading || !leagueId || !teamName || !email}>
            {loading ? "Joining league…" : "Join league"}
          </button>
        </form>

        {status && <p className="panel-text" style={{ marginTop: 16 }}>{status}</p>}

        {result && (
          <div className="summary-card" style={{ marginTop: 18 }}>
            <p>League ID: <strong>{result.leagueId}</strong></p>
            <p>Team ID: <strong>{result.teamId}</strong></p>
            <p style={{ color: "#22c55e" }}>{result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
