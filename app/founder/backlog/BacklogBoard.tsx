"use client";

import { useState } from "react";

type FeedbackType = "BUG" | "SUGGESTION" | "OTHER";

type BacklogItem = {
  id: string;
  title: string;
  userStory: string;
  priority: string;
  category: string;
  createdAt: Date | string;
  feedback: {
    type: FeedbackType;
    body: string;
    user: { email: string };
  } | null;
};

const PRIORITY_OPTIONS = ["P0", "P1", "P2", "P3"];
const CATEGORY_OPTIONS = [
  { label: "Bug Fix", value: "BUG_FIX" },
  { label: "Enhancement", value: "ENHANCEMENT" },
  { label: "New Feature", value: "NEW_FEATURE" },
];

const PRIORITY_COLORS: Record<string, string> = {
  P0: "#ef4444",
  P1: "#f97316",
  P2: "#6366f1",
  P3: "#6b7280",
};

const TYPE_COLORS: Record<string, string> = {
  BUG: "#ef4444",
  SUGGESTION: "#6366f1",
  OTHER: "#6b7280",
};

function chip(color: string, text: string) {
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
      }}
    >
      {text}
    </span>
  );
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type FilterKey = "ALL" | "P0" | "P1" | "P2" | "P3";

export default function BacklogBoard({ items: initial }: { items: BacklogItem[] }) {
  const [items, setItems] = useState<BacklogItem[]>(initial);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; userStory: string; priority: string; category: string }>({
    title: "",
    userStory: "",
    priority: "P2",
    category: "NEW_FEATURE",
  });
  const [saving, setSaving] = useState(false);

  const filtered = filter === "ALL" ? items : items.filter((i) => i.priority === filter);

  function startEdit(item: BacklogItem) {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      userStory: item.userStory,
      priority: item.priority,
      category: item.category,
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSave(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/founder/backlog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) return;
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...editForm } : i))
      );
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/founder/backlog/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const tabStyle = (active: boolean) =>
    ({
      padding: "0.35rem 0.75rem",
      fontSize: "0.78rem",
      fontFamily: "monospace",
      background: active ? "#1e1e2e" : "transparent",
      color: active ? "#a5b4fc" : "#666",
      border: active ? "1px solid #6366f133" : "1px solid transparent",
      borderRadius: 4,
      cursor: "pointer",
      fontWeight: active ? 700 : 400,
    } as React.CSSProperties);

  const filterOptions: { key: FilterKey; label: string }[] = [
    { key: "ALL", label: `All (${items.length})` },
    ...PRIORITY_OPTIONS.map((p) => ({
      key: p as FilterKey,
      label: `${p} (${items.filter((i) => i.priority === p).length})`,
    })),
  ];

  return (
    <>
      {/* Priority filter */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {filterOptions.map((f) => (
          <button key={f.key} style={tabStyle(filter === f.key)} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: "#555", fontSize: "0.85rem" }}>
          {items.length === 0
            ? "No backlog items yet. Promote feedback from the Feedback page to create user stories."
            : "No items match this filter."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filtered.map((item) => {
            const isEditing = editingId === item.id;
            const prioColor = PRIORITY_COLORS[item.priority] ?? "#6b7280";

            return (
              <div
                key={item.id}
                style={{
                  background: "#111",
                  border: "1px solid #222",
                  borderRadius: 6,
                  padding: "1rem 1.25rem",
                  fontFamily: "monospace",
                }}
              >
                {isEditing ? (
                  /* Inline edit form */
                  <div>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                      <select
                        value={editForm.priority}
                        onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                        style={selectStyle}
                      >
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                        style={selectStyle}
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <label style={labelStyle}>TITLE</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      style={{ ...inputStyle, marginBottom: "0.6rem" }}
                    />

                    <label style={labelStyle}>USER STORY</label>
                    <textarea
                      value={editForm.userStory}
                      onChange={(e) => setEditForm((f) => ({ ...f, userStory: e.target.value }))}
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical", marginBottom: "0.75rem" }}
                    />

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={cancelEdit} style={cancelBtnStyle}>Cancel</button>
                      <button
                        onClick={() => handleSave(item.id)}
                        disabled={saving}
                        style={saveBtnStyle(saving)}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Card view */
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {chip(prioColor, item.priority)}
                        {chip("#6b7280", item.category.replace(/_/g, " "))}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => startEdit(item)} style={actionBtnStyle}>Edit</button>
                        <button onClick={() => handleDelete(item.id)} style={{ ...actionBtnStyle, color: "#ef444488" }}>Delete</button>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#e0e0e0", marginBottom: "0.6rem" }}>
                      {item.title}
                    </div>

                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: "#9ca3af",
                        lineHeight: 1.6,
                        marginBottom: "0.75rem",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {item.userStory}
                    </div>

                    {item.feedback && (
                      <div style={{ fontSize: "0.72rem", color: "#444", borderTop: "1px solid #1a1a1a", paddingTop: "0.5rem" }}>
                        {"From: "}
                        {chip(TYPE_COLORS[item.feedback.type] ?? "#555", item.feedback.type)}
                        {" by "}
                        <span style={{ color: "#666" }}>{item.feedback.user.email}</span>
                        {" · "}
                        {formatDate(item.createdAt)}
                      </div>
                    )}
                    {!item.feedback && (
                      <div style={{ fontSize: "0.72rem", color: "#444", borderTop: "1px solid #1a1a1a", paddingTop: "0.5rem" }}>
                        Added {formatDate(item.createdAt)}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// Shared sub-styles
const selectStyle: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #333",
  color: "#e0e0e0",
  borderRadius: 4,
  padding: "0.25rem 0.4rem",
  fontFamily: "monospace",
  fontSize: "0.78rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  color: "#666",
  display: "block",
  marginBottom: "0.25rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid #333",
  color: "#e0e0e0",
  borderRadius: 4,
  padding: "0.35rem 0.5rem",
  fontFamily: "monospace",
  fontSize: "0.82rem",
  boxSizing: "border-box",
};

const cancelBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #333",
  color: "#666",
  borderRadius: 4,
  padding: "0.3rem 0.75rem",
  fontFamily: "monospace",
  fontSize: "0.78rem",
  cursor: "pointer",
};

const saveBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? "#1e1e2e" : "#6366f1",
  border: "none",
  color: "#fff",
  borderRadius: 4,
  padding: "0.3rem 0.75rem",
  fontFamily: "monospace",
  fontSize: "0.78rem",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 700,
});

const actionBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #222",
  color: "#6b7280",
  borderRadius: 4,
  padding: "0.2rem 0.6rem",
  fontFamily: "monospace",
  fontSize: "0.72rem",
  cursor: "pointer",
};
