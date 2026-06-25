"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function RouteAnnouncer() {
  const pathname = usePathname();
  const regionRef = useRef<HTMLDivElement>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (!regionRef.current) return;
    // Clear then set so AT re-announces on every navigation
    regionRef.current.textContent = "";
    requestAnimationFrame(() => {
      if (regionRef.current) {
        regionRef.current.textContent = `Navigated to ${document.title || pathname}`;
      }
    });
  }, [pathname]);

  return (
    <div
      ref={regionRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="visually-hidden"
    />
  );
}
