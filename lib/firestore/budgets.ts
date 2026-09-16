import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
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

function transactionsCollection(userId: string) {
  return collection(db, "users", userId, "transactions");
}

function notificationsCollection(userId: string) {
  return collection(db, "notifications", userId, "items");
}

/* =========================================================
   MONTH HELPERS
========================================================= */

/*
 * Budget month is expected to be:
 *
 * YYYY-MM
 *
 * Example:
 * 2026-09
 */

function getMonthRange(month: string) {
  const [yearString, monthString] = month.split("-");

  const year = Number(yearString);
  const monthNumber = Number(monthString);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new Error("Invalid budget month.");
  }

  const start = new Date(year, monthNumber - 1, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(year, monthNumber, 0);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
  };
}

/* =========================================================
   NOTIFICATION HELPER
========================================================= */

async function createBudgetNotificationIfNeeded(
  userId: string,
  budget: Budget,
) {
  /*
   * Only create an alert when the budget has been reached
   * or exceeded.
   */
  if (budget.spent < budget.amount) {
    return;
  }

  const notificationsRef = notificationsCollection(userId);

  /*
   * We use a unique notification key so the same budget/month
   * does not generate unlimited duplicate notifications.
   */
  const notificationKey = `budget-${budget.id}-${budget.month}`;

  const existingQuery = query(
    notificationsRef,
    where("notificationKey", "==", notificationKey),
  );

  const existingSnapshot = await getDocs(existingQuery);

  if (!existingSnapshot.empty) {
    return;
  }

  const exceeded = budget.spent > budget.amount;

  await addDoc(notificationsRef, {
    title: exceeded
      ? `${budget.categoryName} budget exceeded`
      : `${budget.categoryName} budget limit reached`,

    message: exceeded
      ? `You spent ${budget.spent.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${budget.currency} against a budget of ${budget.amount.toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )} ${budget.currency}.`
      : `You have reached your ${budget.categoryName} budget of ${budget.amount.toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )} ${budget.currency}.`,

    type: "overspend",

    read: false,

    budgetId: budget.id,

    categoryId: budget.categoryId,

    categoryName: budget.categoryName,

    month: budget.month,

    amount: budget.amount,

    spent: budget.spent,

    currency: budget.currency,

    notificationKey,

    createdAt: serverTimestamp(),
  });
}

/* =========================================================
   CALCULATE BUDGET SPENDING
========================================================= */

async function calculateBudgetSpent(
  userId: string,
  budget: Budget,
): Promise<number> {
  const { start, end } = getMonthRange(budget.month);

  const transactionQuery = query(
    transactionsCollection(userId),
    where("type", "==", "expense"),
    where("categoryId", "==", budget.categoryId),
  );

  const snapshot = await getDocs(transactionQuery);

  let spent = 0;

  for (const transaction of snapshot.docs) {
    const data = transaction.data();

    const transactionDate = data.date as Timestamp | undefined;

    if (!transactionDate) {
      continue;
    }

    const date = transactionDate.toDate();

    if (date < start || date > end) {
      continue;
    }

    /*
     * Only count transactions in the same currency.
     */
    const transactionCurrency = data.currency ?? DEFAULT_CURRENCY;

    if (transactionCurrency !== budget.currency) {
      continue;
    }

    spent += Number(data.amount ?? 0);
  }

  return spent;
}

/* =========================================================
   REFRESH ONE BUDGET
========================================================= */

async function refreshBudget(userId: string, budget: Budget): Promise<Budget> {
  const spent = await calculateBudgetSpent(userId, budget);

  const updatedBudget: Budget = {
    ...budget,
    spent,
  };

  /*
   * Keep Firestore's budget.spent synchronized with the
   * actual transactions.
   */
  await updateDoc(budgetDocument(userId, budget.id), {
    spent,
    updatedAt: serverTimestamp(),
  });

  /*
   * Check whether the updated budget should generate
   * a dashboard notification.
   */
  await createBudgetNotificationIfNeeded(userId, updatedBudget);

  return updatedBudget;
}

/* =========================================================
   CREATE BUDGET
========================================================= */

export async function createBudget(userId: string, input: CreateBudgetInput) {
  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Budget amount must be greater than zero.");
  }

  if (!input.categoryId) {
    throw new Error("Please select a category.");
  }

  if (!input.month) {
    throw new Error("Please select a month.");
  }

  const budget = {
    userId,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    amount,
    spent: 0,
    month: input.month,
    currency: input.currency ?? DEFAULT_CURRENCY,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const result = await addDoc(budgetsCollection(userId), budget);

  /*
   * Immediately check existing transactions.
   *
   * This means if the user creates a budget after already
   * spending money, the budget will still calculate correctly.
   */
  const createdBudget: Budget = {
    id: result.id,
    userId,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    amount,
    spent: 0,
    month: input.month,
    currency: input.currency ?? DEFAULT_CURRENCY,
    createdAt: null as unknown as Timestamp,
    updatedAt: null as unknown as Timestamp,
  };

  await refreshBudget(userId, createdBudget);

  return result.id;
}

/* =========================================================
   UPDATE BUDGET
========================================================= */

export async function updateBudget(
  userId: string,
  budgetId: string,
  input: UpdateBudgetInput,
) {
  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Budget amount must be greater than zero.");
  }

  if (!input.categoryId) {
    throw new Error("Please select a category.");
  }

  if (!input.month) {
    throw new Error("Please select a month.");
  }

  const budgetRef = budgetDocument(userId, budgetId);

  await updateDoc(budgetRef, {
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    amount,
    month: input.month,
    currency: input.currency ?? DEFAULT_CURRENCY,
    updatedAt: serverTimestamp(),
  });

  /*
   * Recalculate spending after changing the budget.
   */
  const updatedBudget: Budget = {
    id: budgetId,
    userId,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    amount,
    spent: 0,
    month: input.month,
    currency: input.currency ?? DEFAULT_CURRENCY,
    createdAt: null as unknown as Timestamp,
    updatedAt: null as unknown as Timestamp,
  };

  await refreshBudget(userId, updatedBudget);
}

/* =========================================================
   DELETE BUDGET
========================================================= */

export async function deleteBudget(userId: string, budgetId: string) {
  await deleteDoc(budgetDocument(userId, budgetId));
}

/* =========================================================
   GET BUDGETS
========================================================= */

export async function getBudgets(userId: string): Promise<Budget[]> {
  const snapshot = await getDocs(budgetsCollection(userId));

  const budgets: Budget[] = snapshot.docs.map((item) => {
    const data = item.data();

    return {
      id: item.id,
      userId: data.userId,
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      amount: Number(data.amount ?? 0),
      spent: Number(data.spent ?? 0),
      month: data.month,
      currency: data.currency ?? DEFAULT_CURRENCY,
      createdAt: data.createdAt as Timestamp,
      updatedAt: data.updatedAt as Timestamp,
    };
  });

  /*
   * Recalculate every budget.
   *
   * This is important because it makes existing transactions
   * count toward the budget even if they were created before
   * the budget.
   */
  const refreshedBudgets: Budget[] = [];

  for (const budget of budgets) {
    try {
      const refreshed = await refreshBudget(userId, budget);

      refreshedBudgets.push(refreshed);
    } catch (error) {
      console.error(`Unable to refresh budget ${budget.id}:`, error);

      /*
       * Keep the stored budget if recalculation fails.
       */
      refreshedBudgets.push(budget);
    }
  }

  return refreshedBudgets;
}
