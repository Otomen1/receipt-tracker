"use client";

import { useState } from "react";
import { Receipt } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  Groceries: "bg-green-100 text-green-700",
  Restaurant: "bg-orange-100 text-orange-700",
  Transport: "bg-blue-100 text-blue-700",
  Shopping: "bg-purple-100 text-purple-700",
  Healthcare: "bg-red-100 text-red-700",
  Entertainment: "bg-pink-100 text-pink-700",
  Utilities: "bg-yellow-100 text-yellow-700",
  Travel: "bg-sky-100 text-sky-700",
  Beauty: "bg-fuchsia-100 text-fuchsia-700",
  Education: "bg-teal-100 text-teal-700",
  Other: "bg-gray-100 text-gray-600",
};

interface Props {
  receipt: Receipt;
  onClick: () => void;
  onDelete: () => void;
}

export default function ReceiptCard({ receipt, onClick, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const categoryClass = CATEGORY_COLORS[receipt.category ?? "Other"] ?? CATEGORY_COLORS["Other"];
  const isImage = receipt.file_url && receipt.file_type?.startsWith("image");

  const formattedDate = receipt.receipt_date
    ? new Date(receipt.receipt_date).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No date";

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      fetch(`/api/receipts/${receipt.id}`, { method: "DELETE" }).then(onDelete);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:border-gray-200 transition-all overflow-hidden"
    >
      {isImage && (
        <img
          src={receipt.file_url!}
          alt={receipt.merchant ?? "Receipt"}
          className="w-full h-28 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {receipt.merchant || "Unknown Merchant"}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{formattedDate}</p>
          </div>
          {confirmDelete ? (
            <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-gray-500">Sure?</span>
              <button
                onClick={handleDeleteClick}
                className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors"
              >
                Yes
              </button>
              <button
                onClick={handleCancelDelete}
                className="text-xs text-gray-600 hover:text-gray-900 px-1 py-0.5 rounded transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className="text-gray-300 hover:text-red-400 transition-colors ml-2 text-lg leading-none"
              aria-label="Delete"
            >
              ×
            </button>
          )}
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
    </div>
  );
}
