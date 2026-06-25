import type { Superlative } from "@/lib/services/superlatives";

interface TeamSuperlative {
  teamId: string;
  teamName: string;
  superlatives: Superlative[];
  isMe: boolean;
}

interface Props {
  items: TeamSuperlative[];
}

export default function SuperlativesCard({ items }: Props) {
  const flatItems = items.flatMap((t) =>
    t.superlatives.map((s) => ({ ...s, teamName: t.teamName, isMe: t.isMe }))
  );

  if (flatItems.length === 0) return null;

  return (
    <section style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: 20,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 14 }}>
        Season Awards
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {flatItems.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 10,
              background: item.isMe ? "rgba(143,193,232,0.07)" : "var(--bg-raised)",
              border: item.isMe ? "1px solid rgba(143,193,232,0.2)" : "1px solid transparent",
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: "var(--text)",
                }}>
                  {item.label}
                </span>
                <span style={{
                  fontSize: 12, color: item.isMe ? "var(--accent-strong)" : "var(--dim)",
                  fontWeight: item.isMe ? 600 : 400,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {item.teamName}
                  {item.isMe && <span style={{ marginLeft: 4, fontSize: 10, color: "var(--accent)" }}>You</span>}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>
                {item.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
