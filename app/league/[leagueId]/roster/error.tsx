"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function LeagueRosterError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("League roster error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load rosters."
      onRetry={reset}
    />
  );
}
