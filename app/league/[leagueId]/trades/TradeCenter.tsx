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
  /** When provided, navigation uses /team/[teamId]/trades routes and hides the League History tab */
  teamId?: string;
}

const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "Waiting for response",
  COUNTERED: "Counter-offer sent — awaiting your response",
  ACCEPTED: "Accepted — pending review",
  PENDING_REVIEW: "Under commissioner review",
  EXECUTED: "Completed",
  VETOED: "Vetoed by commissioner",
  REVERSED: "Rolled back by commissioner",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired (no response in time)",
};

const STATUS_COLORS: Record<string, string> = {
  PROPOSED: "var(--accent-strong)",
  COUNTERED: "var(--gold)",
  ACCEPTED: "var(--green)",
  PENDING_REVIEW: "var(--amber)",
  EXECUTED: "var(--green)",
  VETOED: "var(--red)",
  REVERSED: "var(--red)",
  REJECTED: "var(--faint)",
  CANCELLED: "var(--faint)",
  EXPIRED: "var(--faint)",
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
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      {outgoing.length === 0 ? (
        <span style={{ color: "var(--faint)", fontSize: 13 }}>—</span>
      ) : (
        outgoing.map((item) => {
          const p = playerMap[item.playerId];
          return (
            <div key={item.id} style={{ fontSize: 13, color: "var(--text)", marginBottom: 2 }}>
              {p?.name ?? item.playerId}
              <span style={{ color: "var(--dim)", fontSize: 11, marginLeft: 6 }}>
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
  tradeBase,
}: {
  trade: TradeWithItems;
  myTeamId: string;
  playerMap: Record<string, PlayerInfo>;
  teamMap: Record<string, string>;
  isCommissioner: boolean;
  onAction: (tradeId: string, action: string) => void;
  actionPending: boolean;
  tradeBase: string;
}) {
  const isReceiver = trade.receivingTeamId === myTeamId;
  const isProposer = trade.proposingTeamId === myTeamId;
  const otherTeamId = isReceiver ? trade.proposingTeamId : trade.receivingTeamId;
  const otherTeamName = teamMap[otherTeamId] ?? "Unknown Team";
  const myTeamName = teamMap[myTeamId] ?? "My Team";

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: STATUS_COLORS[trade.status] ?? "var(--dim)",
            background: `${STATUS_COLORS[trade.status] ?? "#94a3b8"}22`,
            borderRadius: 999,
            padding: "2px 10px",
          }}>
            {STATUS_LABELS[trade.status] ?? trade.status}
          </span>
          <span style={{ fontSize: 12, color: "var(--faint)" }}>{formatDate(trade.createdAt)}</span>
        </div>
        <Link
          href={`${tradeBase}/${trade.id}`}
          style={{ fontSize: 12, color: "var(--accent-strong)", textDecoration: "none" }}
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
        <div style={{ paddingTop: 20, color: "var(--faint)", fontSize: 20 }}>⇄</div>
        <TradePlayersColumn
          items={trade.items}
          fromTeamId={trade.receivingTeamId}
          playerMap={playerMap}
          teamMap={teamMap}
          label={`${teamMap[trade.receivingTeamId] ?? "Team"} gives`}
        />
      </div>

      {trade.message && (
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--dim)", fontStyle: "italic" }}>
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
                background: "#22c55e", color: "var(--accent-ink)", fontSize: 13, fontWeight: 600,
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
              href={`${tradeBase}/${trade.id}/counter`}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(165,180,252,0.4)",
                background: "transparent", color: "var(--accent-strong)", fontSize: 13, textDecoration: "none",
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
              padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: "var(--dim)", fontSize: 13, cursor: actionPending ? "not-allowed" : "pointer",
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
                background: "#22c55e", color: "var(--accent-ink)", fontSize: 13, fontWeight: 600,
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
  teamId,
}: Props) {
  const tradeBase = teamId ? `/team/${teamId}/trades` : `/league/${leagueId}/trades`;

  const [tab, setTab] = useState<"incoming" | "sent" | "history" | "review">(
    isCommissioner && pendingReview.length > 0 ? "review" : initialTab
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tradePrimerOpen, setTradePrimerOpen] = useState(false);
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
    // League History hidden in team context — Transactions covers full trade history
    ...(teamId ? [] : [{ key: "history" as const, label: "League History" }]),
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
            href={`${tradeBase}/new`}
            style={{
              padding: "10px 18px", borderRadius: 8,
              background: "var(--accent)", color: "var(--accent-ink)",
              fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}
          >
            Propose Trade →
          </Link>
        )}
      </div>

      {/* How trades work primer */}
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setTradePrimerOpen((v) => !v)}
          style={{ fontSize: 13, color: "var(--accent-strong)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {tradePrimerOpen ? "▴ How do trades work?" : "How do trades work? ▾"}
        </button>
        {tradePrimerOpen && (
          <div style={{
            marginTop: 8, padding: "12px 16px", borderRadius: 12,
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            fontSize: 13, color: "var(--dim)", lineHeight: 1.7,
          }}>
            <strong style={{ color: "var(--text)" }}>New to trading?</strong> You can offer players from your roster in exchange for players on another team&apos;s roster. Both sides must agree. The commissioner may review trades before they take effect.
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.key ? "var(--accent-strong)" : "var(--dim)",
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
                background: tab === t.key ? "var(--accent)" : "var(--surface)",
                color: tab === t.key ? "var(--accent-ink)" : "var(--dim)",
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
          color: "var(--faint)", fontSize: 14,
        }}>
          {tab === "incoming" && (
            <>
              <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.4 }}>🔄</div>
              <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--muted)" }}>No trade offers yet</p>
              <p style={{ margin: 0, fontSize: 13 }}>When another manager sends you a deal, it&apos;ll show up here.</p>
            </>
          )}
          {tab === "sent" && (
            <>
              <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.4 }}>📤</div>
              <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--muted)" }}>No trades proposed yet</p>
              <p style={{ margin: 0, fontSize: 13 }}>Browse another team&apos;s roster and make them an offer.</p>
            </>
          )}
          {tab === "review" && (
            <>
              <p style={{ margin: 0 }}>No trades pending review.</p>
            </>
          )}
          {tab === "history" && (
            <>
              <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.4 }}>📋</div>
              <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--muted)" }}>No completed trades yet</p>
              <p style={{ margin: 0, fontSize: 13 }}>Trades that go through will appear here for the whole league to see.</p>
            </>
          )}
          {tab === "incoming" && canPropose && (
            <div style={{ marginTop: 16 }}>
              <Link
                href={`${tradeBase}/new`}
                style={{ color: "var(--accent-strong)", textDecoration: "none", fontSize: 14 }}
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
            tradeBase={tradeBase}
          />
        ))
      )}
    </div>
  );
}
