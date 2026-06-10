"use client";

import { Receipt } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  Groceries: "bg-green-100 text-green-700",
  Restaurant: "bg-orange-100 text-orange-700",
  Transport: "bg-blue-100 text-blue-700",
  Shopping: "bg-purple-100 text-purple-700",
  Other: "bg-gray-100 text-gray-600",
};

interface Props {
  receipt: Receipt;
  onClick: () => void;
  onDelete: () => void;
}

export default function ReceiptCard({ receipt, onClick, onDelete }: Props) {
  const categoryClass =
    CATEGORY_COLORS[receipt.category ?? "Other"] ?? CATEGORY_COLORS["Other"];

  const formattedDate = receipt.receipt_date
    ? new Date(receipt.receipt_date).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No date";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this receipt?")) {
      fetch(`/api/receipts/${receipt.id}`, { method: "DELETE" }).then(onDelete);
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {receipt.merchant || "Unknown Merchant"}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">{formattedDate}</p>
        </div>
        <button
          onClick={handleDelete}
          className="text-gray-300 hover:text-red-400 transition-colors ml-2 text-lg leading-none"
          aria-label="Delete"
        >
          ×
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryClass}`}>
          {receipt.category || "Other"}
        </span>
        <span className="text-base font-bold text-gray-900">
          {receipt.currency} {receipt.total != null ? Number(receipt.total).toFixed(2) : "—"}
        </span>
      </div>
    </div>
  );
}
