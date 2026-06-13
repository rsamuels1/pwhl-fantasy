"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function TeamRosterError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Team roster error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load your roster."
      onRetry={reset}
      returnHref="/dashboard"
      returnLabel="Return to Dashboard"
    />
  );
}
