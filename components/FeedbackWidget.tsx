"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

const FEEDBACK_TYPES = [
  { value: "BUG", label: "Bug" },
  { value: "SUGGESTION", label: "Suggestion" },
  { value: "OTHER", label: "Other" },
] as const;

type FeedbackType = typeof FEEDBACK_TYPES[number]["value"];

interface Props {
  leagueId?: string;
}

export default function FeedbackWidget({ leagueId }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("BUG");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Auto-close after success
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => {
      setOpen(false);
      setSuccess(false);
      setBody("");
      setType("BUG");
    }, 2000);
    return () => clearTimeout(t);
  }, [success]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (overlayRef.current && e.target === overlayRef.current) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  async function handleSubmit() {
    setError(null);
    if (body.trim().length < 10) {
      setError("Please write at least 10 characters.");
      return;
    }
    if (body.length > 2000) {
      setError("Feedback must be 2000 characters or fewer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, body: body.trim(), leagueId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Something went wrong. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Trigger button — fixed bottom-right */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        style={{
          position: "fixed",
          bottom: 80,
          right: 20,
          zIndex: 1000,
          background: "rgba(143,193,232,0.9)",
          color: "var(--accent-ink)",
          border: "none",
          borderRadius: 999,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>Feedback</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          ref={overlayRef}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 440,
              position: "relative",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Send feedback"
          >
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close feedback form"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "none",
                border: "none",
                color: "var(--dim)",
                fontSize: 20,
                cursor: "pointer",
                lineHeight: 1,
                padding: "2px 6px",
              }}
            >
              ×
            </button>

            <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              Send Feedback
            </h2>

            {success ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#22c55e", fontSize: 15, fontWeight: 600 }}>
                Thanks for the feedback!
              </div>
            ) : (
              <>
                {/* Type selector */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {FEEDBACK_TYPES.map((ft) => (
                    <button
                      key={ft.value}
                      onClick={() => setType(ft.value)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 8,
                        border: `1px solid ${type === ft.value ? "var(--accent)" : "var(--border)"}`,
                        background: type === ft.value ? "rgba(143,193,232,0.15)" : "transparent",
                        color: type === ft.value ? "var(--accent-strong)" : "var(--dim)",
                        fontWeight: type === ft.value ? 700 : 400,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>

                {/* Textarea */}
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    type === "BUG"
                      ? "Describe what happened and what you expected..."
                      : type === "SUGGESTION"
                      ? "What would you like to see improved?"
                      : "Share your thoughts..."
                  }
                  rows={5}
                  maxLength={2000}
                  style={{
                    width: "100%",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontSize: 14,
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ fontSize: 11, color: "var(--faint)", textAlign: "right", marginTop: 4 }}>
                  {body.length}/2000
                </div>

                {error && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#f87171" }}>{error}</div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    padding: "11px 0",
                    background: isSubmitting ? "var(--accent-deep)" : "var(--accent)",
                    color: "var(--accent-ink)",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? "Sending..." : "Send Feedback"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
