"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    async function loadSettings() {
      if (!user) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const currentCurrency = await getUserCurrency();

        setCurrency(currentCurrency);
      } catch (err) {
        console.error("Failed to load settings:", err);
        setError("Unable to load your settings.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [user]);

  async function handleCurrencyChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ) {
    const newCurrency = event.target.value;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await updateCurrency(newCurrency);

      setCurrency(newCurrency);

      const currencyInfo = getCurrency(newCurrency);

      setMessage(
        `Currency updated to ${currencyInfo.name} (${currencyInfo.code}).`,
      );
    } catch (err) {
      console.error("Failed to update currency:", err);

      setError("Unable to update your currency.");

      try {
        const currentCurrency = await getUserCurrency();
        setCurrency(currentCurrency);
      } catch {
        setCurrency(DEFAULT_CURRENCY);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <DashboardNavigation />

      <main className="min-h-screen md:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-8 lg:px-8">
          {/* Header */}
          <div>
            <p className="text-sm text-gray-500">Manage your preferences</p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
              Settings
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage your account and application preferences.
            </p>
          </div>

          {/* Account */}
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

                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {user?.email || "Not available"}
                </p>
              </div>
            </div>
          </section>

          {/* Currency */}
          <section className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-semibold text-gray-900">Currency</h2>

              <p className="mt-1 text-sm text-gray-500">
                Choose the currency used throughout your account.
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
                <div className="h-12 w-full animate-pulse rounded-2xl bg-gray-100" />
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

          {/* Supported currencies */}
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
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-sm font-bold text-gray-900">
                        {item.symbol}
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {item.name}
                        </p>

                        <p className="text-xs text-gray-500">{item.code}</p>
                      </div>
                    </div>

                    {active && (
                      <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
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
