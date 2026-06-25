"use client";

import { useState, useEffect, useRef } from "react";

const uid = (() => { let n = 0; return () => `info-tooltip-${++n}`; })();

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [id] = useState(uid);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!popupRef.current?.contains(e.target as Node) && e.target !== buttonRef.current) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        aria-label="What does this mean?"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          color: "var(--dim)",
          lineHeight: 1,
          borderRadius: 6,
        }}
      >
        ⓘ
      </button>
      <div
        id={id}
        ref={popupRef}
        role="tooltip"
        aria-hidden={!open}
        style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          right: 0,
          zIndex: 10,
          width: 220,
          padding: "8px 12px",
          background: "rgba(18,22,32,0.97)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 12,
          color: "var(--muted)",
          lineHeight: 1.5,
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          display: open ? "block" : "none",
        }}
      >
        {text}
      </div>
    </span>
  );
}
