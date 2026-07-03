"use client";

import { useState } from "react";

export default function DisplayNameEditor({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!name.trim()) { setError("Name can't be blank."); return; }
    if (name.trim().length > 80) { setError("Must be 80 characters or fewer."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Unable to save."); }
      else { setName(name.trim()); setSaved(true); }
    } catch {
      setError("Unable to save. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <label style={{ display: "grid", gap: 6, flex: "1 1 220px" }}>
        <span className="visually-hidden">Manager name</span>
        <input
          className="form-input"
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          maxLength={80}
          placeholder="Your public name"
          autoComplete="nickname"
        />
      </label>
      <button
        type="submit"
        className="button-primary"
        disabled={loading || !name.trim() || name.trim() === initialName}
        style={{ padding: "10px 18px", fontSize: 13 }}
      >
        {loading ? "Saving…" : "Save"}
      </button>
      {saved && <span style={{ fontSize: 12, color: "var(--green)", alignSelf: "center" }}>Saved ✓</span>}
      {error && <p role="alert" style={{ width: "100%", margin: 0, fontSize: 12, color: "#f87171" }}>{error}</p>}
    </form>
  );
}
