"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function StandingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Standings error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load standings right now."
      onRetry={reset}
    />
  );
}
