"use client";

import { useEffect, useState, type ChangeEvent } from "react";

import ProtectedRoute from "@/app/components/auth/ProtectedRoute";
import DashboardNavigation from "@/app/components/dashboard/DashboardNavigation";
import { useAuth } from "@/app/components/auth/AuthProvider";

import { CURRENCIES, DEFAULT_CURRENCY, getCurrency } from "@/lib/currency";
import { getUserCurrency, updateCurrency } from "@/lib/auth";

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const { user } = useAuth();

  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /*
   * Load the user's saved currency.
   */
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSettings() {
      try {
        setLoading(true);
        setError("");

        const savedCurrency = await getUserCurrency();

        if (!cancelled) {
          setCurrency(savedCurrency);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);

        if (!cancelled) {
          setError("Unable to load your settings.");
          setCurrency(DEFAULT_CURRENCY);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleCurrencyChange(event: ChangeEvent<HTMLSelectElement>) {
    const newCurrency = event.target.value;

    /*
     * Make sure the selected currency actually exists.
     */
    const currencyInfo = getCurrency(newCurrency);

    if (!CURRENCIES.some((item) => item.code === currencyInfo.code)) {
      return;
    }

    const previousCurrency = currency;

    setCurrency(currencyInfo.code);
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await updateCurrency(currencyInfo.code);

      setMessage(
        `Currency updated to ${currencyInfo.name} (${currencyInfo.code}).`,
      );

      /*
       * Notify other components/tabs that the currency changed.
       *
       * Components that listen to "currencyChanged" can update
       * immediately without needing the user to log out/in.
       */
      window.dispatchEvent(
        new CustomEvent("currencyChanged", {
          detail: {
            currency: currencyInfo.code,
          },
        }),
      );

      /*
       * Also notify other browser tabs/windows.
       */
      try {
        localStorage.setItem(
          "app-currency",
          JSON.stringify({
            currency: currencyInfo.code,
            updatedAt: Date.now(),
          }),
        );
      } catch {
        // localStorage may be unavailable in some environments.
      }
    } catch (err) {
      console.error("Failed to update currency:", err);

      /*
       * Restore the previous value if Firestore update failed.
       */
      setCurrency(previousCurrency);
      setError("Unable to update your currency.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <DashboardNavigation />

      <main className="min-h-screen md:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-8 lg:px-8">
          {/* HEADER */}

          <div>
            <p className="text-sm text-gray-500">Manage your preferences</p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
              Settings
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage your account and application preferences.
            </p>
          </div>

          {/* ACCOUNT */}

          <section className="mt-6 rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-semibold text-gray-900">Account</h2>

              <p className="mt-1 text-sm text-gray-500">
                Your account information.
              </p>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Name
                </p>

                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {user?.displayName || "Not set"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Email
                </p>

                <p className="mt-1 break-all text-sm font-semibold text-gray-900">
                  {user?.email || "Not available"}
                </p>
              </div>
            </div>
          </section>

          {/* CURRENCY */}

          <section className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-semibold text-gray-900">Currency</h2>

              <p className="mt-1 text-sm text-gray-500">
                Choose the default currency used throughout your account.
              </p>
            </div>

            <div className="px-5 py-5 sm:px-6">
              <label
                htmlFor="currency"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Default currency
              </label>

              {loading ? (
                <div className="h-12 w-full max-w-md animate-pulse rounded-2xl bg-gray-100" />
              ) : (
                <select
                  id="currency"
                  value={currency}
                  onChange={handleCurrencyChange}
                  disabled={saving}
                  className="w-full max-w-md rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-black focus:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {CURRENCIES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.symbol} — {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              )}

              {saving && (
                <p className="mt-2 text-sm text-gray-400">Saving currency...</p>
              )}

              {message && (
                <div className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
          </section>

          {/* SUPPORTED CURRENCIES */}

          <section className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Supported currencies
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                These currencies are currently available.
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {CURRENCIES.map((item) => {
                const active = currency === item.code;

                return (
                  <div
                    key={item.code}
                    className="flex items-center justify-between px-5 py-4 sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-sm font-bold text-gray-900">
                        {item.symbol}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {item.name}
                        </p>

                        <p className="text-xs text-gray-500">{item.code}</p>
                      </div>
                    </div>

                    {active && (
                      <span className="shrink-0 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                        Active
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
