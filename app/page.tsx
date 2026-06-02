export default function Home() {
  return (
    <main style={{ padding: "2rem", maxWidth: 600 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>PWHL Fantasy</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Fantasy hockey for the Professional Women&apos;s Hockey League — 2026-27 season.
      </p>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
        League management coming soon. To join a draft:{" "}
        <code style={{ background: "var(--surface)", padding: "2px 6px", borderRadius: 4 }}>
          /draft/[leagueId]?team=[teamId]
        </code>
      </p>
    </main>
  );
}
