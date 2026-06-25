"use client";

import { useRouter } from "next/navigation";

interface Props {
  allTeams: { id: string; name: string }[];
  viewTeamId: string;
  myTeamId: string;
  isCommissioner?: boolean;
}

export default function ViewingSelector({ allTeams, viewTeamId, myTeamId, isCommissioner }: Props) {
  const router = useRouter();
  const isOwnRoster = viewTeamId === myTeamId;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, color: "var(--faint)", fontWeight: 600, flexShrink: 0 }}>
        Viewing:
      </label>
      <select
        value={viewTeamId}
        onChange={(e) => router.push(`?tab=lineup&view=${e.target.value}`)}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, color: "var(--text)", padding: "6px 10px", fontSize: 13,
          cursor: "pointer", outline: "none",
        }}
      >
        {allTeams.map((t) => (
          <option key={t.id} value={t.id} style={{ background: "var(--card)" }}>
            {t.name}{t.id === myTeamId ? " (My Team)" : ""}
          </option>
        ))}
      </select>
      {!isOwnRoster && (
        <>
          <button
            onClick={() => router.push("?tab=lineup")}
            style={{
              fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8,
              border: "1px solid rgba(143,193,232,0.3)", cursor: "pointer",
              background: "rgba(143,193,232,0.1)", color: "var(--accent-strong)",
            }}
          >
            ← My Team
          </button>
          {isCommissioner && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 8,
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
              color: "var(--amber)", letterSpacing: "0.06em",
            }}>
              ⚙ Commissioner View — changes apply to this team
            </span>
          )}
        </>
      )}
    </div>
  );
}
