"use client";

import { useState } from "react";
import type { SeasonState } from "@/lib/season/lifecycle";

interface Props {
  leagueId: string;
  seasonState: SeasonState;
  nowMs: number;
  isCommissioner: boolean;
  isFounder: boolean;
  placement: "sticky-footer" | "inline-panel";
  playoffStatus?: string;
}

type DateInputValue = string; // datetime-local format: "2025-01-15"

export default function ReplaySimulatorControls({
  leagueId,
  seasonState,
  nowMs,
  isCommissioner,
  isFounder,
  placement,
  playoffStatus,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const showControls = isCommissioner || isFounder;
  const allButtonsDisabled = playoffStatus === "IN_PROGRESS";

  if (!showControls) return null;

  // Derive the button set from current week status
  const activePeriod = seasonState.periods.find((p) => p.status === "ACTIVE");
  const firstPending = seasonState.periods.find((p) => p.status === "SCORING_PENDING");
  const firstUpcoming = seasonState.periods.find((p) => p.status === "UPCOMING");
  const targetPeriod = activePeriod ?? firstPending ?? firstUpcoming;

  const isDuringWeek = !!activePeriod;

  // Format date range label
  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);

  const weekLabel = targetPeriod
    ? `Week ${targetPeriod.period.week} (${formatDate(targetPeriod.period.startsAt)} – ${formatDate(targetPeriod.period.endsAt)})`
    : "No weeks";

  const weekBadgeStatus = activePeriod
    ? "ACTIVE"
    : firstPending
    ? "SCORING"
    : firstUpcoming
    ? "UPCOMING"
    : "COMPLETE";

  // Initial date for jump picker (9am UTC of target period start, or today)
  const getDefaultPickerDate = () => {
    if (targetPeriod) {
      const d = new Date(targetPeriod.period.startsAt);
      d.setHours(9, 0, 0, 0);
      return d.toISOString().slice(0, 16); // datetime-local format
    }
    return new Date(nowMs).toISOString().slice(0, 16);
  };

  const [pickerDate, setPickerDate] = useState<DateInputValue>(getDefaultPickerDate());

  async function callAdvanceApi(
    action: "advance" | "set-date",
    dateStr: string
  ) {
    setLoading(true);
    setError(null);
    try {
      const isoDate = new Date(dateStr).toISOString();
      const endpoint = `/api/leagues/${leagueId}/season/advance`;

      const payload =
        action === "advance"
          ? { action: "advance", simulatedDate: isoDate }
          : { action: "set-date", simulatedDate: isoDate };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        state?: SeasonState;
        error?: string;
      };

      if (!res.ok || data.error) {
        setError(data.error ?? "Request failed");
        return;
      }

      // Refresh the page so SeasonState is recomputed from DB
      if (data.state) {
        window.location.reload();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleStartWeek() {
    if (!targetPeriod) return;
    const d = new Date(targetPeriod.period.startsAt);
    d.setHours(9, 0, 0, 0);
    await callAdvanceApi("set-date", d.toISOString().slice(0, 16));
  }

  async function handleEndWeek() {
    if (!targetPeriod) return;
    const d = new Date(targetPeriod.period.endsAt);
    d.setTime(d.getTime() + 60_000); // +1 min past end
    d.setHours(9, 0, 0, 0); // Reset to 9am UTC of that day
    await callAdvanceApi("advance", d.toISOString().slice(0, 16));
  }

  async function handlePlusOneDay() {
    const current = new Date(nowMs);
    current.setDate(current.getDate() + 1);
    current.setHours(9, 0, 0, 0);
    await callAdvanceApi("set-date", current.toISOString().slice(0, 16));
  }

  async function handleJumpToDate() {
    if (!pickerDate) {
      setError("Please select a date");
      return;
    }
    await callAdvanceApi("set-date", pickerDate);
  }

  const buttonBase: React.CSSProperties = {
    border: "none",
    borderRadius: 8,
    color: "#fff",
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    opacity: allButtonsDisabled ? 0.5 : 1,
    pointerEvents: allButtonsDisabled ? "none" : "auto",
  };

  if (placement === "sticky-footer") {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: "#4f46e5",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          padding: "12px 16px",
          color: "#fff",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700 }}>⏪ Replay Mode</span>
              <span style={{ opacity: 0.9 }}>·</span>
              <span style={{ opacity: 0.9 }}>{weekLabel}</span>
              {weekBadgeStatus && (
                <>
                  <span style={{ opacity: 0.7 }}>·</span>
                  <span
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {weekBadgeStatus}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={() => {
                setShowDatePicker(false);
                setError(null);
              }}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#fff",
                padding: "4px 8px",
                fontSize: 12,
                cursor: "pointer",
                borderRadius: 4,
              }}
            >
              ✕
            </button>
          </div>

          {/* Buttons or date picker */}
          {!showDatePicker ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {isDuringWeek ? (
                <>
                  <button
                    onClick={handlePlusOneDay}
                    disabled={loading || allButtonsDisabled}
                    style={{
                      ...buttonBase,
                      background: allButtonsDisabled
                        ? "#64748b"
                        : "#10b981",
                    }}
                  >
                    {loading ? "…" : "+1 Day →"}
                  </button>
                  <button
                    onClick={handleEndWeek}
                    disabled={loading || allButtonsDisabled}
                    style={{
                      ...buttonBase,
                      background: allButtonsDisabled
                        ? "#64748b"
                        : "#f59e0b",
                    }}
                  >
                    {loading ? "…" : "⏭ End Week"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleStartWeek}
                    disabled={loading || !targetPeriod || allButtonsDisabled}
                    style={{
                      ...buttonBase,
                      background: allButtonsDisabled
                        ? "#64748b"
                        : "#10b981",
                    }}
                  >
                    {loading ? "…" : "▶ Start Week"}
                  </button>
                  {seasonState.periods.some((p) => p.status !== "COMPLETE") && (
                    <button
                      onClick={() => {
                        // Jump to last period end
                        const lastPeriod = seasonState.periods[seasonState.periods.length - 1];
                        if (lastPeriod) {
                          const d = new Date(lastPeriod.period.endsAt);
                          d.setHours(9, 0, 0, 0);
                          callAdvanceApi(
                            "advance",
                            d.toISOString().slice(0, 16)
                          );
                        }
                      }}
                      disabled={loading || allButtonsDisabled}
                      style={{
                        ...buttonBase,
                        background: allButtonsDisabled
                          ? "#64748b"
                          : "#a855f7",
                      }}
                    >
                      {loading ? "…" : "⏩ Skip to Playoffs"}
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => setShowDatePicker(true)}
                disabled={loading || allButtonsDisabled}
                style={{
                  ...buttonBase,
                  background: allButtonsDisabled
                    ? "#64748b"
                    : "#0ea5e9",
                }}
              >
                📅 Jump to date
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                <span style={{ opacity: 0.8 }}>Select date:</span>
                <input
                  type="datetime-local"
                  value={pickerDate}
                  onChange={(e) => setPickerDate(e.target.value)}
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    color: "#fff",
                    padding: "6px 10px",
                    fontSize: 13,
                  }}
                />
              </label>
              <button
                onClick={handleJumpToDate}
                disabled={loading}
                style={{
                  ...buttonBase,
                  background: "#0ea5e9",
                }}
              >
                {loading ? "…" : "Jump"}
              </button>
              <button
                onClick={() => setShowDatePicker(false)}
                disabled={loading}
                style={{
                  ...buttonBase,
                  background: "rgba(255,255,255,0.1)",
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Status line */}
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            <span>Simulated: {new Date(nowMs).toISOString().slice(0, 10)}</span>
            {allButtonsDisabled && (
              <span style={{ marginLeft: 12, color: "#fbbf24" }}>
                ⚠ Playoff rounds are advanced via Season Controls
              </span>
            )}
          </div>

          {error && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#f87171" }}>
              ❌ {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (placement === "inline-panel") {
    return (
      <div
        style={{
          border: "2px solid #fbbf24",
          borderRadius: 12,
          padding: 16,
          background: "rgba(251, 191, 36, 0.05)",
          marginBottom: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24" }}>
              🔧 Replay Controls
            </span>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>
              {weekLabel}
            </span>
            {weekBadgeStatus && (
              <span
                style={{
                  background: "#fbbf24",
                  color: "#000",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {weekBadgeStatus}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setShowDatePicker(false);
              setError(null);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        {/* Controls */}
        {!showDatePicker ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {isDuringWeek ? (
              <>
                <button
                  onClick={handlePlusOneDay}
                  disabled={loading || allButtonsDisabled}
                  style={{
                    ...buttonBase,
                    background: allButtonsDisabled
                      ? "#64748b"
                      : "#10b981",
                  }}
                >
                  {loading ? "…" : "+1 Day →"}
                </button>
                <button
                  onClick={handleEndWeek}
                  disabled={loading || allButtonsDisabled}
                  style={{
                    ...buttonBase,
                    background: allButtonsDisabled
                      ? "#64748b"
                      : "#f59e0b",
                  }}
                >
                  {loading ? "…" : "⏭ End Week"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartWeek}
                  disabled={loading || !targetPeriod || allButtonsDisabled}
                  style={{
                    ...buttonBase,
                    background: allButtonsDisabled
                      ? "#64748b"
                      : "#10b981",
                  }}
                >
                  {loading ? "…" : "▶ Start Week"}
                </button>
                {seasonState.periods.some((p) => p.status !== "COMPLETE") && (
                  <button
                    onClick={() => {
                      const lastPeriod = seasonState.periods[seasonState.periods.length - 1];
                      if (lastPeriod) {
                        const d = new Date(lastPeriod.period.endsAt);
                        d.setHours(9, 0, 0, 0);
                        callAdvanceApi(
                          "advance",
                          d.toISOString().slice(0, 16)
                        );
                      }
                    }}
                    disabled={loading || allButtonsDisabled}
                    style={{
                      ...buttonBase,
                      background: allButtonsDisabled
                        ? "#64748b"
                        : "#a855f7",
                    }}
                  >
                    {loading ? "…" : "⏩ Skip to Playoffs"}
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => setShowDatePicker(true)}
              disabled={loading || allButtonsDisabled}
              style={{
                ...buttonBase,
                background: allButtonsDisabled
                  ? "#64748b"
                  : "#0ea5e9",
              }}
            >
              📅 Jump to date
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              <span>Select date:</span>
              <input
                type="datetime-local"
                value={pickerDate}
                onChange={(e) => setPickerDate(e.target.value)}
                style={{
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: 6,
                  color: "#e2e8f0",
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              />
            </label>
            <button
              onClick={handleJumpToDate}
              disabled={loading}
              style={{
                ...buttonBase,
                background: "#0ea5e9",
              }}
            >
              {loading ? "…" : "Jump"}
            </button>
            <button
              onClick={() => setShowDatePicker(false)}
              disabled={loading}
              style={{
                ...buttonBase,
                background: "rgba(148,163,184,0.2)",
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Status */}
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          Simulated: {new Date(nowMs).toISOString().slice(0, 10)}
          {allButtonsDisabled && (
            <div style={{ marginTop: 8, color: "#fbbf24" }}>
              ⚠ Playoff rounds are advanced via Season Controls
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#f87171" }}>
            ❌ {error}
          </div>
        )}
      </div>
    );
  }

  return null;
}
