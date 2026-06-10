"use client";

import { Receipt } from "@/lib/types";

interface Props {
  receipts: Receipt[];
}

export default function StatsBar({ receipts }: Props) {
  const now = new Date();
  const thisMonth = receipts.filter((r) => {
    if (!r.receipt_date) return false;
    const d = new Date(r.receipt_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const thisMonthSpend = thisMonth.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const allTimeSpend = receipts.reduce((sum, r) => sum + (r.total ?? 0), 0);

  const fmt = (n: number) =>
    n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide">Total Receipts</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{receipts.length}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide">This Month</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">MYR {fmt(thisMonthSpend)}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide">All Time</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">MYR {fmt(allTimeSpend)}</p>
      </div>
    </div>
  );
}
