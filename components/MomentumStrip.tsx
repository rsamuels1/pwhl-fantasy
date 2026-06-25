// MomentumStrip: compact in-period momentum row for the matchup page.
// Renders between the hero and the Z3 live situation grid.
// Only mounts when the matchup is ACTIVE.

interface Props {
  scoreDeltaSinceYesterday: number | null;
  playersRemainingTonight: number;
  opponentFinished: boolean;
}

export default function MomentumStrip({ scoreDeltaSinceYesterday, playersRemainingTonight, opponentFinished }: Props) {
  const chips: { label: string; color: string; bg: string; border: string }[] = [];

  if (scoreDeltaSinceYesterday !== null && scoreDeltaSinceYesterday !== 0) {
    const gain = scoreDeltaSinceYesterday > 0;
    chips.push({
      label: `${gain ? "▲" : "▼"} ${gain ? "+" : ""}${scoreDeltaSinceYesterday.toFixed(1)} pts today`,
      color: gain ? "var(--green)" : "var(--red)",
      bg: gain ? "rgba(81,216,138,0.10)" : "rgba(246,131,127,0.10)",
      border: gain ? "rgba(81,216,138,0.22)" : "rgba(246,131,127,0.22)",
    });
  }

  if (playersRemainingTonight > 0) {
    chips.push({
      label: `⚡ ${playersRemainingTonight} playing tonight`,
      color: "var(--accent-strong)",
      bg: "var(--accent-dim)",
      border: "var(--accent-border)",
    });
  }

  if (opponentFinished) {
    chips.push({
      label: "Opponent done",
      color: "var(--faint)",
      bg: "rgba(150,160,200,0.06)",
      border: "rgba(150,160,200,0.12)",
    });
  }

  if (chips.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "2px 0" }}>
      {chips.map((c) => (
        <span
          key={c.label}
          style={{
            display: "inline-flex", alignItems: "center",
            padding: "4px 11px", borderRadius: 99,
            fontSize: 12, fontWeight: 600, lineHeight: 1,
            color: c.color, background: c.bg, border: `1px solid ${c.border}`,
          }}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
