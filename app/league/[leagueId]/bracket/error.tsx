"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function BracketError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Bracket error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load the bracket."
      message="There was a problem loading the playoff bracket. Please try again."
      onRetry={reset}
      returnHref="."
      returnLabel="Return to League"
    />
  );
}
