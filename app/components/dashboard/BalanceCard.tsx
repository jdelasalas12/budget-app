"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, type DocumentData } from "firebase/firestore";

import { useAuth } from "@/app/components/auth/AuthProvider";
import { db } from "@/lib/firebase";
import { formatCurrency } from "@/lib/currency";

interface BalanceCardProps {
  currency: string;
}

export default function BalanceCard({ currency }: BalanceCardProps) {
  const { user } = useAuth();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setBalance(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const accountsRef = collection(db, "users", user.uid, "accounts");

    const unsubscribe = onSnapshot(
      accountsRef,
      (snapshot) => {
        let total = 0;

        snapshot.forEach((accountDoc) => {
          const data = accountDoc.data() as DocumentData;

          const accountBalance = Number(data.balance ?? 0);

          if (Number.isFinite(accountBalance)) {
            total += accountBalance;
          }
        });

        setBalance(total);
        setLoading(false);
      },
      (error) => {
        console.error("Unable to load dashboard balance:", error);

        setBalance(0);
        setError("Unable to load balance.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  return (
    <section className="rounded-3xl bg-black p-6 text-white shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/60">Total balance</p>

          {loading ? (
            <div className="mt-3 h-10 w-48 animate-pulse rounded-xl bg-white/10" />
          ) : (
            <h2 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">
              {formatCurrency(balance, currency)}
            </h2>
          )}

          <p className="mt-2 text-sm text-white/50">Across all your accounts</p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <span className="text-lg">₿</span>
        </div>
      </div>

      {error && <p className="mt-4 text-xs text-red-300">{error}</p>}
    </section>
  );
}
