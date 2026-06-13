"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  leagueId: string;
  maxTeams: number;
  draftType: string;
  draftDone: boolean;
}

export function LeagueSettingsEditor({ leagueId, maxTeams: initialMaxTeams, draftType: initialDraftType, draftDone }: Props) {
  const router = useRouter();
  const [maxTeams, setMaxTeams] = useState(String(initialMaxTeams));
  const [draftType, setDraftType] = useState(initialDraftType);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSave() {
    if (!maxTeams || !draftType) return;
    setBusy(true);
    setResult(null);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxTeams: parseInt(maxTeams),
          draftType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult("Settings saved successfully.");
        router.refresh();
      }
    } catch {
      setResult("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (draftDone) {
    return (
      <div style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(148,163,184,0.05)",
        border: "1px solid rgba(148,163,184,0.1)",
      }}>
        <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
          ⏱ Settings are locked after the draft starts.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
            Max teams
          </label>
          <input
            type="number"
            min="2"
            max="20"
            value={maxTeams}
            onChange={(e) => setMaxTeams(e.target.value)}
            disabled={busy}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.2)",
              background: "rgba(255,255,255,0.04)",
              color: "#e2e8f0",
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
            Draft type
          </label>
          <select
            value={draftType}
            onChange={(e) => setDraftType(e.target.value)}
            disabled={busy}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.2)",
              background: "rgba(255,255,255,0.04)",
              color: "#e2e8f0",
              fontSize: 14,
              boxSizing: "border-box",
            }}
          >
            <option value="SNAKE">Snake</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={busy || maxTeams === String(initialMaxTeams) && draftType === initialDraftType}
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          border: "none",
          cursor: busy ? "not-allowed" : "pointer",
          background: (busy || maxTeams === String(initialMaxTeams) && draftType === initialDraftType) ? "rgba(99,102,241,0.3)" : "#6366f1",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {busy ? "Saving…" : "Save settings"}
      </button>

      {result && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: result.startsWith("Error") ? "#f87171" : "#34d399" }}>
          {result}
        </p>
      )}
    </div>
  );
}
