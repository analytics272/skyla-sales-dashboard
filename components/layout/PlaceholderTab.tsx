export default function PlaceholderTab({ title, sections }: { title: string; sections: string[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Coming in Phase 4 — wired up section by section against live BigQuery data.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <div
            key={s}
            className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-600"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
