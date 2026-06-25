"use client";

import { useState } from "react";
import type { TeamAnalysis } from "@/lib/services/analysis-service";
import AnalysisTab from "./AnalysisTab";

export default function MatchupTabs({
  analysis,
  children,
}: {
  analysis: TeamAnalysis | null;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState<"matchup" | "analysis">("matchup");

  return (
    <div>
      <div style={{
        display: "flex", gap: 0,
        borderBottom: "1px solid var(--border, var(--border))",
        marginBottom: "1.5rem",
      }}>
        {(["matchup", "analysis"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.6rem 1.25rem",
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "var(--accent)" : "var(--faint)",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
              fontSize: "0.9rem",
              textTransform: "capitalize",
              transition: "color 0.15s, border-color 0.15s",
              outline: "none",
            }}
          >
            {t === "matchup" ? "Matchup" : "Analysis"}
          </button>
        ))}
      </div>
      {tab === "matchup" ? children : <AnalysisTab analysis={analysis} />}
    </div>
  );
}
