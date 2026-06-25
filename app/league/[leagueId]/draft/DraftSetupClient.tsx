"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DraftSetupClient({
  leagueId,
  teams,
}: {
  leagueId: string;
  teams: Array<{ id: string; name: string; draftOrder: number | null }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/draft/setup`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "Unable to create draft.");
      } else {
        setMessage(data.message || "Draft created.");
        router.refresh();
      }
    } catch (error) {
      setMessage("Unable to create draft. Check the server logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ color: "var(--dim)" }}>
        <p>This league has no draft yet. Create the draft board to start the first beta draft.</p>
        <p>Teams in this league:</p>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {teams.map((team) => (
            <li key={team.id} style={{ marginBottom: 6 }}>
              {team.name} {team.draftOrder ? `(order ${team.draftOrder})` : "(unassigned)"}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleCreate}
        disabled={loading}
        style={{
          border: "none",
          borderRadius: 16,
          background: "var(--accent)",
          color: "var(--accent-ink)",
          padding: "14px 18px",
          fontWeight: 700,
          cursor: "pointer",
          width: "fit-content",
        }}
      >
        {loading ? "Creating draft…" : "Create draft"}
      </button>

      {message && <p style={{ color: "var(--dim)" }}>{message}</p>}
    </div>
  );
}
