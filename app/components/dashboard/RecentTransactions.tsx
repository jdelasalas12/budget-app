import Link from "next/link";

export default function RecentTransactions() {
  return (
    <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-bold text-gray-950">Recent Transactions</h2>

          <p className="mt-1 text-xs text-gray-400">
            Your latest income and expenses
          </p>
        </div>

        <Link
          href="/transactions"
          className="text-sm font-semibold text-gray-700 hover:text-black"
        >
          View all
        </Link>
      </div>

      <div className="px-5 py-10 text-center sm:px-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-xl">
          🧾
        </div>

        <h3 className="mt-4 font-semibold text-gray-900">
          No transactions yet
        </h3>

        <p className="mx-auto mt-2 max-w-xs text-sm text-gray-500">
          Add your first income or expense to start tracking your finances.
        </p>

        <Link
          href="/transactions"
          className="mt-5 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Add transaction
        </Link>
      </div>
    </section>
  );
}
