"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Trade, TradeItem } from "@prisma/client";

type TradeWithItems = Trade & { items: TradeItem[] };
type PlayerInfo = { name: string; position: string };

const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "Awaiting response",
  COUNTERED: "Countered",
  ACCEPTED: "Accepted",
  PENDING_REVIEW: "In commissioner review",
  EXECUTED: "Executed",
  REVERSED: "Vetoed by commissioner",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_COLORS: Record<string, string> = {
  PROPOSED: "#a5b4fc",
  COUNTERED: "#fcd34d",
  ACCEPTED: "#6ee7b7",
  PENDING_REVIEW: "#fbbf24",
  EXECUTED: "#34d399",
  REVERSED: "#f87171",
  REJECTED: "#94a3b8",
  CANCELLED: "#94a3b8",
  EXPIRED: "#64748b",
};

interface Props {
  trade: TradeWithItems;
  leagueId: string;
  myTeamId: string;
  isCommissioner: boolean;
  playerMap: Record<string, PlayerInfo>;
  teamMap: Record<string, string>;
  canPropose: boolean;
  /** When provided, back links use /team/[teamId]/trades routes */
  teamId?: string;
}

export default function TradeDetailView({
  trade,
  leagueId,
  myTeamId,
  isCommissioner,
  playerMap,
  teamMap,
  canPropose,
  teamId,
}: Props) {
  const tradeBase = teamId ? `/team/${teamId}/trades` : `/league/${leagueId}/trades`;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isReceiver = trade.receivingTeamId === myTeamId;
  const isProposer = trade.proposingTeamId === myTeamId;

  const proposingItems = trade.items.filter((i) => i.fromTeamId === trade.proposingTeamId);
  const receivingItems = trade.items.filter((i) => i.fromTeamId === trade.receivingTeamId);

  async function doAction(action: string) {
    setError(null);
    let url = `/api/leagues/${leagueId}/trades/${trade.id}/`;
    let body: Record<string, string> = {};
    if (action === "accept") url += "accept";
    else if (action === "reject") url += "reject";
    else if (action === "cancel") url += "cancel";
    else if (action === "approve") { url += "review"; body = { action: "approve" }; }
    else if (action === "veto") { url += "review"; body = { action: "veto" }; }
    else return;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Action failed.");
        return;
      }
      startTransition(() => { router.refresh(); });
    } catch {
      setError("Network error. Please try again.");
    }
  }

  const statusColor = STATUS_COLORS[trade.status] ?? "#94a3b8";

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Trade Proposal</h1>
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: statusColor,
          background: `${statusColor}22`,
          borderRadius: 999, padding: "3px 12px",
        }}>
          {STATUS_LABELS[trade.status] ?? trade.status}
        </span>
      </div>

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#f87171", fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {/* Trade breakdown */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: 24, marginBottom: 20,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, alignItems: "start" }}>
          {/* Proposing team gives */}
          <div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {teamMap[trade.proposingTeamId] ?? "Team"} gives
            </div>
            {proposingItems.length === 0 ? (
              <span style={{ color: "#64748b", fontSize: 13 }}>Nothing</span>
            ) : (
              proposingItems.map((item) => {
                const p = playerMap[item.playerId];
                return (
                  <div key={item.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
                      {p?.name ?? item.playerId}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{p?.position}</div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ paddingTop: 24, color: "#64748b", fontSize: 24, textAlign: "center" }}>⇄</div>

          {/* Receiving team gives */}
          <div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {teamMap[trade.receivingTeamId] ?? "Team"} gives
            </div>
            {receivingItems.length === 0 ? (
              <span style={{ color: "#64748b", fontSize: 13 }}>Nothing</span>
            ) : (
              receivingItems.map((item) => {
                const p = playerMap[item.playerId];
                return (
                  <div key={item.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
                      {p?.name ?? item.playerId}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{p?.position}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {trade.message && (
          <div style={{
            marginTop: 20, paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            color: "#94a3b8", fontSize: 13, fontStyle: "italic",
          }}>
            Message: "{trade.message}"
          </div>
        )}

        {trade.resolvedReason && (
          <div style={{
            marginTop: 12, fontSize: 12, color: "#64748b",
          }}>
            Reason: {trade.resolvedReason}
          </div>
        )}

        {trade.executedAt && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
            Executed: {new Date(trade.executedAt).toLocaleString()}
          </div>
        )}

        {trade.reviewEndsAt && trade.status === "PENDING_REVIEW" && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#fbbf24" }}>
            Review window closes: {new Date(trade.reviewEndsAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Counter-offer note */}
      {trade.counterOfId && (
        <div style={{ marginBottom: 16, fontSize: 13, color: "#94a3b8" }}>
          This is a counter-offer.{" "}
          <Link
            href={`${tradeBase}/${trade.counterOfId}`}
            style={{ color: "#a5b4fc", textDecoration: "none" }}
          >
            View original proposal →
          </Link>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {isReceiver && trade.status === "PROPOSED" && (
          <>
            <button
              onClick={() => doAction("accept")}
              disabled={isPending}
              style={{
                padding: "10px 22px", borderRadius: 8, border: "none",
                background: "#22c55e", color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
              }}
            >
              Accept Trade
            </button>
            <button
              onClick={() => doAction("reject")}
              disabled={isPending}
              style={{
                padding: "10px 22px", borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.4)",
                background: "transparent", color: "#f87171",
                fontSize: 14, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
              }}
            >
              Reject
            </button>
            {canPropose && (
              <Link
                href={`${tradeBase}/new?counterOf=${trade.id}`}
                style={{
                  padding: "10px 22px", borderRadius: 8,
                  border: "1px solid rgba(165,180,252,0.4)",
                  background: "transparent", color: "#a5b4fc",
                  fontSize: 14, textDecoration: "none",
                }}
              >
                Counter
              </Link>
            )}
          </>
        )}

        {isProposer && trade.status === "PROPOSED" && (
          <button
            onClick={() => doAction("cancel")}
            disabled={isPending}
            style={{
              padding: "10px 22px", borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.3)",
              background: "transparent", color: "#94a3b8",
              fontSize: 14, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
            }}
          >
            Cancel Trade
          </button>
        )}

        {isCommissioner && (trade.status === "PENDING_REVIEW" || trade.status === "ACCEPTED") && (
          <>
            <button
              onClick={() => doAction("approve")}
              disabled={isPending}
              style={{
                padding: "10px 22px", borderRadius: 8, border: "none",
                background: "#22c55e", color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
              }}
            >
              Approve Trade
            </button>
            <button
              onClick={() => doAction("veto")}
              disabled={isPending}
              style={{
                padding: "10px 22px", borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.4)",
                background: "transparent", color: "#f87171",
                fontSize: 14, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
              }}
            >
              Veto Trade
            </button>
          </>
        )}
      </div>
    </div>
  );
}
