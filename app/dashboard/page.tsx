"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import ProtectedRoute from "@/app/components/auth/ProtectedRoute";
import DashboardNavigation from "@/app/components/dashboard/DashboardNavigation";
import DashboardHeader from "@/app/components/dashboard/DashboardHeader";
import BalanceCard from "@/app/components/dashboard/BalanceCard";
import IncomeExpenseCards from "@/app/components/dashboard/IncomeExpenseCards";
import BudgetCard from "@/app/components/dashboard/BudgetCard";
import RecentTransactions from "@/app/components/dashboard/RecentTransactions";

import { useAuth } from "@/app/components/auth/AuthProvider";
import { db } from "@/lib/firebase";
import { DEFAULT_CURRENCY } from "@/lib/currency";

export default function DashboardPage() {
  const { user } = useAuth();

  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  useEffect(() => {
    if (!user) {
      setCurrency(DEFAULT_CURRENCY);
      return;
    }

    const userRef = doc(db, "users", user.uid);

    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (!snapshot.exists()) {
        setCurrency(DEFAULT_CURRENCY);
        return;
      }

      const data = snapshot.data();

      if (typeof data.currency === "string") {
        setCurrency(data.currency);
      } else {
        setCurrency(DEFAULT_CURRENCY);
      }
    });

    return unsubscribe;
  }, [user]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#f5f5f7]">
        <DashboardNavigation />

        <main className="min-h-screen md:pl-64">
          <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-8 lg:px-8">
            <DashboardHeader />

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <BalanceCard currency={currency} />

              <IncomeExpenseCards currency={currency} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <BudgetCard currency={currency} />

              <RecentTransactions />
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
