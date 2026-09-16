"use client";

import { useCallback, useEffect, useState } from "react";

import type { DocumentSnapshot } from "firebase/firestore";

import ProtectedRoute from "@/app/components/auth/ProtectedRoute";
import DashboardNavigation from "@/app/components/dashboard/DashboardNavigation";
import AccountModal from "@/app/components/accounts/AccountModal";
import { useAuth } from "@/app/components/auth/AuthProvider";

import {
  createAccount,
  deleteAccount,
  getAccounts,
  updateAccount,
} from "@/lib/firestore/accounts";

import type { Account, CreateAccountInput } from "@/types/account";

import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";
import { getUserCurrency } from "@/lib/auth";

export default function AccountsPage() {
  return (
    <ProtectedRoute>
      <AccountsContent />
    </ProtectedRoute>
  );
}

function AccountsContent() {
  const { user } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [page, setPage] = useState(1);

  const [hasMore, setHasMore] = useState(false);

  const [lastDocument, setLastDocument] = useState<DocumentSnapshot | null>(
    null,
  );

  const [pageCursors, setPageCursors] = useState<(DocumentSnapshot | null)[]>([
    null,
  ]);

  const [modalOpen, setModalOpen] = useState(false);

  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Currency selected in Settings
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  /*
   * Load the user's currency from Settings.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    async function loadCurrency() {
      try {
        const savedCurrency = await getUserCurrency();

        setCurrency(savedCurrency);
      } catch (error) {
        console.error("Failed to load currency:", error);

        setCurrency(DEFAULT_CURRENCY);
      }
    }

    loadCurrency();
  }, [user]);

  const loadAccounts = useCallback(
    async (cursor: DocumentSnapshot | null) => {
      if (!user) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await getAccounts({
          userId: user.uid,
          lastDocument: cursor,
        });

        setAccounts(result.accounts);

        setHasMore(result.hasMore);

        setLastDocument(result.lastDocument);
      } catch (error) {
        console.error(error);

        setError("Unable to load accounts. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    setPage(1);
    setPageCursors([null]);

    loadAccounts(null);
  }, [user, loadAccounts]);

  const filteredAccounts = accounts.filter((account) =>
    account.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalBalance = filteredAccounts.reduce(
    (total, account) => total + account.balance,
    0,
  );

  async function handleSave(input: CreateAccountInput) {
    if (!user) {
      return;
    }

    try {
      if (editingAccount) {
        await updateAccount(user.uid, editingAccount.id, input);
      } else {
        await createAccount(user.uid, input);
      }

      setPage(1);
      setPageCursors([null]);

      await loadAccounts(null);
    } catch (error) {
      console.error("Unable to save account:", error);

      throw error;
    }
  }

  async function handleDelete(account: Account) {
    if (!user) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${account.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteAccount(user.uid, account.id);

      await loadAccounts(pageCursors[page - 1] ?? null);
    } catch (error) {
      console.error(error);

      setError("Unable to delete the account.");
    }
  }

  async function handleNextPage() {
    if (!hasMore || !lastDocument) {
      return;
    }

    const cursor = lastDocument;

    setPageCursors((current) => {
      const next = [...current];

      next[page] = cursor;

      return next;
    });

    setPage((current) => current + 1);

    await loadAccounts(cursor);
  }

  async function handlePreviousPage() {
    if (page <= 1) {
      return;
    }

    const cursor = pageCursors[page - 2] ?? null;

    setPage((current) => current - 1);

    await loadAccounts(cursor);
  }

  function openAddModal() {
    setEditingAccount(null);
    setModalOpen(true);
  }

  function openEditModal(account: Account) {
    setEditingAccount(account);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingAccount(null);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <DashboardNavigation />

      <main className="min-h-screen md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-8 lg:px-8">
          {/* Header */}

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">Manage your money</p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
                Accounts
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Manage your cash, banks, cards and wallets.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddModal}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
            >
              + Add account
            </button>
          </div>

          {/* Summary */}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-black p-5 text-white shadow-sm">
              <p className="text-sm text-white/60">Total balance</p>

              <p className="mt-2 text-3xl font-bold">
                {formatCurrency(totalBalance, currency)}
              </p>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <p className="text-sm text-gray-500">Accounts</p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {filteredAccounts.length}
              </p>
            </div>
          </div>

          {/* Search */}

          <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search accounts..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-black focus:bg-white"
            />
          </section>

          {/* Error */}

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Account list */}

          <section className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            {loading ? (
              <LoadingState />
            ) : filteredAccounts.length === 0 ? (
              <EmptyState onAdd={openAddModal} />
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {filteredAccounts.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      currency={currency}
                      onEdit={() => openEditModal(account)}
                      onDelete={() => handleDelete(account)}
                    />
                  ))}
                </div>

                {/* Pagination */}

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
        </div>
      </main>

      {/* Modal */}

      <AccountModal
        open={modalOpen}
        account={editingAccount}
        currency={currency}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  );
}

/* =========================================================
   ACCOUNT ROW
========================================================= */

function AccountRow({
  account,
  currency,
  onEdit,
  onDelete,
}: {
  account: Account;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accountTypeLabel = getAccountTypeLabel(account.type);

  return (
    <div className="flex items-center gap-3 px-4 py-5 sm:gap-4 sm:px-6">
      {/* Icon */}

      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-lg">
        {getAccountIcon(account.type)}
      </div>

      {/* Info */}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 sm:text-base">
          {account.name}
        </p>

        <p className="mt-1 text-xs text-gray-500">{accountTypeLabel}</p>
      </div>

      {/* Balance */}

      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-bold sm:text-base ${
            account.balance < 0 ? "text-red-600" : "text-gray-900"
          }`}
        >
          {formatCurrency(account.balance, currency)}
        </p>

        <div className="mt-1 flex justify-end gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-gray-500 hover:text-black"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="text-xs font-medium text-red-500 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function getAccountTypeLabel(type: Account["type"]) {
  switch (type) {
    case "cash":
      return "Cash";

    case "bank":
      return "Bank Account";

    case "card":
      return "Credit / Debit Card";

    case "wallet":
      return "Digital Wallet";

    case "savings":
      return "Savings";

    default:
      return "Other";
  }
}

function getAccountIcon(type: Account["type"]) {
  switch (type) {
    case "cash":
      return "💵";

    case "bank":
      return "🏦";

    case "card":
      return "💳";

    case "wallet":
      return "📱";

    case "savings":
      return "🐷";

    default:
      return "💰";
  }
}

/* =========================================================
   LOADING
========================================================= */

function LoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-black" />

        <p className="mt-3 text-sm text-gray-500">Loading accounts...</p>
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY
========================================================= */

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100 text-2xl">
        💰
      </div>

      <h2 className="mt-5 text-lg font-bold text-gray-900">
        No accounts found
      </h2>

      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
        Add your first account to start managing your money.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-5 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
      >
        + Add account
      </button>
    </div>
  );
}
