"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  leagueId: string;
  dayNumber: number;
  totalDays: number;
  currentDate: string | null; // "YYYY-MM-DD" of the last completed game day
  hasNextDay: boolean;
}

export default function ReplayDayBar({
  leagueId,
  dayNumber,
  totalDays,
  currentDate,
  hasNextDay,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNextDay = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/replay/advance-day`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to advance.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const dateLabel = currentDate
    ? new Date(currentDate + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Pre-season";

  const pct = totalDays > 0 ? Math.round((dayNumber / totalDays) * 100) : 0;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 14px",
      marginBottom: 12,
      borderRadius: 10,
      background: "rgba(99,102,241,0.06)",
      border: "1px solid rgba(99,102,241,0.2)",
      flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
        ⏪ Replay
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", whiteSpace: "nowrap" }}>
          Day {dayNumber}
          <span style={{ color: "#475569", fontWeight: 400 }}> / {totalDays}</span>
        </span>
        <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{dateLabel}</span>
        {/* Progress bar */}
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", minWidth: 40 }}>
          <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: "linear-gradient(90deg, #6366f1, #818cf8)" }} />
        </div>
      </div>

      {hasNextDay ? (
        <button
          onClick={handleNextDay}
          disabled={loading}
          style={{
            flexShrink: 0,
            background: loading ? "rgba(99,102,241,0.3)" : "#6366f1",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {loading ? "…" : "Next day →"}
        </button>
      ) : (
        <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600, flexShrink: 0 }}>
          ✓ Season complete
        </span>
      )}

      {error && (
        <span style={{ fontSize: 12, color: "#f87171", width: "100%" }}>{error}</span>
      )}
    </div>
  );
}
