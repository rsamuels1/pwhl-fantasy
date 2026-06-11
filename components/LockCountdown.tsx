"use client";

import { useState, useEffect } from "react";

export default function LockCountdown({ startsAt }: { startsAt: string }) {
  const [msLeft, setMsLeft] = useState(() => new Date(startsAt).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setMsLeft(new Date(startsAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [startsAt]);

  if (msLeft <= 0) return null;

  const totalSecs = Math.floor(msLeft / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const isUrgent = msLeft < 30 * 60 * 1000;
  const label = hours > 0
    ? `Locks in ${hours}h ${mins}m`
    : `Locks in ${mins}m ${secs.toString().padStart(2, "0")}s`;

  return (
    <span
      title="This player's game starts soon — make lineup changes before then"
      style={{
        fontSize: 10, fontWeight: 700, flexShrink: 0,
        padding: "1px 6px", borderRadius: 4,
        background: isUrgent ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
        color: isUrgent ? "#f87171" : "#f59e0b",
      }}
    >
      {label}
    </span>
  );
}
