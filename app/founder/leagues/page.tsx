"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface League {
  id: string;
  name: string;
  season: string;
  status: string;
  playoffStatus: string;
  isReplay: boolean;
  betaStatus: string;
  maxTeams: number;
  commissioner: { email: string; displayName: string } | null;
  _count: { teams: number };
  draft: { status: string; currentPick: number | null } | null;
}

const STATUS_COLOR: Record<string, string> = {
  PRE_DRAFT: "#9ca3af",
  DRAFTING: "#f59e0b",
  IN_SEASON: "#22c55e",
  COMPLETE: "#6b7280",
};

const DRAFT_COLOR: Record<string, string> = {
  PENDING: "#9ca3af",
  IN_PROGRESS: "#f59e0b",
  PAUSED: "#ef4444",
  COMPLETE: "#22c55e",
};

const inputStyle: React.CSSProperties = {
  background: "#111",
  border: "1px solid #333",
  borderRadius: "6px",
  padding: "0.5rem 0.75rem",
  color: "#e0e0e0",
  fontFamily: "monospace",
  fontSize: "0.85rem",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function LeagueExplorer() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Beta league creation form state
  const [showBetaForm, setShowBetaForm] = useState(false);
  const [betaName, setBetaName] = useState("");
  const [betaEmail, setBetaEmail] = useState("");
  const [betaDraftDate, setBetaDraftDate] = useState("2026-07-07");
  const [betaCreating, setBetaCreating] = useState(false);
  const [betaResult, setBetaResult] = useState<{ leagueId: string; inviteUrl: string } | null>(null);
  const [betaError, setBetaError] = useState<string | null>(null);

  function fetchLeagues() {
    fetch("/api/founder/leagues")
      .then((r) => r.json())
      .then((d) => { setLeagues(d.leagues ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchLeagues();
  }, []);

  const filtered = leagues.filter((l) => {
    const q = filter.toLowerCase();
    const matchesSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.id.includes(q) ||
      l.commissioner?.email.toLowerCase().includes(q) ||
      l.commissioner?.displayName.toLowerCase().includes(q);
    // "BETA_ACTIVE" is a pseudo-status: filter by betaStatus === "ACTIVE"
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "BETA_ACTIVE"
        ? l.betaStatus === "ACTIVE"
        : l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleCreateBetaLeague(e: React.FormEvent) {
    e.preventDefault();
    setBetaCreating(true);
    setBetaError(null);
    setBetaResult(null);

    try {
      const res = await fetch("/api/founder/beta-leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: betaName,
          commissionerEmail: betaEmail,
          draftStartsAt: new Date(betaDraftDate + "T12:00:00Z").toISOString(),
        }),
      });
      const data = await res.json() as { leagueId?: string; commissionerInviteUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setBetaResult({ leagueId: data.leagueId!, inviteUrl: data.commissionerInviteUrl! });
      setBetaName("");
      setBetaEmail("");
      fetchLeagues();
    } catch (err) {
      setBetaError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBetaCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: "1100px" }}>
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem", color: "#ccc" }}>
        League Explorer
      </h1>

      {/* Create Beta League button + form */}
      <div style={{ marginBottom: "1.25rem" }}>
        <button
          onClick={() => { setShowBetaForm(!showBetaForm); setBetaResult(null); setBetaError(null); }}
          style={{
            padding: "0.45rem 1rem",
            background: showBetaForm ? "#1a1a0f" : "#111",
            border: "1px solid #f59e0b",
            borderRadius: "6px",
            color: "#f59e0b",
            fontFamily: "monospace",
            fontSize: "0.82rem",
            cursor: "pointer",
          }}
        >
          {showBetaForm ? "Cancel" : "Create Beta League"}
        </button>

        {showBetaForm && (
          <form
            onSubmit={handleCreateBetaLeague}
            style={{
              marginTop: "0.75rem",
              background: "#0f0f00",
              border: "1px solid #333",
              borderRadius: "8px",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              maxWidth: "460px",
            }}
          >
            <div style={{ fontSize: "0.78rem", color: "#f59e0b", fontWeight: 700, marginBottom: "0.25rem" }}>
              New Beta League
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", color: "#666", marginBottom: "0.3rem" }}>League name</label>
              <input
                type="text"
                value={betaName}
                onChange={(e) => setBetaName(e.target.value)}
                placeholder="e.g. PWHL GM Beta Wave 1"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", color: "#666", marginBottom: "0.3rem" }}>Commissioner email</label>
              <input
                type="email"
                value={betaEmail}
                onChange={(e) => setBetaEmail(e.target.value)}
                placeholder="commissioner@example.com"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", color: "#666", marginBottom: "0.3rem" }}>
                Draft date <span style={{ color: "#555" }}>(July 6–12, 2026)</span>
              </label>
              <input
                type="date"
                value={betaDraftDate}
                min="2026-07-06"
                max="2026-07-12"
                onChange={(e) => setBetaDraftDate(e.target.value)}
                required
                style={{ ...inputStyle, width: "auto" }}
              />
            </div>
            <button
              type="submit"
              disabled={betaCreating}
              style={{
                padding: "0.5rem 1rem",
                background: betaCreating ? "#333" : "#f59e0b",
                border: "none",
                borderRadius: "4px",
                color: "#000",
                fontFamily: "monospace",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: betaCreating ? "not-allowed" : "pointer",
                opacity: betaCreating ? 0.7 : 1,
                alignSelf: "flex-start",
              }}
            >
              {betaCreating ? "Creating…" : "Create league"}
            </button>

            {betaError && (
              <div style={{ color: "#f87171", fontSize: "0.78rem" }}>Error: {betaError}</div>
            )}
            {betaResult && (
              <div style={{ background: "#0a1a0a", border: "1px solid #2d4a2d", borderRadius: "6px", padding: "0.75rem" }}>
                <div style={{ color: "#22c55e", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                  League created!
                </div>
                <div style={{ fontSize: "0.78rem", color: "#888", marginBottom: "0.25rem" }}>Commissioner invite URL:</div>
                <div style={{
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  padding: "0.4rem 0.6rem",
                  color: "#64b5f6",
                  wordBreak: "break-all",
                }}>
                  {window.location.origin}{betaResult.inviteUrl}
                </div>
                <Link
                  href={`/founder/leagues/${betaResult.leagueId}`}
                  style={{ display: "inline-block", marginTop: "0.5rem", color: "#64b5f6", fontSize: "0.78rem" }}
                >
                  Open league detail →
                </Link>
              </div>
            )}
          </form>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by name, commissioner, or ID…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: "#111", border: "1px solid #333", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#e0e0e0", fontFamily: "monospace", fontSize: "0.85rem", outline: "none" }}
        />
        {["all", "PRE_DRAFT", "DRAFTING", "IN_SEASON", "COMPLETE", "BETA_ACTIVE"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "0.4rem 0.75rem",
              background: statusFilter === s ? (s === "BETA_ACTIVE" ? "#f59e0b" : "#22c55e") : "#111",
              border: `1px solid ${statusFilter === s ? (s === "BETA_ACTIVE" ? "#f59e0b" : "#22c55e") : "#333"}`,
              borderRadius: "4px",
              color: statusFilter === s ? "#000" : "#888",
              fontFamily: "monospace",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            {s === "all" ? "All" : s === "BETA_ACTIVE" ? "Beta" : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "#555", fontSize: "0.9rem", padding: "2rem 0" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: "#555", fontSize: "0.9rem", padding: "2rem 0" }}>No leagues match your filter.</div>
      ) : (
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ background: "#0a0a0a" }}>
                {["Name", "Season", "Status", "Commissioner", "Teams", "Draft", "Playoffs", ""].map((h) => (
                  <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "#666", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #222" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "0.6rem 0.75rem", color: "#ccc" }}>
                    {l.name}
                    {l.isReplay && (
                      <span style={{ marginLeft: "0.4rem", background: "rgba(100,181,246,0.1)", color: "#64b5f6", borderRadius: "3px", padding: "0 0.3rem", fontSize: "0.7rem" }}>
                        replay
                      </span>
                    )}
                    {l.betaStatus === "ACTIVE" && (
                      <span style={{ marginLeft: "0.4rem", background: "rgba(245,158,11,0.15)", color: "#f59e0b", borderRadius: "3px", padding: "0 0.3rem", fontSize: "0.7rem" }}>
                        beta
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "#888" }}>{l.season}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <span style={{ color: STATUS_COLOR[l.status] ?? "#888", fontWeight: 700, fontSize: "0.75rem" }}>{l.status}</span>
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "#888", fontSize: "0.78rem" }}>
                    {l.commissioner?.displayName ?? "—"}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "#888", textAlign: "center" }}>
                    {l._count.teams}/{l.maxTeams}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    {l.draft ? (
                      <span style={{ color: DRAFT_COLOR[l.draft.status] ?? "#888", fontSize: "0.75rem", fontWeight: 600 }}>
                        {l.draft.status}
                        {l.draft.status === "IN_PROGRESS" && l.draft.currentPick != null
                          ? ` · pick ${l.draft.currentPick}`
                          : ""}
                      </span>
                    ) : (
                      <span style={{ color: "#444" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "#888", fontSize: "0.75rem" }}>
                    {l.playoffStatus}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <Link href={`/founder/leagues/${l.id}`} style={{ color: "#64b5f6", fontSize: "0.78rem" }}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#555" }}>
        {filtered.length} of {leagues.length} leagues
      </div>
    </div>
  );
}
