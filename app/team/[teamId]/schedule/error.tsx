"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function ScheduleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Schedule error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load the schedule."
      onRetry={reset}
      returnHref="/dashboard"
      returnLabel="Return to Dashboard"
    />
  );
}
