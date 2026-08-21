"use client";

// Global Property / FY / Quarter / Month filters (PRD §5), synced to the URL so
// they survive refresh, are shareable, and persist across tab navigation without
// needing a separate store. Property, FY, and Month are all multi-select;
// Quarter is single-select (a convenience shortcut for its 3 months).
import { createContext, useContext, useMemo, useCallback, ReactNode, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { currentFYLabel } from "@/lib/reference/financialYear";

export interface FiltersState {
  properties: string[]; // empty = all active properties
  fys: string[]; // empty = default to the current FY
  quarter?: 1 | 2 | 3 | 4;
  months: number[]; // empty = whole FY, no narrowing
}

interface FiltersContextValue extends FiltersState {
  setProperties: (properties: string[]) => void;
  setFys: (fys: string[]) => void;
  setQuarter: (quarter?: 1 | 2 | 3 | 4) => void;
  setMonths: (months: number[]) => void;
  toggleMonth: (month: number) => void;
  clearQuarterAndMonths: () => void;
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

  const fys = useMemo(() => {
    const raw = searchParams.get("fy");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);

  const quarterRaw = searchParams.get("quarter");
  const quarter = quarterRaw ? (Number(quarterRaw) as 1 | 2 | 3 | 4) : undefined;

  const months = useMemo(() => {
    const raw = searchParams.get("months");
    return raw ? raw.split(",").map(Number).filter((n) => !Number.isNaN(n)) : [];
  }, [searchParams]);

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
    fys: fys.length > 0 ? fys : [currentFYLabel()],
    quarter,
    months,
    setProperties: (p) => updateParams({ property: p.length ? p.join(",") : undefined }),
    setFys: (v) => updateParams({ fy: v.length ? v.join(",") : undefined }),
    // Changing quarter drops a stale month selection from a different quarter.
    setQuarter: (q) => updateParams({ quarter: q ? String(q) : undefined, months: undefined }),
    setMonths: (m) => updateParams({ months: m.length ? m.join(",") : undefined, quarter: undefined }),
    toggleMonth: (m) => {
      const next = months.includes(m) ? months.filter((x) => x !== m) : [...months, m];
      updateParams({ months: next.length ? next.join(",") : undefined, quarter: undefined });
    },
    clearQuarterAndMonths: () => updateParams({ quarter: undefined, months: undefined }),
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
