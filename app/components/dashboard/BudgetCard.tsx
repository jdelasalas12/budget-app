"use client";

import { useEffect, useMemo, useState } from "react";

import { getCurrency } from "@/lib/currency";
import { getBudgets } from "@/lib/firestore/budgets";
import { useAuth } from "@/app/components/auth/AuthProvider";

import type { Budget } from "@/types/budget";

interface BudgetCardProps {
  currency: string;
}

export default function BudgetCard({ currency }: BudgetCardProps) {
  const { user } = useAuth();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const currencyInfo = getCurrency(currency);

  useEffect(() => {
    async function loadBudgets() {
      if (!user) {
        setBudgets([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const data = await getBudgets(user.uid);

        setBudgets(data);
      } catch (error) {
        console.error("Unable to load budgets:", error);
        setBudgets([]);
      } finally {
        setLoading(false);
      }
    }

    void loadBudgets();
  }, [user]);

  const currencyBudgets = useMemo(() => {
    return budgets.filter(
      (budget) => (budget.currency || currency) === currency,
    );
  }, [budgets, currency]);

  const totalBudget = useMemo(() => {
    return currencyBudgets.reduce(
      (total, budget) => total + Number(budget.amount || 0),
      0,
    );
  }, [currencyBudgets]);

  const totalSpent = useMemo(() => {
    return currencyBudgets.reduce(
      (total, budget) => total + Number(budget.spent || 0),
      0,
    );
  }, [currencyBudgets]);

  const remaining = totalBudget - totalSpent;

  const percentage =
    totalBudget > 0
      ? Math.min(Math.max((totalSpent / totalBudget) * 100, 0), 100)
      : 0;

  if (loading) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm text-gray-500">Loading budget...</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Monthly Budget</p>

          <h2 className="mt-2 text-2xl font-bold text-gray-950">
            {currencyInfo.symbol} {totalBudget.toFixed(2)}
          </h2>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100">
          🎯
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${
            totalSpent > totalBudget ? "bg-red-500" : "bg-black"
          }`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {currencyInfo.symbol} {totalSpent.toFixed(2)} spent
        </span>

        <span
          className={
            remaining < 0 ? "font-semibold text-red-600" : "text-gray-500"
          }
        >
          {currencyInfo.symbol} {Math.abs(remaining).toFixed(2)}{" "}
          {remaining < 0 ? "over budget" : "remaining"}
        </span>
      </div>

      {currencyBudgets.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Categories
          </p>

          <div className="space-y-3">
            {currencyBudgets.map((budget) => {
              const amount = Number(budget.amount || 0);
              const spent = Number(budget.spent || 0);

              const categoryPercentage =
                amount > 0
                  ? Math.min(Math.max((spent / amount) * 100, 0), 100)
                  : 0;

              return (
                <div key={budget.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {budget.categoryName}
                    </span>

                    <span className="text-gray-500">
                      {currencyInfo.symbol} {spent.toFixed(2)}
                      {" / "}
                      {currencyInfo.symbol} {amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${
                        spent > amount
                          ? "bg-red-500"
                          : categoryPercentage >= 80
                            ? "bg-amber-500"
                            : "bg-black"
                      }`}
                      style={{
                        width: `${categoryPercentage}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {currencyBudgets.length === 0 && (
        <p className="mt-5 text-sm text-gray-500">
          No budgets found for {currency}.
        </p>
      )}
    </section>
  );
}
