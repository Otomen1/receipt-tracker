"use client";

import { useState, useEffect } from "react";

const CATEGORIES = ["Groceries", "Restaurant", "Transport", "Shopping", "Healthcare", "Entertainment", "Utilities", "Travel", "Beauty", "Education", "Other"];
const STORAGE_KEY = "receipt-tracker-budgets";

export type Budgets = Record<string, number>;

export function loadBudgets(): Budgets {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveBudgets(b: Budgets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
}

interface Props {
  onClose: () => void;
}

export default function BudgetModal({ onClose }: Props) {
  const [budgets, setBudgets] = useState<Budgets>({});

  useEffect(() => {
    setBudgets(loadBudgets());
  }, []);

  const update = (cat: string, val: string) => {
    const num = parseFloat(val);
    setBudgets((prev) => ({ ...prev, [cat]: isNaN(num) ? 0 : num }));
  };

  const handleSave = () => {
    saveBudgets(budgets);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Monthly Budgets</h2>
            <p className="text-xs text-gray-400 mt-0.5">Set spending limits per category (MYR)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 overflow-y-auto space-y-2">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center gap-3">
              <label className="text-sm text-gray-700 w-32 shrink-0">{cat}</label>
              <input
                type="number"
                step="10"
                placeholder="No limit"
                value={budgets[cat] || ""}
                onChange={(e) => update(cat, e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          ))}
        </div>
        <div className="p-5 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Save Budgets</button>
        </div>
      </div>
    </div>
  );
}
