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
];

export default function DashboardNavigation() {
  const pathname = usePathname();

  async function handleLogout() {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Unable to sign out:", error);
    }
  }

  const desktopNavigation = [
    ...navigation,
    {
      label: "Settings",
      href: "/settings",
      icon: "⚙",
    },
  ];

  return (
    <>
      {/* =====================================================
          DESKTOP / TABLET SIDEBAR
      ====================================================== */}

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white px-4 py-6 md:flex md:flex-col">
        {/* LOGO */}

        <div className="px-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-white">
              ₿
            </div>

            <div className="min-w-0">
              <p className="font-bold text-gray-950">Budget</p>

              <p className="text-xs text-gray-400">Manager</p>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}

        <nav className="mt-10 flex-1 space-y-1">
          {desktopNavigation.map((item) => {
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
                <span className="w-5 shrink-0 text-center text-lg leading-none">
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* SIGN OUT */}

        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50"
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
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>

            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* =====================================================
          MOBILE BOTTOM NAVIGATION
      ====================================================== */}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto flex w-full max-w-md items-center">
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 transition ${
                  active ? "text-black" : "text-gray-400 hover:text-gray-700"
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>

                <span className="max-w-full truncate px-0.5 text-[9px] font-medium leading-tight sm:text-[10px]">
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* =================================================
              MORE MENU
          ================================================== */}

          <details className="relative min-w-0 flex-1">
            <summary className="flex cursor-pointer list-none flex-col items-center gap-1 rounded-xl py-2 text-gray-400 transition hover:text-gray-700 [&::-webkit-details-marker]:hidden">
              <span className="text-xl leading-none">•••</span>

              <span className="text-[9px] font-medium leading-tight sm:text-[10px]">
                More
              </span>
            </summary>

            <div className="absolute bottom-full right-1 mb-3 w-44 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
              {/* SETTINGS */}

              <Link
                href="/settings"
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  pathname === "/settings"
                    ? "bg-black text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="text-lg">⚙</span>

                <span>Settings</span>
              </Link>

              {/* SIGN OUT */}

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50"
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
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="16" y2="7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>

                <span>Sign out</span>
              </button>
            </div>
          </details>
        </div>
      </nav>

      {/* =====================================================
          MOBILE ADD TRANSACTION BUTTON
      ====================================================== */}

      <Link
        href="/transactions"
        aria-label="Add transaction"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-black text-2xl font-light text-white shadow-xl transition hover:bg-gray-800 active:scale-95 md:hidden"
      >
        +
      </Link>
    </>
  );
}
