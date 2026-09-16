import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
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

/* =========================================================
   REFERENCES
========================================================= */

function transactionsCollection(userId: string) {
  return collection(db, "users", userId, "transactions");
}

function transactionDocument(userId: string, transactionId: string) {
  return doc(db, "users", userId, "transactions", transactionId);
}

function accountDocument(userId: string, accountId: string) {
  return doc(db, "users", userId, "accounts", accountId);
}

/* =========================================================
   SEARCH
========================================================= */

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

/* =========================================================
   BALANCE
========================================================= */

function getBalanceEffect(type: TransactionType, amount: number) {
  return type === "income" ? amount : -amount;
}

/* =========================================================
   MAP TRANSACTION
========================================================= */

function mapTransaction(item: DocumentSnapshot): Transaction {
  const data = item.data();

  if (!data) {
    throw new Error("Transaction data is missing.");
  }

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
}

/* =========================================================
   CREATE
========================================================= */

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
) {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transaction amount must be greater than zero.");
  }

  if (!input.accountId) {
    throw new Error("Please select an account.");
  }

  if (!input.title?.trim()) {
    throw new Error("Please enter a transaction title.");
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

    const currentBalance = Number(accountSnapshot.data().balance ?? 0);

    const balanceEffect = getBalanceEffect(input.type, amount);

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
      balance: currentBalance + balanceEffect,
      updatedAt: serverTimestamp(),
    });
  });

  return transactionRef.id;
}

/* =========================================================
   UPDATE
========================================================= */

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput,
) {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transaction amount must be greater than zero.");
  }

  if (!input.accountId) {
    throw new Error("Please select an account.");
  }

  if (!input.title?.trim()) {
    throw new Error("Please enter a transaction title.");
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
    const existingSnapshot = await transaction.get(transactionRef);

    if (!existingSnapshot.exists()) {
      throw new Error("Transaction not found.");
    }

    const oldData = existingSnapshot.data();

    const oldAccountId = String(oldData.accountId);

    const oldType = oldData.type as TransactionType;

    const oldAmount = Number(oldData.amount ?? 0);

    const oldAccountRef = accountDocument(userId, oldAccountId);

    /* SAME ACCOUNT */

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

      transaction.update(oldAccountRef, {
        balance: currentBalance - oldEffect + newEffect,
        updatedAt: serverTimestamp(),
      });
    } else {
      /* DIFFERENT ACCOUNT */

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
  });
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteTransaction(userId: string, transactionId: string) {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const transactionRef = transactionDocument(userId, transactionId);

  await runTransaction(db, async (transaction) => {
    const transactionSnapshot = await transaction.get(transactionRef);

    if (!transactionSnapshot.exists()) {
      throw new Error("Transaction not found.");
    }

    const data = transactionSnapshot.data();

    const accountId = String(data.accountId);

    const type = data.type as TransactionType;

    const amount = Number(data.amount ?? 0);

    const accountRef = accountDocument(userId, accountId);

    const accountSnapshot = await transaction.get(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error(
        "The account connected to this transaction could not be found.",
      );
    }

    const currentBalance = Number(accountSnapshot.data().balance ?? 0);

    const effect = getBalanceEffect(type, amount);

    transaction.update(accountRef, {
      balance: currentBalance - effect,
      updatedAt: serverTimestamp(),
    });

    transaction.delete(transactionRef);
  });
}

/* =========================================================
   NORMAL TRANSACTIONS
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
  if (!userId) {
    throw new Error("You must be signed in.");
  }

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

  return {
    transactions: documents.map(mapTransaction),

    lastDocument: documents.length > 0 ? documents[documents.length - 1] : null,

    hasMore,
  };
}

/* =========================================================
   REPORT TRANSACTIONS
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
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const collectionRef = transactionsCollection(userId);

  const fromDate = new Date(from);

  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(to);

  toDate.setDate(toDate.getDate() + 1);
  toDate.setHours(0, 0, 0, 0);

  const constraints: QueryConstraint[] = [
    where("date", ">=", Timestamp.fromDate(fromDate)),

    where("date", "<", Timestamp.fromDate(toDate)),

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

  return {
    transactions: documents.map(mapTransaction),

    lastDocument: documents.length > 0 ? documents[documents.length - 1] : null,

    hasMore,
  };
}

/* =========================================================
   EXPENSE TRANSACTIONS FOR MONTH
========================================================= */

export async function getExpenseTransactionsForMonth({
  userId,
  from,
  to,
}: {
  userId: string;
  from: Date;
  to: Date;
}): Promise<Transaction[]> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const collectionRef = transactionsCollection(userId);

  const fromDate = new Date(from);

  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(to);

  toDate.setHours(23, 59, 59, 999);

  const transactionQuery = query(
    collectionRef,

    where("type", "==", "expense"),

    where("date", ">=", Timestamp.fromDate(fromDate)),

    where("date", "<=", Timestamp.fromDate(toDate)),

    orderBy("date", "desc"),
  );

  const snapshot = await getDocs(transactionQuery);

  return snapshot.docs.map(mapTransaction);
}
