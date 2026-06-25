// components/StatChip.tsx
// Renders a small animated pill badge beside a player's name on the matchup page.
// Server component — no client JS needed. Animation is CSS-only (one-shot pulse).

import type { StatChip as StatChipType } from "@/lib/services/dashboard";
import { getChipCopy } from "@/lib/copy/living-league-glossary";

const CHIP_COLORS: Record<StatChipType["type"], string> = {
  weekly_leader: "var(--gold)",
  league_record: "var(--gold)",
  streak: "var(--gold)",
  projection_swing_up: "var(--green)",
  projection_swing_down: "var(--dim)",
};

export default function StatChip({ chip }: { chip: StatChipType }) {
  const copy = getChipCopy(chip.type);
  const color = CHIP_COLORS[chip.type] ?? "var(--accent-strong)";
  return (
    <span
      className="stat-chip-pulse"
      title={copy.explainer}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 9.5,
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 999,
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span aria-hidden="true">{copy.icon}</span>
      <span className="visually-hidden">{copy.explainer} </span>
      {chip.label}
    </span>
  );
}
