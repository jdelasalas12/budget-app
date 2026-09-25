import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";

import type { Bill, CreateBillInput, UpdateBillInput } from "@/types/bill";

import type { Account } from "@/types/account";
import type { Transaction } from "@/types/transaction";

const BILLS_COLLECTION = "bills";
const ACCOUNTS_COLLECTION = "accounts";
const TRANSACTIONS_COLLECTION = "transactions";

function getBillsCollection(db: Firestore, userId: string) {
  return collection(db, "users", userId, BILLS_COLLECTION);
}

function getAccountsCollection(db: Firestore, userId: string) {
  return collection(db, "users", userId, ACCOUNTS_COLLECTION);
}

function getTransactionsCollection(db: Firestore, userId: string) {
  return collection(db, "users", userId, TRANSACTIONS_COLLECTION);
}

/**
 * Create search keywords for Firestore searching.
 */
function createSearchKeywords(
  title: string,
  categoryName: string,
  accountName: string,
) {
  const values = [title, categoryName, accountName];

  const keywords = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      continue;
    }

    keywords.add(normalized);

    /*
     * Add every prefix.
     *
     * Example:
     * "internet"
     *
     * becomes:
     * i
     * in
     * int
     * inte
     * ...
     */
    for (let i = 1; i <= normalized.length; i++) {
      keywords.add(normalized.substring(0, i));
    }
  }

  return Array.from(keywords);
}

/**
 * Create a bill.
 */
export async function createBill(
  db: Firestore,
  userId: string,
  input: CreateBillInput,
): Promise<string> {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (!input.title.trim()) {
    throw new Error("Bill title is required.");
  }

  if (input.amount <= 0) {
    throw new Error("Bill amount must be greater than zero.");
  }

  if (!input.categoryId) {
    throw new Error("Category is required.");
  }

  if (!input.accountId) {
    throw new Error("Account is required.");
  }

  const billsRef = getBillsCollection(db, userId);

  const searchKeywords = createSearchKeywords(
    input.title,
    input.categoryName,
    input.accountName,
  );

  const billData = {
    userId,

    title: input.title.trim(),
    amount: input.amount,

    categoryId: input.categoryId,
    categoryName: input.categoryName,

    accountId: input.accountId,
    accountName: input.accountName,

    dueDate: Timestamp.fromDate(input.dueDate),

    frequency: input.frequency,

    notes: input.notes?.trim() ?? "",

    currency: input.currency ?? "PHP",

    searchKeywords,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const billRef = await addDoc(billsRef, billData);

  return billRef.id;
}

/**
 * Get all bills for a user.
 *
 * Ordered by due date, earliest first.
 */
export async function getBills(db: Firestore, userId: string): Promise<Bill[]> {
  if (!userId) {
    return [];
  }

  const billsRef = getBillsCollection(db, userId);

  const billsQuery = query(billsRef, orderBy("dueDate", "asc"));

  const snapshot = await getDocs(billsQuery);

  return snapshot.docs.map((billDoc) => ({
    id: billDoc.id,
    ...billDoc.data(),
  })) as Bill[];
}

/**
 * Get upcoming bills.
 *
 * This retrieves bills whose due date is today or later.
 */
export async function getUpcomingBills(
  db: Firestore,
  userId: string,
): Promise<Bill[]> {
  if (!userId) {
    return [];
  }

  const billsRef = getBillsCollection(db, userId);

  const now = Timestamp.now();

  const billsQuery = query(
    billsRef,
    where("dueDate", ">=", now),
    orderBy("dueDate", "asc"),
  );

  const snapshot = await getDocs(billsQuery);

  return snapshot.docs.map((billDoc) => ({
    id: billDoc.id,
    ...billDoc.data(),
  })) as Bill[];
}

/**
 * Get overdue bills.
 *
 * Only unpaid bills should be returned.
 *
 * Because paid bills don't have paidAt,
 * we query for bills whose due date has passed
 * and then filter out paid bills.
 */
export async function getOverdueBills(
  db: Firestore,
  userId: string,
): Promise<Bill[]> {
  if (!userId) {
    return [];
  }

  const billsRef = getBillsCollection(db, userId);

  const now = Timestamp.now();

  const billsQuery = query(
    billsRef,
    where("dueDate", "<", now),
    orderBy("dueDate", "asc"),
  );

  const snapshot = await getDocs(billsQuery);

  return snapshot.docs
    .map(
      (billDoc) =>
        ({
          id: billDoc.id,
          ...billDoc.data(),
        }) as Bill,
    )
    .filter((bill) => !bill.paidAt);
}

/**
 * Update a bill.
 */
export async function updateBill(
  db: Firestore,
  userId: string,
  billId: string,
  input: UpdateBillInput,
): Promise<void> {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (!billId) {
    throw new Error("Bill ID is required.");
  }

  if (!input.title.trim()) {
    throw new Error("Bill title is required.");
  }

  if (input.amount <= 0) {
    throw new Error("Bill amount must be greater than zero.");
  }

  const billRef = doc(db, "users", userId, BILLS_COLLECTION, billId);

  const searchKeywords = createSearchKeywords(
    input.title,
    input.categoryName,
    input.accountName,
  );

  await updateDoc(billRef, {
    title: input.title.trim(),
    amount: input.amount,

    categoryId: input.categoryId,
    categoryName: input.categoryName,

    accountId: input.accountId,
    accountName: input.accountName,

    dueDate: Timestamp.fromDate(input.dueDate),

    frequency: input.frequency,

    notes: input.notes?.trim() ?? "",

    currency: input.currency ?? "PHP",

    searchKeywords,

    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a bill.
 *
 * This only deletes the bill.
 * Existing transactions are NOT deleted.
 */
export async function deleteBill(
  db: Firestore,
  userId: string,
  billId: string,
): Promise<void> {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (!billId) {
    throw new Error("Bill ID is required.");
  }

  const billRef = doc(db, "users", userId, BILLS_COLLECTION, billId);

  await deleteDoc(billRef);
}

/**
 * Mark a bill as paid.
 *
 * This performs three operations atomically:
 *
 * 1. Creates an expense transaction.
 * 2. Decreases the selected account balance.
 * 3. Marks the bill as paid.
 *
 * If any operation fails, Firestore rolls everything back.
 */
export async function markBillAsPaid(
  db: Firestore,
  userId: string,
  billId: string,
): Promise<string> {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (!billId) {
    throw new Error("Bill ID is required.");
  }

  return await runTransaction(db, async (firestoreTransaction) => {
    const billRef = doc(db, "users", userId, BILLS_COLLECTION, billId);

    const billSnapshot = await firestoreTransaction.get(billRef);

    if (!billSnapshot.exists()) {
      throw new Error("Bill not found.");
    }

    const bill = billSnapshot.data() as Bill;

    /*
     * Prevent paying the same bill twice.
     */
    if (bill.paidAt) {
      throw new Error("This bill has already been paid.");
    }

    if (!bill.accountId) {
      throw new Error("This bill does not have a payment account.");
    }

    /*
     * Get the account that will pay the bill.
     */
    const accountRef = doc(
      db,
      "users",
      userId,
      ACCOUNTS_COLLECTION,
      bill.accountId,
    );

    const accountSnapshot = await firestoreTransaction.get(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error("Payment account not found.");
    }

    const account = accountSnapshot.data() as Account;

    /*
     * Prevent the account balance from going negative.
     *
     * Remove this check if your app allows negative balances.
     */
    if (account.balance < bill.amount) {
      throw new Error(`Insufficient balance in ${account.name}.`);
    }

    /*
     * Create the expense transaction.
     */
    const transactionRef = doc(getTransactionsCollection(db, userId));

    const transactionData: Omit<Transaction, "id"> = {
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

      currency: bill.currency,

      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),

      searchKeywords: createSearchKeywords(
        bill.title,
        bill.categoryName,
        bill.accountName,
      ),
    };

    /*
     * Create the transaction.
     */
    firestoreTransaction.set(transactionRef, transactionData);

    /*
     * Decrease account balance.
     */
    firestoreTransaction.update(accountRef, {
      balance: account.balance - bill.amount,
      updatedAt: serverTimestamp(),
    });

    /*
     * Mark bill as paid.
     */
    firestoreTransaction.update(billRef, {
      paidAt: serverTimestamp(),
      transactionId: transactionRef.id,
      updatedAt: serverTimestamp(),
    });

    return transactionRef.id;
  });
}

/**
 * Mark a bill as unpaid.
 *
 * IMPORTANT:
 *
 * This reverses the transaction created by
 * markBillAsPaid().
 *
 * It should therefore only be used when you
 * intentionally want to undo a bill payment.
 */
export async function markBillAsUnpaid(
  db: Firestore,
  userId: string,
  billId: string,
): Promise<void> {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (!billId) {
    throw new Error("Bill ID is required.");
  }

  await runTransaction(db, async (firestoreTransaction) => {
    const billRef = doc(db, "users", userId, BILLS_COLLECTION, billId);

    const billSnapshot = await firestoreTransaction.get(billRef);

    if (!billSnapshot.exists()) {
      throw new Error("Bill not found.");
    }

    const bill = billSnapshot.data() as Bill;

    if (!bill.paidAt || !bill.transactionId) {
      throw new Error("This bill is not marked as paid.");
    }

    const accountRef = doc(
      db,
      "users",
      userId,
      ACCOUNTS_COLLECTION,
      bill.accountId,
    );

    const accountSnapshot = await firestoreTransaction.get(accountRef);

    if (!accountSnapshot.exists()) {
      throw new Error("Payment account not found.");
    }

    const account = accountSnapshot.data() as Account;

    /*
     * Find the transaction that was created
     * for this bill.
     */
    const transactionRef = doc(
      db,
      "users",
      userId,
      TRANSACTIONS_COLLECTION,
      bill.transactionId,
    );

    /*
     * Restore the money to the account.
     */
    firestoreTransaction.update(accountRef, {
      balance: account.balance + bill.amount,
      updatedAt: serverTimestamp(),
    });

    /*
     * Delete the generated expense transaction.
     */
    firestoreTransaction.delete(transactionRef);

    /*
     * Reset the bill to unpaid.
     */
    firestoreTransaction.update(billRef, {
      paidAt: null,
      transactionId: null,
      updatedAt: serverTimestamp(),
    });
  });
}
