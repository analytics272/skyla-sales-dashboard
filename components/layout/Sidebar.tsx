"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { TABS } from "@/lib/navigation";

export default function Sidebar() {
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
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col bg-gradient-to-b from-teal-800 to-teal-900 text-teal-50">
      <div className="flex flex-col items-center gap-2 px-4 pb-6 pt-8 text-center">
        <Image src="/skyla-logo.png" alt="Skyla Collective" width={188} height={140} className="h-14 w-auto" priority />
        <div>
          <p className="text-sm font-semibold tracking-wide">SKYLA COLLECTIVE</p>
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
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-teal-100 transition-colors hover:bg-teal-700/60 disabled:opacity-50"
        >
          {loggingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
