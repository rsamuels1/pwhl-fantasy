"use client";

import { useEffect, useRef, useState } from "react";

type FeedbackStatus = "OPEN" | "IN_BACKLOG" | "RESOLVED" | "DISMISSED";

type Submission = {
  id: string;
  type: "BUG" | "SUGGESTION" | "OTHER";
  body: string;
  url: string | null;
  leagueId: string | null;
  status: FeedbackStatus;
  createdAt: Date | string;
  user: { email: string };
  backlogItem: { id: string } | null;
};

const TYPE_COLORS: Record<string, string> = {
  BUG: "#ef4444",
  SUGGESTION: "var(--accent)",
  OTHER: "#6b7280",
};

const STATUS_STYLES: Record<FeedbackStatus, { color: string; label: string; strikethrough?: boolean }> = {
  OPEN: { color: "var(--faint)", label: "OPEN" },
  IN_BACKLOG: { color: "var(--accent)", label: "IN BACKLOG" },
  RESOLVED: { color: "#22c55e", label: "RESOLVED" },
  DISMISSED: { color: "#374151", label: "DISMISSED", strikethrough: true },
};

const ALL_STATUSES: FeedbackStatus[] = ["OPEN", "IN_BACKLOG", "RESOLVED", "DISMISSED"];

const PRIORITY_OPTIONS = ["P0", "P1", "P2", "P3"];
const CATEGORY_OPTIONS = [
  { label: "Bug Fix", value: "BUG_FIX" },
  { label: "Enhancement", value: "ENHANCEMENT" },
  { label: "New Feature", value: "NEW_FEATURE" },
];

function chip(color: string, text: string, strikethrough?: boolean) {
  return (
    <span
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        borderRadius: 4,
        padding: "0.15rem 0.5rem",
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textDecoration: strikethrough ? "line-through" : undefined,
        opacity: strikethrough ? 0.6 : 1,
      }}
    >
      {text}
    </span>
  );
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString();
}

type TabKey = "ALL" | FeedbackStatus;

export default function FeedbackTable({ submissions: initial }: { submissions: Submission[] }) {
  const [submissions, setSubmissions] = useState<Submission[]>(initial);
  const [activeTab, setActiveTab] = useState<TabKey>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteForm, setPromoteForm] = useState({ title: "", userStory: "", priority: "P2", category: "NEW_FEATURE" });
  const [promoteLoading, setPromoteLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openSub = submissions.find((s) => s.id === openId) ?? null;

  // Open/close dialog
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (openId) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [openId]);

  // Reset promote state when dialog closes or changes submission
  useEffect(() => {
    if (!openId) {
      setPromoting(false);
    }
  }, [openId]);

  function openDialog(id: string) {
    const sub = submissions.find((s) => s.id === id);
    if (!sub) return;
    setPromoting(false);
    setPromoteForm({
      title: `[${sub.type}] ${sub.body.slice(0, 60)}`,
      userStory: "As a PWHL GM user, I want ... so that ...",
      priority: "P2",
      category: "NEW_FEATURE",
    });
    setOpenId(id);
  }

  function closeDialog() {
    setOpenId(null);
    setPromoting(false);
  }

  async function handleStatusChange(id: string, status: FeedbackStatus) {
    const res = await fetch(`/api/founder/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  async function handlePromote(e: React.FormEvent) {
    e.preventDefault();
    if (!openSub) return;
    setPromoteLoading(true);
    try {
      const res = await fetch("/api/founder/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackId: openSub.id,
          title: promoteForm.title,
          userStory: promoteForm.userStory,
          priority: promoteForm.priority,
          category: promoteForm.category,
        }),
      });
      if (!res.ok) return;
      const { item } = await res.json();
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === openSub.id
            ? { ...s, status: "IN_BACKLOG", backlogItem: { id: item.id } }
            : s
        )
      );
      closeDialog();
    } finally {
      setPromoteLoading(false);
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "ALL", label: `All (${submissions.length})` },
    ...ALL_STATUSES.map((s) => ({
      key: s as TabKey,
      label: `${STATUS_STYLES[s].label} (${submissions.filter((x) => x.status === s).length})`,
    })),
  ];

  const filtered = activeTab === "ALL" ? submissions : submissions.filter((s) => s.status === activeTab);

  const tabStyle = (active: boolean) => ({
    padding: "0.35rem 0.75rem",
    fontSize: "0.78rem",
    fontFamily: "monospace",
    background: active ? "var(--card)" : "transparent",
    color: active ? "var(--accent-strong)" : "#666",
    border: active ? "1px solid rgba(143,193,232,0.2)" : "1px solid transparent",
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: active ? 700 : 400,
  } as React.CSSProperties);

  return (
    <>
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t.key} style={tabStyle(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: "#555", fontSize: "0.85rem" }}>No submissions in this category.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ background: "#0a0a0a" }}>
              {["Type", "Status", "User", "League", "Feedback", "Submitted"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "0.5rem 0.75rem",
                    textAlign: "left",
                    color: "#666",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    borderBottom: "1px solid #222",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const statusStyle = STATUS_STYLES[s.status];
              return (
                <tr key={s.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    {chip(TYPE_COLORS[s.type] ?? "#555", s.type)}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    {chip(statusStyle.color, statusStyle.label, statusStyle.strikethrough)}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--dim)", fontFamily: "monospace", fontSize: "0.78rem" }}>
                    {s.user.email}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", fontFamily: "monospace", fontSize: "0.72rem" }}>
                    {s.leagueId ? (
                      <a
                        href={`/founder/leagues/${s.leagueId}`}
                        style={{ color: "var(--accent)", textDecoration: "none" }}
                      >
                        {s.leagueId}
                      </a>
                    ) : (
                      <span style={{ color: "#444" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#ccc", maxWidth: "340px" }}>
                    <span style={{ opacity: 0.7 }}>{s.body.slice(0, 160)}{s.body.length > 160 ? "…" : ""}</span>
                    {" "}
                    <button
                      onClick={() => openDialog(s.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent)",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        padding: 0,
                        fontFamily: "monospace",
                      }}
                    >
                      View →
                    </button>
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", color: "#555", whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                    {formatDate(s.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Native dialog */}
      <dialog
        ref={dialogRef}
        onClose={closeDialog}
        style={{
          background: "#111",
          color: "#e0e0e0",
          fontFamily: "monospace",
          border: "1px solid #333",
          borderRadius: 8,
          padding: "1.5rem",
          width: "min(640px, 90vw)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {openSub && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {chip(TYPE_COLORS[openSub.type] ?? "#555", openSub.type)}
                {chip(STATUS_STYLES[openSub.status].color, STATUS_STYLES[openSub.status].label, STATUS_STYLES[openSub.status].strikethrough)}
              </div>
              <button
                onClick={closeDialog}
                style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            {!promoting ? (
              <>
                {/* Full body */}
                <div
                  style={{
                    background: "#0a0a0a",
                    border: "1px solid #222",
                    borderRadius: 6,
                    padding: "0.75rem 1rem",
                    marginBottom: "1rem",
                    fontSize: "0.85rem",
                    lineHeight: 1.6,
                    color: "#ccc",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {openSub.body}
                </div>

                {/* Metadata */}
                <div style={{ fontSize: "0.78rem", color: "#666", display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.3rem 1rem", marginBottom: "1rem" }}>
                  <span style={{ color: "#444" }}>User</span>
                  <span style={{ color: "var(--dim)" }}>{openSub.user.email}</span>
                  <span style={{ color: "#444" }}>Submitted</span>
                  <span>{formatDate(openSub.createdAt)}</span>
                  {openSub.leagueId && (
                    <>
                      <span style={{ color: "#444" }}>League</span>
                      <a href={`/founder/leagues/${openSub.leagueId}`} style={{ color: "var(--accent)" }}>
                        {openSub.leagueId}
                      </a>
                    </>
                  )}
                  {openSub.url && (
                    <>
                      <span style={{ color: "#444" }}>URL</span>
                      <span style={{ color: "var(--dim)", wordBreak: "break-all" }}>{openSub.url}</span>
                    </>
                  )}
                </div>

                {/* Status dropdown */}
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "#666", display: "block", marginBottom: "0.3rem" }}>
                    STATUS
                  </label>
                  <select
                    value={openSub.status}
                    onChange={(e) => handleStatusChange(openSub.id, e.target.value as FeedbackStatus)}
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid #333",
                      color: "#e0e0e0",
                      borderRadius: 4,
                      padding: "0.3rem 0.5rem",
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                    }}
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Promote button */}
                {openSub.status !== "IN_BACKLOG" && !openSub.backlogItem && (
                  <button
                    onClick={() => setPromoting(true)}
                    style={{
                      background: "rgba(143,193,232,0.13)",
                      color: "var(--accent-strong)",
                      border: "1px solid rgba(143,193,232,0.27)",
                      borderRadius: 4,
                      padding: "0.4rem 0.9rem",
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    → Promote to Backlog
                  </button>
                )}
                {openSub.backlogItem && (
                  <div style={{ fontSize: "0.78rem", color: "#22c55e" }}>
                    Already in backlog
                  </div>
                )}
              </>
            ) : (
              /* Promote form */
              <form onSubmit={handlePromote}>
                <div style={{ fontSize: "0.85rem", color: "var(--accent-strong)", fontWeight: 700, marginBottom: "1rem" }}>
                  → Promote to Backlog
                </div>

                <label style={{ fontSize: "0.75rem", color: "#666", display: "block", marginBottom: "0.25rem" }}>
                  TITLE
                </label>
                <input
                  type="text"
                  value={promoteForm.title}
                  onChange={(e) => setPromoteForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  style={{
                    width: "100%",
                    background: "#0a0a0a",
                    border: "1px solid #333",
                    color: "#e0e0e0",
                    borderRadius: 4,
                    padding: "0.4rem 0.5rem",
                    fontFamily: "monospace",
                    fontSize: "0.82rem",
                    marginBottom: "0.75rem",
                    boxSizing: "border-box",
                  }}
                />

                <label style={{ fontSize: "0.75rem", color: "#666", display: "block", marginBottom: "0.25rem" }}>
                  USER STORY
                </label>
                <textarea
                  value={promoteForm.userStory}
                  onChange={(e) => setPromoteForm((f) => ({ ...f, userStory: e.target.value }))}
                  required
                  rows={4}
                  style={{
                    width: "100%",
                    background: "#0a0a0a",
                    border: "1px solid #333",
                    color: "#e0e0e0",
                    borderRadius: 4,
                    padding: "0.4rem 0.5rem",
                    fontFamily: "monospace",
                    fontSize: "0.82rem",
                    marginBottom: "0.75rem",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "#666", display: "block", marginBottom: "0.25rem" }}>
                      PRIORITY
                    </label>
                    <select
                      value={promoteForm.priority}
                      onChange={(e) => setPromoteForm((f) => ({ ...f, priority: e.target.value }))}
                      style={{
                        width: "100%",
                        background: "#0a0a0a",
                        border: "1px solid #333",
                        color: "#e0e0e0",
                        borderRadius: 4,
                        padding: "0.3rem 0.5rem",
                        fontFamily: "monospace",
                        fontSize: "0.82rem",
                      }}
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "#666", display: "block", marginBottom: "0.25rem" }}>
                      CATEGORY
                    </label>
                    <select
                      value={promoteForm.category}
                      onChange={(e) => setPromoteForm((f) => ({ ...f, category: e.target.value }))}
                      style={{
                        width: "100%",
                        background: "#0a0a0a",
                        border: "1px solid #333",
                        color: "#e0e0e0",
                        borderRadius: 4,
                        padding: "0.3rem 0.5rem",
                        fontFamily: "monospace",
                        fontSize: "0.82rem",
                      }}
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setPromoting(false)}
                    style={{
                      background: "none",
                      border: "1px solid #333",
                      color: "#666",
                      borderRadius: 4,
                      padding: "0.4rem 0.9rem",
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={promoteLoading}
                    style={{
                      background: promoteLoading ? "var(--card)" : "var(--accent)",
                      border: "none",
                      color: "var(--accent-ink)",
                      borderRadius: 4,
                      padding: "0.4rem 0.9rem",
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                      cursor: promoteLoading ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {promoteLoading ? "Saving…" : "Submit"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
