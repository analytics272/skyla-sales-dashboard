"use client";

// 2026-09-02 redesign (§6, responsive): collapses to a hamburger-triggered
// drawer below the `lg` breakpoint instead of a permanent 224px column, so
// mobile/tablet get the full viewport width for content. "Last Updated"
// (§3) now lives here, bottom-left near the nav, sourced from a real
// BigQuery sync timestamp passed down from the server layout — never
// fabricated client-side "now".
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { TABS } from "@/lib/navigation";

function formatLastUpdated(iso: string | null): string {
  if (!iso) return "Unavailable";
  const d = new Date(iso);
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const month = d.toLocaleString("en-US", { month: "long" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day}${suffix} ${month} · ${time}`;
}

function SidebarContent({ lastUpdated, onNavigate }: { lastUpdated: string | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.toString();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-6 pt-8">
        <Image src="/skyla-icon.png" alt="Skyla Collective" width={932} height={899} className="h-9 w-auto shrink-0" priority />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-wide">Skyla Collective</p>
          <p className="text-[10px] uppercase tracking-widest text-teal-300">Sales Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {TABS.map((tab) => {
          const href = `/${tab.slug}${query ? `?${query}` : ""}`;
          const active = pathname === `/${tab.slug}`;
          return (
            <Link
              key={tab.slug}
              href={href}
              onClick={onNavigate}
              className={clsx(
                "block rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-teal-50 text-teal-900" : "text-teal-100 hover:bg-teal-700/60"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-teal-700/60 px-3 py-3">
        <p className="px-1 pb-2 text-[11px] text-teal-300">
          Last Updated
          <br />
          <span className="text-teal-100">{formatLastUpdated(lastUpdated)}</span>
        </p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-teal-100 transition-colors hover:bg-teal-700/60 disabled:opacity-50"
        >
          {loggingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </>
  );
}

export default function Sidebar({ lastUpdated }: { lastUpdated: string | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar: hamburger + brand, only below lg */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-teal-800 bg-teal-900 px-4 py-3 text-teal-50 lg:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 hover:bg-teal-800"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Image src="/skyla-icon.png" alt="Skyla Collective" width={932} height={899} className="h-8 w-auto" priority />
        <p className="text-sm font-semibold tracking-wide">SKYLA COLLECTIVE</p>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-gradient-to-b from-teal-800 to-teal-900 text-teal-50 shadow-xl">
            <SidebarContent lastUpdated={lastUpdated} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop/tablet permanent sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-gradient-to-b from-teal-800 to-teal-900 text-teal-50 lg:flex">
        <SidebarContent lastUpdated={lastUpdated} />
      </aside>
    </>
  );
}
