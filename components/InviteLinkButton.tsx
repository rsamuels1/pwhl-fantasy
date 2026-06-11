"use client";

import { useState } from "react";

export default function InviteLinkButton({ leagueId }: { leagueId: string }) {
  const [copied, setCopied] = useState(false);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${leagueId}`
      : `/invite/${leagueId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select the text
      const el = document.getElementById(`invite-url-${leagueId}`) as HTMLInputElement | null;
      el?.select();
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        id={`invite-url-${leagueId}`}
        readOnly
        value={inviteUrl}
        style={{
          flex: 1,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(148,163,184,0.15)",
          borderRadius: 10,
          padding: "10px 12px",
          color: "#94a3b8",
          fontSize: 13,
          fontFamily: "monospace",
          outline: "none",
          minWidth: 0,
        }}
        onFocus={(e) => e.target.select()}
      />
      <button
        onClick={handleCopy}
        style={{
          flexShrink: 0,
          padding: "10px 16px",
          borderRadius: 10,
          border: "1px solid rgba(148,163,184,0.2)",
          background: copied ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.06)",
          color: copied ? "#34d399" : "#e2e8f0",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "✓ Copied!" : "Copy link"}
      </button>
    </div>
  );
}
