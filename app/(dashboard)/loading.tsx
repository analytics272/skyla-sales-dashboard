// Next.js shows this instantly on any navigation within the (dashboard)
// route group — including a filter change, which triggers a full
// server-side refetch of every BigQuery-backed chart on the page. Without
// this, the old page just sits frozen while that refetch runs (often a
// couple of seconds), which reads as "the filter didn't do anything" rather
// than "it's loading."
function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Block className="h-6 w-48" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} className="h-20" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Block key={i} className="h-64" />
        ))}
      </div>
      <Block className="h-72" />
    </div>
  );
}
