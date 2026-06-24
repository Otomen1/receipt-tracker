"use client";

import { useState } from "react";
import { Receipt } from "@/lib/types";
import EditReceiptModal from "./EditReceiptModal";

interface Props {
  receipt: Receipt;
  onClose: () => void;
  onUpdated: (r: Receipt) => void;
}

export default function ReceiptDetail({ receipt, onClose, onUpdated }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const [current, setCurrent] = useState<Receipt>(receipt);

  const formattedDate = current.receipt_date
    ? new Date(current.receipt_date).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Unknown date";

  const handleSaved = (updated: Receipt) => {
    setCurrent(updated);
    setShowEdit(false);
    onUpdated(updated);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 truncate flex-1">
              {current.merchant || "Receipt"}
            </h2>
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={() => setShowEdit(true)}
                className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 font-medium hover:bg-blue-50 transition-colors"
              >
                Edit
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
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
                  {current.currency}{" "}
                  {current.total != null ? Number(current.total).toFixed(2) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Category</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {current.category || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Currency</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{current.currency}</p>
              </div>

              {current.payment_method && (
                <div>
                  <p className="text-xs text-gray-500">Payment</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{current.payment_method}</p>
                </div>
              )}

              {current.sst_amount != null && (
                <div>
                  <p className="text-xs text-gray-500">SST</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {current.currency} {Number(current.sst_amount).toFixed(2)}
                  </p>
                </div>
              )}

              {current.discount != null && (
                <div>
                  <p className="text-xs text-gray-500">Discount</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5 text-green-700">
                    − {current.currency} {Number(current.discount).toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {current.items && current.items.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Line Items</p>
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                  {current.items.map((item, i) => (
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

            {current.file_url && (
              <div>
                <p className="text-xs text-gray-500 mb-1">File</p>
                <a
                  href={current.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate block"
                >
                  View original file ↗
                </a>
              </div>
            )}

            {current.raw_text && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Raw OCR Text</p>
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {current.raw_text}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <EditReceiptModal
          receipt={current}
          onClose={() => setShowEdit(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
