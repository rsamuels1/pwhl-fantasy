"use client";

import { useState, useTransition } from "react";

interface Props {
  leagueId: string;
  tradeReviewHours: number;
  requireCommissionerTradeApproval: boolean;
}

export default function TradeSettingsForm({
  leagueId,
  tradeReviewHours: initial_reviewHours,
  requireCommissionerTradeApproval: initial_requireApproval,
}: Props) {
  const [reviewHours, setReviewHours] = useState(initial_reviewHours);
  const [requireApproval, setRequireApproval] = useState(initial_requireApproval);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/trade-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeReviewHours: reviewHours, requireCommissionerTradeApproval: requireApproval }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to save.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 6 }}>
          Veto review window
        </label>
        <p style={{ fontSize: 13, color: "var(--faint)", margin: "0 0 10px" }}>
          Accepted trades sit in a review window before executing. Set to 0 to execute immediately.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="number"
            min={0}
            max={168}
            value={reviewHours}
            onChange={(e) => setReviewHours(Math.max(0, parseInt(e.target.value) || 0))}
            style={{
              width: 80, padding: "8px 12px", borderRadius: 8,
              background: "var(--surface)", border: "1px solid var(--border)",
              color: "var(--text)", fontSize: 14,
            }}
          />
          <span style={{ color: "var(--dim)", fontSize: 13 }}>hours</span>
        </div>
      </div>

      <div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={requireApproval}
            onChange={(e) => setRequireApproval(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Require commissioner approval for all trades
          </span>
        </label>
        <p style={{ fontSize: 13, color: "var(--faint)", margin: "6px 0 0 26px" }}>
          When enabled, no trade executes without your explicit approval.
        </p>
      </div>

      {error && (
        <div style={{ color: "var(--loss-color)", fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => startTransition(handleSave)}
          disabled={isPending}
          style={{
            padding: "8px 20px", borderRadius: 8, border: "none",
            background: "rgba(143,193,232,0.8)", color: "var(--accent-ink)",
            fontSize: 13, fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Saving..." : "Save trade settings"}
        </button>
        {saved && <span style={{ color: "var(--win-color)", fontSize: 13 }}>Saved!</span>}
      </div>
    </div>
  );
}
