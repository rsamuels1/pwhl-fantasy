"use client";

import { useState } from "react";

interface CreateResponse {
  leagueId: string;
  commissionerId: string;
  message: string;
}

export default function CreateLeaguePage() {
  const [name, setName] = useState("PWHL Fantasy League");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [maxTeams, setMaxTeams] = useState(10);
  const [useLastSeasonSimulation, setUseLastSeasonSimulation] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/leagues/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueName: name,
          commissionerEmail: email,
          commissionerName: displayName || email.split("@")[0],
          maxTeams,
          useLastSeasonSimulation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.error || "Failed to create league");
      } else {
        setResult(data);
        setStatus("League created successfully.");
      }
    } catch (error) {
      setStatus("Unable to create league. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-width" style={{ padding: "32px 16px" }}>
      <div className="dashboard-panel" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "grid", gap: 14 }}>
          <h1 style={{ margin: 0 }}>Create a new league</h1>
          <p className="panel-text">
            Start a new PWHL Fantasy league with a league name, commissioner details, and optional replay simulation.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18, marginTop: 20 }}>
          <label className="form-label">
            League name
            <input className="form-input" value={name} onChange={(event) => setName(event.target.value)} required />
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
              placeholder="Commissioner name"
            />
          </label>

          <label className="form-label">
            Maximum teams
            <input
              className="form-input"
              type="number"
              min={4}
              max={20}
              value={maxTeams}
              onChange={(event) => setMaxTeams(Number(event.target.value))}
              required
            />
          </label>

          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="checkbox"
              checked={useLastSeasonSimulation}
              onChange={(event) => setUseLastSeasonSimulation(event.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ color: "#e2e8f0", lineHeight: 1.5 }}>
              Last Season Simulation — use last year’s real schedule and start game 1 as if it happens tomorrow.
            </span>
          </label>

          <button type="submit" className="button-primary" disabled={loading}>
            {loading ? "Creating league…" : "Create league"}
          </button>
        </form>

        {status && <p className="panel-text" style={{ marginTop: 16 }}>{status}</p>}

        {result && (
          <div className="summary-card" style={{ marginTop: 18 }}>
            <p>League ID: <strong>{result.leagueId}</strong></p>
            <p>Commissioner ID: <strong>{result.commissionerId}</strong></p>
            <p style={{ color: "#22c55e" }}>{result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
