"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/components/auth/AuthProvider";
import { getCurrency } from "@/lib/currency";
import { getTransactions } from "@/lib/firestore/transactions";

import type { Transaction } from "@/types/transaction";

export default function RecentTransactions() {
  const { user, currency } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTransactions() {
      if (!user) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const result = await getTransactions({
          userId: user.uid,
          type: "all",
        });

        const filteredTransactions = result.transactions
          .filter(
            (transaction) => (transaction.currency || currency) === currency,
          )
          .slice(0, 5);

        setTransactions(filteredTransactions);
      } catch (error) {
        console.error("Unable to load recent transactions:", error);

        setTransactions([]);
      } finally {
        setLoading(false);
      }
    }

    void loadTransactions();
  }, [user, currency]);

  function formatDate(transaction: Transaction) {
    if (!transaction.date) {
      return "";
    }

    const date =
      typeof transaction.date.toDate === "function"
        ? transaction.date.toDate()
        : new Date(transaction.date as unknown as string);

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
      {/* HEADER */}

      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-bold text-gray-950">Recent Transactions</h2>

          <p className="mt-1 text-xs text-gray-400">
            Your latest income and expenses
          </p>
        </div>

        <Link
          href="/transactions"
          className="text-sm font-semibold text-gray-700 hover:text-black"
        >
          View all
        </Link>
      </div>

      {/* LOADING */}

      {loading ? (
        <div className="divide-y divide-gray-100">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="flex items-center gap-4 px-5 py-4 sm:px-6"
            >
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-gray-100" />

              <div className="min-w-0 flex-1">
                <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />

                <div className="mt-2 h-3 w-20 animate-pulse rounded bg-gray-100" />
              </div>

              <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        /* EMPTY STATE */

        <div className="px-5 py-10 text-center sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-xl">
            🧾
          </div>

          <h3 className="mt-4 font-semibold text-gray-900">
            No transactions yet
          </h3>

          <p className="mx-auto mt-2 max-w-xs text-sm text-gray-500">
            Add your first income or expense to start tracking your finances.
          </p>

          <Link
            href="/transactions"
            className="mt-5 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Add transaction
          </Link>
        </div>
      ) : (
        /* TRANSACTIONS */

        <div className="divide-y divide-gray-100">
          {transactions.map((transaction) => {
            const isIncome = transaction.type === "income";

            const transactionCurrency = transaction.currency || currency;

            const currencyInfo = getCurrency(transactionCurrency);

            return (
              <div
                key={transaction.id}
                className="flex items-center gap-4 px-5 py-4 sm:px-6"
              >
                {/* ICON */}

                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    isIncome
                      ? "bg-green-50 text-green-600"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {isIncome ? "↗" : "↘"}
                </div>

                {/* DETAILS */}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {transaction.title}
                  </p>

                  <p className="mt-1 truncate text-xs text-gray-400">
                    {transaction.categoryName || "Uncategorized"}
                    {transaction.date ? ` • ${formatDate(transaction)}` : ""}
                  </p>
                </div>

                {/* AMOUNT */}

                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold ${
                      isIncome ? "text-green-600" : "text-gray-900"
                    }`}
                  >
                    {isIncome ? "+" : "-"}
                    {currencyInfo.symbol}{" "}
                    {Number(transaction.amount || 0).toFixed(2)}
                  </p>

                  <p className="mt-1 text-[10px] font-medium text-gray-400">
                    {transactionCurrency}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="px-5 py-4 text-center sm:px-6">
            <Link
              href="/transactions"
              className="text-sm font-semibold text-gray-600 hover:text-black"
            >
              View all transactions →
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
