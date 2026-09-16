import type { Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  currency: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UpdateUserProfileInput {
  name: string;
  currency: string;
}
