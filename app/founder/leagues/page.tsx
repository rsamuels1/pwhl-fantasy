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

export default function LeagueExplorer() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/founder/leagues")
      .then((r) => r.json())
      .then((d) => { setLeagues(d.leagues ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = leagues.filter((l) => {
    const q = filter.toLowerCase();
    const matchesSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.id.includes(q) ||
      l.commissioner?.email.toLowerCase().includes(q) ||
      l.commissioner?.displayName.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ maxWidth: "1100px" }}>
      <h1 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem", color: "#ccc" }}>
        League Explorer
      </h1>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search by name, commissioner, or ID…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1, background: "#111", border: "1px solid #333", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#e0e0e0", fontFamily: "monospace", fontSize: "0.85rem", outline: "none" }}
        />
        {["all", "PRE_DRAFT", "DRAFTING", "IN_SEASON", "COMPLETE"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{ padding: "0.4rem 0.75rem", background: statusFilter === s ? "#22c55e" : "#111", border: `1px solid ${statusFilter === s ? "#22c55e" : "#333"}`, borderRadius: "4px", color: statusFilter === s ? "#000" : "#888", fontFamily: "monospace", fontSize: "0.75rem", cursor: "pointer" }}
          >
            {s === "all" ? "All" : s}
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
