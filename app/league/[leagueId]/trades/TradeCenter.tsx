"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Trade, TradeItem } from "@prisma/client";

type TradeWithItems = Trade & { items: TradeItem[] };
type PlayerInfo = { name: string; position: string };

interface Props {
  leagueId: string;
  myTeamId: string;
  isCommissioner: boolean;
  canPropose: boolean;
  initialTab: "incoming" | "sent" | "history";
  incomingTrades: TradeWithItems[];
  sentTrades: TradeWithItems[];
  historyTrades: TradeWithItems[];
  pendingReview: TradeWithItems[];
  playerMap: Record<string, PlayerInfo>;
  teamMap: Record<string, string>;
}

const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "Awaiting response",
  COUNTERED: "Countered",
  ACCEPTED: "Accepted",
  PENDING_REVIEW: "In review",
  EXECUTED: "Executed",
  REVERSED: "Vetoed",
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

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function TradePlayersColumn({
  items,
  fromTeamId,
  playerMap,
  teamMap,
  label,
}: {
  items: TradeItem[];
  fromTeamId: string;
  playerMap: Record<string, PlayerInfo>;
  teamMap: Record<string, string>;
  label: string;
}) {
  const outgoing = items.filter((i) => i.fromTeamId === fromTeamId);
  return (
    <div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      {outgoing.length === 0 ? (
        <span style={{ color: "#64748b", fontSize: 13 }}>—</span>
      ) : (
        outgoing.map((item) => {
          const p = playerMap[item.playerId];
          return (
            <div key={item.id} style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 2 }}>
              {p?.name ?? item.playerId}
              <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: 6 }}>
                {p?.position?.slice(0, 1)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

function TradeCard({
  trade,
  myTeamId,
  playerMap,
  teamMap,
  isCommissioner,
  onAction,
  actionPending,
}: {
  trade: TradeWithItems;
  myTeamId: string;
  playerMap: Record<string, PlayerInfo>;
  teamMap: Record<string, string>;
  isCommissioner: boolean;
  onAction: (tradeId: string, action: string) => void;
  actionPending: boolean;
}) {
  const isReceiver = trade.receivingTeamId === myTeamId;
  const isProposer = trade.proposingTeamId === myTeamId;
  const otherTeamId = isReceiver ? trade.proposingTeamId : trade.receivingTeamId;
  const otherTeamName = teamMap[otherTeamId] ?? "Unknown Team";
  const myTeamName = teamMap[myTeamId] ?? "My Team";

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: STATUS_COLORS[trade.status] ?? "#94a3b8",
            background: `${STATUS_COLORS[trade.status] ?? "#94a3b8"}22`,
            borderRadius: 999,
            padding: "2px 10px",
          }}>
            {STATUS_LABELS[trade.status] ?? trade.status}
          </span>
          <span style={{ fontSize: 12, color: "#64748b" }}>{formatDate(trade.createdAt)}</span>
        </div>
        <Link
          href={`/league/${trade.leagueId}/trades/${trade.id}`}
          style={{ fontSize: 12, color: "#a5b4fc", textDecoration: "none" }}
        >
          View →
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "start" }}>
        <TradePlayersColumn
          items={trade.items}
          fromTeamId={trade.proposingTeamId}
          playerMap={playerMap}
          teamMap={teamMap}
          label={`${teamMap[trade.proposingTeamId] ?? "Team"} gives`}
        />
        <div style={{ paddingTop: 20, color: "#64748b", fontSize: 20 }}>⇄</div>
        <TradePlayersColumn
          items={trade.items}
          fromTeamId={trade.receivingTeamId}
          playerMap={playerMap}
          teamMap={teamMap}
          label={`${teamMap[trade.receivingTeamId] ?? "Team"} gives`}
        />
      </div>

      {trade.message && (
        <div style={{ marginTop: 10, fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>
          "{trade.message}"
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {isReceiver && trade.status === "PROPOSED" && (
          <>
            <button
              onClick={() => onAction(trade.id, "accept")}
              disabled={actionPending}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "#22c55e", color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: actionPending ? "not-allowed" : "pointer", opacity: actionPending ? 0.6 : 1,
              }}
            >
              Accept
            </button>
            <button
              onClick={() => onAction(trade.id, "reject")}
              disabled={actionPending}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)",
                background: "transparent", color: "#f87171", fontSize: 13, cursor: actionPending ? "not-allowed" : "pointer",
                opacity: actionPending ? 0.6 : 1,
              }}
            >
              Reject
            </button>
            <Link
              href={`/league/${trade.leagueId}/trades/${trade.id}/counter`}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(165,180,252,0.4)",
                background: "transparent", color: "#a5b4fc", fontSize: 13, textDecoration: "none",
              }}
            >
              Counter
            </Link>
          </>
        )}
        {isProposer && trade.status === "PROPOSED" && (
          <button
            onClick={() => onAction(trade.id, "cancel")}
            disabled={actionPending}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.3)",
              background: "transparent", color: "#94a3b8", fontSize: 13, cursor: actionPending ? "not-allowed" : "pointer",
              opacity: actionPending ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
        )}
        {isCommissioner && (trade.status === "PENDING_REVIEW" || trade.status === "ACCEPTED") && (
          <>
            <button
              onClick={() => onAction(trade.id, "review-approve")}
              disabled={actionPending}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "#22c55e", color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: actionPending ? "not-allowed" : "pointer", opacity: actionPending ? 0.6 : 1,
              }}
            >
              Approve
            </button>
            <button
              onClick={() => onAction(trade.id, "review-veto")}
              disabled={actionPending}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)",
                background: "transparent", color: "#f87171", fontSize: 13, cursor: actionPending ? "not-allowed" : "pointer",
                opacity: actionPending ? 0.6 : 1,
              }}
            >
              Veto
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function TradeCenter({
  leagueId,
  myTeamId,
  isCommissioner,
  canPropose,
  initialTab,
  incomingTrades,
  sentTrades,
  historyTrades,
  pendingReview,
  playerMap,
  teamMap,
}: Props) {
  const [tab, setTab] = useState<"incoming" | "sent" | "history" | "review">(
    isCommissioner && pendingReview.length > 0 ? "review" : initialTab
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleAction(tradeId: string, action: string) {
    setError(null);
    let url = `/api/leagues/${leagueId}/trades/${tradeId}/`;
    let body: Record<string, string> = {};

    if (action === "accept") url += "accept";
    else if (action === "reject") url += "reject";
    else if (action === "cancel") url += "cancel";
    else if (action === "review-approve") { url += "review"; body = { action: "approve" }; }
    else if (action === "review-veto") { url += "review"; body = { action: "veto" }; }
    else return;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Something went wrong.");
        return;
      }
      startTransition(() => { router.refresh(); });
    } catch {
      setError("Network error. Please try again.");
    }
  }

  const tabs: Array<{ key: typeof tab; label: string; count?: number }> = [
    { key: "incoming", label: "Incoming", count: incomingTrades.length },
    { key: "sent", label: "Sent", count: sentTrades.length },
    ...(isCommissioner && pendingReview.length > 0
      ? [{ key: "review" as const, label: "Needs Review", count: pendingReview.length }]
      : []),
    { key: "history", label: "League History" },
  ];

  const currentTrades =
    tab === "incoming" ? incomingTrades
    : tab === "sent" ? sentTrades
    : tab === "review" ? pendingReview
    : historyTrades;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Trade Center</h1>
        {canPropose && (
          <Link
            href={`/league/${leagueId}/trades/new`}
            style={{
              padding: "10px 18px", borderRadius: 8,
              background: "rgba(99,102,241,0.85)", color: "#fff",
              fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}
          >
            + Propose Trade
          </Link>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid #6366f1" : "2px solid transparent",
              color: tab === t.key ? "#a5b4fc" : "#94a3b8",
              fontSize: 14,
              cursor: "pointer",
              fontWeight: tab === t.key ? 600 : 400,
              position: "relative",
              top: 1,
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 11,
                background: tab === t.key ? "#6366f1" : "rgba(255,255,255,0.1)",
                color: tab === t.key ? "#fff" : "#94a3b8",
                borderRadius: 999, padding: "1px 6px",
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#f87171", fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {currentTrades.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px 24px",
          color: "#64748b", fontSize: 14,
        }}>
          {tab === "incoming" && "No incoming trade offers."}
          {tab === "sent" && "You haven't proposed any trades yet."}
          {tab === "review" && "No trades pending review."}
          {tab === "history" && "No completed trades yet this season."}
          {tab === "incoming" && canPropose && (
            <div style={{ marginTop: 16 }}>
              <Link
                href={`/league/${leagueId}/trades/new`}
                style={{ color: "#a5b4fc", textDecoration: "none", fontSize: 14 }}
              >
                Propose a trade to another team →
              </Link>
            </div>
          )}
        </div>
      ) : (
        currentTrades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            myTeamId={myTeamId}
            playerMap={playerMap}
            teamMap={teamMap}
            isCommissioner={isCommissioner}
            onAction={handleAction}
            actionPending={isPending}
          />
        ))
      )}
    </div>
  );
}
