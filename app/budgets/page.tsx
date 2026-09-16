"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ProtectedRoute from "@/app/components/auth/ProtectedRoute";
import DashboardNavigation from "@/app/components/dashboard/DashboardNavigation";
import { useAuth } from "@/app/components/auth/AuthProvider";

import {
  createBudget,
  deleteBudget,
  getBudgets,
  updateBudget,
} from "@/lib/firestore/budgets";

import { getExpenseTransactionsForMonth } from "@/lib/firestore/transactions";
import { getUserCurrency } from "@/lib/auth";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";

import type { Budget, CreateBudgetInput } from "@/types/budget";
import type { Transaction } from "@/types/transaction";

const categories = [
  "Food",
  "Transportation",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Business",
  "Other",
];

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new Error("Invalid month.");
  }

  const from = new Date(year, monthNumber - 1, 1);
  const to = new Date(year, monthNumber, 1);

  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  return {
    from,
    to,
  };
}

export default function BudgetsPage() {
  return (
    <ProtectedRoute>
      <BudgetsContent />
    </ProtectedRoute>
  );
}

function BudgetsContent() {
  const { user } = useAuth();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [month, setMonth] = useState(getCurrentMonth());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setBudgets([]);
      setTransactions([]);
      setCurrency(DEFAULT_CURRENCY);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { from, to } = getMonthRange(month);

      const [budgetData, transactionData, userCurrency] = await Promise.all([
        getBudgets(user.uid),

        getExpenseTransactionsForMonth({
          userId: user.uid,
          from,
          to,
        }),

        getUserCurrency(),
      ]);

      setBudgets(budgetData);
      setTransactions(transactionData);
      setCurrency(userCurrency || DEFAULT_CURRENCY);
    } catch (error) {
      console.error("Unable to load budgets:", error);

      setError("Unable to load your budgets.");
    } finally {
      setLoading(false);
    }
  }, [user, month]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /*
   * Calculate spending by category AND currency.
   *
   * This prevents PHP transactions from being counted
   * against an SAR budget, for example.
   */
  const spendingByCategory = useMemo(() => {
    const totals = new Map<string, number>();

    for (const transaction of transactions) {
      if (transaction.type !== "expense") {
        continue;
      }

      if (!transaction.categoryId) {
        continue;
      }

      const amount = Number(transaction.amount ?? 0);

      if (!Number.isFinite(amount)) {
        continue;
      }

      const transactionCurrency = transaction.currency || DEFAULT_CURRENCY;

      const key = `${transaction.categoryId}__${transactionCurrency}`;

      totals.set(key, (totals.get(key) ?? 0) + amount);
    }

    return totals;
  }, [transactions]);

  /*
   * Attach calculated spending to each budget.
   */
  const budgetsForMonth = useMemo(() => {
    return budgets
      .filter((budget) => budget.month === month)
      .map((budget) => {
        const budgetCurrency = budget.currency || DEFAULT_CURRENCY;

        const key = `${budget.categoryId}__${budgetCurrency}`;

        return {
          ...budget,
          currency: budgetCurrency,
          spent: spendingByCategory.get(key) ?? 0,
        };
      });
  }, [budgets, month, spendingByCategory]);

  /*
   * Summary only includes budgets in the user's
   * current default currency.
   *
   * We do not convert between currencies without
   * an exchange-rate system.
   */
  const summary = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;

    for (const budget of budgetsForMonth) {
      if (budget.currency !== currency) {
        continue;
      }

      totalBudget += Number(budget.amount ?? 0);
      totalSpent += Number(budget.spent ?? 0);
    }

    return {
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
    };
  }, [budgetsForMonth, currency]);

  async function handleSave(input: CreateBudgetInput) {
    if (!user) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingBudget) {
        await updateBudget(user.uid, editingBudget.id, input);

        /*
         * Reload after editing so the calculated spending
         * and currency are guaranteed to be current.
         */
        const updatedBudgets = await getBudgets(user.uid);

        setBudgets(updatedBudgets);
      } else {
        await createBudget(user.uid, input);

        const updatedBudgets = await getBudgets(user.uid);

        setBudgets(updatedBudgets);
      }

      setModalOpen(false);
      setEditingBudget(null);
    } catch (error) {
      console.error("Unable to save budget:", error);

      setError(
        error instanceof Error ? error.message : "Unable to save the budget.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(budget: Budget) {
    if (!user) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the ${budget.categoryName} budget?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await deleteBudget(user.uid, budget.id);

      setBudgets((current) => current.filter((item) => item.id !== budget.id));
    } catch (error) {
      console.error("Unable to delete budget:", error);

      setError("Unable to delete the budget.");
    }
  }

  function openAddModal() {
    setEditingBudget(null);
    setModalOpen(true);
  }

  function openEditModal(budget: Budget) {
    setEditingBudget(budget);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingBudget(null);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <DashboardNavigation />

      <main className="min-h-screen md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-8 lg:px-8">
          {/* HEADER */}

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">Plan your spending</p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
                Budgets
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Set spending limits and track your progress.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddModal}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              + Add budget
            </button>
          </div>

          {/* MONTH */}

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Budget period</h2>

                <p className="mt-1 text-sm text-gray-500">
                  Select the month you want to view.
                </p>
              </div>

              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                disabled={loading}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-black focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </section>

          {/* ERROR */}

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* CONTENT */}

          {loading ? (
            <LoadingState />
          ) : (
            <>
              {/* SUMMARY */}

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <SummaryCard
                  title={`Total budget (${currency})`}
                  value={formatCurrency(summary.totalBudget, currency)}
                  color="blue"
                />

                <SummaryCard
                  title={`Total spent (${currency})`}
                  value={formatCurrency(summary.totalSpent, currency)}
                  color="red"
                />

                <SummaryCard
                  title={`Remaining (${currency})`}
                  value={formatCurrency(summary.remaining, currency)}
                  color={summary.remaining >= 0 ? "green" : "red"}
                />
              </div>

              {/* BUDGET LIST */}

              <section className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Your budgets
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Spending is calculated automatically from your expense
                        transactions.
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      Default: {currency}
                    </span>
                  </div>
                </div>

                {budgetsForMonth.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-xl">
                      💰
                    </div>

                    <h3 className="mt-4 font-semibold text-gray-900">
                      No budgets for this month
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      Create a budget to start tracking your spending.
                    </p>

                    <button
                      type="button"
                      onClick={openAddModal}
                      className="mt-5 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                    >
                      + Add budget
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {budgetsForMonth.map((budget) => {
                      const amount = Number(budget.amount ?? 0);

                      const spent = Number(budget.spent ?? 0);

                      const percentage =
                        amount > 0 ? (spent / amount) * 100 : 0;

                      const remaining = amount - spent;

                      const overBudget = spent > amount;

                      return (
                        <div key={budget.id} className="px-5 py-5 sm:px-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate font-semibold text-gray-900">
                                  {budget.categoryName}
                                </h3>

                                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                                  {budget.currency}
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-gray-500">
                                {formatCurrency(spent, budget.currency)} spent
                                of {formatCurrency(amount, budget.currency)}
                              </p>
                            </div>

                            <div className="flex shrink-0 gap-3">
                              <button
                                type="button"
                                onClick={() => openEditModal(budget)}
                                className="text-xs font-medium text-gray-500 transition hover:text-black"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(budget)}
                                className="text-xs font-medium text-red-500 transition hover:text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={`h-full rounded-full transition-all ${
                                overBudget
                                  ? "bg-red-500"
                                  : percentage >= 80
                                    ? "bg-amber-500"
                                    : "bg-black"
                              }`}
                              style={{
                                width: `${Math.min(
                                  Math.max(percentage, 0),
                                  100,
                                )}%`,
                              }}
                            />
                          </div>

                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span
                              className={
                                overBudget
                                  ? "font-semibold text-red-600"
                                  : "text-gray-400"
                              }
                            >
                              {percentage.toFixed(0)}% used
                            </span>

                            <span
                              className={
                                remaining < 0
                                  ? "font-semibold text-red-600"
                                  : "text-gray-500"
                              }
                            >
                              {remaining >= 0
                                ? `${formatCurrency(
                                    remaining,
                                    budget.currency,
                                  )} remaining`
                                : `${formatCurrency(
                                    Math.abs(remaining),
                                    budget.currency,
                                  )} over budget`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <BudgetModal
        open={modalOpen}
        budget={editingBudget}
        month={month}
        defaultCurrency={currency}
        saving={saving}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: "green" | "red" | "blue";
}) {
  const colors = {
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <span
        className={`inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold ${colors[color]}`}
      >
        {title}
      </span>

      <p className="mt-4 break-words text-2xl font-bold text-gray-950">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   MODAL
========================================================= */

function BudgetModal({
  open,
  budget,
  month,
  defaultCurrency,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  budget: Budget | null;
  month: string;
  defaultCurrency: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: CreateBudgetInput) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState("Food");
  const [amount, setAmount] = useState("");
  const [budgetMonth, setBudgetMonth] = useState(month);
  const [currency, setCurrency] = useState(defaultCurrency);

  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setValidationError("");

    if (budget) {
      setCategoryId(budget.categoryId);
      setAmount(String(budget.amount));
      setBudgetMonth(budget.month);

      /*
       * Existing budgets keep their saved currency.
       */
      setCurrency(budget.currency || defaultCurrency);
    } else {
      setCategoryId("Food");
      setAmount("");
      setBudgetMonth(month);

      /*
       * New budgets ALWAYS use the currency
       * selected in Settings.
       */
      setCurrency(defaultCurrency);
    }
  }, [open, budget, month, defaultCurrency]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setValidationError("");

    const selectedCategory = categories.find(
      (category) => category === categoryId,
    );

    if (!selectedCategory) {
      setValidationError("Please select a category.");
      return;
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setValidationError("Budget amount must be greater than zero.");
      return;
    }

    if (!budgetMonth) {
      setValidationError("Please select a month.");
      return;
    }

    if (!currency) {
      setValidationError("Please select a currency.");
      return;
    }

    await onSave({
      categoryId,
      categoryName: selectedCategory,
      amount: numericAmount,
      month: budgetMonth,
      currency,
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-950">
              {budget ? "Edit Budget" : "Add Budget"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Set a spending limit for a category.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500 transition hover:bg-gray-200 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {validationError && (
          <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* CATEGORY */}

          <div>
            <label
              htmlFor="budget-category"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Category
            </label>

            <select
              id="budget-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:opacity-60"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* AMOUNT */}

          <div>
            <label
              htmlFor="budget-amount"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Budget amount
            </label>

            <div className="flex overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 focus-within:border-black">
              <div className="flex items-center border-r border-gray-200 bg-gray-100 px-4 text-sm font-bold text-gray-700">
                {currency}
              </div>

              <input
                id="budget-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
                disabled={saving}
                className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none disabled:opacity-60"
              />
            </div>

            <p className="mt-2 text-xs text-gray-400">
              New budgets use your default currency from Settings:{" "}
              <span className="font-semibold">{defaultCurrency}</span>
            </p>
          </div>

          {/* MONTH */}

          <div>
            <label
              htmlFor="budget-month"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Month
            </label>

            <input
              id="budget-month"
              type="month"
              value={budgetMonth}
              onChange={(event) => setBudgetMonth(event.target.value)}
              required
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:opacity-60"
            />
          </div>

          {/* BUTTONS */}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !amount || !budgetMonth || !currency}
              className="flex-1 rounded-2xl bg-black px-4 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : budget ? "Save changes" : "Add budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function LoadingState() {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-3xl bg-white" />
        ))}
      </div>

      <div className="h-96 animate-pulse rounded-3xl bg-white" />
    </div>
  );
}
