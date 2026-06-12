"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState("PWHL Fantasy League");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [maxTeams, setMaxTeams] = useState(10);
  const [useLastSeasonSimulation, setUseLastSeasonSimulation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
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
        setError(data?.error || "Failed to create league");
      } else {
        router.push(data.redirectTo ?? "/dashboard");
      }
    } catch {
      setError("Unable to create league. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-width" style={{ padding: "32px 16px" }}>
      <div className="dashboard-panel" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px" }}>
            Step 1 of 5
          </p>
          <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>Create your league</h1>
          <p className="panel-text">
            You'll be the commissioner — you control the draft, settings, and invites.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
          <label className="form-label">
            League name
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Friday Night Hockey League"
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
            Your display name
            <input
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Commissioner name"
            />
          </label>

          <label className="form-label">
            Max teams
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                className="form-input"
                type="number"
                min={4}
                max={20}
                value={maxTeams}
                onChange={(e) => setMaxTeams(Number(e.target.value))}
                required
                style={{ maxWidth: 100 }}
              />
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {maxTeams} spots · most leagues use 8–12
              </span>
            </div>
          </label>

          <label className="form-label" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <input
              type="checkbox"
              checked={useLastSeasonSimulation}
              onChange={(e) => setUseLastSeasonSimulation(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ color: "#e2e8f0", lineHeight: 1.5, fontSize: 14 }}>
              <strong>⏪ Replay League (2025–26 season)</strong>
              <span style={{ display: "block", color: "#64748b", fontSize: 13, marginTop: 2 }}>
                Draft real players, advance weeks manually, and score from historical results. Great for testing or playing a completed season.
              </span>
            </span>
          </label>

          {error && (
            <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p>
          )}

          <button type="submit" className="button-primary" disabled={loading || !email || !name}>
            {loading ? "Creating league…" : "Create league →"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 13, color: "#475569", textAlign: "center" }}>
          Already have an invite?{" "}
          <a href="/join-league" style={{ color: "#a5b4fc" }}>Join a league instead</a>
        </p>
      </div>
    </div>
  );
}
