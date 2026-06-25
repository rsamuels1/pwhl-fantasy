"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface WireEntry {
  playerId: string;
  playerName: string;
  position: string;
  teamAbbr: string | null;
  expiresAt: string;
  hoursRemaining: number;
}

interface PendingClaim {
  id: string;
  addPlayerId: string;
  addPlayerName: string;
  dropPlayerId: string | null;
  dropPlayerName: string | null;
  prioritySnapshot: number;
  createdAt: string;
}

interface PriorityRow {
  priority: number;
  teamId: string;
  teamName: string;
}

interface RosterPlayer {
  entryId: string;
  playerId: string;
  name: string;
  slot: string;
}

interface WireData {
  wire: WireEntry[];
  myClaims: PendingClaim[];
  myPriority: number | null;
  allPriorities: PriorityRow[];
}

interface Props {
  leagueId: string;
  teamId: string;
  rosterPlayers: RosterPlayer[];
}

const POS_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa",
  DEFENSE: "#34d399",
  GOALIE: "#f59e0b",
};

function fmtCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "clearing…";
  const totalMinutes = Math.floor(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function WaiverWirePanel({ leagueId, teamId, rosterPlayers }: Props) {
  const [data, setData] = useState<WireData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Claim submission state
  const [claimingPlayerId, setClaimingPlayerId] = useState<string | null>(null);
  const [dropForClaim, setDropForClaim] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Two-step cancel confirmation: stores the claim ID awaiting confirmation
  const [cancelConfirming, setCancelConfirming] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/waivers?team=${teamId}`);
      if (!res.ok) throw new Error("Failed to load waiver data");
      const json = await res.json() as WireData;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load waivers");
    } finally {
      setLoading(false);
    }
  }, [leagueId, teamId]);

  useEffect(() => {
    fetchData();
    // Refresh countdowns every 60s
    intervalRef.current = setInterval(() => {
      setData((prev) => prev ? { ...prev } : prev); // trigger re-render for countdowns
      fetchData();
    }, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  async function handleSubmitClaim(addPlayerId: string) {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/waivers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addPlayerId, dropPlayerId: dropForClaim ?? undefined }),
      });
      const json = await res.json() as { claim?: object; error?: string };
      if (!res.ok || json.error) {
        setFeedback({ type: "error", msg: json.error ?? "Failed to submit claim." });
      } else {
        setFeedback({ type: "success", msg: "Claim submitted! You'll be notified when waivers clear." });
        setClaimingPlayerId(null);
        setDropForClaim(null);
        fetchData();
      }
    } catch {
      setFeedback({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelClaim(claimId: string) {
    setFeedback(null);
    setCancelConfirming(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/waivers?claimId=${claimId}`, {
        method: "DELETE",
      });
      const json = await res.json() as { cancelled?: string; error?: string };
      if (!res.ok || json.error) {
        setFeedback({ type: "error", msg: json.error ?? "Failed to cancel claim." });
      } else {
        setFeedback({ type: "success", msg: "Claim cancelled." });
        fetchData();
      }
    } catch {
      setFeedback({ type: "error", msg: "Network error. Please try again." });
    }
  }

  if (loading) {
    return <p style={{ color: "var(--faint)", fontSize: 13, padding: "12px 0" }}>Loading waiver wire…</p>;
  }
  if (error) {
    return <p style={{ color: "#f87171", fontSize: 13, padding: "12px 0" }}>{error}</p>;
  }
  if (!data) return null;

  const claimingEntry = claimingPlayerId ? data.wire.find((e) => e.playerId === claimingPlayerId) : null;
  const alreadyClaimedIds = new Set(data.myClaims.map((c) => c.addPlayerId));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Feedback strip */}
      {feedback && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, fontSize: 13,
          background: feedback.type === "success" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
          border: `1px solid ${feedback.type === "success" ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`,
          color: feedback.type === "success" ? "#6ee7b7" : "#f87171",
        }}>
          {feedback.msg}
        </div>
      )}

      {/* ── Section 1: Active Waiver Wire ── */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--dim)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Waiver Wire
        </h3>

        {data.wire.length === 0 ? (
          <p style={{ color: "var(--faint)", fontSize: 13, fontStyle: "italic" }}>No players on waivers right now.</p>
        ) : (
          <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            {/* Column header */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(100px,1fr) 50px 80px 80px", gap: 8, padding: "8px 14px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--faint)" }}>
              <span>Player</span>
              <span>Pos</span>
              <span style={{ textAlign: "right" }}>Clears In</span>
              <span />
            </div>

            {data.wire.map((entry, i) => {
              const isClaiming = claimingPlayerId === entry.playerId;
              const alreadyClaimed = alreadyClaimedIds.has(entry.playerId);
              return (
                <div key={entry.playerId} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(100px,1fr) 50px 80px 80px",
                    gap: 8,
                    padding: "10px 14px",
                    alignItems: "center",
                    background: isClaiming ? "rgba(143,193,232,0.06)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.playerName}
                      </span>
                      {entry.teamAbbr && <span style={{ fontSize: 10, color: "var(--faint)", flexShrink: 0 }}>{entry.teamAbbr}</span>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[entry.position] ?? "var(--dim)" }}>
                      {entry.position[0]}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--dim)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmtCountdown(entry.expiresAt)}
                    </span>
                    {alreadyClaimed ? (
                      <span style={{ fontSize: 11, color: "var(--accent-strong)", textAlign: "right" }}>Claimed</span>
                    ) : (
                      <button
                        onClick={() => {
                          setClaimingPlayerId(isClaiming ? null : entry.playerId);
                          setDropForClaim(null);
                        }}
                        disabled={submitting}
                        style={{
                          fontSize: 11, fontWeight: 600, minHeight: 36, padding: "0 12px",
                          borderRadius: 6, border: "none", cursor: "pointer",
                          background: isClaiming ? "rgba(143,193,232,0.2)" : "rgba(143,193,232,0.15)",
                          color: "var(--accent-strong)",
                          outline: isClaiming ? "1px solid rgba(143,193,232,0.4)" : "none",
                          opacity: submitting ? 0.5 : 1,
                        }}
                      >
                        {isClaiming ? "Cancel" : "Claim"}
                      </button>
                    )}
                  </div>

                  {/* Inline claim form */}
                  {isClaiming && claimingEntry && (
                    <div style={{ margin: "0 14px 12px", padding: "14px", borderRadius: 10, background: "rgba(143,193,232,0.08)", border: "1px solid rgba(143,193,232,0.2)" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: "0 0 10px" }}>
                        Claim {claimingEntry.playerName}
                      </p>
                      {rosterPlayers.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <p style={{ fontSize: 12, color: "var(--dim)", margin: "0 0 6px" }}>
                            Drop to make room (optional if roster has space):
                          </p>
                          <select
                            value={dropForClaim ?? ""}
                            onChange={(e) => setDropForClaim(e.target.value || null)}
                            style={{
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              color: "var(--text)",
                              padding: "7px 10px",
                              fontSize: 13,
                              cursor: "pointer",
                              outline: "none",
                              width: "100%",
                            }}
                          >
                            <option value="">No drop (if roster has space)</option>
                            {rosterPlayers.map((rp) => (
                              <option key={rp.playerId} value={rp.playerId}>
                                {rp.name} ({rp.slot})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => handleSubmitClaim(entry.playerId)}
                          disabled={submitting}
                          style={{
                            fontSize: 12, fontWeight: 700, minHeight: 36, padding: "0 16px",
                            borderRadius: 8, border: "none", cursor: "pointer",
                            background: "rgba(143,193,232,0.3)", color: "var(--accent-strong)",
                            opacity: submitting ? 0.5 : 1,
                          }}
                        >
                          {submitting ? "Submitting…" : "Submit Claim"}
                        </button>
                        <button
                          onClick={() => { setClaimingPlayerId(null); setDropForClaim(null); }}
                          style={{ fontSize: 12, fontWeight: 600, minHeight: 36, padding: "0 14px", borderRadius: 8, border: "none", cursor: "pointer", background: "var(--surface)", color: "var(--faint)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2: My Pending Claims ── */}
      {data.myClaims.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--dim)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            My Pending Claims
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.myClaims.map((claim) => (
              <div key={claim.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 10,
                background: "var(--bg-raised)",
                border: "1px solid var(--border)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                    Add {claim.addPlayerName}
                  </span>
                  {claim.dropPlayerName && (
                    <span style={{ fontSize: 12, color: "var(--faint)", marginLeft: 6 }}>
                      / Drop {claim.dropPlayerName}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: 8 }}>
                    Priority #{claim.prioritySnapshot}
                  </span>
                </div>
                {cancelConfirming === claim.id ? (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleCancelClaim(claim.id)}
                      style={{
                        fontSize: 11, fontWeight: 700, minHeight: 36, padding: "0 12px",
                        borderRadius: 6, border: "1px solid rgba(248,113,113,0.5)",
                        cursor: "pointer", background: "rgba(248,113,113,0.15)", color: "#f87171",
                      }}
                    >
                      Confirm cancel?
                    </button>
                    <button
                      onClick={() => setCancelConfirming(null)}
                      style={{
                        fontSize: 11, fontWeight: 600, minHeight: 36, padding: "0 10px",
                        borderRadius: 6, border: "1px solid var(--border)",
                        cursor: "pointer", background: "var(--surface)", color: "var(--faint)",
                      }}
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCancelConfirming(claim.id)}
                    style={{
                      fontSize: 11, fontWeight: 600, minHeight: 36, padding: "0 12px",
                      borderRadius: 6, border: "1px solid rgba(248,113,113,0.3)",
                      cursor: "pointer", background: "rgba(248,113,113,0.06)", color: "#f87171",
                      flexShrink: 0,
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3: Priority Order ── */}
      {data.allPriorities.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--dim)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Priority Order
          </h3>
          <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            {data.allPriorities.map((row, i) => {
              const isMe = row.teamId === teamId;
              return (
                <div key={row.teamId} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 14px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  background: isMe ? "rgba(143,193,232,0.05)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                }}>
                  <span style={{ fontSize: 12, color: "var(--faint)", width: 20, flexShrink: 0, textAlign: "center" }}>
                    {row.priority}
                  </span>
                  <span style={{ fontSize: 13, color: isMe ? "var(--accent-strong)" : "var(--muted)", fontWeight: isMe ? 600 : 400, flex: 1 }}>
                    {row.teamName}
                  </span>
                  {isMe && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(143,193,232,0.2)", color: "var(--accent-strong)" }}>
                      You
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "var(--faint)", margin: "8px 0 0", lineHeight: 1.5 }}>
            Waivers process daily at 3 AM ET. Claiming a player moves you to last priority.
          </p>
        </div>
      )}
    </div>
  );
}
