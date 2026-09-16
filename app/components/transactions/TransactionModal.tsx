"use client";

import { useEffect, useState, type FormEvent } from "react";

import type {
  CreateTransactionInput,
  Transaction,
  TransactionType,
} from "@/types/transaction";

import { useAuth } from "@/app/components/auth/AuthProvider";
import { getAccounts } from "@/lib/firestore/accounts";
import { getUserCurrency } from "@/lib/auth";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";

import type { Account } from "@/types/account";

interface TransactionModalProps {
  open: boolean;
  transaction?: Transaction | null;
  onClose: () => void;
  onSave: (input: CreateTransactionInput) => Promise<void>;
}

const categories = [
  "Food",
  "Transportation",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Salary",
  "Business",
  "Other",
];

function getLocalDateTime() {
  const now = new Date();

  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

  return local.toISOString().slice(0, 16);
}

export default function TransactionModal({
  open,
  transaction,
  onClose,
  onSave,
}: TransactionModalProps) {
  const editing = Boolean(transaction);

  const { user } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [loadingCurrency, setLoadingCurrency] = useState(false);

  const [type, setType] = useState<TransactionType>("expense");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const [categoryId, setCategoryId] = useState("Food");

  const [accountId, setAccountId] = useState("");

  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /*
   * Load the user's currency and accounts
   * whenever the modal opens.
   */
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

  /*
   * Populate the form when adding
   * or editing a transaction.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");

    if (transaction) {
      setType(transaction.type);

      setTitle(transaction.title);

      setAmount(String(transaction.amount));

      setCategoryId(transaction.categoryId);

      setAccountId(transaction.accountId);

      setNotes(transaction.notes ?? "");

      /*
       * When editing, initially display
       * the transaction's stored currency.
       */
      setCurrency(transaction.currency || DEFAULT_CURRENCY);

      const transactionDate = transaction.date?.toDate?.() ?? new Date();

      const local = new Date(
        transactionDate.getTime() - transactionDate.getTimezoneOffset() * 60000,
      );

      setDate(local.toISOString().slice(0, 16));
    } else {
      setType("expense");

      setTitle("");

      setAmount("");

      setCategoryId("Food");

      setAccountId("");

      setDate(getLocalDateTime());

      setNotes("");
    }
  }, [open, transaction]);

  /*
   * When the selected account changes,
   * display that account's currency.
   */
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const numericAmount = Number(amount);

    if (!title.trim()) {
      setError("Please enter a transaction title.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Please enter an amount greater than zero.");
      return;
    }

    if (!date) {
      setError("Please select a date.");
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

    /*
     * The transaction currency follows the account.
     *
     * Example:
     * PHP account -> transaction is PHP
     * SAR account -> transaction is SAR
     * USD account -> transaction is USD
     */
    const transactionCurrency =
      selectedAccount.currency || currency || DEFAULT_CURRENCY;

    setSaving(true);

    try {
      await onSave({
        type,
        title: title.trim(),
        amount: numericAmount,
        categoryId,
        categoryName: selectedCategory,
        accountId,
        accountName: selectedAccount.name,
        date: new Date(date),
        notes: notes.trim(),
        currency: transactionCurrency,
      });

      onClose();
    } catch (error) {
      console.error("Unable to save transaction:", error);

      setError("Unable to save the transaction. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const selectedAccount = accounts.find((account) => account.id === accountId);

  const displayCurrency =
    selectedAccount?.currency || currency || DEFAULT_CURRENCY;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
        {/* Header */}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-950">
              {editing ? "Edit Transaction" : "Add Transaction"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Record your income or expense.
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
          {/* Income / Expense */}

          <div className="grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setType("expense")}
              disabled={saving}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                type === "expense"
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Expense
            </button>

            <button
              type="button"
              onClick={() => setType("income")}
              disabled={saving}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                type === "income"
                  ? "bg-white text-green-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Income
            </button>
          </div>

          {/* Title */}

          <div>
            <label
              htmlFor="transaction-title"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Title
            </label>

            <input
              id="transaction-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Grocery shopping"
              required
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {/* Amount */}

          <div>
            <label
              htmlFor="transaction-amount"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Amount
            </label>

            <div className="flex overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 focus-within:border-black">
              <span className="flex items-center px-4 text-sm font-semibold text-gray-500">
                {displayCurrency}
              </span>

              <input
                id="transaction-amount"
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
                This transaction will be recorded in {displayCurrency}.
              </p>
            )}
          </div>

          {/* Category */}

          <div>
            <label
              htmlFor="transaction-category"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Category
            </label>

            <select
              id="transaction-category"
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
              htmlFor="transaction-account"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Account
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
                  id="transaction-account"
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

          {/* Date */}

          <div>
            <label
              htmlFor="transaction-date"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Date
            </label>

            <input
              id="transaction-date"
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {/* Notes */}

          <div>
            <label
              htmlFor="transaction-notes"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Notes
            </label>

            <textarea
              id="transaction-notes"
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
              {saving
                ? "Saving..."
                : editing
                  ? "Save changes"
                  : "Add transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
