import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { DEFAULT_CURRENCY } from "@/lib/currency";

import type {
  Budget,
  CreateBudgetInput,
  UpdateBudgetInput,
} from "@/types/budget";

/* =========================================================
   COLLECTION HELPERS
========================================================= */

function budgetsCollection(userId: string) {
  return collection(db, "users", userId, "budgets");
}

function budgetDocument(userId: string, budgetId: string) {
  return doc(db, "users", userId, "budgets", budgetId);
}

/* =========================================================
   CREATE BUDGET
========================================================= */

export async function createBudget(
  userId: string,
  input: CreateBudgetInput,
): Promise<string> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Budget amount must be greater than zero.");
  }

  if (!input.categoryId) {
    throw new Error("Please select a category.");
  }

  if (!input.categoryName) {
    throw new Error("Please select a valid category.");
  }

  if (!input.month) {
    throw new Error("Please select a month.");
  }

  const currency = input.currency ?? DEFAULT_CURRENCY;

  const budgetData = {
    userId,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    amount,
    spent: 0,
    month: input.month,
    currency,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const result = await addDoc(budgetsCollection(userId), budgetData);

  return result.id;
}

/* =========================================================
   UPDATE BUDGET
========================================================= */

export async function updateBudget(
  userId: string,
  budgetId: string,
  input: UpdateBudgetInput,
): Promise<void> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  if (!budgetId) {
    throw new Error("Invalid budget.");
  }

  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Budget amount must be greater than zero.");
  }

  if (!input.categoryId) {
    throw new Error("Please select a category.");
  }

  if (!input.categoryName) {
    throw new Error("Please select a valid category.");
  }

  if (!input.month) {
    throw new Error("Please select a month.");
  }

  const currency = input.currency ?? DEFAULT_CURRENCY;

  await updateDoc(budgetDocument(userId, budgetId), {
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    amount,
    month: input.month,
    currency,
    updatedAt: serverTimestamp(),
  });
}

/* =========================================================
   DELETE BUDGET
========================================================= */

export async function deleteBudget(
  userId: string,
  budgetId: string,
): Promise<void> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  if (!budgetId) {
    throw new Error("Invalid budget.");
  }

  await deleteDoc(budgetDocument(userId, budgetId));
}

/* =========================================================
   GET BUDGETS
========================================================= */

export async function getBudgets(userId: string): Promise<Budget[]> {
  if (!userId) {
    throw new Error("You must be signed in.");
  }

  /*
   * IMPORTANT:
   *
   * This function is intentionally READ ONLY.
   *
   * Do not recalculate spending here.
   * Do not update budgets here.
   * Do not create notifications here.
   *
   * The Budgets page calculates spending from transactions.
   *
   * This keeps the page much faster and avoids unnecessary
   * Firestore writes every time the page is opened.
   */

  const snapshot = await getDocs(budgetsCollection(userId));

  return snapshot.docs.map((item) => {
    const data = item.data();

    return {
      id: item.id,

      userId: typeof data.userId === "string" ? data.userId : userId,

      categoryId: typeof data.categoryId === "string" ? data.categoryId : "",

      categoryName:
        typeof data.categoryName === "string" ? data.categoryName : "",

      amount: Number(data.amount ?? 0),

      /*
       * The page recalculates this from transactions.
       *
       * Keeping the stored value as a fallback is useful for
       * older budget documents.
       */
      spent: Number(data.spent ?? 0),

      month: typeof data.month === "string" ? data.month : "",

      currency:
        typeof data.currency === "string" ? data.currency : DEFAULT_CURRENCY,

      createdAt: (data.createdAt as Timestamp) ?? null,

      updatedAt: (data.updatedAt as Timestamp) ?? null,
    };
  });
}
