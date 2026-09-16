import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
  type Transaction as FirestoreTransaction,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { DEFAULT_CURRENCY } from "@/lib/currency";

import type {
  CreateTransactionInput,
  Transaction,
  TransactionType,
  UpdateTransactionInput,
} from "@/types/transaction";

const TRANSACTIONS_PER_PAGE = 10;

function transactionsCollection(userId: string) {
  return collection(db, "users", userId, "transactions");
}

function accountDocument(userId: string, accountId: string) {
  return doc(db, "users", userId, "accounts", accountId);
}

function transactionDocument(userId: string, transactionId: string) {
  return doc(db, "users", userId, "transactions", transactionId);
}

function budgetsCollection(userId: string) {
  return collection(db, "users", userId, "budgets");
}

function budgetDocument(userId: string, budgetId: string) {
  return doc(db, "users", userId, "budgets", budgetId);
}

function notificationsCollection(userId: string) {
  return collection(db, "notifications", userId, "items");
}

function createSearchKeywords(values: string[]) {
  const keywords = new Set<string>();

  for (const value of values) {
    const words = value.toLowerCase().trim().split(/\s+/).filter(Boolean);

    for (const word of words) {
      const maxLength = Math.min(word.length, 20);

      for (let i = 1; i <= maxLength; i++) {
        keywords.add(word.slice(0, i));
      }
    }
  }

  return Array.from(keywords);
}

function getBalanceEffect(type: TransactionType, amount: number) {
  return type === "income" ? amount : -amount;
}

/*
 * Returns the month key used by budgets.
 *
 * Example:
 * 2026-09-16 -> "2026-09"
 */
function getBudgetMonth(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

/*
 * Recalculate a budget's spent amount from transactions.
 *
 * This makes the budget reliable even when transactions
 * are edited or deleted.
 */
async function recalculateBudget(
  userId: string,
  categoryId: string,
  month: string,
  transaction: FirestoreTransaction,
) {
  const budgetQuery = query(
    budgetsCollection(userId),
    where("categoryId", "==", categoryId),
    where("month", "==", month),
    limit(1),
  );

  const budgetSnapshot = await getDocs(budgetQuery);

  if (budgetSnapshot.empty) {
    return;
  }

  const budgetDoc = budgetSnapshot.docs[0];

  const transactionsQuery = query(
    transactionsCollection(userId),
    where("categoryId", "==", categoryId),
  );

  const transactionsSnapshot = await getDocs(transactionsQuery);

  let spent = 0;

  for (const transactionDoc of transactionsSnapshot.docs) {
    const data = transactionDoc.data();

    if (data.type !== "expense") {
      continue;
    }

    const transactionDate = data.date?.toDate?.();

    if (!transactionDate) {
      continue;
    }

    if (getBudgetMonth(transactionDate) !== month) {
      continue;
    }

    spent += Number(data.amount ?? 0);
  }

  const budgetAmount = Number(budgetDoc.data().amount ?? 0);

  transaction.update(budgetDocument(userId, budgetDoc.id), {
    spent,
    updatedAt: serverTimestamp(),
  });

  /*
   * Create notification when the budget is exceeded.
   *
   * We create the notification only when the transaction
   * causes the budget to become overspent.
   */
  if (spent > budgetAmount) {
    const notificationRef = doc(notificationsCollection(userId));

    transaction.set(notificationRef, {
      userId,
      type: "budget_overspent",
      title: "Budget exceeded",
      message: `You've exceeded your ${budgetDoc.data().categoryName} budget by ${Math.abs(
        spent - budgetAmount,
      ).toFixed(2)}.`,
      budgetId: budgetDoc.id,
      categoryId,
      categoryName: budgetDoc.data().categoryName,
      amount: spent - budgetAmount,
      currency: budgetDoc.data().currency ?? DEFAULT_CURRENCY,
      read: false,
      createdAt: serverTimestamp(),
    });
  }
}

/* =========================================================
   CREATE TRANSACTION
========================================================= */

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
) {
  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transaction amount must be greater than zero.");
  }

  if (!input.accountId) {
    throw new Error("Please select an account.");
  }

  const transactionRef = doc(transactionsCollection(userId));
  const accountRef = accountDocument(userId, input.accountId);

  const searchKeywords = createSearchKeywords([
    input.title,
    input.categoryName,
    input.accountName,
    input.notes ?? "",
  ]);

  await runTransaction(db, async (transaction) => {
    const accountSnapshot = await transaction.get(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error("The selected account could not be found.");
    }

    const accountData = accountSnapshot.data();
    const currentBalance = Number(accountData.balance ?? 0);

    const balanceEffect = getBalanceEffect(input.type, amount);
    const newBalance = currentBalance + balanceEffect;

    transaction.set(transactionRef, {
      userId,
      type: input.type,
      title: input.title.trim(),
      amount,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      accountId: input.accountId,
      accountName: input.accountName,
      date: Timestamp.fromDate(input.date),
      notes: input.notes?.trim() ?? "",
      currency: input.currency ?? DEFAULT_CURRENCY,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      searchKeywords,
    });

    transaction.update(accountRef, {
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });

    /*
     * Only expenses affect budgets.
     */
    if (input.type === "expense") {
      const month = getBudgetMonth(input.date);

      await recalculateBudget(userId, input.categoryId, month, transaction);
    }
  });

  return transactionRef.id;
}

/* =========================================================
   UPDATE TRANSACTION
========================================================= */

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput,
) {
  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transaction amount must be greater than zero.");
  }

  if (!input.accountId) {
    throw new Error("Please select an account.");
  }

  const transactionRef = transactionDocument(userId, transactionId);
  const newAccountRef = accountDocument(userId, input.accountId);

  const searchKeywords = createSearchKeywords([
    input.title,
    input.categoryName,
    input.accountName,
    input.notes ?? "",
  ]);

  await runTransaction(db, async (transaction) => {
    const existingTransactionSnapshot = await transaction.get(transactionRef);

    if (!existingTransactionSnapshot.exists()) {
      throw new Error("Transaction not found.");
    }

    const oldData = existingTransactionSnapshot.data();

    const oldAccountId = oldData.accountId as string;
    const oldType = oldData.type as TransactionType;
    const oldAmount = Number(oldData.amount ?? 0);
    const oldCategoryId = oldData.categoryId as string;

    const oldDate = oldData.date?.toDate?.() ?? new Date();

    const oldAccountRef = accountDocument(userId, oldAccountId);

    /*
     * Update account balances.
     */
    if (oldAccountId === input.accountId) {
      const accountSnapshot = await transaction.get(oldAccountRef);

      if (!accountSnapshot.exists()) {
        throw new Error(
          "The account connected to this transaction could not be found.",
        );
      }

      const currentBalance = Number(accountSnapshot.data().balance ?? 0);

      const oldEffect = getBalanceEffect(oldType, oldAmount);
      const newEffect = getBalanceEffect(input.type, amount);

      const newBalance = currentBalance - oldEffect + newEffect;

      transaction.update(oldAccountRef, {
        balance: newBalance,
        updatedAt: serverTimestamp(),
      });
    } else {
      const oldAccountSnapshot = await transaction.get(oldAccountRef);
      const newAccountSnapshot = await transaction.get(newAccountRef);

      if (!oldAccountSnapshot.exists()) {
        throw new Error("The previous account could not be found.");
      }

      if (!newAccountSnapshot.exists()) {
        throw new Error("The new account could not be found.");
      }

      const oldBalance = Number(oldAccountSnapshot.data().balance ?? 0);
      const newBalance = Number(newAccountSnapshot.data().balance ?? 0);

      const oldEffect = getBalanceEffect(oldType, oldAmount);
      const newEffect = getBalanceEffect(input.type, amount);

      transaction.update(oldAccountRef, {
        balance: oldBalance - oldEffect,
        updatedAt: serverTimestamp(),
      });

      transaction.update(newAccountRef, {
        balance: newBalance + newEffect,
        updatedAt: serverTimestamp(),
      });
    }

    /*
     * Update the transaction itself.
     */
    transaction.update(transactionRef, {
      type: input.type,
      title: input.title.trim(),
      amount,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      accountId: input.accountId,
      accountName: input.accountName,
      date: Timestamp.fromDate(input.date),
      notes: input.notes?.trim() ?? "",
      currency: input.currency ?? DEFAULT_CURRENCY,
      updatedAt: serverTimestamp(),
      searchKeywords,
    });

    /*
     * Recalculate the OLD budget.
     *
     * This is important if the user changes:
     * - category
     * - month
     * - expense -> income
     */
    if (oldType === "expense") {
      const oldMonth = getBudgetMonth(oldDate);

      await recalculateBudget(userId, oldCategoryId, oldMonth, transaction);
    }

    /*
     * Recalculate the NEW budget.
     */
    if (input.type === "expense") {
      const newMonth = getBudgetMonth(input.date);

      await recalculateBudget(userId, input.categoryId, newMonth, transaction);
    }
  });
}

/* =========================================================
   DELETE TRANSACTION
========================================================= */

export async function deleteTransaction(userId: string, transactionId: string) {
  const transactionRef = transactionDocument(userId, transactionId);

  await runTransaction(db, async (transaction) => {
    const transactionSnapshot = await transaction.get(transactionRef);

    if (!transactionSnapshot.exists()) {
      throw new Error("Transaction not found.");
    }

    const data = transactionSnapshot.data();

    const accountId = data.accountId as string;
    const type = data.type as TransactionType;
    const amount = Number(data.amount ?? 0);
    const categoryId = data.categoryId as string;

    const transactionDate = data.date?.toDate?.() ?? new Date();

    const accountRef = accountDocument(userId, accountId);

    const accountSnapshot = await transaction.get(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error(
        "The account connected to this transaction could not be found.",
      );
    }

    const currentBalance = Number(accountSnapshot.data().balance ?? 0);

    const transactionEffect = getBalanceEffect(type, amount);

    const newBalance = currentBalance - transactionEffect;

    transaction.update(accountRef, {
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });

    transaction.delete(transactionRef);

    /*
     * Recalculate budget after deleting an expense.
     */
    if (type === "expense") {
      const month = getBudgetMonth(transactionDate);

      await recalculateBudget(userId, categoryId, month, transaction);
    }
  });
}

/* =========================================================
   NORMAL TRANSACTION PAGINATION
========================================================= */

export interface TransactionPage {
  transactions: Transaction[];
  lastDocument: DocumentSnapshot | null;
  hasMore: boolean;
}

export async function getTransactions({
  userId,
  type = "all",
  search = "",
  lastDocument = null,
}: {
  userId: string;
  type?: "all" | TransactionType;
  search?: string;
  lastDocument?: DocumentSnapshot | null;
}): Promise<TransactionPage> {
  const collectionRef = transactionsCollection(userId);

  const constraints: QueryConstraint[] = [];

  if (type !== "all") {
    constraints.push(where("type", "==", type));
  }

  const normalizedSearch = search.trim().toLowerCase();

  if (normalizedSearch) {
    constraints.push(
      where("searchKeywords", "array-contains", normalizedSearch),
    );
  }

  constraints.push(orderBy("createdAt", "desc"));

  if (lastDocument) {
    constraints.push(startAfter(lastDocument));
  }

  constraints.push(limit(TRANSACTIONS_PER_PAGE + 1));

  const transactionQuery = query(collectionRef, ...constraints);

  const snapshot = await getDocs(transactionQuery);

  const hasMore = snapshot.docs.length > TRANSACTIONS_PER_PAGE;

  const documents = snapshot.docs.slice(0, TRANSACTIONS_PER_PAGE);

  const transactions: Transaction[] = documents.map((item) => {
    const data = item.data();

    return {
      id: item.id,
      userId: data.userId,
      type: data.type,
      title: data.title,
      amount: Number(data.amount ?? 0),
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      accountId: data.accountId,
      accountName: data.accountName,
      date: data.date,
      notes: data.notes ?? "",
      currency: data.currency ?? DEFAULT_CURRENCY,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      searchKeywords: data.searchKeywords ?? [],
    };
  });

  return {
    transactions,
    lastDocument: documents.length > 0 ? documents[documents.length - 1] : null,
    hasMore,
  };
}

/* =========================================================
   REPORT TRANSACTION PAGINATION
========================================================= */

export interface ReportTransactionPage {
  transactions: Transaction[];
  lastDocument: DocumentSnapshot | null;
  hasMore: boolean;
}

export async function getReportTransactions({
  userId,
  from,
  to,
  lastDocument = null,
}: {
  userId: string;
  from: Date;
  to: Date;
  lastDocument?: DocumentSnapshot | null;
}): Promise<ReportTransactionPage> {
  const collectionRef = transactionsCollection(userId);

  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const constraints: QueryConstraint[] = [
    where("date", ">=", Timestamp.fromDate(fromDate)),
    where("date", "<=", Timestamp.fromDate(toDate)),
    orderBy("date", "desc"),
  ];

  if (lastDocument) {
    constraints.push(startAfter(lastDocument));
  }

  constraints.push(limit(TRANSACTIONS_PER_PAGE + 1));

  const reportQuery = query(collectionRef, ...constraints);

  const snapshot = await getDocs(reportQuery);

  const hasMore = snapshot.docs.length > TRANSACTIONS_PER_PAGE;

  const documents = snapshot.docs.slice(0, TRANSACTIONS_PER_PAGE);

  const transactions: Transaction[] = documents.map((item) => {
    const data = item.data();

    return {
      id: item.id,
      userId: data.userId,
      type: data.type,
      title: data.title,
      amount: Number(data.amount ?? 0),
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      accountId: data.accountId,
      accountName: data.accountName,
      date: data.date,
      notes: data.notes ?? "",
      currency: data.currency ?? DEFAULT_CURRENCY,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      searchKeywords: data.searchKeywords ?? [],
    };
  });

  return {
    transactions,
    lastDocument: documents.length > 0 ? documents[documents.length - 1] : null,
    hasMore,
  };
}
