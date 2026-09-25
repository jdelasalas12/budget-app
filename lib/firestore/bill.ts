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
  updateDoc,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { DEFAULT_CURRENCY } from "@/lib/currency";

import type {
  Bill,
  BillFrequency,
  CreateBillInput,
  UpdateBillInput,
} from "@/types/bill";

import type { TransactionType } from "@/types/transaction";

const BILLS_PER_PAGE = 10;

/* =========================================================
   REFERENCES
========================================================= */

function billsCollection(userId: string) {
  return collection(db, "users", userId, "bills");
}

function billDocument(userId: string, billId: string) {
  return doc(db, "users", userId, "bills", billId);
}

function accountDocument(userId: string, accountId: string) {
  return doc(db, "users", userId, "accounts", accountId);
}

function transactionDocument(userId: string, transactionId: string) {
  return doc(db, "users", userId, "transactions", transactionId);
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
   MAP BILL
========================================================= */

function mapBill(item: DocumentSnapshot): Bill {
  const data = item.data();

  if (!data) {
    throw new Error("Bill data is missing.");
  }

  return {
    id: item.id,

    userId: data.userId,

    title: data.title ?? "",

    amount: Number(data.amount ?? 0),

    categoryId: data.categoryId ?? "",
    categoryName: data.categoryName ?? "",

    accountId: data.accountId ?? "",
    accountName: data.accountName ?? "",

    dueDate: data.dueDate,

    frequency: data.frequency as BillFrequency,

    notes: data.notes ?? "",

    currency: data.currency ?? DEFAULT_CURRENCY,

    paidAt: data.paidAt ?? undefined,

    transactionId: data.transactionId ?? undefined,

    createdAt: data.createdAt,

    updatedAt: data.updatedAt,

    searchKeywords: data.searchKeywords ?? [],
  };
}

/* =========================================================
   CREATE
========================================================= */

export async function createBill(
  userId: string,
  input: CreateBillInput,
): Promise<string> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Bill amount must be greater than zero.");
  }

  if (!input.title?.trim()) {
    throw new Error("Please enter a bill title.");
  }

  if (!input.categoryId) {
    throw new Error("Please select a category.");
  }

  if (!input.accountId) {
    throw new Error("Please select an account.");
  }

  if (!input.dueDate || Number.isNaN(input.dueDate.getTime())) {
    throw new Error("Please select a valid due date.");
  }

  if (!input.frequency) {
    throw new Error("Please select a bill frequency.");
  }

  const searchKeywords = createSearchKeywords([
    input.title,
    input.categoryName,
    input.accountName,
    input.notes ?? "",
  ]);

  const billRef = doc(billsCollection(userId));

  await runTransaction(db, async (transaction) => {
    const accountRef = accountDocument(userId, input.accountId);

    const accountSnapshot = await transaction.get(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error("The selected account could not be found.");
    }

    const accountData = accountSnapshot.data();

    const accountCurrency =
      accountData.currency || input.currency || DEFAULT_CURRENCY;

    transaction.set(billRef, {
      userId,

      title: input.title.trim(),

      amount,

      categoryId: input.categoryId,
      categoryName: input.categoryName,

      accountId: input.accountId,
      accountName: input.accountName,

      dueDate: Timestamp.fromDate(input.dueDate),

      frequency: input.frequency,

      notes: input.notes?.trim() ?? "",

      currency: accountCurrency,

      paidAt: null,
      transactionId: null,

      searchKeywords,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return billRef.id;
}

/* =========================================================
   UPDATE
========================================================= */

export async function updateBill(
  userId: string,
  billId: string,
  input: UpdateBillInput,
): Promise<void> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  if (!billId) {
    throw new Error("Bill ID is required.");
  }

  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Bill amount must be greater than zero.");
  }

  if (!input.title?.trim()) {
    throw new Error("Please enter a bill title.");
  }

  if (!input.categoryId) {
    throw new Error("Please select a category.");
  }

  if (!input.accountId) {
    throw new Error("Please select an account.");
  }

  if (!input.dueDate || Number.isNaN(input.dueDate.getTime())) {
    throw new Error("Please select a valid due date.");
  }

  if (!input.frequency) {
    throw new Error("Please select a bill frequency.");
  }

  const billRef = billDocument(userId, billId);

  await runTransaction(db, async (transaction) => {
    const billSnapshot = await transaction.get(billRef);

    if (!billSnapshot.exists()) {
      throw new Error("Bill not found.");
    }

    const accountRef = accountDocument(userId, input.accountId);

    const accountSnapshot = await transaction.get(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error("The selected account could not be found.");
    }

    const accountCurrency =
      accountSnapshot.data().currency || input.currency || DEFAULT_CURRENCY;

    const searchKeywords = createSearchKeywords([
      input.title,
      input.categoryName,
      input.accountName,
      input.notes ?? "",
    ]);

    transaction.update(billRef, {
      title: input.title.trim(),

      amount,

      categoryId: input.categoryId,
      categoryName: input.categoryName,

      accountId: input.accountId,
      accountName: input.accountName,

      dueDate: Timestamp.fromDate(input.dueDate),

      frequency: input.frequency,

      notes: input.notes?.trim() ?? "",

      currency: accountCurrency,

      searchKeywords,

      updatedAt: serverTimestamp(),
    });
  });
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteBill(
  userId: string,
  billId: string,
): Promise<void> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  if (!billId) {
    throw new Error("Bill ID is required.");
  }

  const billRef = billDocument(userId, billId);

  await runTransaction(db, async (transaction) => {
    const billSnapshot = await transaction.get(billRef);

    if (!billSnapshot.exists()) {
      throw new Error("Bill not found.");
    }

    const bill = mapBill(billSnapshot);

    /*
     * Do not allow deletion while the bill still has
     * a linked payment transaction.
     *
     * This prevents the account balance from becoming
     * inconsistent.
     */
    if (bill.transactionId) {
      throw new Error(
        "This bill has a payment transaction. Mark it as unpaid before deleting it.",
      );
    }

    transaction.delete(billRef);
  });
}

/* =========================================================
   GET BILLS
========================================================= */

export interface BillPage {
  bills: Bill[];
  lastDocument: DocumentSnapshot | null;
  hasMore: boolean;
}

export async function getBills({
  userId,
  search = "",
  lastDocument = null,
}: {
  userId: string;
  search?: string;
  lastDocument?: DocumentSnapshot | null;
}): Promise<BillPage> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const collectionRef = billsCollection(userId);

  const constraints: QueryConstraint[] = [];

  const normalizedSearch = search.trim().toLowerCase();

  if (normalizedSearch) {
    constraints.push(
      where("searchKeywords", "array-contains", normalizedSearch),
    );
  }

  constraints.push(orderBy("dueDate", "asc"));

  if (lastDocument) {
    constraints.push(startAfter(lastDocument));
  }

  constraints.push(limit(BILLS_PER_PAGE + 1));

  const billsQuery = query(collectionRef, ...constraints);

  const snapshot = await getDocs(billsQuery);

  const hasMore = snapshot.docs.length > BILLS_PER_PAGE;

  const documents = snapshot.docs.slice(0, BILLS_PER_PAGE);

  return {
    bills: documents.map(mapBill),

    lastDocument: documents.length > 0 ? documents[documents.length - 1] : null,

    hasMore,
  };
}

/* =========================================================
   UPCOMING BILLS
========================================================= */

export async function getUpcomingBills({
  userId,
  limitCount = 5,
}: {
  userId: string;
  limitCount?: number;
}): Promise<Bill[]> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const now = Timestamp.now();

  const billsQuery = query(
    billsCollection(userId),
    where("dueDate", ">=", now),
    orderBy("dueDate", "asc"),
    limit(limitCount),
  );

  const snapshot = await getDocs(billsQuery);

  return snapshot.docs.map(mapBill);
}

/* =========================================================
   OVERDUE BILLS
========================================================= */

export async function getOverdueBills({
  userId,
  limitCount = 5,
}: {
  userId: string;
  limitCount?: number;
}): Promise<Bill[]> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const now = Timestamp.now();

  const billsQuery = query(
    billsCollection(userId),
    where("dueDate", "<", now),
    orderBy("dueDate", "asc"),
    limit(limitCount),
  );

  const snapshot = await getDocs(billsQuery);

  return snapshot.docs.map(mapBill).filter((bill) => !bill.paidAt);
}

/* =========================================================
   MARK AS PAID
========================================================= */

/**
 * Marks a bill as paid and creates its expense transaction.
 *
 * Everything happens inside one Firestore transaction:
 *
 * 1. Read bill.
 * 2. Read account.
 * 3. Read transaction if necessary.
 * 4. Create expense transaction.
 * 5. Decrease account balance.
 * 6. Mark bill as paid.
 *
 * This prevents the bill and account from getting out of sync.
 */
export async function markBillAsPaid(
  userId: string,
  billId: string,
): Promise<string> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  if (!billId) {
    throw new Error("Bill ID is required.");
  }

  const billRef = billDocument(userId, billId);

  const transactionRef = doc(collection(db, "users", userId, "transactions"));

  await runTransaction(db, async (transaction) => {
    const billSnapshot = await transaction.get(billRef);

    if (!billSnapshot.exists()) {
      throw new Error("Bill not found.");
    }

    const bill = mapBill(billSnapshot);

    if (bill.paidAt || bill.transactionId) {
      throw new Error("This bill has already been paid.");
    }

    const accountRef = accountDocument(userId, bill.accountId);

    const accountSnapshot = await transaction.get(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error("The account connected to this bill could not be found.");
    }

    const accountData = accountSnapshot.data();

    const currentBalance = Number(accountData.balance ?? 0);

    const newBalance = currentBalance - bill.amount;

    const searchKeywords = createSearchKeywords([
      bill.title,
      bill.categoryName,
      bill.accountName,
      bill.notes,
    ]);

    /*
     * Create the expense transaction.
     */
    transaction.set(transactionRef, {
      userId,

      type: "expense",

      title: bill.title,

      amount: bill.amount,

      categoryId: bill.categoryId,
      categoryName: bill.categoryName,

      accountId: bill.accountId,
      accountName: bill.accountName,

      date: Timestamp.now(),

      notes: bill.notes || `Bill payment: ${bill.title}`,

      currency: bill.currency || accountData.currency || DEFAULT_CURRENCY,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      searchKeywords,
    });

    /*
     * Update account balance.
     */
    transaction.update(accountRef, {
      balance: newBalance,
      updatedAt: serverTimestamp(),
    });

    /*
     * Mark bill as paid.
     */
    transaction.update(billRef, {
      paidAt: serverTimestamp(),
      transactionId: transactionRef.id,
      updatedAt: serverTimestamp(),
    });
  });

  return transactionRef.id;
}

/* =========================================================
   MARK AS UNPAID
========================================================= */

/**
 * Marks a bill as unpaid and reverses its payment transaction.
 *
 * Everything is performed atomically:
 *
 * 1. Read bill.
 * 2. Read linked transaction.
 * 3. Read account.
 * 4. Restore account balance.
 * 5. Delete payment transaction.
 * 6. Clear paidAt + transactionId.
 */
export async function markBillAsUnpaid(
  userId: string,
  billId: string,
): Promise<void> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  if (!billId) {
    throw new Error("Bill ID is required.");
  }

  const billRef = billDocument(userId, billId);

  await runTransaction(db, async (transaction) => {
    const billSnapshot = await transaction.get(billRef);

    if (!billSnapshot.exists()) {
      throw new Error("Bill not found.");
    }

    const bill = mapBill(billSnapshot);

    if (!bill.paidAt || !bill.transactionId) {
      throw new Error("This bill is not paid.");
    }

    const paymentTransactionRef = transactionDocument(
      userId,
      bill.transactionId,
    );

    const accountRef = accountDocument(userId, bill.accountId);

    /*
     * Firestore requires all reads to happen before writes.
     */
    const paymentTransactionSnapshot = await transaction.get(
      paymentTransactionRef,
    );

    const accountSnapshot = await transaction.get(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error("The account connected to this bill could not be found.");
    }

    if (!paymentTransactionSnapshot.exists()) {
      throw new Error(
        "The payment transaction connected to this bill could not be found.",
      );
    }

    const paymentData = paymentTransactionSnapshot.data();

    const paymentType = paymentData.type as TransactionType;

    const paymentAmount = Number(paymentData.amount ?? 0);

    if (paymentType !== "expense") {
      throw new Error("The linked bill transaction is invalid.");
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new Error("The linked bill transaction has an invalid amount.");
    }

    const currentBalance = Number(accountSnapshot.data().balance ?? 0);

    /*
     * The payment originally decreased the balance.
     *
     * Reverse that decrease.
     */
    const restoredBalance =
      currentBalance - getBalanceEffect(paymentType, paymentAmount);

    transaction.update(accountRef, {
      balance: restoredBalance,
      updatedAt: serverTimestamp(),
    });

    /*
     * Remove the payment transaction.
     */
    transaction.delete(paymentTransactionRef);

    /*
     * Make the bill unpaid again.
     */
    transaction.update(billRef, {
      paidAt: null,
      transactionId: null,
      updatedAt: serverTimestamp(),
    });
  });
}

/* =========================================================
   GET BILL
========================================================= */

export async function getBill(
  userId: string,
  billId: string,
): Promise<Bill | null> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  if (!billId) {
    throw new Error("Bill ID is required.");
  }

  const snapshot = await getDocs(
    query(billsCollection(userId), where("__name__", "==", billId), limit(1)),
  );

  if (snapshot.empty) {
    return null;
  }

  return mapBill(snapshot.docs[0]);
}
