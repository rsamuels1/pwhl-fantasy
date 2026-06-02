/**
 * Loading skeleton for bracket page
 * /app/league/[leagueId]/bracket/loading.tsx
 */

export default function BracketLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 bg-slate-300 rounded w-48 mb-2"></div>
        <div className="h-6 bg-slate-200 rounded w-32"></div>
      </div>

      {/* Tabs skeleton */}
      <div className="mb-6 border-b border-slate-300 flex gap-4">
        <div className="h-10 bg-slate-300 rounded w-24"></div>
        <div className="h-10 bg-slate-200 rounded w-24"></div>
      </div>

      {/* Content skeleton - table rows */}
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-200 rounded"></div>
        ))}
      </div>
    </div>
  );
}
