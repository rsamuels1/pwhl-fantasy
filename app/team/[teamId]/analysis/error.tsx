"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function AnalysisError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Analysis error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load analysis data."
      onRetry={reset}
      returnHref="/dashboard"
      returnLabel="Return to Dashboard"
    />
  );
}
