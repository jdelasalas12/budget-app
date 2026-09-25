"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ProtectedRoute from "@/app/components/auth/ProtectedRoute";
import DashboardNavigation from "@/app/components/dashboard/DashboardNavigation";
import { useAuth } from "@/app/components/auth/AuthProvider";

import {
  createBill,
  deleteBill,
  getBills,
  getOverdueBills,
  getUpcomingBills,
  markBillAsPaid,
  updateBill,
} from "@/lib/firestore/bill";

import { getAccounts } from "@/lib/firestore/accounts";
import { getUserCurrency } from "@/lib/auth";
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency";

import type { Account } from "@/types/account";
import type { Bill, BillFrequency, CreateBillInput } from "@/types/bill";

const categories = [
  { id: "Bills", name: "Bills" },
  { id: "Housing", name: "Housing" },
  { id: "Utilities", name: "Utilities" },
  { id: "Food", name: "Food" },
  { id: "Transportation", name: "Transportation" },
  { id: "Shopping", name: "Shopping" },
  { id: "Entertainment", name: "Entertainment" },
  { id: "Health", name: "Health" },
  { id: "Business", name: "Business" },
  { id: "Other", name: "Other" },
];

export default function BillsPage() {
  return (
    <ProtectedRoute>
      <BillsContent />
    </ProtectedRoute>
  );
}

function BillsContent() {
  const { user } = useAuth();

  const [bills, setBills] = useState<Bill[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [overdueBills, setOverdueBills] = useState<Bill[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingPayment, setProcessingPayment] = useState<string | null>(
    null,
  );

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setBills([]);
      setUpcomingBills([]);
      setOverdueBills([]);
      setAccounts([]);
      setCurrency(DEFAULT_CURRENCY);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [billPage, upcoming, overdue, userCurrency, accountPage] =
        await Promise.all([
          getBills({
            userId: user.uid,
            search,
          }),

          getUpcomingBills({
            userId: user.uid,
            limitCount: 5,
          }),

          getOverdueBills({
            userId: user.uid,
            limitCount: 5,
          }),

          getUserCurrency(),

          getAccounts({
            userId: user.uid,
          }),
        ]);

      setBills(billPage.bills);
      setUpcomingBills(upcoming);
      setOverdueBills(overdue);
      setAccounts(accountPage.accounts);
      setCurrency(userCurrency || DEFAULT_CURRENCY);
    } catch (error) {
      console.error("Unable to load bills:", error);

      setError(
        error instanceof Error ? error.message : "Unable to load your bills.",
      );
    } finally {
      setLoading(false);
    }
  }, [user, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const unpaidBills = useMemo(() => {
    return bills.filter((bill) => !bill.paidAt);
  }, [bills]);

  const paidBills = useMemo(() => {
    return bills.filter((bill) => Boolean(bill.paidAt));
  }, [bills]);

  const totalUnpaid = useMemo(() => {
    return unpaidBills
      .filter((bill) => (bill.currency || DEFAULT_CURRENCY) === currency)
      .reduce((total, bill) => total + Number(bill.amount ?? 0), 0);
  }, [unpaidBills, currency]);

  const totalPaid = useMemo(() => {
    return paidBills
      .filter((bill) => (bill.currency || DEFAULT_CURRENCY) === currency)
      .reduce((total, bill) => total + Number(bill.amount ?? 0), 0);
  }, [paidBills, currency]);

  async function handleSave(input: CreateBillInput) {
    if (!user) {
      setError("You must be signed in.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingBill) {
        await updateBill(user.uid, editingBill.id, input);
      } else {
        await createBill(user.uid, input);
      }

      await loadData();

      setModalOpen(false);
      setEditingBill(null);
    } catch (error) {
      console.error("Unable to save bill:", error);

      setError(
        error instanceof Error ? error.message : "Unable to save the bill.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bill: Bill) {
    if (!user) {
      setError("You must be signed in.");
      return;
    }

    const confirmed = window.confirm(`Delete "${bill.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await deleteBill(user.uid, bill.id);

      setBills((current) => current.filter((item) => item.id !== bill.id));

      setUpcomingBills((current) =>
        current.filter((item) => item.id !== bill.id),
      );

      setOverdueBills((current) =>
        current.filter((item) => item.id !== bill.id),
      );
    } catch (error) {
      console.error("Unable to delete bill:", error);

      setError(
        error instanceof Error ? error.message : "Unable to delete the bill.",
      );
    }
  }

  async function handleMarkAsPaid(bill: Bill) {
    if (!user) {
      setError("You must be signed in.");
      return;
    }

    const confirmed = window.confirm(
      `Mark "${bill.title}" as paid? This will create an expense transaction and update the account balance.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingPayment(bill.id);
      setError("");

      await markBillAsPaid(user.uid, bill.id);

      await loadData();
    } catch (error) {
      console.error("Unable to mark bill as paid:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to mark the bill as paid.",
      );
    } finally {
      setProcessingPayment(null);
    }
  }

  function openAddModal() {
    setEditingBill(null);
    setModalOpen(true);
  }

  function openEditModal(bill: Bill) {
    setEditingBill(bill);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingBill(null);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <DashboardNavigation />

      <main className="min-h-screen md:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-8 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Stay on top of recurring payments
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-950">
                Bills
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Track upcoming, overdue, and paid bills.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddModal}
              className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              + Add bill
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Find a bill</h2>

                <p className="mt-1 text-sm text-gray-500">
                  Search by title, category, account, or notes.
                </p>
              </div>

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search bills..."
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-black focus:bg-white sm:max-w-xs"
              />
            </div>
          </section>

          {loading ? (
            <LoadingState />
          ) : (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <SummaryCard
                  title={`Unpaid (${currency})`}
                  value={formatCurrency(totalUnpaid, currency)}
                  color="red"
                />

                <SummaryCard
                  title={`Paid (${currency})`}
                  value={formatCurrency(totalPaid, currency)}
                  color="green"
                />

                <SummaryCard
                  title="Total bills"
                  value={String(bills.length)}
                  color="blue"
                />
              </div>

              {overdueBills.length > 0 && (
                <section className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-red-100">
                  <div className="border-b border-red-100 px-5 py-5 sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Overdue
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                          These bills have passed their due date.
                        </p>
                      </div>

                      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                        {overdueBills.length}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {overdueBills.map((bill) => (
                      <BillRow
                        key={bill.id}
                        bill={bill}
                        processingPayment={processingPayment}
                        onEdit={openEditModal}
                        onDelete={handleDelete}
                        onMarkAsPaid={handleMarkAsPaid}
                        overdue
                      />
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Upcoming
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Your next bills based on their due dates.
                      </p>
                    </div>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      {upcomingBills.length}
                    </span>
                  </div>
                </div>

                {upcomingBills.length === 0 ? (
                  <EmptyState
                    title="No upcoming bills"
                    description="You don't have any unpaid upcoming bills."
                    onAdd={openAddModal}
                  />
                ) : (
                  <div className="divide-y divide-gray-100">
                    {upcomingBills.map((bill) => (
                      <BillRow
                        key={bill.id}
                        bill={bill}
                        processingPayment={processingPayment}
                        onEdit={openEditModal}
                        onDelete={handleDelete}
                        onMarkAsPaid={handleMarkAsPaid}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-4 rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    All bills
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Manage your saved bills.
                  </p>
                </div>

                {bills.length === 0 ? (
                  <EmptyState
                    title="No bills yet"
                    description="Create your first bill to start tracking recurring payments."
                    onAdd={openAddModal}
                  />
                ) : (
                  <div className="divide-y divide-gray-100">
                    {bills.map((bill) => (
                      <BillRow
                        key={bill.id}
                        bill={bill}
                        processingPayment={processingPayment}
                        onEdit={openEditModal}
                        onDelete={handleDelete}
                        onMarkAsPaid={handleMarkAsPaid}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <BillModal
        open={modalOpen}
        bill={editingBill}
        accounts={accounts}
        defaultCurrency={currency}
        saving={saving}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  );
}

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

function BillRow({
  bill,
  processingPayment,
  onEdit,
  onDelete,
  onMarkAsPaid,
  overdue = false,
}: {
  bill: Bill;
  processingPayment: string | null;
  onEdit: (bill: Bill) => void;
  onDelete: (bill: Bill) => void;
  onMarkAsPaid: (bill: Bill) => void;
  overdue?: boolean;
}) {
  const amount = Number(bill.amount ?? 0);
  const billCurrency = bill.currency || DEFAULT_CURRENCY;
  const isPaid = Boolean(bill.paidAt);
  const dueDate = bill.dueDate.toDate();

  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-gray-900">
              {bill.title}
            </h3>

            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
              {billCurrency}
            </span>

            {isPaid && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
                Paid
              </span>
            )}

            {!isPaid && overdue && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                Overdue
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-gray-500">
            {bill.categoryName} · {bill.accountName}
          </p>

          <p
            className={`mt-2 text-xs ${
              overdue && !isPaid
                ? "font-semibold text-red-600"
                : "text-gray-400"
            }`}
          >
            Due{" "}
            {dueDate.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            {formatFrequency(bill.frequency)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <p className="text-lg font-bold text-gray-950">
            {formatCurrency(amount, billCurrency)}
          </p>

          <div className="flex flex-wrap gap-3">
            {!isPaid && (
              <button
                type="button"
                onClick={() => onMarkAsPaid(bill)}
                disabled={processingPayment === bill.id}
                className="rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processingPayment === bill.id ? "Processing..." : "Mark paid"}
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(bill)}
              className="text-xs font-medium text-gray-500 transition hover:text-black"
            >
              Edit
            </button>

            <button
              type="button"
              onClick={() => onDelete(bill)}
              className="text-xs font-medium text-red-500 transition hover:text-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {bill.notes && (
        <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-xs text-gray-500">
          {bill.notes}
        </div>
      )}
    </div>
  );
}

function BillModal({
  open,
  bill,
  accounts,
  defaultCurrency,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  bill: Bill | null;
  accounts: Account[];
  defaultCurrency: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: CreateBillInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const [categoryId, setCategoryId] = useState("Bills");
  const [categoryName, setCategoryName] = useState("Bills");

  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");

  const [dueDate, setDueDate] = useState("");
  const [frequency, setFrequency] = useState<BillFrequency>("monthly");

  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);

  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setValidationError("");

    if (bill) {
      setTitle(bill.title);
      setAmount(String(bill.amount));

      setCategoryId(bill.categoryId);
      setCategoryName(bill.categoryName);

      setAccountId(bill.accountId);
      setAccountName(bill.accountName);

      setDueDate(formatDateForInput(bill.dueDate.toDate()));

      setFrequency(bill.frequency);
      setNotes(bill.notes || "");
      setCurrency(bill.currency || defaultCurrency);
    } else {
      setTitle("");
      setAmount("");

      setCategoryId("Bills");
      setCategoryName("Bills");

      setAccountId("");
      setAccountName("");

      setDueDate(formatDateForInput(new Date()));

      setFrequency("monthly");
      setNotes("");
      setCurrency(defaultCurrency);
    }
  }, [open, bill, defaultCurrency]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setValidationError("");

    const numericAmount = Number(amount);

    if (!title.trim()) {
      setValidationError("Please enter a bill title.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setValidationError("Bill amount must be greater than zero.");
      return;
    }

    if (!categoryId || !categoryName) {
      setValidationError("Please select a category.");
      return;
    }

    if (!accountId || !accountName) {
      setValidationError("Please select an account.");
      return;
    }

    if (!dueDate) {
      setValidationError("Please select a due date.");
      return;
    }

    if (!currency) {
      setValidationError("Please select a currency.");
      return;
    }

    await onSave({
      title: title.trim(),
      amount: numericAmount,

      categoryId,
      categoryName,

      accountId,
      accountName,

      dueDate: new Date(`${dueDate}T00:00:00`),

      frequency,

      notes: notes.trim(),

      currency,
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-950">
              {bill ? "Edit Bill" : "Add Bill"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Add the details for this bill.
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
          <div>
            <label
              htmlFor="bill-title"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Bill title
            </label>

            <input
              id="bill-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Internet bill"
              required
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="bill-amount"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Amount
            </label>

            <div className="flex overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 focus-within:border-black">
              <div className="flex items-center border-r border-gray-200 bg-gray-100 px-4 text-sm font-bold text-gray-700">
                {currency}
              </div>

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
                className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none disabled:opacity-60"
              />
            </div>
          </div>

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
              onChange={(event) => {
                const selected = categories.find(
                  (item) => item.id === event.target.value,
                );

                setCategoryId(event.target.value);
                setCategoryName(selected?.name || event.target.value);
              }}
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:opacity-60"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="bill-account"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Account
            </label>

            <select
              id="bill-account"
              value={accountId}
              onChange={(event) => {
                const selectedAccount = accounts.find(
                  (account) => account.id === event.target.value,
                );

                if (!selectedAccount) {
                  setAccountId("");
                  setAccountName("");
                  setCurrency(defaultCurrency);
                  return;
                }

                setAccountId(selectedAccount.id);
                setAccountName(selectedAccount.name);
                setCurrency(selectedAccount.currency || defaultCurrency);
              }}
              required
              disabled={saving || accounts.length === 0}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:opacity-60"
            >
              <option value="">Select an account</option>

              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>

            {accounts.length === 0 && (
              <p className="mt-2 text-xs text-red-500">
                You need to create an account before adding a bill.
              </p>
            )}

            {accountId && (
              <p className="mt-2 text-xs text-gray-400">
                Currency:{" "}
                <span className="font-semibold text-gray-600">{currency}</span>
              </p>
            )}
          </div>

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
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:opacity-60"
            />
          </div>

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
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:opacity-60"
            >
              <option value="one-time">One-time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

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
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-black focus:bg-white disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="bill-currency"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Currency
            </label>

            <input
              id="bill-currency"
              type="text"
              value={currency}
              readOnly
              disabled={saving}
              className="w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 uppercase outline-none disabled:opacity-60"
            />

            <p className="mt-2 text-xs text-gray-400">
              Bills use the currency of the selected account.
            </p>
          </div>

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
              disabled={saving || accounts.length === 0}
              className="flex-1 rounded-2xl bg-black px-4 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : bill ? "Save changes" : "Add bill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  onAdd,
}: {
  title: string;
  description: string;
  onAdd: () => void;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-xl">
        🧾
      </div>

      <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>

      <p className="mt-1 text-sm text-gray-500">{description}</p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-5 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
      >
        + Add bill
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-3xl bg-white" />
        ))}
      </div>

      <div className="h-80 animate-pulse rounded-3xl bg-white" />

      <div className="h-80 animate-pulse rounded-3xl bg-white" />
    </div>
  );
}

function formatFrequency(frequency: BillFrequency) {
  switch (frequency) {
    case "one-time":
      return "One-time";

    case "weekly":
      return "Repeats weekly";

    case "monthly":
      return "Repeats monthly";

    case "yearly":
      return "Repeats yearly";

    default:
      return frequency;
  }
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
