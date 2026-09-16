import type { Timestamp } from "firebase/firestore";

export type NotificationType =
  | "budget_warning"
  | "budget_limit"
  | "budget_exceeded";

export interface AppNotification {
  id: string;
  userId: string;

  type: NotificationType;

  title: string;
  message: string;

  budgetId?: string;
  categoryName?: string;

  read: boolean;

  createdAt: Timestamp;
}
