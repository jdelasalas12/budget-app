"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type {
  Account,
  AccountType,
  CreateAccountInput,
  UpdateAccountInput,
} from "@/types/account";

import { getCurrency } from "@/lib/currency";

interface AccountModalProps {
  open: boolean;
  account: Account | null;
  currency: string;
  onClose: () => void;
  onSave: (input: CreateAccountInput | UpdateAccountInput) => Promise<void>;
}

const ACCOUNT_TYPES: {
  value: AccountType;
  label: string;
}[] = [
  {
    value: "cash",
    label: "Cash",
  },
  {
    value: "bank",
    label: "Bank Account",
  },
  {
    value: "card",
    label: "Credit/Debit Card",
  },
  {
    value: "wallet",
    label: "Digital Wallet",
  },
  {
    value: "savings",
    label: "Savings",
  },
  {
    value: "other",
    label: "Other",
  },
];

const DEFAULT_FORM = {
  name: "",
  type: "cash" as AccountType,
  openingBalance: "0",
  notes: "",
};

export default function AccountModal({
  open,
  account,
  currency,
  onClose,
  onSave,
}: AccountModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const editing = Boolean(account);
  const currencyInfo = getCurrency(currency);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (account) {
      setName(account.name);
      setType(account.type);

      setOpeningBalance(String(account.openingBalance ?? account.balance ?? 0));

      setNotes(account.notes ?? "");
    } else {
      setName(DEFAULT_FORM.name);
      setType(DEFAULT_FORM.type);
      setOpeningBalance(DEFAULT_FORM.openingBalance);
      setNotes(DEFAULT_FORM.notes);
    }

    setError("");
  }, [open, account]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, saving, onClose]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter an account name.");
      return;
    }

    const numericOpeningBalance = Number(openingBalance);

    if (!Number.isFinite(numericOpeningBalance) || numericOpeningBalance < 0) {
      setError("Please enter a valid opening balance.");
      return;
    }

    setSaving(true);

    try {
      await onSave({
        name: trimmedName,
        type,
        openingBalance: numericOpeningBalance,
        notes: notes.trim(),
      });

      onClose();
    } catch (err) {
      console.error("Unable to save account:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save account. Please try again.",
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <h2
              id="account-modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              {editing ? "Edit Account" : "Add Account"}
            </h2>

            <p className="mt-0.5 text-sm text-gray-500">
              {editing
                ? "Update your account details."
                : "Add a new account to track your money."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-5 py-5 sm:px-6">
            {/* Error */}
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Account Name */}
            <div>
              <label
                htmlFor="account-name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Account Name
              </label>

              <input
                id="account-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Main Bank Account"
                disabled={saving}
                autoFocus
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50"
              />
            </div>

            {/* Account Type */}
            <div>
              <label
                htmlFor="account-type"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Account Type
              </label>

              <select
                id="account-type"
                value={type}
                onChange={(event) => setType(event.target.value as AccountType)}
                disabled={saving}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50"
              >
                {ACCOUNT_TYPES.map((accountType) => (
                  <option key={accountType.value} value={accountType.value}>
                    {accountType.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Opening Balance */}
            <div>
              <label
                htmlFor="opening-balance"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Opening Balance
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  {currencyInfo?.symbol ?? currency}
                </span>

                <input
                  id="opening-balance"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={openingBalance}
                  onChange={(event) => setOpeningBalance(event.target.value)}
                  disabled={saving}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-12 pr-3.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50"
                />
              </div>

              <p className="mt-1.5 text-xs text-gray-400">
                Enter the amount currently available in this account.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="account-notes"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Notes
                <span className="ml-1 font-normal text-gray-400">
                  (optional)
                </span>
              </label>

              <textarea
                id="account-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add any notes about this account..."
                rows={3}
                disabled={saving}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving...
                </span>
              ) : editing ? (
                "Save Changes"
              ) : (
                "Add Account"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
