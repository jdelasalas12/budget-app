"use client";

import { getCurrency } from "@/lib/currency";

interface IncomeExpenseCardsProps {
  currency: string;
}

export default function IncomeExpenseCards({
  currency,
}: IncomeExpenseCardsProps) {
  const currencyInfo = getCurrency(currency);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50">
            ↗
          </div>

          <p className="text-sm font-medium text-gray-500">Income</p>
        </div>

        <p className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">
          {currencyInfo.symbol} 0.00
        </p>

        <p className="mt-1 text-xs text-gray-400">This month</p>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50">
            ↘
          </div>

          <p className="text-sm font-medium text-gray-500">Expenses</p>
        </div>

        <p className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">
          {currencyInfo.symbol} 0.00
        </p>

        <p className="mt-1 text-xs text-gray-400">This month</p>
      </div>
    </div>
  );
}
