/**
 * Error boundary for bracket page
 * /app/league/[leagueId]/bracket/error.tsx
 */

"use client";

import { useEffect } from "react";

export default function BracketError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Bracket page error:", error);
  }, [error]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-6">
        <h2 className="text-lg font-bold text-red-800 mb-2">Error Loading Bracket</h2>
        <p className="text-red-700 mb-4">{error.message}</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
