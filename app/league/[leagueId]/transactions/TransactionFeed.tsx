"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { EnrichedTransactionEvent } from "@/lib/services/activity";

interface Props {
  leagueId: string;
  initialEvents: EnrichedTransactionEvent[];
  initialHasMore: boolean;
  teams: { id: string; name: string }[];
  selectedTeamId: string | null;
  selectedType: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  DRAFT_PICK: "🎯",
  PLAYER_ADD: "➕",
  PLAYER_DROP: "➖",
  TRADE: "🔄",
  PLAYOFF_QUALIFICATION: "🏒",
  MAJOR_PERFORMANCE: "⭐",
};

const TYPE_GROUPS: { label: string; types: string | null }[] = [
  { label: "All", types: null },
  { label: "Adds/Drops", types: "PLAYER_ADD,PLAYER_DROP" },
  { label: "Draft", types: "DRAFT_PICK" },
  { label: "Trades", types: "TRADE" },
  { label: "Commissioner", types: "COMMISSIONER_FORCE_MOVE,COMMISSIONER_UNDO_TRANSACTION,COMMISSIONER_REPLACE_MANAGER,COMMISSIONER_DRAFT_PAUSED,COMMISSIONER_DRAFT_RESUMED,COMMISSIONER_ANNOUNCEMENT,COMMISSIONER_SETTINGS_CHANGED" },
  { label: "Playoffs", types: "PLAYOFF_QUALIFICATION" },
];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TransactionFeed({
  leagueId,
  initialEvents,
  initialHasMore,
  teams,
  selectedTeamId,
  selectedType,
}: Props) {
  const router = useRouter();
  const [events, setEvents] = useState<EnrichedTransactionEvent[]>(initialEvents);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Reset state when filters change
  useEffect(() => {
    setEvents(initialEvents);
    setHasMore(initialHasMore);
    setError(null);
    loadingRef.current = false;
  }, [initialEvents, initialHasMore]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const before = events[events.length - 1]?.createdAt;
      if (!before) { setLoading(false); loadingRef.current = false; return; }

      const params = new URLSearchParams();
      params.set("limit", "25");
      params.set("before", before);
      if (selectedTeamId) params.set("teamId", selectedTeamId);
      if (selectedType) params.set("type", selectedType);

      const res = await fetch(`/api/leagues/${leagueId}/transactions?${params}`);
      if (!res.ok) throw new Error("Failed to load transactions");

      const data = await res.json() as { events: EnrichedTransactionEvent[]; hasMore: boolean };
      setEvents((prev) => [...prev, ...data.events]);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more transactions");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [events, hasMore, leagueId, selectedTeamId, selectedType]);


  // IntersectionObserver for scroll-to-bottom pagination
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams();
    if (value) params.set(key, value);
    router.push(`/league/${leagueId}/transactions?${params.toString()}`);
  }

  const icon = (type: string): string => {
    if (type.startsWith("COMMISSIONER_")) return "🛠️";
    return TYPE_ICONS[type] ?? "•";
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 16px" }}>Transaction History</h1>

      {/* Type filter tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        {TYPE_GROUPS.map((group) => {
          const isActive = group.types === selectedType || (group.types === null && selectedType === null);
          return (
            <button
              key={group.label}
              onClick={() => updateFilter("type", group.types)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: isActive ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)",
                color: isActive ? "#a5b4fc" : "#64748b",
              }}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {/* Team filter dropdown */}
      <div style={{ marginBottom: 16 }}>
        <select
          value={selectedTeamId ?? ""}
          onChange={(e) => updateFilter("team", e.target.value || null)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(148,163,184,0.2)",
            background: "rgba(255,255,255,0.06)",
            color: "#e2e8f0",
            fontSize: 13,
            outline: "none",
          }}
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            fontSize: 13,
            color: "#fca5a5",
            marginBottom: 16,
          }}
        >
          {error}
          <button
            onClick={loadMore}
            style={{
              marginLeft: 12,
              background: "none",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5",
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {events.length === 0 && !loading && (
        <p style={{ color: "#64748b", fontSize: 13, fontStyle: "italic" }}>
          No transactions yet. Actions like draft picks, player adds, and drops will appear here.
        </p>
      )}

      {/* Event list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {events.map((evt) => (
          <div
            key={evt.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(148,163,184,0.08)",
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{icon(evt.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, color: "#cbd5e1" }}>
                {evt.description}
                {evt.teamName && (
                  <span style={{ color: "#818cf8", marginLeft: 6 }}>{evt.teamName}</span>
                )}
              </span>
            </div>
            <span style={{ fontSize: 11, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}>
              {timeAgo(evt.createdAt)}
            </span>
          </div>
        ))}
      </div>


      {/* Loading state */}
      {loading && (
        <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", marginTop: 12 }}>
          Loading more transactions…
        </p>
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* Fallback "Load more" button */}
      {hasMore && !loading && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            onClick={loadMore}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.2)",
              background: "rgba(255,255,255,0.06)",
              color: "#94a3b8",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Load more
          </button>
        </div>
      )}

      {/* End of list */}
      {!hasMore && events.length > 0 && (
        <p style={{ color: "#475569", fontSize: 12, textAlign: "center", marginTop: 16 }}>
          All transactions loaded
        </p>
      )}
    </div>
  );
}
