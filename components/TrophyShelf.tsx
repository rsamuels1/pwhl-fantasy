// components/TrophyShelf.tsx
// Compact horizontal strip of up to 3 most-recent trophies (icons only, with tooltip).
// Rendered in Z7 area of matchup page.

import type { TrophyType } from "@prisma/client";
import Link from "next/link";

interface TrophyItem {
  id: string;
  type: TrophyType;
  season: string;
}

interface Props {
  trophies: TrophyItem[];
  trophiesHref: string;
}

const TROPHY_ICON: Record<TrophyType, string> = {
  CHAMPION: "🏆",
  BEST_RECORD: "★",
  TOP_SCORER: "🔥",
  MOST_IMPROVED: "📈",
  MOST_TRANSACTIONS: "⚙",
};

const TROPHY_LABEL: Record<TrophyType, string> = {
  CHAMPION: "League Champion",
  BEST_RECORD: "Best Record",
  TOP_SCORER: "Top Scorer",
  MOST_IMPROVED: "Most Improved",
  MOST_TRANSACTIONS: "Most Active GM",
};

export default function TrophyShelf({ trophies, trophiesHref }: Props) {
  if (trophies.length === 0) return null;

  const displayed = trophies.slice(0, 3);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        background: "linear-gradient(135deg, rgba(212,175,55,0.07), rgba(212,175,55,0.02))",
        border: "1px solid rgba(212,175,55,0.2)",
        borderRadius: 12,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "var(--faint)",
          marginRight: 4,
        }}
      >
        Trophy Cabinet
      </span>
      {displayed.map((t) => (
        <span
          key={t.id}
          title={`${TROPHY_LABEL[t.type]} · ${t.season}`}
          aria-label={`${TROPHY_LABEL[t.type]} — ${t.season}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(212,175,55,0.12)",
            border: "1px solid rgba(212,175,55,0.28)",
            fontSize: 16,
            cursor: "default",
          }}
        >
          {TROPHY_ICON[t.type]}
        </span>
      ))}
      {trophies.length > 3 && (
        <span style={{ fontSize: 12, color: "var(--faint)" }}>+{trophies.length - 3} more</span>
      )}
      <Link
        href={trophiesHref}
        style={{
          marginLeft: "auto",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--gold)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        View all →
      </Link>
    </div>
  );
}
