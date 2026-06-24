"use client";

import { Receipt } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { useState } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  Groceries: "#16a34a",
  Restaurant: "#ea580c",
  Transport: "#2563eb",
  Shopping: "#9333ea",
  Healthcare: "#dc2626",
  Entertainment: "#db2777",
  Utilities: "#ca8a04",
  Travel: "#0284c7",
  Beauty: "#c026d3",
  Education: "#0d9488",
  Other: "#6b7280",
};

interface Props {
  receipts: Receipt[];
}

export default function SpendingChart({ receipts }: Props) {
  const [view, setView] = useState<"monthly" | "category">("monthly");

  // Monthly data — last 6 months
  const monthlyData = (() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const month = d.toLocaleString("en-MY", { month: "short", year: "2-digit" });
      const total = receipts
        .filter((r) => {
          if (!r.receipt_date) return false;
          const rd = new Date(r.receipt_date);
          return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
        })
        .reduce((s, r) => s + (r.total ?? 0), 0);
      return { month, total: parseFloat(total.toFixed(2)) };
    });
  })();

  // Category data
  const categoryData = (() => {
    const map: Record<string, number> = {};
    receipts.forEach((r) => {
      const cat = r.category ?? "Other";
      map[cat] = (map[cat] ?? 0) + (r.total ?? 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  })();

  if (receipts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Spending Overview</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setView("monthly")}
            className={`text-xs px-3 py-1 rounded-lg transition-colors ${view === "monthly" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setView("category")}
            className={`text-xs px-3 py-1 rounded-lg transition-colors ${view === "category" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
          >
            By Category
          </button>
        </div>
      </div>

      {view === "monthly" ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => [`MYR ${Number(v).toFixed(2)}`, "Spent"]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={categoryData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={75}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
              fontSize={11}
            >
              {categoryData.map((entry) => (
                <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? "#6b7280"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [`MYR ${Number(v).toFixed(2)}`]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
