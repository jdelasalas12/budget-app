"use client";

import { useEffect, useState, type FormEvent } from "react";

import type { Bill, BillFrequency, CreateBillInput } from "@/types/bill";

import { useAuth } from "@/app/components/auth/AuthProvider";
import { getAccounts } from "@/lib/firestore/accounts";
import { getUserCurrency } from "@/lib/auth";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";

import type { Account } from "@/types/account";

interface BillModalProps {
  open: boolean;
  bill?: Bill | null;
  onClose: () => void;
  onSave: (input: CreateBillInput) => Promise<void>;
}

const categories = [
  "Bills",
  "Food",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Health",
  "Salary",
  "Business",
  "Other",
];

function getLocalDate() {
  const now = new Date();

  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

  return local.toISOString().slice(0, 10);
}

export default function BillModal({
  open,
  bill,
  onClose,
  onSave,
}: BillModalProps) {
  const editing = Boolean(bill);

  const { user } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [loadingCurrency, setLoadingCurrency] = useState(false);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const [categoryId, setCategoryId] = useState("Bills");

  const [accountId, setAccountId] = useState("");

  const [dueDate, setDueDate] = useState("");

  const [frequency, setFrequency] = useState<BillFrequency>("monthly");

  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* =========================================================
     LOAD ACCOUNTS + CURRENCY
  ========================================================= */

  useEffect(() => {
    if (!open || !user) {
      return;
    }

    const userId = user.uid;

    async function loadCurrency() {
      setLoadingCurrency(true);

      try {
        const currentCurrency = await getUserCurrency();

        setCurrency(currentCurrency);
      } catch (error) {
        console.error("Unable to load currency:", error);

        setCurrency(DEFAULT_CURRENCY);
      } finally {
        setLoadingCurrency(false);
      }
    }

    async function loadAccounts() {
      setLoadingAccounts(true);

      try {
        const result = await getAccounts({
          userId,
        });

        setAccounts(result.accounts);
      } catch (error) {
        console.error("Unable to load accounts:", error);

        setAccounts([]);
      } finally {
        setLoadingAccounts(false);
      }
    }

    loadCurrency();
    loadAccounts();
  }, [open, user]);

  /* =========================================================
     POPULATE FORM
  ========================================================= */

  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");

    if (bill) {
      setTitle(bill.title);

      setAmount(String(bill.amount));

      setCategoryId(bill.categoryId || "Bills");

      setAccountId(bill.accountId);

      setFrequency(bill.frequency || "monthly");

      setNotes(bill.notes ?? "");

      setCurrency(bill.currency || DEFAULT_CURRENCY);

      const date = bill.dueDate?.toDate?.() ?? new Date();

      const year = date.getFullYear();

      const month = String(date.getMonth() + 1).padStart(2, "0");

      const day = String(date.getDate()).padStart(2, "0");

      setDueDate(`${year}-${month}-${day}`);
    } else {
      setTitle("");

      setAmount("");

      setCategoryId("Bills");

      setAccountId("");

      setDueDate(getLocalDate());

      setFrequency("monthly");

      setNotes("");

      setCurrency(DEFAULT_CURRENCY);
    }
  }, [open, bill]);

  /* =========================================================
     ACCOUNT CURRENCY
  ========================================================= */

  useEffect(() => {
    if (!accountId) {
      return;
    }

    const selectedAccount = accounts.find(
      (account) => account.id === accountId,
    );

    if (selectedAccount?.currency) {
      setCurrency(selectedAccount.currency);
    }
  }, [accountId, accounts]);

  if (!open) {
    return null;
  }

  /* =========================================================
     SUBMIT
  ========================================================= */

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const numericAmount = Number(amount);

    if (!title.trim()) {
      setError("Please enter a bill title.");

      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Please enter an amount greater than zero.");

      return;
    }

    if (!dueDate) {
      setError("Please select a due date.");

      return;
    }

    if (!accountId) {
      setError("Please select an account.");

      return;
    }

    const selectedCategory = categories.find(
      (category) => category === categoryId,
    );

    const selectedAccount = accounts.find(
      (account) => account.id === accountId,
    );

    if (!selectedCategory) {
      setError("Please select a valid category.");

      return;
    }

    if (!selectedAccount) {
      setError("Please select a valid account.");

      return;
    }

    const billCurrency =
      selectedAccount.currency || currency || DEFAULT_CURRENCY;

    setSaving(true);

    try {
      await onSave({
        title: title.trim(),

        amount: numericAmount,

        categoryId,

        categoryName: selectedCategory,

        accountId,

        accountName: selectedAccount.name,

        dueDate: new Date(`${dueDate}T00:00:00`),

        frequency,

        notes: notes.trim(),

        currency: billCurrency,
      });

      onClose();
    } catch (error) {
      console.error("Unable to save bill:", error);

      setError("Unable to save the bill. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const selectedAccount = accounts.find((account) => account.id === accountId);

  const displayCurrency =
    selectedAccount?.currency || currency || DEFAULT_CURRENCY;

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
        {/* Header */}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-950">
              {editing ? "Edit Bill" : "Add Bill"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Track a bill that needs to be paid.
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}

          <div>
            <label
              htmlFor="bill-title"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Bill name
            </label>

            <input
              id="bill-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Internet"
              required
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {/* Amount */}

          <div>
            <label
              htmlFor="bill-amount"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Amount
            </label>

            <div className="flex overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 focus-within:border-black">
              <span className="flex items-center px-4 text-sm font-semibold text-gray-500">
                {displayCurrency}
              </span>

              <input
                id="bill-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
                disabled={saving}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 outline-none disabled:cursor-not-allowed"
              />
            </div>

            {!loadingCurrency && (
              <p className="mt-1 text-xs text-gray-400">
                This bill will be recorded in {displayCurrency}.
              </p>
            )}
          </div>

          {/* Category */}

          <div>
            <label
              htmlFor="bill-category"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Category
            </label>

            <select
              id="bill-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Account */}

          <div>
            <label
              htmlFor="bill-account"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Pay from account
            </label>

            {loadingAccounts ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Loading accounts...
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                No accounts available. Please create an account first.
              </div>
            ) : (
              <>
                <select
                  id="bill-account"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  required
                  disabled={saving}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Select an account</option>

                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} — {account.currency}{" "}
                      {account.balance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </option>
                  ))}
                </select>

                {selectedAccount && (
                  <div className="mt-2 rounded-2xl bg-gray-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-500">
                        Account currency
                      </span>

                      <span className="text-xs font-semibold text-gray-900">
                        {selectedAccount.currency}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-500">
                        Current balance
                      </span>

                      <span className="text-xs font-semibold text-gray-900">
                        {formatCurrency(
                          selectedAccount.balance,
                          selectedAccount.currency,
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Due date */}

          <div>
            <label
              htmlFor="bill-due-date"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Due date
            </label>

            <input
              id="bill-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {/* Frequency */}

          <div>
            <label
              htmlFor="bill-frequency"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Frequency
            </label>

            <select
              id="bill-frequency"
              value={frequency}
              onChange={(event) =>
                setFrequency(event.target.value as BillFrequency)
              }
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="one-time">One time</option>

              <option value="weekly">Weekly</option>

              <option value="monthly">Monthly</option>

              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Notes */}

          <div>
            <label
              htmlFor="bill-notes"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Notes
            </label>

            <textarea
              id="bill-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes..."
              rows={3}
              disabled={saving}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {/* Error */}

          {error && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Buttons */}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                loadingAccounts ||
                loadingCurrency ||
                accounts.length === 0
              }
              className="flex-1 rounded-2xl bg-black px-4 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Save changes" : "Add bill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
