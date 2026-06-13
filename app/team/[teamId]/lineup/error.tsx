"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function LineupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Lineup error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load your lineup."
      onRetry={reset}
      returnHref="/dashboard"
      returnLabel="Return to Dashboard"
    />
  );
}
