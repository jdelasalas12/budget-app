"use client";

import { useEffect, useState } from "react";

import { getCurrency } from "@/lib/currency";
import { getTransactionsForMonth } from "@/lib/firestore/transactions";
import { useAuth } from "@/app/components/auth/AuthProvider";

interface IncomeExpenseCardsProps {
  currency: string;
}

function getCurrentMonthRange() {
  const now = new Date();

  const from = new Date(now.getFullYear(), now.getMonth(), 1);

  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

export default function IncomeExpenseCards({
  currency,
}: IncomeExpenseCardsProps) {
  const { user } = useAuth();

  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [loading, setLoading] = useState(true);

  const currencyInfo = getCurrency(currency);

  useEffect(() => {
    async function loadTransactions() {
      if (!user) {
        setIncome(0);
        setExpenses(0);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const { from, to } = getCurrentMonthRange();

        const transactions = await getTransactionsForMonth({
          userId: user.uid,
          from,
          to,
        });

        let totalIncome = 0;
        let totalExpenses = 0;

        for (const transaction of transactions) {
          const transactionCurrency = transaction.currency || currency;

          // Don't mix different currencies.
          if (transactionCurrency !== currency) {
            continue;
          }

          const amount = Number(transaction.amount ?? 0);

          if (!Number.isFinite(amount)) {
            continue;
          }

          if (transaction.type === "income") {
            totalIncome += amount;
          }

          if (transaction.type === "expense") {
            totalExpenses += amount;
          }
        }

        setIncome(totalIncome);
        setExpenses(totalExpenses);
      } catch (error) {
        console.error("Unable to load monthly transactions:", error);

        setIncome(0);
        setExpenses(0);
      } finally {
        setLoading(false);
      }
    }

    void loadTransactions();
  }, [user, currency]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {/* INCOME */}

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50">
            ↗
          </div>

          <p className="text-sm font-medium text-gray-500">Income</p>
        </div>

        <p className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">
          {currencyInfo.symbol} {loading ? "..." : income.toFixed(2)}
        </p>

        <p className="mt-1 text-xs text-gray-400">This month</p>
      </div>

      {/* EXPENSES */}

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50">
            ↘
          </div>

          <p className="text-sm font-medium text-gray-500">Expenses</p>
        </div>

        <p className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">
          {currencyInfo.symbol} {loading ? "..." : expenses.toFixed(2)}
        </p>

        <p className="mt-1 text-xs text-gray-400">This month</p>
      </div>
    </div>
  );
}
