"use client";

import { useEffect, useState } from "react";

import type {
  Budget,
  CreateBudgetInput,
  UpdateBudgetInput,
} from "@/types/budget";

import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currency";

interface BudgetModalProps {
  open: boolean;
  budget: Budget | null;
  onClose: () => void;
  onSave: (input: CreateBudgetInput | UpdateBudgetInput) => Promise<void>;
}

const CATEGORIES = [
  "Food",
  "Transportation",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Education",
  "Travel",
  "Housing",
  "Other",
];

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetModal({
  open,
  budget,
  onClose,
  onSave,
}: BudgetModalProps) {
  const [categoryName, setCategoryName] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(getCurrentMonth());
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const editing = Boolean(budget);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (budget) {
      setCategoryName(budget.categoryName);
      setAmount(String(budget.amount));
      setMonth(budget.month);
      setCurrency(budget.currency);
    } else {
      setCategoryName("");
      setAmount("");
      setMonth(getCurrentMonth());
      setCurrency(DEFAULT_CURRENCY);
    }

    setError("");
  }, [open, budget]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const trimmedCategory = categoryName.trim();
    const numericAmount = Number(amount);

    if (!trimmedCategory) {
      setError("Please select a category.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Please enter a budget amount greater than 0.");
      return;
    }

    if (!month) {
      setError("Please select a month.");
      return;
    }

    setSaving(true);

    try {
      await onSave({
        categoryId: trimmedCategory.toLowerCase().replace(/\s+/g, "-"),
        categoryName: trimmedCategory,
        amount: numericAmount,
        month,
        currency,
      });

      onClose();
    } catch (err) {
      console.error("Unable to save budget:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save budget. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) {
      return;
    }

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {editing ? "Edit Budget" : "Add Budget"}
            </h2>

            <p className="mt-0.5 text-sm text-gray-500">
              {editing
                ? "Update your budget."
                : "Set a spending limit for a category."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
          {error && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="budget-category"
              className="mb-2 block text-sm font-semibold text-gray-800"
            >
              Category
            </label>

            <select
              id="budget-category"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-black focus:bg-white disabled:opacity-50"
            >
              <option value="">Select a category</option>

              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="budget-amount"
              className="mb-2 block text-sm font-semibold text-gray-800"
            >
              Budget amount
            </label>

            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                disabled={saving}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold outline-none focus:border-black disabled:opacity-50"
              >
                {CURRENCIES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code}
                  </option>
                ))}
              </select>

              <input
                id="budget-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                disabled={saving}
                className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-black focus:bg-white disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="budget-month"
              className="mb-2 block text-sm font-semibold text-gray-800"
            >
              Month
            </label>

            <input
              id="budget-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-black focus:bg-white disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-semibold transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Save changes" : "Add budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
