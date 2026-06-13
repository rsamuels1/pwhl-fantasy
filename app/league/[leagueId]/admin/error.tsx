"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ErrorState";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Admin panel error:", error); }, [error]);
  return (
    <ErrorState
      title="We couldn't load the admin panel."
      onRetry={reset}
      returnHref="/dashboard"
      returnLabel="Return to Dashboard"
    />
  );
}
