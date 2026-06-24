import Link from "next/link";

interface EmptyStateProps {
  message: string;
  subtext?: string;
  actionHref?: string;
  actionLabel?: string;
}

export default function EmptyState({ message, subtext, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
      textAlign: "center",
      gap: 10,
    }}>
      <div style={{ fontSize: 28, marginBottom: 4, opacity: 0.5 }}>🏒</div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)", margin: 0 }}>{message}</p>
      {subtext && (
        <p style={{ fontSize: 13, color: "var(--faint)", margin: 0, maxWidth: 320 }}>{subtext}</p>
      )}
      {actionHref && actionLabel && (
        <Link href={actionHref} style={{
          marginTop: 8,
          display: "inline-block",
          padding: "8px 18px",
          borderRadius: 8,
          background: "var(--accent)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
        }}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
