"use client";

import Link from "next/link";
import type { EditionData } from "@/lib/services/morning-skate-service";

interface Props {
  edition: { id: string; leagueId: string; data: EditionData } | null;
}

export default function MorningSkatePreview({ edition }: Props) {
  if (!edition) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.03))",
      border: "1px solid rgba(99,102,241,0.25)",
      borderRadius: 14,
      padding: "14px 18px",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 14,
      flexWrap: "wrap",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "rgba(99,102,241,0.85)",
          marginBottom: 4,
        }}>
          Morning Skate
        </div>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text)",
          lineHeight: 1.3,
          marginBottom: 5,
        }}>
          {edition.data.headline}
        </div>
        <div style={{
          fontSize: 12.5,
          color: "var(--dim)",
          lineHeight: 1.5,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>
          {edition.data.lede}
        </div>
      </div>
      <Link
        href={`/league/${edition.leagueId}/morning-skate/${edition.id}`}
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: "7px 14px",
          borderRadius: 8,
          background: "rgba(99,102,241,0.12)",
          color: "rgba(129,140,248,0.95)",
          border: "1px solid rgba(99,102,241,0.30)",
          textDecoration: "none",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        Read full edition →
      </Link>
    </div>
  );
}
