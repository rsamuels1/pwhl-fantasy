"use client";

import { useState } from "react";

interface Props {
  leagueId: string;
}

export default function CommissionerInviteForm({ leagueId }: Props) {
  const [emails, setEmails] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const emailList = emails
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));

    const res = await fetch(`/api/leagues/${leagueId}/invite-emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: emailList }),
    });

    setStatus(res.ok ? "sent" : "error");
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="one@example.com, two@example.com"
        rows={3}
        style={{
          padding: 8,
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 13,
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      <button
        type="submit"
        disabled={status === "sending" || !emails.trim()}
        style={{
          alignSelf: "flex-start",
          padding: "6px 14px",
          borderRadius: 6,
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          opacity: status === "sending" || !emails.trim() ? 0.5 : 1,
        }}
      >
        {status === "sending" ? "Sending…" : "Send invites →"}
      </button>
      {status === "sent" && (
        <p style={{ fontSize: 13, color: "#34d399", margin: 0 }}>Invites sent!</p>
      )}
      {status === "error" && (
        <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>
          Something went wrong. Try again.
        </p>
      )}
    </form>
  );
}
