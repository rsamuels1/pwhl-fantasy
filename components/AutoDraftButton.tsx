"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AutoDraftButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAutoDraft = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/auto-draft`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Auto-draft failed.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        padding: "12px 14px", borderRadius: 12,
        background: "rgba(143,193,232,0.07)",
        border: "1px solid rgba(143,193,232,0.2)",
        marginBottom: 12,
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--accent-strong)" }}>
          ⏪ Replay league — auto-draft available
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "var(--faint)" }}>
          Instantly assigns all picks using historical fantasy point rankings. No draft server needed.
        </p>
      </div>
      <button
        onClick={handleAutoDraft}
        disabled={loading}
        className="button-primary"
      >
        {loading ? "Drafting…" : "Auto-draft all teams"}
      </button>
      {error && (
        <p style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}
