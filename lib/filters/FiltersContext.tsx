"use client";

// Global Property filter + the comparison-period tab, synced to the URL so
// they survive refresh, are shareable, and persist across tab navigation
// without needing a separate store. Property stays multi-select; the period
// is a single active tab, with an optional custom date range when
// period === "custom", plus an independent "compare to last year" toggle
// (2026-09-02, third pass) that applies to whichever period tab is active
// rather than being its own tab.
import { createContext, useContext, useMemo, useCallback, ReactNode, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PeriodKey, isPeriodKey } from "@/lib/reference/period";

export interface FiltersState {
  properties: string[]; // empty = all active properties
  period: PeriodKey;
  customStart: string | null; // ISO date, only meaningful when period === "custom"
  customEnd: string | null;
  compareYoY: boolean;
}

interface FiltersContextValue extends FiltersState {
  setProperties: (properties: string[]) => void;
  setPeriod: (period: PeriodKey) => void;
  /** Sets period to "custom" and both bounds in one URL update. */
  setCustomRange: (start: string, end: string) => void;
  setCompareYoY: (on: boolean) => void;
  resetAll: () => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

function FiltersProviderInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const properties = useMemo(() => {
    const raw = searchParams.get("property");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);

  const periodRaw = searchParams.get("period");
  const period: PeriodKey = isPeriodKey(periodRaw) ? periodRaw : "this_fy";
  const customStart = searchParams.get("start");
  const customEnd = searchParams.get("end");
  const compareYoY = searchParams.get("compare") === "yoy";

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const value: FiltersContextValue = {
    properties,
    period,
    customStart,
    customEnd,
    compareYoY,
    setProperties: (p) => updateParams({ property: p.length ? p.join(",") : undefined }),
    // Switching away from "custom" clears any leftover start/end so they
    // don't linger in the URL and silently resurrect on a later "Custom Range" click.
    setPeriod: (p) => updateParams({ period: p === "this_fy" ? undefined : p, ...(p === "custom" ? {} : { start: undefined, end: undefined }) }),
    setCustomRange: (start, end) => updateParams({ period: "custom", start, end }),
    setCompareYoY: (on) => updateParams({ compare: on ? "yoy" : undefined }),
    // Back to defaults: all properties, "This FY", compare-to-preceding-period.
    resetAll: () => updateParams({ property: undefined, period: undefined, start: undefined, end: undefined, compare: undefined }),
  };

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <FiltersProviderInner>{children}</FiltersProviderInner>
    </Suspense>
  );
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used within FiltersProvider");
  return ctx;
}
