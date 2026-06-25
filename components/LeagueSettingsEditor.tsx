"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  leagueId: string;
  maxTeams: number;
  draftType: string;
  draftDone: boolean;
  isPublic?: boolean;
}

export function LeagueSettingsEditor({ leagueId, maxTeams: initialMaxTeams, draftType: initialDraftType, draftDone, isPublic: initialIsPublic = false }: Props) {
  const router = useRouter();
  const [maxTeams, setMaxTeams] = useState(String(initialMaxTeams));
  const [draftType, setDraftType] = useState(initialDraftType);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const isDirty =
    maxTeams !== String(initialMaxTeams) ||
    draftType !== initialDraftType ||
    isPublic !== initialIsPublic;

  async function handleSave() {
    if (!maxTeams || !draftType) return;
    setBusy(true);
    setResult(null);

    const body: Record<string, unknown> = { isPublic };
    if (!draftDone) {
      body.maxTeams = parseInt(maxTeams);
      body.draftType = draftType;
    }

    try {
      const res = await fetch(`/api/leagues/${leagueId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult("Settings saved.");
        router.refresh();
      }
    } catch {
      setResult("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {!draftDone && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--dim)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" as const }}>
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
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--dim)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" as const }}>
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
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            >
              <option value="SNAKE">Snake</option>
            </select>
          </div>
        </div>
      )}

      {/* isPublic toggle — always editable */}
      <button
        type="button"
        onClick={() => setIsPublic((v) => !v)}
        disabled={busy}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "none", border: "none", cursor: busy ? "not-allowed" : "pointer",
          padding: "8px 0", textAlign: "left",
        }}
      >
        <span style={{
          width: 36, height: 20, borderRadius: 99, flexShrink: 0,
          background: isPublic ? "var(--accent)" : "var(--surface)",
          display: "inline-flex", alignItems: "center",
          padding: "0 3px", transition: "background 0.2s",
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: "50%", background: "var(--accent-ink)",
            transform: isPublic ? "translateX(16px)" : "translateX(0)",
            transition: "transform 0.2s",
          }} />
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            List on public league directory
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)" }}>
            Your league will appear on the Leagues page so new players can find and join it.
          </div>
        </div>
      </button>

      <button
        onClick={handleSave}
        disabled={busy || !isDirty}
        style={{
          padding: "10px 16px",
          borderRadius: 10,
          border: "none",
          cursor: busy || !isDirty ? "not-allowed" : "pointer",
          background: busy || !isDirty ? "rgba(143,193,232,0.3)" : "var(--accent)",
          color: "var(--accent-ink)",
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
