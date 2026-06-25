"use client";

import { useState, useCallback, useEffect, useRef } from "react";

type Notification = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  actionUrl?: string;
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
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

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
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={openDropdown}
        aria-label="Notifications"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
          position: "relative",
          color: "var(--dim)",
        }}
      >
        🔔
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "var(--red)",
              color: "var(--accent-ink)",
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
            position: "fixed",
            right: "16px",
            top: "52px",
            background: "var(--surface)",
            border: "1px solid var(--border, #333)",
            borderRadius: "8px",
            width: "300px",
            zIndex: 9999,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border, #333)",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            Notifications
          </div>
          {notifications === null ? (
            <div style={{ padding: "12px 14px", fontSize: "13px", color: "var(--dim)" }}>
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: "13px", color: "var(--dim)" }}>
              You&apos;re all caught up.
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
                    color: n.readAt ? "var(--dim)" : "var(--text)",
                    background: n.readAt ? "transparent" : "rgba(143,193,232,0.06)",
                  }}
                >
                  {n.actionUrl ? (
                    <a href={n.actionUrl} style={{ textDecoration: "none", color: "inherit" }}>
                      <div style={{ fontWeight: 600 }}>{n.title ?? TYPE_LABEL[n.type] ?? n.type}</div>
                      {(n.body ?? (typeof n.data.teamName === "string" ? n.data.teamName : undefined)) && (
                        <div style={{ marginTop: "2px", color: "var(--dim)" }}>
                          {n.body ?? (n.data.teamName as string)}
                        </div>
                      )}
                    </a>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600 }}>{n.title ?? TYPE_LABEL[n.type] ?? n.type}</div>
                      {(n.body ?? (typeof n.data.teamName === "string" ? n.data.teamName : undefined)) && (
                        <div style={{ marginTop: "2px", color: "var(--dim)" }}>
                          {n.body ?? (n.data.teamName as string)}
                        </div>
                      )}
                    </>
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
