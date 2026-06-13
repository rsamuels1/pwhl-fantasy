import Link from "next/link";

interface ErrorStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;
  returnHref?: string;
  returnLabel?: string;
}

export default function ErrorState({ title, message, onRetry, returnHref, returnLabel }: ErrorStateProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
      textAlign: "center",
      gap: 16,
    }}>
      <div style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.25)",
        borderRadius: 16,
        padding: "24px 32px",
        maxWidth: 480,
        width: "100%",
      }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: "#fca5a5", marginBottom: message ? 8 : 16 }}>
          {title}
        </p>
        {message && (
          <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>{message}</p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#fca5a5",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          )}
          {returnHref && (
            <Link href={returnHref} style={{
              padding: "8px 18px",
              borderRadius: 8,
              background: "var(--panel)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              fontSize: 13,
              fontWeight: 600,
            }}>
              {returnLabel ?? "Go Back"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
