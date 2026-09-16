import type { Timestamp } from "firebase/firestore";

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  userId: string;

  type: TransactionType;

  title: string;
  amount: number;

  categoryId: string;
  categoryName: string;

  accountId: string;
  accountName: string;

  date: Timestamp;

  notes: string;

  currency: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;

  /**
   * Used for Firestore searching.
   */
  searchKeywords: string[];
}

export interface CreateTransactionInput {
  type: TransactionType;

  title: string;
  amount: number;

  categoryId: string;
  categoryName: string;

  accountId: string;
  accountName: string;

  date: Date;

  notes?: string;

  currency?: string;
}

export interface UpdateTransactionInput {
  type: TransactionType;

  title: string;
  amount: number;

  categoryId: string;
  categoryName: string;

  accountId: string;
  accountName: string;

  date: Date;

  notes?: string;

  currency?: string;
}
