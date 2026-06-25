"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  leagueId: string;
  teamId: string;
  currentName: string;
}

export default function TeamNameEditor({ leagueId, teamId, currentName }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setValue(currentName);
    setError(null);
    setEditing(false);
  }

  async function handleSave() {
    const trimmed = value.trim();
    if (trimmed.length === 0) { setError("Team name cannot be empty."); return; }
    if (trimmed.length > 50) { setError("Team name must be 50 characters or fewer."); return; }

    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/teams/${teamId}/name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? "Failed to save team name.");
        return;
      }
      setEditing(false);
      startTransition(() => { router.refresh(); });
    } catch {
      setError("Network error. Please try again.");
    }
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{currentName}</span>
        <button
          type="button"
          onClick={() => { setValue(currentName); setEditing(true); }}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 12,
            color: "var(--dim)",
            cursor: "pointer",
          }}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label htmlFor="team-name-input" className="visually-hidden">Team name</label>
        <input
          id="team-name-input"
          type="text"
          aria-describedby="team-name-count"
          aria-invalid={!!error}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={50}
          autoFocus
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "var(--accent-border)"}`,
            background: "var(--bg-raised)",
            color: "var(--text)",
            fontSize: 15,
            fontWeight: 600,
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "var(--accent)",
            color: "var(--accent-ink)",
            fontSize: 13,
            fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleCancel}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--dim)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--red)" }}>{error}</p>
      )}
      <p id="team-name-count" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--faint)" }}>
        {value.length}/50 characters
      </p>
    </div>
  );
}
