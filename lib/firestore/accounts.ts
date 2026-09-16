import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  type DocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { DEFAULT_CURRENCY } from "@/lib/currency";

import type {
  Account,
  CreateAccountInput,
  UpdateAccountInput,
} from "@/types/account";

const ACCOUNTS_PER_PAGE = 10;

function accountsCollection(userId: string) {
  return collection(db, "users", userId, "accounts");
}

function accountDocument(userId: string, accountId: string) {
  return doc(db, "users", userId, "accounts", accountId);
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  const collectionRef = accountsCollection(userId);

  const openingBalance = Number(input.openingBalance);

  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    throw new Error("Opening balance must be a valid amount.");
  }

  const account = {
    userId,
    name: input.name.trim(),
    type: input.type,
    openingBalance,
    balance: openingBalance,
    currency: input.currency ?? DEFAULT_CURRENCY,
    notes: input.notes?.trim() ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const result = await addDoc(collectionRef, account);

  return result.id;
}

export async function updateAccount(
  userId: string,
  accountId: string,
  input: UpdateAccountInput,
) {
  const accountRef = accountDocument(userId, accountId);

  const openingBalance = Number(input.openingBalance);

  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    throw new Error("Opening balance must be a valid amount.");
  }

  const snapshot = await getDoc(accountRef);

  if (!snapshot.exists()) {
    throw new Error("Account not found.");
  }

  const data = snapshot.data();

  const oldOpeningBalance = Number(data.openingBalance ?? data.balance ?? 0);

  const oldBalance = Number(data.balance ?? 0);

  const difference = openingBalance - oldOpeningBalance;

  const newBalance = oldBalance + difference;

  await updateDoc(accountRef, {
    name: input.name.trim(),
    type: input.type,
    openingBalance,
    balance: newBalance,
    currency: input.currency ?? DEFAULT_CURRENCY,
    notes: input.notes?.trim() ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAccount(userId: string, accountId: string) {
  const accountRef = accountDocument(userId, accountId);

  await deleteDoc(accountRef);
}

export interface AccountPage {
  accounts: Account[];
  lastDocument: DocumentSnapshot | null;
  hasMore: boolean;
}

export async function getAccounts({
  userId,
  lastDocument = null,
}: {
  userId: string;
  lastDocument?: DocumentSnapshot | null;
}): Promise<AccountPage> {
  const collectionRef = accountsCollection(userId);

  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];

  if (lastDocument) {
    constraints.push(startAfter(lastDocument));
  }

  constraints.push(limit(ACCOUNTS_PER_PAGE + 1));

  const accountQuery = query(collectionRef, ...constraints);

  const snapshot = await getDocs(accountQuery);

  const hasMore = snapshot.docs.length > ACCOUNTS_PER_PAGE;

  const documents = snapshot.docs.slice(0, ACCOUNTS_PER_PAGE);

  const accounts: Account[] = documents.map((item) => {
    const data = item.data();

    return {
      id: item.id,
      userId: data.userId,
      name: data.name,
      type: data.type,
      openingBalance: Number(data.openingBalance ?? data.balance ?? 0),
      balance: Number(data.balance ?? 0),
      currency: data.currency ?? DEFAULT_CURRENCY,
      notes: data.notes ?? "",
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  return {
    accounts,
    lastDocument: documents.length > 0 ? documents[documents.length - 1] : null,
    hasMore,
  };
}
