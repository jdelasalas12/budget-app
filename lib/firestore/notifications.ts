import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/currency";

export type BudgetNotificationLevel = "warning" | "limit" | "overspent";

export interface BudgetNotification {
  id: string;
  userId: string;
  budgetId: string;
  categoryId: string;
  categoryName: string;
  level: BudgetNotificationLevel;
  message: string;
  spent: number;
  budgetAmount: number;
  percentage: number;
  currency: string;
  read: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface BudgetData {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  month: string;
  currency: string;
}

interface TransactionData {
  type: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  currency: string;
  date: {
    toDate?: () => Date;
  } | null;
}

function budgetsCollection(userId: string) {
  return collection(db, "users", userId, "budgets");
}

function transactionsCollection(userId: string) {
  return collection(db, "users", userId, "transactions");
}

function notificationsCollection(userId: string) {
  return collection(db, "users", userId, "notifications");
}

function notificationDocument(userId: string, notificationId: string) {
  return doc(db, "users", userId, "notifications", notificationId);
}

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getNotificationLevel(
  percentage: number,
): BudgetNotificationLevel | null {
  if (percentage > 100) {
    return "overspent";
  }

  if (percentage >= 100) {
    return "limit";
  }

  if (percentage >= 80) {
    return "warning";
  }

  return null;
}

function createMessage(
  budget: BudgetData,
  spent: number,
  percentage: number,
  level: BudgetNotificationLevel,
) {
  if (level === "overspent") {
    return `${budget.categoryName} budget is overspent. You have spent ${formatCurrency(
      spent,
      budget.currency,
    )} of ${formatCurrency(budget.amount, budget.currency)}.`;
  }

  if (level === "limit") {
    return `${budget.categoryName} budget limit reached. You have spent ${formatCurrency(
      spent,
      budget.currency,
    )} of ${formatCurrency(budget.amount, budget.currency)}.`;
  }

  return `${budget.categoryName} budget is ${Math.round(
    percentage,
  )}% used. You have spent ${formatCurrency(
    spent,
    budget.currency,
  )} of ${formatCurrency(budget.amount, budget.currency)}.`;
}

/**
 * Subscribe to the user's current-month budgets and transactions.
 *
 * This function GENERATES budget notifications in:
 *
 * users/{userId}/notifications
 *
 * The notification UI can subscribe to that collection separately.
 */
export function subscribeToBudgetNotifications(
  userId: string,
  onError?: (error: Error) => void,
): Unsubscribe {
  const month = getCurrentMonth();

  let budgets: BudgetData[] = [];
  let transactions: TransactionData[] = [];

  let budgetsLoaded = false;
  let transactionsLoaded = false;

  let recalculating = false;

  const budgetsQuery = query(
    budgetsCollection(userId),
    where("month", "==", month),
  );

  const unsubscribeBudgets = onSnapshot(
    budgetsQuery,
    (snapshot) => {
      budgets = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          categoryId: String(data.categoryId ?? ""),
          categoryName: String(data.categoryName ?? "Unknown"),
          amount: Number(data.amount ?? 0),
          month: String(data.month ?? month),
          currency: String(data.currency ?? "PHP"),
        };
      });

      budgetsLoaded = true;

      void recalculate();
    },
    (error) => {
      console.error("Budget notification listener error:", error);

      onError?.(error);
    },
  );

  const unsubscribeTransactions = onSnapshot(
    transactionsCollection(userId),
    (snapshot) => {
      transactions = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          type: String(data.type ?? ""),
          amount: Number(data.amount ?? 0),
          categoryId: String(data.categoryId ?? ""),
          categoryName: String(data.categoryName ?? ""),
          currency: String(data.currency ?? "PHP"),
          date: data.date ?? null,
        };
      });

      transactionsLoaded = true;

      void recalculate();
    },
    (error) => {
      console.error("Transaction notification listener error:", error);

      onError?.(error);
    },
  );

  async function recalculate() {
    if (!budgetsLoaded || !transactionsLoaded || recalculating) {
      return;
    }

    recalculating = true;

    try {
      const generatedIds = new Set<string>();

      for (const budget of budgets) {
        if (!Number.isFinite(budget.amount) || budget.amount <= 0) {
          continue;
        }

        let spent = 0;

        for (const transaction of transactions) {
          if (transaction.type !== "expense") {
            continue;
          }

          if (!Number.isFinite(transaction.amount)) {
            continue;
          }

          /*
           * Match category.
           */
          const matchesCategory =
            transaction.categoryId === budget.categoryId ||
            transaction.categoryName === budget.categoryName;

          if (!matchesCategory) {
            continue;
          }

          /*
           * IMPORTANT:
           *
           * Do not combine different currencies.
           */
          if (transaction.currency !== budget.currency) {
            continue;
          }

          const transactionDate = transaction.date?.toDate?.();

          if (!transactionDate) {
            continue;
          }

          const transactionMonth = `${transactionDate.getFullYear()}-${String(
            transactionDate.getMonth() + 1,
          ).padStart(2, "0")}`;

          if (transactionMonth !== budget.month) {
            continue;
          }

          spent += transaction.amount;
        }

        const percentage = (spent / budget.amount) * 100;

        const level = getNotificationLevel(percentage);

        /*
         * Below 80%.
         *
         * Remove all possible notifications for
         * this budget.
         */
        if (!level) {
          await deleteDoc(
            notificationDocument(userId, `${budget.id}-warning`),
          ).catch(() => {});

          await deleteDoc(
            notificationDocument(userId, `${budget.id}-limit`),
          ).catch(() => {});

          await deleteDoc(
            notificationDocument(userId, `${budget.id}-overspent`),
          ).catch(() => {});

          continue;
        }

        const notificationId = `${budget.id}-${level}`;

        generatedIds.add(notificationId);

        /*
         * Read the existing notification directly.
         *
         * We intentionally DO NOT listen to notifications
         * here. This prevents a notification write from
         * triggering another calculation loop.
         */
        const notificationRef = notificationDocument(userId, notificationId);

        /*
         * Preserve read status by using merge.
         *
         * If this is a brand-new notification,
         * read defaults to false.
         */
        const message = createMessage(budget, spent, percentage, level);

        await setDoc(
          notificationRef,
          {
            userId,
            budgetId: budget.id,
            categoryId: budget.categoryId,
            categoryName: budget.categoryName,
            level,
            message,
            spent,
            budgetAmount: budget.amount,
            percentage,
            currency: budget.currency,
            read: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            merge: true,
          },
        );
      }

      /*
       * Clean up notification levels that are no longer
       * applicable.
       *
       * We use a separate one-time snapshot so the generator
       * itself does not continuously listen to notifications.
       */
      const notificationSnapshot = await new Promise<{
        docs: Array<{
          id: string;
        }>;
      }>((resolve, reject) => {
        const unsubscribe = onSnapshot(
          notificationsCollection(userId),
          (snapshot) => {
            unsubscribe();
            resolve({
              docs: snapshot.docs.map((item) => ({
                id: item.id,
              })),
            });
          },
          (error) => {
            unsubscribe();
            reject(error);
          },
        );
      });

      for (const notification of notificationSnapshot.docs) {
        /*
         * Only delete budget notifications generated by
         * this system.
         */
        if (
          notification.id.endsWith("-warning") ||
          notification.id.endsWith("-limit") ||
          notification.id.endsWith("-overspent")
        ) {
          if (!generatedIds.has(notification.id)) {
            await deleteDoc(
              notificationDocument(userId, notification.id),
            ).catch(() => {});
          }
        }
      }
    } catch (error) {
      console.error("Unable to recalculate budget notifications:", error);

      onError?.(
        error instanceof Error
          ? error
          : new Error("Unable to calculate budget notifications."),
      );
    } finally {
      recalculating = false;
    }
  }

  return () => {
    unsubscribeBudgets();
    unsubscribeTransactions();
  };
}

/**
 * Mark one notification as read.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
) {
  await setDoc(
    notificationDocument(userId, notificationId),
    {
      read: true,
      updatedAt: new Date(),
    },
    {
      merge: true,
    },
  );
}

/**
 * Delete one notification completely.
 */
export async function deleteNotification(
  userId: string,
  notificationId: string,
) {
  await deleteDoc(notificationDocument(userId, notificationId));
}
