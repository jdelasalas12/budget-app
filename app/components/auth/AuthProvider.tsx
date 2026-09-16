"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { getUserCurrency } from "@/lib/auth";
import { DEFAULT_CURRENCY } from "@/lib/currency";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  currency: string;
  currencyLoading: boolean;
  refreshCurrency: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  currency: DEFAULT_CURRENCY,
  currencyLoading: true,
  refreshCurrency: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [currencyLoading, setCurrencyLoading] = useState(true);

  const refreshCurrency = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setCurrency(DEFAULT_CURRENCY);
      setCurrencyLoading(false);
      return;
    }

    try {
      setCurrencyLoading(true);

      const currentCurrency = await getUserCurrency();

      setCurrency(currentCurrency);
    } catch (error) {
      console.error("Unable to load user currency:", error);

      setCurrency(DEFAULT_CURRENCY);
    } finally {
      setCurrencyLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (!currentUser) {
        setCurrency(DEFAULT_CURRENCY);
        setCurrencyLoading(false);
        return;
      }

      try {
        setCurrencyLoading(true);

        const currentCurrency = await getUserCurrency();

        setCurrency(currentCurrency);
      } catch (error) {
        console.error("Unable to load user currency:", error);

        setCurrency(DEFAULT_CURRENCY);
      } finally {
        setCurrencyLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      currency,
      currencyLoading,
      refreshCurrency,
    }),
    [user, loading, currency, currencyLoading, refreshCurrency],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
