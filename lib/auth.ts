import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { detectInitialCurrency } from "@/lib/country-currency";
import { DEFAULT_CURRENCY, getCurrency } from "@/lib/currency";

export async function registerUser(
  name: string,
  email: string,
  password: string,
) {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  const credential = await createUserWithEmailAndPassword(
    auth,
    trimmedEmail,
    password,
  );

  await updateProfile(credential.user, {
    displayName: trimmedName,
  });

  // Detect initial currency.
  // Defaults to PHP.
  const currency = detectInitialCurrency();

  await setDoc(doc(db, "users", credential.user.uid), {
    uid: credential.user.uid,
    name: trimmedName,
    email: trimmedEmail,
    currency,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return credential.user;
}

export async function updateCurrency(currencyCode: string) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to change your currency.");
  }

  const currency = getCurrency(currencyCode);

  await updateDoc(doc(db, "users", user.uid), {
    currency: currency.code,
    updatedAt: serverTimestamp(),
  });
}

export async function getUserCurrency(): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    return DEFAULT_CURRENCY;
  }

  const snapshot = await getDoc(doc(db, "users", user.uid));

  if (!snapshot.exists()) {
    return DEFAULT_CURRENCY;
  }

  const data = snapshot.data();

  return typeof data.currency === "string" ? data.currency : DEFAULT_CURRENCY;
}

export async function loginUser(email: string, password: string) {
  await setPersistence(auth, browserLocalPersistence);

  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );

  return credential.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}
