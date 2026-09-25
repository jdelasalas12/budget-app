"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutUser } from "@/lib/auth";

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
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
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: (
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
        <path d="M7 7h13" />
        <path d="m17 3 4 4-4 4" />
        <path d="M17 17H4" />
        <path d="m7 13-4 4 4 4" />
      </svg>
    ),
  },
  {
    label: "Budgets",
    href: "/budgets",
    icon: (
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
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M7 8h10" />
        <path d="M7 12h3" />
        <path d="M7 16h3" />
        <path d="M14 12h3" />
        <path d="M14 16h3" />
      </svg>
    ),
  },
  {
    label: "Bills",
    href: "/bills",
    icon: (
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
        <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" />
        <path d="M9 7h6" />
        <path d="M9 11h6" />
        <path d="M9 15h3" />
      </svg>
    ),
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: (
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
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
      </svg>
    ),
  },
  {
    label: "Reports",
    href: "/reports",
    icon: (
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
        <path d="M4 19V5" />
        <path d="M4 19h17" />
        <path d="m7 15 4-4 3 2 5-6" />
      </svg>
    ),
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

  const desktopNavigation: NavigationItem[] = [
    ...navigation,
    {
      label: "Settings",
      href: "/settings",
      icon: (
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
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.4 1.4-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-2v-.5a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L9 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H7v-2h.5a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L8.6 9 10 7.6l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V6h2v.5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.4 9l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.5v2h-.5a1.7 1.7 0 0 0-1.1 1Z" />
        </svg>
      ),
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
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-black text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-black"
                }`}
              >
                <span className="flex w-5 shrink-0 items-center justify-center">
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
          {navigation.slice(0, 5).map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 transition ${
                  active ? "text-black" : "text-gray-400 hover:text-gray-700"
                }`}
              >
                <span className="flex h-5 items-center justify-center">
                  {item.icon}
                </span>

                <span className="max-w-full truncate px-0.5 text-[9px] font-medium leading-tight sm:text-[10px]">
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* MORE */}

          <details className="relative min-w-0 flex-1">
            <summary className="flex cursor-pointer list-none flex-col items-center gap-1 rounded-xl py-2 text-gray-400 transition hover:text-gray-700 [&::-webkit-details-marker]:hidden">
              <span className="flex h-5 items-center justify-center text-lg leading-none">
                •••
              </span>

              <span className="text-[9px] font-medium leading-tight sm:text-[10px]">
                More
              </span>
            </summary>

            <div className="absolute bottom-full right-1 mb-3 w-48 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
              {/* REPORTS */}

              <Link
                href="/reports"
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  pathname.startsWith("/reports")
                    ? "bg-black text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="flex w-5 items-center justify-center">
                  {navigation.find((item) => item.href === "/reports")?.icon}
                </span>

                <span>Reports</span>
              </Link>

              {/* SETTINGS */}

              <Link
                href="/settings"
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  pathname.startsWith("/settings")
                    ? "bg-black text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="flex w-5 items-center justify-center">
                  {
                    desktopNavigation.find((item) => item.href === "/settings")
                      ?.icon
                  }
                </span>

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
