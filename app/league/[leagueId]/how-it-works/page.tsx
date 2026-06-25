import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { parseScoringSettings } from "@/lib/scoring/settings";

interface Props {
  params: Promise<{ leagueId: string }>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 24px", marginBottom: 16 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--surface)" }}>
      <span style={{ fontSize: 13, color: muted ? "var(--dim)" : "var(--text)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: muted ? "var(--faint)" : "var(--accent-strong)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

export default async function HowItWorksPage({ params }: Props) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/how-it-works`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { scoringSettings: true, rosterSettings: true, scoringMode: true },
  });
  if (!league) notFound();

  const scoring = parseScoringSettings(league.scoringSettings);
  const s = scoring.skater;
  const g = scoring.goalie;
  const isH2h = (league.scoringMode ?? "H2H") === "H2H";

  return (
    <div style={{ maxWidth: 680 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800 }}>How PWHL GM Works</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--dim)" }}>
          A plain-English guide to scoring, standings, and lineup management.
        </p>
      </header>

      {/* ── Standings section — H2H or VP depending on league mode ── */}
      {isH2h ? (
        <Section title="Head-to-Head — How Standings Work">
          <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--dim)", lineHeight: 1.6 }}>
            Each week you&apos;re matched against one opponent. The team with more fantasy points (FP) wins
            the matchup. Your win-loss-tie record at the end of the regular season determines your playoff seed.
            Tiebreaker: total FP scored across the season.
          </p>
          <Row label="Beat your opponent's FP total" value="Win" />
          <Row label="Tie your opponent's FP total" value="Tie" />
          <Row label="Score less than your opponent" value="Loss" />
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--faint)", lineHeight: 1.5 }}>
            Top 4 teams by record at the end of the regular season qualify for the playoffs.
          </p>
        </Section>
      ) : (
        <Section title="Victory Points (VP) — How Standings Work">
          <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--dim)", lineHeight: 1.6 }}>
            At the end of each week, your fantasy points (FP) total is compared to every other team in the league.
            You earn Victory Points (VP) based on how your score ranks against the field — not just one opponent.
            This keeps the standings competitive even if you have a great week against a bad week.
          </p>
          <Row label="Beat more than half the league (win your matchup)" value="+2 VP" />
          <Row label="Tie your matchup" value="+1 VP" />
          <Row label="Highest score in the entire league" value="+2 VP" />
          <Row label="Second-highest score in the league" value="+1 VP" />
          <Row label="Maximum VP you can earn in one week" value="4 VP" />
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--faint)", lineHeight: 1.5 }}>
            Top 4 teams by VP at the end of the regular season qualify for the playoffs.
          </p>
        </Section>
      )}

      {/* ── Fantasy Points ── */}
      <Section title="Fantasy Points (FP) — How Your Score Is Calculated">
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--dim)", lineHeight: 1.6 }}>
          Every time a real PWHL player does something on the ice, your roster earns FP. Active players
          (not on your bench) score for you. Here's what each stat is worth in this league:
        </p>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--faint)", marginBottom: 6 }}>Skaters (Forwards &amp; Defense)</div>
          <Row label="Goal" value={`${s.goal > 0 ? "+" : ""}${s.goal} FP`} />
          <Row label="Assist" value={`${s.assist > 0 ? "+" : ""}${s.assist} FP`} />
          <Row label="Power play point (PPP)" value={`${s.powerPlayPoint > 0 ? "+" : ""}${s.powerPlayPoint} FP`} />
          <Row label="Shot on goal (SOG)" value={`${s.shot > 0 ? "+" : ""}${s.shot} FP`} />
          <Row label="Hit (HIT)" value={`${s.hit > 0 ? "+" : ""}${s.hit} FP`} />
          <Row label="Blocked shot (BLK)" value={`${s.block > 0 ? "+" : ""}${s.block} FP`} />
          <Row label="+/- (plus/minus)" value={`${s.plusMinus > 0 ? "+" : ""}${s.plusMinus} FP per unit`} />
          {s.penaltyMinute !== 0 && (
            <Row label="Penalty minute (PIM)" value={`${s.penaltyMinute > 0 ? "+" : ""}${s.penaltyMinute} FP`} />
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--faint)", marginBottom: 6 }}>Goalies</div>
          <Row label="Win" value={`${g.win > 0 ? "+" : ""}${g.win} FP`} />
          <Row label="Save (SV)" value={`${g.save > 0 ? "+" : ""}${g.save} FP`} />
          <Row label="Goal against (GA)" value={`${g.goalAgainst > 0 ? "+" : ""}${g.goalAgainst} FP`} />
          <Row label="Shutout (SO)" value={`${g.shutout > 0 ? "+" : ""}${g.shutout} FP`} />
        </div>
      </Section>

      {/* ── Roster Slots ── */}
      <Section title="Roster Slots — Who Plays for Your Team">
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--dim)", lineHeight: 1.6 }}>
          Each week, only players in active slots (F, D, G, UTIL) score for you. Bench players accumulate
          no FP that week. Locked players (their real team has already played this week) cannot be moved.
        </p>
        {[
          { slot: "F", label: "Forward (×3)", note: "Any forward" },
          { slot: "D", label: "Defense (×2)", note: "Any defenseman" },
          { slot: "G", label: "Goalie (×1)", note: "Any goalie" },
          { slot: "UTIL", label: "Utility (×1)", note: "Any skater (forward or defense)" },
          { slot: "BENCH", label: "Bench (×6)", note: "No FP scored, but safe from dropping" },
        ].map(({ slot, label, note }) => (
          <div key={slot} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--surface)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 44, padding: "2px 6px", borderRadius: 4, background: "var(--surface)", color: "var(--accent-strong)", textAlign: "center", flexShrink: 0 }}>{slot}</span>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</span>
              <span style={{ fontSize: 12, color: "var(--dim)", marginLeft: 8 }}>{note}</span>
            </div>
          </div>
        ))}
      </Section>

      {/* ── Stat Glossary ── */}
      <Section title="Stat Glossary">
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--dim)", lineHeight: 1.6 }}>
          You{"'"}ll see these abbreviations throughout the app.
        </p>
        {[
          { abbr: "FP", full: "Fantasy points — your team's score for the week, based on this league's scoring settings above." },
          ...(!isH2h ? [{ abbr: "VP", full: "Victory points — your weekly standing result. Earned based on how your FP total ranks against the field." }] : []),
          { abbr: "G", full: "Goals scored." },
          { abbr: "A", full: "Assists — credited to players who helped set up a goal." },
          { abbr: "PTS", full: "Points = Goals + Assists." },
          { abbr: "PPP", full: "Power play points — goals or assists scored while the opposing team is shorthanded. Worth bonus FP." },
          { abbr: "SOG", full: "Shots on goal — shots that required a save or went in." },
          { abbr: "HIT", full: "Hits delivered — physical body checks." },
          { abbr: "BLK", full: "Blocked shots — shots stopped by a skater (not the goalie)." },
          { abbr: "SV%", full: "Save percentage — the fraction of shots a goalie stopped (saves ÷ shots faced)." },
          { abbr: "GA", full: "Goals against — goals allowed by a goalie. Usually negative FP." },
          { abbr: "SO", full: "Shutout — a goalie plays the full game and allows zero goals." },
          { abbr: "GP", full: "Games played in the selected time range." },
          { abbr: "W", full: "Wins (goalie stat)." },
          { abbr: "UTIL", full: "Utility slot — accepts any skater (forward or defense)." },
        ].map(({ abbr, full }) => (
          <div key={abbr} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--surface)" }}>
            <code style={{ fontSize: 11, fontWeight: 700, minWidth: 48, color: "var(--accent-strong)", flexShrink: 0 }}>{abbr}</code>
            <span style={{ fontSize: 13, color: "var(--dim)" }}>{full}</span>
          </div>
        ))}
      </Section>

      {/* ── Waiver Wire ── */}
      <Section title="Adding &amp; Dropping Players">
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--dim)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text)" }}>Free agents</strong> can be added instantly from the Roster page — they go straight to your bench. No review period, no waiting.
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--dim)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text)" }}>Waiver wire players</strong> were recently dropped and have a review window before anyone can claim them. Submit a claim from the Waiver Wire tab and if you win the priority order, you get the player after the window closes.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "var(--dim)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text)" }}>Dropping a player</strong> puts them on waivers for 48 hours. After that, they become a free agent again.
        </p>
      </Section>

      {/* ── Trades ── */}
      <Section title="Trades">
        <p style={{ margin: 0, fontSize: 14, color: "var(--dim)", lineHeight: 1.6 }}>
          You can propose trades with any other team in the league from the{" "}
          <strong style={{ color: "var(--text)" }}>Trades</strong> tab in your franchise. Pick a partner, choose who you want from them and what you{"'"}re offering in return, then send your proposal. The other GM can accept, reject, or counter. If your league has commissioner review enabled, trades may have a 24-hour veto window before they go through.
        </p>
      </Section>
    </div>
  );
}
