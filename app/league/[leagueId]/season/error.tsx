"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function SeasonError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Season page error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load the season."
      onRetry={reset}
    />
  );
}
