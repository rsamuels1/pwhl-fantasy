"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Trade, TradeItem } from "@prisma/client";

type TradeWithItems = Trade & { items: TradeItem[] };

interface Props {
  leagueId: string;
  trades: TradeWithItems[];
  playerNames: Record<string, string>;
  teamNames: Record<string, string>;
}

export default function PendingTradeReviewList({ leagueId, trades, playerNames, teamNames }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function doAction(tradeId: string, action: "approve" | "veto") {
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/trades/${tradeId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Action failed.");
        return;
      }
      startTransition(() => { router.refresh(); });
    } catch {
      setError("Network error.");
    }
  }

  if (error) {
    <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13,
        }}>
          {error}
        </div>
      )}
      {trades.map((trade) => {
        const propItems = trade.items.filter((i) => i.fromTeamId === trade.proposingTeamId);
        const recItems = trade.items.filter((i) => i.fromTeamId === trade.receivingTeamId);
        const reviewEnd = trade.reviewEndsAt ? new Date(trade.reviewEndsAt).toLocaleString() : null;

        return (
          <div
            key={trade.id}
            style={{
              background: "var(--surface)",
              border: "1px solid rgba(251,191,36,0.2)",
              borderRadius: 12, padding: "16px 20px",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, marginBottom: 14, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 4 }}>
                  {teamNames[trade.proposingTeamId] ?? "Team"} gives
                </div>
                {propItems.map((i) => (
                  <div key={i.id} style={{ fontSize: 14, color: "var(--text)" }}>
                    {playerNames[i.playerId] ?? i.playerId}
                  </div>
                ))}
              </div>
              <div style={{ paddingTop: 16, color: "var(--faint)" }}>⇄</div>
              <div>
                <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 4 }}>
                  {teamNames[trade.receivingTeamId] ?? "Team"} gives
                </div>
                {recItems.map((i) => (
                  <div key={i.id} style={{ fontSize: 14, color: "var(--text)" }}>
                    {playerNames[i.playerId] ?? i.playerId}
                  </div>
                ))}
              </div>
            </div>

            {reviewEnd && (
              <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 12 }}>
                Review window: until {reviewEnd}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => doAction(trade.id, "approve")}
                disabled={isPending}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: "#22c55e", color: "var(--accent-ink)", fontSize: 13, fontWeight: 600,
                  cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
                }}
              >
                Approve
              </button>
              <button
                onClick={() => doAction(trade.id, "veto")}
                disabled={isPending}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.4)",
                  background: "transparent", color: "#f87171",
                  fontSize: 13, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
                }}
              >
                Veto
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
