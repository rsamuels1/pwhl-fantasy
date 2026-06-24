"use client";
// components/FranchiseIdentityChip.tsx
// Pill chip showing the team's franchise archetype with an InfoTooltip.

import InfoTooltip from "./InfoTooltip";
import type { FranchiseIdentityResult } from "@/lib/services/franchise-identity";

interface Props {
  identity: FranchiseIdentityResult;
}

const ARCHETYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  BOOM_OR_BUST: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)", text: "var(--amber)" },
  DEFENSIVE_FORTRESS: { bg: "rgba(81,216,138,0.10)", border: "rgba(81,216,138,0.28)", text: "var(--green)" },
  SNIPER_FACTORY: { bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.28)", text: "var(--red)" },
  GOALTENDER_DRIVEN: { bg: "rgba(143,193,232,0.10)", border: "rgba(143,193,232,0.28)", text: "var(--accent-strong)" },
};

export default function FranchiseIdentityChip({ identity }: Props) {
  const colors = ARCHETYPE_COLORS[identity.archetype] ?? {
    bg: "rgba(100,116,139,0.10)",
    border: "rgba(100,116,139,0.28)",
    text: "var(--muted)",
  };
  const muted = identity.confidence === "LOW";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
          background: muted ? "rgba(100,116,139,0.08)" : colors.bg,
          border: `1px solid ${muted ? "rgba(100,116,139,0.20)" : colors.border}`,
          color: muted ? "var(--dim)" : colors.text,
          opacity: muted ? 0.7 : 1,
        }}
      >
        {identity.label}
        {identity.confidence !== "HIGH" && (
          <span style={{ fontSize: 10, opacity: 0.7 }}>
            {identity.confidence === "LOW" ? "· emerging" : ""}
          </span>
        )}
      </span>
      <InfoTooltip text={identity.description} />
    </div>
  );
}
