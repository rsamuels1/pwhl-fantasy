"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function QuickDraftJoinForm() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!leagueId.trim() || !teamId.trim()) {
      setError("Enter both a league ID and team ID.");
      return;
    }

    router.push(`/draft/${leagueId.trim()}?team=${teamId.trim()}`);
  };

  return (
    <section style={{ display: "grid", gap: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, padding: 24 }}>
      <div>
        <p style={{ color: "var(--dim)", marginBottom: 8 }}>Quick draft join</p>
        <h2 style={{ margin: 0, fontSize: 22 }}>Open a draft room instantly</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ color: "var(--muted)", fontSize: 14 }}>
            League ID
            <input
              value={leagueId}
              onChange={(event) => setLeagueId(event.target.value)}
              placeholder="e.g. abc123"
              style={inputStyle}
            />
          </label>
          <label style={{ color: "var(--muted)", fontSize: 14 }}>
            Team ID
            <input
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              placeholder="e.g. team123"
              style={inputStyle}
            />
          </label>
        </div>

        {error && <p style={{ color: "#f87171", margin: 0 }}>{error}</p>}

        <button type="submit" style={buttonStyle}>
          Join draft room
        </button>
      </form>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "#020617",
  color: "var(--text)",
  padding: "12px 14px",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 16,
  padding: "12px 18px",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 700,
  cursor: "pointer",
  width: "fit-content",
};
