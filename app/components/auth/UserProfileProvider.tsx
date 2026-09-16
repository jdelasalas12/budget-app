"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { getUserProfile } from "@/lib/firestore/user";

import type { UserProfile } from "@/types/user";

interface UserProfileContextValue {
  userProfile: UserProfile | null;
  loadingProfile: boolean;
  refreshUserProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(
  undefined,
);

interface UserProfileProviderProps {
  children: ReactNode;
}

export function UserProfileProvider({ children }: UserProfileProviderProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [loadingProfile, setLoadingProfile] = useState(true);

  async function loadUserProfile(userId: string) {
    try {
      const profile = await getUserProfile(userId);

      setUserProfile(profile);
    } catch (error) {
      console.error("Unable to load user profile:", error);

      setUserProfile(null);
    }
  }

  async function refreshUserProfile() {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    await loadUserProfile(currentUser.uid);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoadingProfile(true);

      if (!currentUser) {
        setUserProfile(null);
        setLoadingProfile(false);
        return;
      }

      await loadUserProfile(currentUser.uid);

      setLoadingProfile(false);
    });

    return unsubscribe;
  }, []);

  return (
    <UserProfileContext.Provider
      value={{
        userProfile,
        loadingProfile,
        refreshUserProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);

  if (!context) {
    throw new Error("useUserProfile must be used inside UserProfileProvider");
  }

  return context;
}
