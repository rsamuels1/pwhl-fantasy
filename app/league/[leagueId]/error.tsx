"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function LeagueOverviewError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("League overview error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load this league."
      message="There was a problem loading the league overview. Please try again."
      onRetry={reset}
      returnHref="/dashboard"
      returnLabel="Return to Dashboard"
    />
  );
}
