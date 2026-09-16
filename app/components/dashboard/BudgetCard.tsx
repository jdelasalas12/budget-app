"use client";

import { getCurrency } from "@/lib/currency";

interface BudgetCardProps {
  currency: string;
}

export default function BudgetCard({ currency }: BudgetCardProps) {
  const currencyInfo = getCurrency(currency);

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Monthly Budget</p>

          <h2 className="mt-2 text-2xl font-bold">
            {currencyInfo.symbol} 0.00
          </h2>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100">
          🎯
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full w-0 rounded-full bg-black" />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>{currencyInfo.symbol} 0.00 spent</span>

        <span>{currencyInfo.symbol} 0.00 remaining</span>
      </div>

      <button
        type="button"
        className="mt-5 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold transition hover:bg-gray-50"
      >
        Create a budget
      </button>
    </section>
  );
}
