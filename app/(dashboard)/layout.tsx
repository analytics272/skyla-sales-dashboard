import { FiltersProvider } from "@/lib/filters/FiltersContext";
import QueryProvider from "@/lib/query/QueryProvider";
import Sidebar from "@/components/layout/Sidebar";
import FilterBar from "@/components/layout/FilterBar";
import { getLastSyncTime } from "@/lib/bigquery/queries/syncStatus";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { lastUpdated } = await getLastSyncTime();

  return (
    <QueryProvider>
      <FiltersProvider>
        <div className="flex min-h-screen flex-col bg-zinc-100 dark:bg-black lg:flex-row">
          {/* Sidebar is sticky/full-height on desktop, a hamburger drawer on mobile/tablet (PRD §5, redesign §6). */}
          <Sidebar lastUpdated={lastUpdated} />
          <div className="min-w-0 flex-1">
            <div className="sticky top-0 z-20 shadow-sm">
              <FilterBar />
            </div>
            <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </FiltersProvider>
    </QueryProvider>
  );
}
