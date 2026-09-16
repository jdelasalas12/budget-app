"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/lib/auth";

const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "⌂",
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: "↕",
  },
  {
    label: "Budgets",
    href: "/budgets",
    icon: "◫",
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: "▣",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "◒",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "⚙",
  },
];

export default function DashboardNavigation() {
  const pathname = usePathname();

  async function handleLogout() {
    await logoutUser();
  }

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white px-4 py-6 md:flex md:flex-col">
        <div className="px-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
              ₿
            </div>

            <div>
              <p className="font-bold">Budget</p>
              <p className="text-xs text-gray-400">Manager</p>
            </div>
          </div>
        </div>

        <nav className="mt-10 flex-1 space-y-1">
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-black text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-black"
                }`}
              >
                <span className="w-5 text-center text-lg">{item.icon}</span>

                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Sign Out
          Put this beside your existing notification bell.
          Add the same classes to the container that currently
          contains your bell if you already have one.
      */}
      <div className="fixed right-4 top-4 z-40 flex items-center gap-2 md:hidden">
        {/* Notification bell should remain here / beside this button */}

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          className="flex h-10 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-black"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>

          <span className="hidden min-[400px]:inline">Sign out</span>
        </button>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md overflow-x-auto scrollbar-none">
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-[68px] flex-1 shrink-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium ${
                  active ? "text-black" : "text-gray-400"
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>

                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Add Button */}
      <Link
        href="/transactions"
        aria-label="Add transaction"
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-black text-2xl text-white shadow-xl md:hidden"
      >
        +
      </Link>
    </>
  );
}
