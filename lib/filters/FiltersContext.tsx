"use client";

// Global Property filter + the Today/This FY/Last Year comparison-period tab
// (2026-09-02 redesign), synced to the URL so they survive refresh, are
// shareable, and persist across tab navigation without needing a separate
// store. Property stays multi-select; the period is a single active tab.
import { createContext, useContext, useMemo, useCallback, ReactNode, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PeriodKey, isPeriodKey } from "@/lib/reference/period";

export interface FiltersState {
  properties: string[]; // empty = all active properties
  period: PeriodKey;
}

interface FiltersContextValue extends FiltersState {
  setProperties: (properties: string[]) => void;
  setPeriod: (period: PeriodKey) => void;
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
    setProperties: (p) => updateParams({ property: p.length ? p.join(",") : undefined }),
    setPeriod: (p) => updateParams({ period: p === "this_fy" ? undefined : p }),
    // Back to defaults: all properties, "This FY".
    resetAll: () => updateParams({ property: undefined, period: undefined }),
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
