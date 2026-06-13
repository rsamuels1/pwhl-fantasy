"use client";

import { useState, useCallback } from "react";

type Notification = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  DRAFT_STARTING: "Draft is starting!",
  ON_THE_CLOCK: "You're on the clock!",
  LINEUP_INCOMPLETE: "Lineup incomplete",
};

export default function NotificationBell({
  initialCount,
  leagueId,
}: {
  initialCount: number;
  leagueId: string;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  const openDropdown = useCallback(async () => {
    setOpen((prev) => !prev);
    if (notifications !== null) return;

    const res = await fetch(`/api/leagues/${leagueId}/notifications`);
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);

    if (count > 0) {
      setCount(0);
      await fetch(`/api/leagues/${leagueId}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
    }
  }, [leagueId, notifications, count]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={openDropdown}
        aria-label="Notifications"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
          position: "relative",
          color: "var(--text-muted, #888)",
        }}
      >
        🔔
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "#e53e3e",
              color: "#fff",
              borderRadius: "999px",
              fontSize: "10px",
              padding: "1px 5px",
              lineHeight: 1.4,
              minWidth: "16px",
              textAlign: "center",
            }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            background: "var(--surface, #1a1a2e)",
            border: "1px solid var(--border, #333)",
            borderRadius: "8px",
            width: "280px",
            zIndex: 100,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border, #333)",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text, #eee)",
            }}
          >
            Notifications
          </div>
          {notifications === null ? (
            <div style={{ padding: "12px 14px", fontSize: "13px", color: "var(--text-muted, #888)" }}>
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: "13px", color: "var(--text-muted, #888)" }}>
              No notifications
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--border, #2a2a3e)",
                    fontSize: "13px",
                    color: n.readAt ? "var(--text-muted, #888)" : "var(--text, #eee)",
                    background: n.readAt ? "transparent" : "rgba(99,102,241,0.06)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{TYPE_LABEL[n.type] ?? n.type}</div>
                  {typeof n.data.teamName === "string" && (
                    <div style={{ marginTop: "2px", color: "var(--text-muted, #888)" }}>
                      {n.data.teamName}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
