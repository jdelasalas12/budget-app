"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentSnapshot } from "firebase/firestore";

import ProtectedRoute from "@/app/components/auth/ProtectedRoute";
import DashboardNavigation from "@/app/components/dashboard/DashboardNavigation";
import { useAuth } from "@/app/components/auth/AuthProvider";

import { getReportTransactions } from "@/lib/firestore/transactions";
import { formatCurrency } from "@/lib/currency";

import type { Transaction } from "@/types/transaction";

const PAGE_SIZE = 10;

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStartOfMonth() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getEndOfToday() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  );
}

function ReportsContent() {
  const { user } = useAuth();

  const defaultFrom = useMemo(() => formatDateForInput(getStartOfMonth()), []);

  const defaultTo = useMemo(() => formatDateForInput(getEndOfToday()), []);

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const [appliedFromDate, setAppliedFromDate] = useState(defaultFrom);
  const [appliedToDate, setAppliedToDate] = useState(defaultTo);

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  /*
   * Cursor used for each page.
   *
   * pageCursors[0] = null
   * pageCursors[1] = cursor needed to load page 2
   * pageCursors[2] = cursor needed to load page 3
   */
  const [pageCursors, setPageCursors] = useState<(DocumentSnapshot | null)[]>([
    null,
  ]);

  /*
   * Keep the request counter outside React state.
   *
   * Changing this value does NOT cause a render.
   */
  const requestIdRef = useRef(0);

  /*
   * Prevent multiple pagination requests from
   * being fired at the same time.
   */
  const loadingRef = useRef(false);

  /*
   * Fetch a report page.
   */
  const fetchPage = useCallback(
    async (cursor: DocumentSnapshot | null, targetPage: number) => {
      if (!user) {
        return;
      }

      /*
       * Every request gets its own ID.
       */
      const requestId = ++requestIdRef.current;

      loadingRef.current = true;
      setLoading(true);
      setError("");

      try {
        const from = new Date(`${appliedFromDate}T00:00:00`);

        /*
         * Keep the selected "To" date inclusive.
         *
         * The Firestore function should ideally treat this
         * as an exclusive upper bound.
         */
        const to = new Date(`${appliedToDate}T00:00:00`);
        to.setDate(to.getDate() + 1);

        if (from > to) {
          throw new Error("The From date cannot be later than the To date.");
        }

        const result = await getReportTransactions({
          userId: user.uid,
          from,
          to,
          lastDocument: cursor,
        });

        /*
         * Ignore stale requests.
         */
        if (requestId !== requestIdRef.current) {
          return;
        }

        setTransactions(result.transactions);
        setHasMore(result.hasMore);
        setPage(targetPage);

        /*
         * Store the cursor returned by Firestore.
         */
        if (result.lastDocument) {
          setPageCursors((current) => {
            const next = [...current];

            next[targetPage] = result.lastDocument;

            return next;
          });
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.error("Unable to load report:", err);

        setError(
          err instanceof Error ? err.message : "Unable to load your report.",
        );
      } finally {
        if (requestId === requestIdRef.current) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [user, appliedFromDate, appliedToDate],
  );

  /*
   * Load the first page whenever:
   *
   * - the user changes
   * - the applied date range changes
   */
  useEffect(() => {
    if (!user) {
      requestIdRef.current += 1;

      setTransactions([]);
      setHasMore(false);
      setPage(1);
      setPageCursors([null]);
      setLoading(false);

      return;
    }

    /*
     * Reset pagination immediately.
     */
    setPage(1);
    setPageCursors([null]);

    fetchPage(null, 1);
  }, [user, appliedFromDate, appliedToDate, fetchPage]);

  const handleApply = useCallback(() => {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T00:00:00`);

    if (from > to) {
      setError("The From date cannot be later than the To date.");
      return;
    }

    setError("");

    if (fromDate === appliedFromDate && toDate === appliedToDate) {
      return;
    }

    setAppliedFromDate(fromDate ? fromDate.toString().slice(0, 10) : "");
    setAppliedToDate(toDate ? toDate.toString().slice(0, 10) : "");
  }, [fromDate, toDate, appliedFromDate, appliedToDate]);

  const handleClear = useCallback(() => {
    const nextFrom = formatDateForInput(getStartOfMonth());
    const nextTo = formatDateForInput(getEndOfToday());

    setFromDate(nextFrom);
    setToDate(nextTo);
    setError("");

    if (nextFrom === appliedFromDate && nextTo === appliedToDate) {
      return;
    }

    setAppliedFromDate(nextFrom);
    setAppliedToDate(nextTo);
  }, [appliedFromDate, appliedToDate]);

  const handleNextPage = useCallback(async () => {
    if (!user || loadingRef.current || !hasMore) {
      return;
    }

    const nextPage = page + 1;

    /*
     * pageCursors[page] contains the cursor returned
     * from the current page.
     */
    const cursor = pageCursors[page];

    if (!cursor) {
      return;
    }

    await fetchPage(cursor, nextPage);
  }, [user, hasMore, page, pageCursors, fetchPage]);

  const handlePreviousPage = useCallback(async () => {
    if (!user || loadingRef.current || page <= 1) {
      return;
    }

    const previousPage = page - 1;

    /*
     * Page 1 always starts at null.
     *
     * For page N, we need the cursor that starts
     * page N.
     */
    const cursor =
      previousPage === 1 ? null : (pageCursors[previousPage - 1] ?? null);

    await fetchPage(cursor, previousPage);
  }, [user, page, pageCursors, fetchPage]);

  /*
   * Summary for currently loaded page.
   */
  const stats = useMemo(() => {
    let income = 0;
    let expenses = 0;

    for (const transaction of transactions) {
      if (transaction.type === "income") {
        income += transaction.amount;
      } else {
        expenses += transaction.amount;
      }
    }

    return {
      income,
      expenses,
      net: income - expenses,
    };
  }, [transactions]);

  /*
   * Spending by category.
   */
  const categoryBreakdown = useMemo(() => {
    const categories = new Map<string, number>();

    for (const transaction of transactions) {
      if (transaction.type !== "expense") {
        continue;
      }

      categories.set(
        transaction.categoryName,
        (categories.get(transaction.categoryName) ?? 0) + transaction.amount,
      );
    }

    return Array.from(categories.entries())
      .map(([name, amount]) => ({
        name,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  /*
   * Activity by account.
   */
  const accountBreakdown = useMemo(() => {
    const accounts = new Map<
      string,
      {
        income: number;
        expenses: number;
      }
    >();

    for (const transaction of transactions) {
      const current = accounts.get(transaction.accountName) ?? {
        income: 0,
        expenses: 0,
      };

      if (transaction.type === "income") {
        current.income += transaction.amount;
      } else {
        current.expenses += transaction.amount;
      }

      accounts.set(transaction.accountName, current);
    }

    return Array.from(accounts.entries())
      .map(([name, values]) => ({
        name,
        ...values,
        net: values.income - values.expenses,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [transactions]);

  const currency = transactions[0]?.currency ?? "PHP";

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <DashboardNavigation />

      <main className="min-h-screen md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-8 lg:px-8">
          <div>
            <p className="text-sm text-gray-500">Understand your finances</p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
              Reports
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Review your income, expenses, and spending patterns.
            </p>
          </div>

          {/* DATE FILTER */}

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Report period
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Choose the dates you want to include in this report.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
              <div>
                <label
                  htmlFor="from-date"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  From
                </label>

                <input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-black focus:bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="to-date"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  To
                </label>

                <input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-black focus:bg-white"
                />
              </div>

              <button
                type="button"
                onClick={handleApply}
                disabled={loading}
                className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Loading..." : "Apply"}
              </button>

              <button
                type="button"
                onClick={handleClear}
                disabled={loading}
                className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Clear
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500">
                Showing transactions from{" "}
                <span className="font-semibold text-gray-900">
                  {appliedFromDate}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-gray-900">
                  {appliedToDate}
                </span>
              </p>
            </div>
          </section>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <ReportsLoading />
          ) : (
            <>
              {/* SUMMARY */}

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <SummaryCard
                  title="Income"
                  value={formatCurrency(stats.income, currency)}
                  description="Loaded report transactions"
                  color="green"
                />

                <SummaryCard
                  title="Expenses"
                  value={formatCurrency(stats.expenses, currency)}
                  description="Loaded report transactions"
                  color="red"
                />

                <SummaryCard
                  title="Net"
                  value={formatCurrency(stats.net, currency)}
                  description="Income minus expenses"
                  color={stats.net >= 0 ? "blue" : "red"}
                />
              </div>

              {/* CATEGORY */}

              <section className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Spending by category
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Where your money is going during this period.
                  </p>
                </div>

                {categoryBreakdown.length === 0 ? (
                  <EmptyReport text="No expense data for this period." />
                ) : (
                  <div className="space-y-5 px-5 py-5 sm:px-6">
                    {categoryBreakdown.map((category) => {
                      const percentage =
                        stats.expenses > 0
                          ? (category.amount / stats.expenses) * 100
                          : 0;

                      return (
                        <div key={category.name}>
                          <div className="flex items-center justify-between gap-4">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {category.name}
                            </p>

                            <p className="shrink-0 text-sm font-semibold text-gray-900">
                              {formatCurrency(category.amount, currency)}
                            </p>
                          </div>

                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-black transition-all"
                              style={{
                                width: `${Math.min(percentage, 100)}%`,
                              }}
                            />
                          </div>

                          <p className="mt-1 text-xs text-gray-400">
                            {percentage.toFixed(1)}% of expenses
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ACCOUNT ACTIVITY */}

              <section className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Account activity
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Income and expenses by account.
                  </p>
                </div>

                {accountBreakdown.length === 0 ? (
                  <EmptyReport text="No account activity for this period." />
                ) : (
                  <div className="divide-y divide-gray-100">
                    {accountBreakdown.map((account) => (
                      <div
                        key={account.name}
                        className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {account.name}
                          </p>

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            <span className="text-green-600">
                              Income: {formatCurrency(account.income, currency)}
                            </span>

                            <span className="text-red-500">
                              Expenses:{" "}
                              {formatCurrency(account.expenses, currency)}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-xs text-gray-400">Net</p>

                          <p
                            className={`text-sm font-bold ${
                              account.net >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(account.net, currency)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* TRANSACTIONS */}

              <section className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Transactions
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Transactions in this report period.
                  </p>
                </div>

                {transactions.length === 0 ? (
                  <EmptyReport text="No transactions for this period." />
                ) : (
                  <>
                    <div className="divide-y divide-gray-100">
                      {transactions.map((transaction) => (
                        <ReportTransactionRow
                          key={transaction.id}
                          transaction={transaction}
                        />
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-gray-500">Page {page}</p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handlePreviousPage}
                          disabled={page === 1 || loading}
                          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        >
                          Previous
                        </button>

                        <button
                          type="button"
                          onClick={handleNextPage}
                          disabled={!hasMore || loading}
                          className="flex-1 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  description,
  color,
}: {
  title: string;
  value: string;
  description: string;
  color: "green" | "red" | "blue";
}) {
  const colors = {
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
      <div
        className={`inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold ${colors[color]}`}
      >
        {title}
      </div>

      <p className="mt-4 break-words text-2xl font-bold tracking-tight text-gray-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-gray-400">{description}</p>
    </div>
  );
}

/* =========================================================
   TRANSACTION ROW
========================================================= */

function ReportTransactionRow({ transaction }: { transaction: Transaction }) {
  const isIncome = transaction.type === "income";

  const date =
    transaction.date?.toDate?.().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) ?? "";

  return (
    <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
          isIncome ? "bg-green-50" : "bg-red-50"
        }`}
      >
        <span
          className={`text-lg ${isIncome ? "text-green-600" : "text-red-600"}`}
        >
          {isIncome ? "↗" : "↘"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {transaction.title}
        </p>

        <p className="mt-1 truncate text-xs text-gray-500">
          {transaction.categoryName}
          {" · "}
          {transaction.accountName}
          {" · "}
          {date}
        </p>
      </div>

      <p
        className={`shrink-0 text-sm font-bold ${
          isIncome ? "text-green-600" : "text-gray-900"
        }`}
      >
        {isIncome ? "+" : "-"}{" "}
        {formatCurrency(transaction.amount, transaction.currency)}
      </p>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyReport({ text }: { text: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-xl">
        📊
      </div>

      <p className="mt-3 text-sm text-gray-500">{text}</p>
    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function ReportsLoading() {
  return (
    <div className="mt-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-3xl bg-white" />
        ))}
      </div>

      <div className="mt-4 h-80 animate-pulse rounded-3xl bg-white" />

      <div className="mt-4 h-64 animate-pulse rounded-3xl bg-white" />

      <div className="mt-4 h-96 animate-pulse rounded-3xl bg-white" />
    </div>
  );
}
