export default function Card({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    // min-w-0: without it, a CSS Grid item's default min-width:auto can force
    // Recharts' percentage-width ResponsiveContainer to collapse to 0 width.
    <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      {title && <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{title}</h3>}
      {subtitle && <p className="mb-3 mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{subtitle}</p>}
      {title && !subtitle && <div className="mb-3" />}
      <div>{children}</div>
    </div>
  );
}
