import type { Timestamp } from "firebase/firestore";

export interface Budget {
  id: string;
  userId: string;

  categoryId: string;
  categoryName: string;

  amount: number;
  spent: number;

  month: string;
  currency: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateBudgetInput {
  categoryId: string;
  categoryName: string;
  amount: number;
  month: string;
  currency?: string;
}

export interface UpdateBudgetInput {
  categoryId: string;
  categoryName: string;
  amount: number;
  month: string;
  currency?: string;
}
