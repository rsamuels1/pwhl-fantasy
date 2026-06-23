import type { RaceInfo } from "@/lib/playoffs/seeding";

interface TeamRow {
  id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
}

interface Props {
  raceMap: Map<string, RaceInfo>;
  teams: TeamRow[];
  isInSeason: boolean;
  currentWeek: number;
  totalWeeks: number;
}

function RaceChip({ status }: { status: RaceInfo["status"] }) {
  if (status === "clinched") return <span className="chip-clinched">✓ CLINCHED</span>;
  if (status === "in") return <span className="chip-in">IN</span>;
  if (status === "bubble") return <span className="chip-bubble">◉ BUBBLE</span>;
  if (status === "eliminated") return <span className="chip-eliminated">✗ ELIM</span>;
  return <span className="chip-out">OUT</span>;
}


export default function BubbleWatch({ raceMap, teams, isInSeason, currentWeek, totalWeeks }: Props) {
  if (!isInSeason || raceMap.size === 0) return null;

  const inPlayoffs: (TeamRow & { status: RaceInfo["status"] })[] = [];
  const bubble: (TeamRow & { status: RaceInfo["status"] })[] = [];
  const eliminated: (TeamRow & { status: RaceInfo["status"] })[] = [];

  for (const team of teams) {
    const info = raceMap.get(team.id);
    if (!info) continue;
    const entry = { ...team, status: info.status };
    if (info.status === "clinched" || info.status === "in") inPlayoffs.push(entry);
    else if (info.status === "bubble") bubble.push(entry);
    else eliminated.push(entry);
  }

  const heading = totalWeeks > 0 && currentWeek > totalWeeks / 2
    ? "Playoff Push"
    : "Current Playoff Picture";

  const Group = ({ label, items }: { label: string; items: typeof inPlayoffs }) => (
    items.length === 0 ? null : (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)", marginBottom: 8 }}>
          {label}
        </div>
        {items.map((t) => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 0", borderBottom: "1px solid var(--border)", gap: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
                {t.wins}–{t.losses}{t.ties > 0 ? `–${t.ties}` : ""}
              </span>
              <RaceChip status={t.status} />
            </div>
          </div>
        ))}
      </div>
    )
  );

  return (
    <section style={{
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span className="section-accent" />
        <h2 style={{ fontSize: 12, margin: 0, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" }}>
          {heading}
        </h2>
      </div>
      <Group label="In the Playoffs" items={inPlayoffs} />
      <Group label="Bubble" items={bubble} />
      <Group label="Eliminated" items={eliminated} />
    </section>
  );
}
