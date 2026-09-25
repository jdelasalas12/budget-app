import type { Timestamp } from "firebase/firestore";

export type BillFrequency = "one-time" | "weekly" | "monthly" | "yearly";

export interface Bill {
  id: string;
  userId: string;

  title: string;
  amount: number;

  categoryId: string;
  categoryName: string;

  accountId: string;
  accountName: string;

  dueDate: Timestamp;

  frequency: BillFrequency;

  notes: string;

  currency: string;

  /**
   * Set when the current bill occurrence is paid.
   */
  paidAt?: Timestamp;

  /**
   * Transaction created for the current bill payment.
   */
  transactionId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;

  /**
   * Used for Firestore searching.
   */
  searchKeywords: string[];
}

export interface CreateBillInput {
  title: string;
  amount: number;

  categoryId: string;
  categoryName: string;

  accountId: string;
  accountName: string;

  dueDate: Date;

  frequency: BillFrequency;

  notes?: string;

  currency?: string;
}

export interface UpdateBillInput {
  title: string;
  amount: number;

  categoryId: string;
  categoryName: string;

  accountId: string;
  accountName: string;

  dueDate: Date;

  frequency: BillFrequency;

  notes?: string;

  currency?: string;
}
