"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AnnouncementForm({
  leagueId,
  initial,
}: {
  leagueId: string;
  initial: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function save(next: string) {
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/announcement`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcement: next }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSavedMsg(next.trim() ? "Announcement posted" : "Announcement cleared");
      router.refresh();
    } catch {
      setSavedMsg("Couldn't save — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label htmlFor="announcement-text" className="visually-hidden">League announcement</label>
      <textarea
        id="announcement-text"
        aria-describedby="announcement-count"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Post a note to the whole league — reminders, schedule changes, trash talk…"
        style={{
          width: "100%", resize: "vertical", boxSizing: "border-box",
          background: "var(--bg-raised)", color: "var(--text)",
          border: "1px solid var(--border)", borderRadius: 10,
          padding: "10px 12px", fontSize: 14, fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => save(value)}
          disabled={saving}
          style={{
            fontSize: 13, fontWeight: 700, padding: "8px 16px", borderRadius: 10,
            border: "1px solid rgba(143,193,232,0.3)", cursor: saving ? "default" : "pointer",
            background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)", opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Post announcement"}
        </button>
        {(initial || value) && (
          <button
            onClick={() => { setValue(""); save(""); }}
            disabled={saving}
            style={{
              fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 10,
              border: "1px solid var(--border)", cursor: "pointer",
              background: "transparent", color: "var(--faint)",
            }}
          >
            Clear
          </button>
        )}
        {savedMsg && <span role="status" style={{ fontSize: 12, color: "var(--faint)" }}>{savedMsg}</span>}
        <span id="announcement-count" style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>{value.length}/500</span>
      </div>
    </div>
  );
}
