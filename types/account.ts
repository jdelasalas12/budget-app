import type { Timestamp } from "firebase/firestore";

export type AccountType =
  | "cash"
  | "bank"
  | "card"
  | "wallet"
  | "savings"
  | "other";

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  balance: number;
  currency: string;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  openingBalance: number;
  currency?: string;
  notes?: string;
}

export interface UpdateAccountInput {
  name: string;
  type: AccountType;
  openingBalance: number;
  currency?: string;
  notes?: string;
}
