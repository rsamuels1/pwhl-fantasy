"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function QuickDraftJoinForm() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [teamId, setTeamId] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!leagueId || !teamId) return;
    router.push(`/draft/${encodeURIComponent(leagueId)}?team=${encodeURIComponent(teamId)}`);
  };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, padding: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>Quick Draft Join</h2>
      <p style={{ color: "var(--dim)", marginTop: 10, marginBottom: 20 }}>
        Have a league ID and team ID? Jump straight into the draft room.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 8, color: "var(--text)" }}>
          League ID
          <input
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            placeholder="Enter league ID"
            style={{ width: "100%", borderRadius: 16, border: "1px solid var(--border)", background: "#111827", color: "var(--text)", padding: "12px 14px" }}
          />
        </label>
        <label style={{ display: "grid", gap: 8, color: "var(--text)" }}>
          Team ID
          <input
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            placeholder="Enter team ID"
            style={{ width: "100%", borderRadius: 16, border: "1px solid var(--border)", background: "#111827", color: "var(--text)", padding: "12px 14px" }}
          />
        </label>
        <button
          type="submit"
          style={{ border: "none", borderRadius: 16, background: "var(--accent)", color: "var(--accent-ink)", padding: "14px 18px", fontWeight: 700, cursor: "pointer" }}
          disabled={!leagueId || !teamId}
        >
          Join draft room
        </button>
      </form>
    </div>
  );
}
