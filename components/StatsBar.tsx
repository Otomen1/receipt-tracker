"use client";

import { Receipt } from "@/lib/types";
import { Budgets, loadBudgets } from "./BudgetModal";
import { useEffect, useState } from "react";

interface Props {
  receipts: Receipt[];
}

export default function StatsBar({ receipts }: Props) {
  const [budgets, setBudgets] = useState<Budgets>({});

  useEffect(() => {
    setBudgets(loadBudgets());
  }, []);

  const now = new Date();
  const thisMonth = receipts.filter((r) => {
    if (!r.receipt_date) return false;
    const d = new Date(r.receipt_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const thisMonthSpend = thisMonth.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const allTimeSpend = receipts.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const avgReceipt = receipts.length > 0 ? allTimeSpend / receipts.length : 0;

  const merchantCounts: Record<string, number> = {};
  receipts.forEach((r) => {
    if (r.merchant) merchantCounts[r.merchant] = (merchantCounts[r.merchant] ?? 0) + 1;
  });
  const topMerchant = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const fmt = (n: number) =>
    n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Category spending this month
  const catSpend: Record<string, number> = {};
  thisMonth.forEach((r) => {
    const cat = r.category ?? "Other";
    catSpend[cat] = (catSpend[cat] ?? 0) + (r.total ?? 0);
  });

  const budgetedCats = Object.entries(budgets).filter(
    ([cat, limit]) => limit > 0 && catSpend[cat] !== undefined
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Receipts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{receipts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">This Month</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">MYR {fmt(thisMonthSpend)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Receipt</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">MYR {fmt(avgReceipt)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Top Merchant</p>
          <p className="text-lg font-bold text-gray-900 mt-1 truncate">{topMerchant ?? "—"}</p>
        </div>
      </div>

      {budgetedCats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Budget Progress (This Month)</p>
          <div className="space-y-2.5">
            {budgetedCats.map(([cat, limit]) => {
              const spent = catSpend[cat] ?? 0;
              const pct = Math.min((spent / limit) * 100, 100);
              const over = spent > limit;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700">{cat}</span>
                    <span className={over ? "text-red-600 font-medium" : "text-gray-500"}>
                      MYR {fmt(spent)} / {fmt(limit)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${over ? "bg-red-500" : pct > 80 ? "bg-yellow-500" : "bg-blue-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
