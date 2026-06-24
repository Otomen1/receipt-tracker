"use client";

import { useState } from "react";
import { Receipt } from "@/lib/types";
import ReceiptCard from "./ReceiptCard";

const PAGE_SIZE = 12;

interface Props {
  receipts: Receipt[];
  onSelect: (r: Receipt) => void;
  onDelete: () => void;
}

export default function ReceiptGrid({ receipts, onSelect, onDelete }: Props) {
  const [page, setPage] = useState(1);

  if (receipts.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-5xl mb-4">🧾</p>
        <p className="text-base font-medium text-gray-500">No receipts found</p>
        <p className="text-sm mt-1">Upload a receipt or add one manually to get started</p>
      </div>
    );
  }

  const totalPages = Math.ceil(receipts.length / PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const pageReceipts = receipts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageReceipts.map((r) => (
          <ReceiptCard
            key={r.id}
            receipt={r}
            onClick={() => onSelect(r)}
            onDelete={onDelete}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {safePage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
