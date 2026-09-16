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

/**
 * Listen to the user's budgets and transactions in real time.
 *
 * Whenever either collection changes, budget notifications
 * are recalculated immediately.
 */
export function subscribeToBudgetNotifications(
  userId: string,
  callback: (notifications: BudgetNotification[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const month = getCurrentMonth();

  const budgetsRef = collection(db, "users", userId, "budgets");

  const transactionsRef = collection(db, "users", userId, "transactions");

  const notificationsRef = collection(db, "users", userId, "notifications");

  let budgets: BudgetData[] = [];
  let transactions: TransactionData[] = [];
  let storedNotifications: BudgetNotification[] = [];

  let budgetsLoaded = false;
  let transactionsLoaded = false;
  let notificationsLoaded = false;

  let unsubscribeBudgets: Unsubscribe | null = null;
  let unsubscribeTransactions: Unsubscribe | null = null;
  let unsubscribeNotifications: Unsubscribe | null = null;

  function recalculate() {
    if (!budgetsLoaded || !transactionsLoaded || !notificationsLoaded) {
      return;
    }

    const generated: BudgetNotification[] = [];

    for (const budget of budgets) {
      if (!Number.isFinite(budget.amount) || budget.amount <= 0) {
        continue;
      }

      let spent = 0;

      for (const transaction of transactions) {
        if (transaction.type !== "expense") {
          continue;
        }

        const matchesCategory =
          transaction.categoryId === budget.categoryId ||
          transaction.categoryName === budget.categoryName;

        if (!matchesCategory) {
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

      if (!level) {
        continue;
      }

      const notificationId = `${budget.id}-${level}`;

      const existing = storedNotifications.find(
        (notification) => notification.id === notificationId,
      );

      let message = "";

      if (level === "overspent") {
        message = `${budget.categoryName} budget is overspent. You have spent ${formatCurrency(
          spent,
          budget.currency,
        )} of ${formatCurrency(budget.amount, budget.currency)}.`;
      } else if (level === "limit") {
        message = `${budget.categoryName} budget limit reached. You have spent ${formatCurrency(
          spent,
          budget.currency,
        )} of ${formatCurrency(budget.amount, budget.currency)}.`;
      } else {
        message = `${budget.categoryName} budget is ${Math.round(
          percentage,
        )}% used. You have spent ${formatCurrency(
          spent,
          budget.currency,
        )} of ${formatCurrency(budget.amount, budget.currency)}.`;
      }

      generated.push({
        id: notificationId,
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
        read: existing?.read ?? false,
        createdAt: existing?.createdAt,
      });
    }

    /*
     * Save/update notifications in Firestore.
     */
    for (const notification of generated) {
      const notificationRef = notificationDocument(userId, notification.id);

      void setDoc(
        notificationRef,
        {
          userId: notification.userId,
          budgetId: notification.budgetId,
          categoryId: notification.categoryId,
          categoryName: notification.categoryName,
          level: notification.level,
          message: notification.message,
          spent: notification.spent,
          budgetAmount: notification.budgetAmount,
          percentage: notification.percentage,
          currency: notification.currency,
          read: notification.read,
          createdAt: notification.createdAt ?? new Date(),
          updatedAt: new Date(),
        },
        {
          merge: true,
        },
      );
    }

    /*
     * Remove old notifications when the budget is
     * no longer at the warning threshold.
     *
     * Example:
     *
     * 80% -> notification exists
     * transaction deleted -> 70%
     * notification is removed.
     */
    const generatedIds = new Set(
      generated.map((notification) => notification.id),
    );

    for (const existing of storedNotifications) {
      if (!generatedIds.has(existing.id)) {
        void deleteDoc(notificationDocument(userId, existing.id));
      }
    }

    /*
     * Return only unread notifications to the UI.
     */
    callback(generated.filter((notification) => !notification.read));
  }

  unsubscribeBudgets = onSnapshot(
    query(budgetsRef, where("month", "==", month)),
    (snapshot) => {
      budgets = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          categoryId: data.categoryId ?? "",
          categoryName: data.categoryName ?? "Unknown",
          amount: Number(data.amount ?? 0),
          month: data.month ?? month,
          currency: data.currency ?? "PHP",
        };
      });

      budgetsLoaded = true;
      recalculate();
    },
    (error) => {
      console.error("Budget notification listener error:", error);

      onError?.(error);
    },
  );

  unsubscribeTransactions = onSnapshot(
    transactionsRef,
    (snapshot) => {
      transactions = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          type: data.type ?? "",
          amount: Number(data.amount ?? 0),
          categoryId: data.categoryId ?? "",
          categoryName: data.categoryName ?? "",
          currency: data.currency ?? "PHP",
          date: data.date ?? null,
        };
      });

      transactionsLoaded = true;
      recalculate();
    },
    (error) => {
      console.error("Transaction notification listener error:", error);

      onError?.(error);
    },
  );

  unsubscribeNotifications = onSnapshot(
    notificationsRef,
    (snapshot) => {
      storedNotifications = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          userId: data.userId ?? userId,
          budgetId: data.budgetId ?? "",
          categoryId: data.categoryId ?? "",
          categoryName: data.categoryName ?? "",
          level: data.level ?? "warning",
          message: data.message ?? "",
          spent: Number(data.spent ?? 0),
          budgetAmount: Number(data.budgetAmount ?? 0),
          percentage: Number(data.percentage ?? 0),
          currency: data.currency ?? "PHP",
          read: Boolean(data.read),
          createdAt: data.createdAt,
        };
      });

      notificationsLoaded = true;
      recalculate();
    },
    (error) => {
      console.error("Notification listener error:", error);

      onError?.(error);
    },
  );

  return () => {
    unsubscribeBudgets?.();
    unsubscribeTransactions?.();
    unsubscribeNotifications?.();
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
 * Delete a notification completely.
 */
export async function deleteNotification(
  userId: string,
  notificationId: string,
) {
  await deleteDoc(notificationDocument(userId, notificationId));
}
