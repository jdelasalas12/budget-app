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

import { getTransactions } from "@/lib/firestore/transactions";
import { formatCurrency } from "@/lib/currency";

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [month, setMonth] = useState(getCurrentMonth());

  const [modalOpen, setModalOpen] = useState(false);

  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [budgetData, transactionData] = await Promise.all([
        getBudgets(user.uid),
        getAllTransactions(user.uid),
      ]);

      setBudgets(budgetData);
      setTransactions(transactionData);
    } catch (error) {
      console.error("Unable to load budgets:", error);

      setError("Unable to load your budgets.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const budgetsForMonth = useMemo(() => {
    return budgets
      .filter((budget) => budget.month === month)
      .map((budget) => {
        const spent = transactions
          .filter((transaction) => {
            if (transaction.type !== "expense") {
              return false;
            }

            if (transaction.categoryId !== budget.categoryId) {
              return false;
            }

            const date = transaction.date?.toDate?.();

            if (!date) {
              return false;
            }

            const transactionMonth = `${date.getFullYear()}-${String(
              date.getMonth() + 1,
            ).padStart(2, "0")}`;

            return transactionMonth === budget.month;
          })
          .reduce(
            (total, transaction) => total + Number(transaction.amount ?? 0),
            0,
          );

        return {
          ...budget,
          spent,
        };
      });
  }, [budgets, transactions, month]);

  const summary = useMemo(() => {
    const totalBudget = budgetsForMonth.reduce(
      (total, budget) => total + budget.amount,
      0,
    );

    const totalSpent = budgetsForMonth.reduce(
      (total, budget) => total + budget.spent,
      0,
    );

    return {
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
    };
  }, [budgetsForMonth]);

  async function handleSave(input: CreateBudgetInput) {
    if (!user) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingBudget) {
        await updateBudget(user.uid, editingBudget.id, input);
      } else {
        await createBudget(user.uid, input);
      }

      setModalOpen(false);
      setEditingBudget(null);

      await loadData();
    } catch (error) {
      console.error(error);

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

      await loadData();
    } catch (error) {
      console.error(error);

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
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-black focus:bg-white"
              />
            </div>
          </section>

          {/* ERROR */}

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <LoadingState />
          ) : (
            <>
              {/* SUMMARY */}

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <SummaryCard
                  title="Total budget"
                  value={formatCurrency(
                    summary.totalBudget,
                    budgetsForMonth[0]?.currency ?? "PHP",
                  )}
                  color="blue"
                />

                <SummaryCard
                  title="Total spent"
                  value={formatCurrency(
                    summary.totalSpent,
                    budgetsForMonth[0]?.currency ?? "PHP",
                  )}
                  color="red"
                />

                <SummaryCard
                  title="Remaining"
                  value={formatCurrency(
                    summary.remaining,
                    budgetsForMonth[0]?.currency ?? "PHP",
                  )}
                  color={summary.remaining >= 0 ? "green" : "red"}
                />
              </div>

              {/* BUDGET LIST */}

              <section className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Your budgets
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Spending is calculated automatically from your expense
                    transactions.
                  </p>
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
                      className="mt-5 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                    >
                      + Add budget
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {budgetsForMonth.map((budget) => {
                      const percentage =
                        budget.amount > 0
                          ? (budget.spent / budget.amount) * 100
                          : 0;

                      const remaining = budget.amount - budget.spent;

                      const overBudget = budget.spent > budget.amount;

                      return (
                        <div key={budget.id} className="px-5 py-5 sm:px-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold text-gray-900">
                                {budget.categoryName}
                              </h3>

                              <p className="mt-1 text-xs text-gray-500">
                                {formatCurrency(budget.spent, budget.currency)}{" "}
                                spent of{" "}
                                {formatCurrency(budget.amount, budget.currency)}
                              </p>
                            </div>

                            <div className="flex shrink-0 gap-3">
                              <button
                                type="button"
                                onClick={() => openEditModal(budget)}
                                className="text-xs font-medium text-gray-500 hover:text-black"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(budget)}
                                className="text-xs font-medium text-red-500 hover:text-red-700"
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
                                width: `${Math.min(percentage, 100)}%`,
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
        saving={saving}
        onClose={() => {
          if (!saving) {
            setModalOpen(false);
            setEditingBudget(null);
          }
        }}
        onSave={handleSave}
      />
    </div>
  );
}

/* =========================================================
   LOAD ALL TRANSACTIONS
========================================================= */

async function getAllTransactions(userId: string): Promise<Transaction[]> {
  const transactions: Transaction[] = [];

  let lastDocument: any = null;

  while (true) {
    const result = await getTransactions({
      userId,
      lastDocument,
    });

    transactions.push(...result.transactions);

    if (!result.hasMore || !result.lastDocument) {
      break;
    }

    lastDocument = result.lastDocument;
  }

  return transactions;
}

/* =========================================================
   SUMMARY
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
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  budget: Budget | null;
  month: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: CreateBudgetInput) => Promise<void>;
}) {
  const { user } = useAuth();

  const [categoryId, setCategoryId] = useState("Food");
  const [amount, setAmount] = useState("");
  const [budgetMonth, setBudgetMonth] = useState(month);
  const [currency, setCurrency] = useState("PHP");

  useEffect(() => {
    if (!open) {
      return;
    }

    if (budget) {
      setCategoryId(budget.categoryId);
      setAmount(String(budget.amount));
      setBudgetMonth(budget.month);
      setCurrency(budget.currency);
    } else {
      setCategoryId("Food");
      setAmount("");
      setBudgetMonth(month);
      setCurrency("PHP");
    }
  }, [open, budget, month]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedCategory = categories.find(
      (category) => category === categoryId,
    );

    if (!selectedCategory) {
      return;
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
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
            <h2 className="text-xl font-bold">
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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500 hover:bg-gray-200"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">Category</label>

            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-black focus:bg-white"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Budget amount
            </label>

            <div className="flex overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 focus-within:border-black">
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="border-r border-gray-200 bg-transparent px-3 text-sm font-semibold outline-none"
              >
                <option value="PHP">PHP</option>
                <option value="SAR">SAR</option>
                <option value="USD">USD</option>
              </select>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
                className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Month</label>

            <input
              type="month"
              value={budgetMonth}
              onChange={(event) => setBudgetMonth(event.target.value)}
              required
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-black focus:bg-white"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || !user || !amount || !budgetMonth}
              className="flex-1 rounded-2xl bg-black px-4 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
