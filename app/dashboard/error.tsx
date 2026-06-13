"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Dashboard error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load your dashboard."
      message="There was a problem loading your leagues. Please try again."
      onRetry={reset}
    />
  );
}
