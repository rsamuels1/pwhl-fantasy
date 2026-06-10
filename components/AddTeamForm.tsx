"use client";

import { useState } from "react";

export default function AddTeamForm({ leagueId, onTeamAdded }: { leagueId: string; onTeamAdded?: () => void }) {
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          teamName: teamName || `Test Team ${Math.random().toString(36).slice(2, 6)}`,
          ownerEmail: `test-${Date.now()}@testing.local`,
          ownerName: "Test Manager",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to add team");
      } else {
        setMessage(`Team "${data.teamId}" created successfully!`);
        setTeamName("");
        if (onTeamAdded) onTeamAdded();
      }
    } catch (err) {
      setError("Unable to add team. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-panel">
      <div className="panel-headline">Quick add team (testing)</div>
      <p className="panel-text">Create a test team to draft as or populate your league for testing.</p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label className="form-label">
            Team name (optional)
            <input
              className="form-input"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Leave blank for auto-generated name"
            />
          </label>
        </div>
        <button type="submit" className="button-primary" disabled={loading}>
          {loading ? "Creating…" : "Add Team"}
        </button>
        {message && <p style={{ color: "#22c55e", fontSize: "0.95rem" }}>{message}</p>}
        {error && <p style={{ color: "#ef4444", fontSize: "0.95rem" }}>{error}</p>}
      </form>
    </div>
  );
}
