"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import type { DocumentSnapshot } from "firebase/firestore";

import ProtectedRoute from "@/app/components/auth/ProtectedRoute";
import DashboardNavigation from "@/app/components/dashboard/DashboardNavigation";
import TransactionModal from "@/app/components/transactions/TransactionModal";
import { useAuth } from "@/app/components/auth/AuthProvider";

import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "@/lib/firestore/transactions";

import type {
  CreateTransactionInput,
  Transaction,
  TransactionType,
  UpdateTransactionInput,
} from "@/types/transaction";

import { formatCurrency } from "@/lib/currency";

type FilterType = "all" | TransactionType;

type TransactionFormInput = CreateTransactionInput | UpdateTransactionInput;

export default function TransactionsPage() {
  return (
    <ProtectedRoute>
      <TransactionsContent />
    </ProtectedRoute>
  );
}

function TransactionsContent() {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [filter, setFilter] = useState<FilterType>("all");

  const [searchInput, setSearchInput] = useState("");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [hasMore, setHasMore] = useState(false);

  const [page, setPage] = useState(1);

  const [pageCursors, setPageCursors] = useState<(DocumentSnapshot | null)[]>([
    null,
  ]);

  const [lastDocument, setLastDocument] = useState<DocumentSnapshot | null>(
    null,
  );

  const [modalOpen, setModalOpen] = useState(false);

  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const loadTransactions = useCallback(
    async (cursor: DocumentSnapshot | null) => {
      if (!user) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await getTransactions({
          userId: user.uid,
          type: filter,
          search,
          lastDocument: cursor,
        });

        setTransactions(result.transactions);

        setHasMore(result.hasMore);

        setLastDocument(result.lastDocument);
      } catch (error) {
        console.error("Unable to load transactions:", error);

        setError("Unable to load transactions. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [user, filter, search],
  );

  /*
   * Reload transactions whenever
   * the filter or search changes.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    setPage(1);
    setPageCursors([null]);

    void loadTransactions(null);
  }, [user, filter, search, loadTransactions]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSearch(searchInput.trim().toLowerCase());
  }

  async function handleSave(input: TransactionFormInput) {
    if (!user) {
      return;
    }

    try {
      if (editingTransaction) {
        await updateTransaction(user.uid, editingTransaction.id, input);
      } else {
        await createTransaction(user.uid, input);
      }

      /*
       * After adding/editing, return
       * to page 1.
       */
      setPage(1);
      setPageCursors([null]);

      await loadTransactions(null);

      closeModal();
    } catch (error) {
      console.error("Unable to save transaction:", error);

      throw error;
    }
  }

  async function handleDelete(transaction: Transaction) {
    if (!user) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${transaction.title}"?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await deleteTransaction(user.uid, transaction.id);

      /*
       * Reload the current page.
       */
      await loadTransactions(pageCursors[page - 1] ?? null);

      /*
       * If deleting the last item on a page
       * leaves that page empty, go back one page.
       */
      if (page > 1 && transactions.length === 1) {
        const previousCursor = pageCursors[page - 2] ?? null;

        setPage((current) => current - 1);

        await loadTransactions(previousCursor);
      }
    } catch (error) {
      console.error("Unable to delete transaction:", error);

      setError("Unable to delete the transaction. Please try again.");
    }
  }

  async function handleNextPage() {
    if (!hasMore || !lastDocument || loading) {
      return;
    }

    const currentLastDocument = lastDocument;

    setPageCursors((current) => {
      const next = [...current];

      next[page] = currentLastDocument;

      return next;
    });

    setPage((current) => current + 1);

    await loadTransactions(currentLastDocument);
  }

  async function handlePreviousPage() {
    if (page <= 1 || loading) {
      return;
    }

    const previousCursor = pageCursors[page - 2] ?? null;

    setPage((current) => current - 1);

    await loadTransactions(previousCursor);
  }

  function openAddModal() {
    setEditingTransaction(null);
    setModalOpen(true);
  }

  function openEditModal(transaction: Transaction) {
    setEditingTransaction(transaction);
    setModalOpen(true);
  }

  function closeModal() {
    if (loading) {
      return;
    }

    setModalOpen(false);
    setEditingTransaction(null);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <DashboardNavigation />

      <main className="min-h-screen md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-8 lg:px-8">
          {/* HEADER */}

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">Manage your money</p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
                Transactions
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Track your income and expenses.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddModal}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
            >
              + Add transaction
            </button>
          </div>

          {/* FILTERS */}

          <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="grid grid-cols-3 rounded-2xl bg-gray-100 p-1 lg:w-[360px]">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    filter === "all"
                      ? "bg-white text-black shadow-sm"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  All
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("income")}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    filter === "income"
                      ? "bg-white text-green-600 shadow-sm"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  Income
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("expense")}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    filter === "expense"
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  Expense
                </button>
              </div>

              <form
                onSubmit={handleSearchSubmit}
                className="flex min-w-0 flex-1 gap-2"
              >
                <div className="relative min-w-0 flex-1">
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search transactions..."
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-black focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  className="rounded-2xl bg-gray-100 px-5 py-3 text-sm font-semibold transition hover:bg-gray-200"
                >
                  Search
                </button>
              </form>
            </div>

            {search && (
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-2.5">
                <p className="text-xs text-gray-500">
                  Searching for:{" "}
                  <span className="font-semibold text-gray-900">{search}</span>
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                  }}
                  className="text-xs font-semibold text-gray-600 hover:text-black"
                >
                  Clear
                </button>
              </div>
            )}
          </section>

          {/* ERROR */}

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* LIST */}

          <section className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
            {loading ? (
              <LoadingState />
            ) : transactions.length === 0 ? (
              <EmptyState onAdd={openAddModal} />
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {transactions.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      onEdit={() => openEditModal(transaction)}
                      onDelete={() => handleDelete(transaction)}
                    />
                  ))}
                </div>

                {/* PAGINATION */}

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

      {/* MODAL */}

      <TransactionModal
        open={modalOpen}
        transaction={editingTransaction}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  );
}

/* =========================================================
   TRANSACTION ROW
========================================================= */

function TransactionRow({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isIncome = transaction.type === "income";

  const date =
    transaction.date?.toDate?.().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) ?? "";

  return (
    <div className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          isIncome ? "bg-green-50" : "bg-red-50"
        }`}
      >
        <span
          className={`text-lg ${isIncome ? "text-green-600" : "text-red-600"}`}
        >
          {isIncome ? "↗" : "↘"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 sm:text-base">
          {transaction.title}
        </p>

        <p className="mt-1 truncate text-xs text-gray-500">
          {transaction.categoryName}
          {" · "}
          {transaction.accountName}
          {" · "}
          {date}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-bold sm:text-base ${
            isIncome ? "text-green-600" : "text-gray-900"
          }`}
        >
          {isIncome ? "+" : "-"}{" "}
          {formatCurrency(transaction.amount, transaction.currency)}
        </p>

        <div className="mt-1 flex justify-end gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-gray-500 transition hover:text-black"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="text-xs font-medium text-red-500 transition hover:text-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function LoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-black" />

        <p className="mt-3 text-sm text-gray-500">Loading transactions...</p>
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
        🧾
      </div>

      <h2 className="mt-5 text-lg font-bold text-gray-900">
        No transactions found
      </h2>

      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
        Add your first income or expense to start tracking your finances.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-5 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
      >
        + Add transaction
      </button>
    </div>
  );
}
