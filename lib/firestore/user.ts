import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type { UpdateUserProfileInput, UserProfile } from "@/types/user";

const DEFAULT_CURRENCY = "USD";

function userDocument(userId: string) {
  return doc(db, "users", userId);
}

/**
 * Create the user's profile after registration.
 */
export async function createUserProfile(
  userId: string,
  input: {
    name: string;
    email: string;
    currency?: string;
  },
) {
  const userRef = userDocument(userId);

  await setDoc(
    userRef,
    {
      uid: userId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      currency: input.currency ?? DEFAULT_CURRENCY,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}

/**
 * Get the user's profile.
 */
export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const userRef = userDocument(userId);

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    uid: userId,
    name: data.name ?? "",
    email: data.email ?? "",
    currency: data.currency ?? DEFAULT_CURRENCY,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/**
 * Update the user's profile.
 */
export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileInput,
) {
  const userRef = userDocument(userId);

  await updateDoc(userRef, {
    name: input.name.trim(),
    currency: input.currency,
    updatedAt: serverTimestamp(),
  });
}
