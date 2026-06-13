"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function MatchupsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Matchups error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load matchup data."
      onRetry={reset}
    />
  );
}
