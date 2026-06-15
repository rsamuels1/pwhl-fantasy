import { requireFounder } from "@/lib/auth";
import Link from "next/link";
import FeedbackWidget from "@/components/FeedbackWidget";

export default async function FounderLayout({ children }: { children: React.ReactNode }) {
  await requireFounder();

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "monospace" }}>
      <header style={{ background: "#111", borderBottom: "1px solid #333", padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", gap: "2rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.05em" }}>
          PWHL FANTASY
        </span>
        <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid #f59e0b", borderRadius: "4px", padding: "0.15rem 0.6rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em" }}>
          FOUNDER MODE
        </span>
        <nav style={{ display: "flex", gap: "1.5rem", fontSize: "0.85rem" }}>
          <Link href="/founder" style={{ color: "#9ca3af" }}>Dashboard</Link>
          <Link href="/founder/leagues" style={{ color: "#9ca3af" }}>Leagues</Link>
          <Link href="/founder/simulate" style={{ color: "#9ca3af" }}>Simulate</Link>
          <Link href="/founder/feedback" style={{ color: "#9ca3af" }}>Feedback</Link>
        </nav>
        <div style={{ marginLeft: "auto" }}>
          <Link href="/dashboard" style={{ color: "#6b7280", fontSize: "0.8rem" }}>← App</Link>
        </div>
      </header>
      <main style={{ padding: "1.5rem" }}>
        {children}
      </main>
      <FeedbackWidget />
    </div>
  );
}
