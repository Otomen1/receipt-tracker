"use client";

import { Receipt } from "@/lib/types";

const CATEGORIES = ["Groceries", "Restaurant", "Transport", "Shopping", "Healthcare", "Entertainment", "Utilities", "Travel", "Beauty", "Education", "Other"];

interface Props {
  search: string;
  onSearch: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  dateFrom: string;
  onDateFrom: (v: string) => void;
  dateTo: string;
  onDateTo: (v: string) => void;
  sort: string;
  onSort: (v: string) => void;
  receipts: Receipt[];
  onExport: () => void;
}

export default function FilterBar({
  search, onSearch, category, onCategory,
  dateFrom, onDateFrom, dateTo, onDateTo,
  sort, onSort, receipts, onExport,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Search + Export */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by merchant or category…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={onExport}
          disabled={receipts.length === 0}
          className="border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition-colors"
          title="Export CSV"
        >
          ↓ CSV
        </button>
      </div>

      {/* Date range + Sort */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-600"
        />
        <span className="text-gray-400 self-center text-sm">–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-600"
        />
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="ml-auto border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-600"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="amount-desc">Highest amount</option>
          <option value="amount-asc">Lowest amount</option>
          <option value="merchant-asc">Merchant A–Z</option>
        </select>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onCategory("")}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            category === "" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => onCategory(category === c ? "" : c)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              category === c ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
