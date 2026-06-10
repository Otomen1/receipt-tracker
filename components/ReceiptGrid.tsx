"use client";

import { Receipt } from "@/lib/types";
import ReceiptCard from "./ReceiptCard";

interface Props {
  receipts: Receipt[];
  onSelect: (r: Receipt) => void;
  onDelete: () => void;
}

export default function ReceiptGrid({ receipts, onSelect, onDelete }: Props) {
  if (receipts.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">🧾</p>
        <p className="text-sm">No receipts yet. Upload one to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {receipts.map((r) => (
        <ReceiptCard
          key={r.id}
          receipt={r}
          onClick={() => onSelect(r)}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
