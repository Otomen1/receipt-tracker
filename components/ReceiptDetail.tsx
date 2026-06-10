"use client";

import { Receipt } from "@/lib/types";

interface Props {
  receipt: Receipt;
  onClose: () => void;
  onUpdated: (r: Receipt) => void;
}

export default function ReceiptDetail({ receipt, onClose, onUpdated }: Props) {
  const formattedDate = receipt.receipt_date
    ? new Date(receipt.receipt_date).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Unknown date";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 truncate flex-1">
            {receipt.merchant || "Receipt"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-2">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Date</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{formattedDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {receipt.currency}{" "}
                {receipt.total != null ? Number(receipt.total).toFixed(2) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Category</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">
                {receipt.category || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Currency</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{receipt.currency}</p>
            </div>
          </div>

          {receipt.items && receipt.items.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Line Items</p>
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                {receipt.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-gray-700">{item.name}</span>
                    <div className="text-sm text-gray-500 flex gap-3">
                      {item.quantity != null && <span>×{item.quantity}</span>}
                      {item.price != null && (
                        <span className="font-medium text-gray-900">
                          {Number(item.price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {receipt.file_url && (
            <div>
              <p className="text-xs text-gray-500 mb-1">File</p>
              <a
                href={receipt.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline truncate block"
              >
                View original file ↗
              </a>
            </div>
          )}

          {receipt.raw_text && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Raw OCR Text</p>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {receipt.raw_text}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
