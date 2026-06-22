"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  leagueId: string;
  currentSeason: string;
}

export function RenewLeagueForm({ leagueId, currentSeason }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    const name = (fd.get("name") as string).trim();
    const season = (fd.get("season") as string).trim();
    const draftDate = (fd.get("draftStartsAt") as string).trim();
    if (name) body.name = name;
    if (season) body.season = season;
    if (draftDate) body.draftStartsAt = new Date(draftDate).toISOString();

    try {
      const res = await fetch(`/api/leagues/${leagueId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to renew league");
        setBusy(false);
        return;
      }
      router.push(data.redirectTo);
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  const bumped = bumpSeason(currentSeason);

  if (!confirmed) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{
          padding: "14px 16px", borderRadius: 12,
          background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)",
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#a5b4fc" }}>
            Starting next season creates a new league
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
            Your current league stays as-is. Every manager needs a new invite to rejoin — they won&apos;t be added automatically. Rosters, stats, and matchup history stay in this season&apos;s league.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setConfirmed(true)}
            style={{
              padding: "10px 20px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 14,
            }}
          >
            Yes, create next season →
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: "10px 20px", borderRadius: 12, cursor: "pointer",
              background: "transparent", color: "#64748b", fontWeight: 600, fontSize: 14,
              border: "1px solid rgba(148,163,184,0.2)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontSize: 13, color: "#94a3b8" }}>League name</label>
        <input name="name" placeholder="Same as current" style={inputStyle} />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontSize: 13, color: "#94a3b8" }}>Season</label>
        <input name="season" defaultValue={bumped} style={inputStyle} />
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ fontSize: 13, color: "#94a3b8" }}>Draft date (optional)</label>
        <input name="draftStartsAt" type="datetime-local" style={inputStyle} />
      </div>
      {error && (
        <p style={{ margin: 0, color: "#f87171", fontSize: 13 }}>{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        style={{
          padding: "10px 20px", borderRadius: 12, border: "none", cursor: busy ? "not-allowed" : "pointer",
          background: busy ? "rgba(99,102,241,0.4)" : "#6366f1",
          color: "#fff", fontWeight: 700, fontSize: 14,
        }}
      >
        {busy ? "Creating…" : "Create next season"}
      </button>
    </form>
  );
}

function bumpSeason(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return s;
  const next = parseInt(m[1], 10) + 1;
  const end = (parseInt(m[2], 10) + 1) % 100;
  return `${next}-${String(end).padStart(2, "0")}`;
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.2)",
  background: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: 14, width: "100%", boxSizing: "border-box",
};
