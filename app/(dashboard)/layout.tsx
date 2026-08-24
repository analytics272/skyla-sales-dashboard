import { FiltersProvider } from "@/lib/filters/FiltersContext";
import QueryProvider from "@/lib/query/QueryProvider";
import Sidebar from "@/components/layout/Sidebar";
import FilterBar from "@/components/layout/FilterBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <FiltersProvider>
        <div className="flex min-h-screen bg-zinc-100 dark:bg-black">
          {/* Sidebar is sticky/full-height so nav stays reachable while scrolling a page's content (PRD §5). */}
          <Sidebar />
          <div className="min-w-0 flex-1">
            <div className="sticky top-0 z-20 shadow-sm">
              <FilterBar />
            </div>
            <main className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </FiltersProvider>
    </QueryProvider>
  );
}
