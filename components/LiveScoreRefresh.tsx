"use client";

// Polls the server during an active matchup by calling router.refresh() on an
// interval. This re-runs the server component (matchup page) and pulls fresh
// live scores without a full page reload. Mount it only when a matchup is active.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LiveScoreRefresh({
  intervalSeconds = 60,
}: {
  intervalSeconds?: number;
}) {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastUpdated(Date.now());
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [router, intervalSeconds]);

  // Re-tick the "updated Ns ago" label every 10s without refetching.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const secsAgo = Math.max(0, Math.round((Date.now() - lastUpdated) / 1000));
  const agoLabel = secsAgo < 10 ? "just now" : secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b" }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: "#34d399",
        boxShadow: "0 0 0 0 rgba(52,211,153,0.6)", animation: "livePulse 2s infinite",
      }} />
      <span>Live · updated {agoLabel}</span>
      <style>{`
        @keyframes livePulse {
          0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); }
          70% { box-shadow: 0 0 0 6px rgba(52,211,153,0); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
      `}</style>
    </div>
  );
}
