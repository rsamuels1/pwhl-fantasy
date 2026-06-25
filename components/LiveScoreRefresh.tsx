"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LiveScoreRefresh({
  intervalSeconds = 60,
}: {
  intervalSeconds?: number;
}) {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const srRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastUpdated(Date.now());
      // Announce score update to screen readers via live region content swap
      if (srRegionRef.current) {
        srRegionRef.current.textContent = "";
        requestAnimationFrame(() => {
          if (srRegionRef.current) srRegionRef.current.textContent = "Scores updated";
        });
      }
    }, intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [router, intervalSeconds]);

  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const secsAgo = Math.max(0, Math.round((Date.now() - lastUpdated) / 1000));
  const agoLabel = secsAgo < 10 ? "just now" : secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`;

  return (
    <>
      <div
        ref={srRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--faint)" }}>
        <span
          aria-hidden="true"
          style={{
            width: 7, height: 7, borderRadius: "50%", background: "#34d399",
            boxShadow: "0 0 0 0 rgba(52,211,153,0.6)", animation: "livePulse 2s infinite",
          }}
        />
        <span>Live · updated {agoLabel}</span>
        <style>{`
          @keyframes livePulse {
            0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); }
            70% { box-shadow: 0 0 0 6px rgba(52,211,153,0); }
            100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .live-pulse-dot { animation: none !important; }
          }
        `}</style>
      </div>
    </>
  );
}
