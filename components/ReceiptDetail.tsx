"use client";

import { useState } from "react";
import { Receipt } from "@/lib/types";
import EditReceiptModal from "./EditReceiptModal";

interface Props {
  receipt: Receipt;
  onClose: () => void;
  onUpdated: (r: Receipt) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Groceries: "🛒",
  Restaurant: "🍽️",
  Transport: "🚗",
  Shopping: "🛍️",
  Other: "🧾",
};

export default function ReceiptDetail({ receipt, onClose, onUpdated }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const [current, setCurrent] = useState<Receipt>(receipt);

  const handleSaved = (updated: Receipt) => {
    setCurrent(updated);
    setShowEdit(false);
    onUpdated(updated);
  };

  const formattedDate = current.receipt_date
    ? new Date(current.receipt_date).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const itemsTotal = current.items?.reduce(
    (sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 1),
    0
  ) ?? 0;

  const emoji = CATEGORY_EMOJI[current.category ?? "Other"] ?? "🧾";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-sm flex flex-col" style={{ maxHeight: "90vh" }}>

          {/* Action bar above receipt */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-sm flex items-center gap-1"
            >
              ← Close
            </button>
            <button
              onClick={() => setShowEdit(true)}
              className="text-white/80 hover:text-white text-sm border border-white/30 rounded-lg px-3 py-1.5"
            >
              Edit
            </button>
          </div>

          {/* Receipt paper */}
          <div className="overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="bg-white relative font-mono" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>

              {/* Torn top edge */}
              <div className="w-full overflow-hidden" style={{ height: 16 }}>
                <svg viewBox="0 0 400 16" preserveAspectRatio="none" className="w-full h-full">
                  <path d="M0,16 Q10,4 20,16 Q30,4 40,16 Q50,4 60,16 Q70,4 80,16 Q90,4 100,16 Q110,4 120,16 Q130,4 140,16 Q150,4 160,16 Q170,4 180,16 Q190,4 200,16 Q210,4 220,16 Q230,4 240,16 Q250,4 260,16 Q270,4 280,16 Q290,4 300,16 Q310,4 320,16 Q330,4 340,16 Q350,4 360,16 Q370,4 380,16 Q390,4 400,16 L400,0 L0,0 Z" fill="white"/>
                </svg>
              </div>

              <div className="px-6 pb-2">
                {/* Header */}
                <div className="text-center mb-4">
                  <div className="text-3xl mb-1">{emoji}</div>
                  <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide leading-tight">
                    {current.merchant || "RECEIPT"}
                  </h2>
                  {formattedDate && (
                    <p className="text-xs text-gray-500 mt-1">{formattedDate}</p>
                  )}
                  {current.category && (
                    <span className="inline-block mt-1 text-xs text-gray-400 uppercase tracking-widest">
                      {current.category}
                    </span>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t-2 border-dashed border-gray-200 mb-4" />

                {/* Line items */}
                {current.items && current.items.length > 0 ? (
                  <div className="mb-4 space-y-1.5">
                    {current.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-700">
                        <span className="flex-1 truncate pr-2">
                          {item.quantity != null && item.quantity !== 1
                            ? `${item.name} x${item.quantity}`
                            : item.name}
                        </span>
                        <span className="font-medium tabular-nums">
                          {item.price != null
                            ? (item.price * (item.quantity ?? 1)).toFixed(2)
                            : "—"}
                        </span>
                      </div>
                    ))}

                    {/* Items subtotal if we have prices */}
                    {itemsTotal > 0 && (
                      <div className="flex justify-between text-xs text-gray-400 pt-1">
                        <span>Subtotal</span>
                        <span className="tabular-nums">{itemsTotal.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 text-center mb-4 italic">No line items</p>
                )}

                {/* Tax / discount rows */}
                {(current.sst_amount != null || current.discount != null) && (
                  <div className="space-y-1 mb-3">
                    {current.discount != null && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>Discount</span>
                        <span className="tabular-nums">− {Number(current.discount).toFixed(2)}</span>
                      </div>
                    )}
                    {current.sst_amount != null && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>SST</span>
                        <span className="tabular-nums">{Number(current.sst_amount).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="border-t-2 border-dashed border-gray-200 my-3" />
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">Total</span>
                  <span className="text-xl font-bold text-gray-900 tabular-nums">
                    {current.currency} {current.total != null ? Number(current.total).toFixed(2) : "—"}
                  </span>
                </div>

                {/* Payment method */}
                {current.payment_method && (
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Paid by</span>
                    <span>{current.payment_method}</span>
                  </div>
                )}

                <div className="border-t-2 border-dashed border-gray-200 mt-4 mb-4" />

                {/* Footer */}
                <div className="text-center space-y-1 mb-2">
                  {current.file_url && (
                    <a
                      href={current.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-blue-500 hover:underline"
                    >
                      View original file ↗
                    </a>
                  )}
                  {current.raw_text && (
                    <details className="text-left mt-2">
                      <summary className="text-xs text-gray-400 cursor-pointer text-center">
                        Show OCR text
                      </summary>
                      <pre className="text-xs text-gray-500 mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto bg-gray-50 rounded p-2">
                        {current.raw_text}
                      </pre>
                    </details>
                  )}
                  <p className="text-xs text-gray-300 pt-2 tracking-widest">* * * * * * * * * *</p>
                  <p className="text-xs text-gray-300">Thank you</p>
                </div>
              </div>

              {/* Torn bottom edge */}
              <div className="w-full overflow-hidden" style={{ height: 16 }}>
                <svg viewBox="0 0 400 16" preserveAspectRatio="none" className="w-full h-full">
                  <path d="M0,0 Q10,12 20,0 Q30,12 40,0 Q50,12 60,0 Q70,12 80,0 Q90,12 100,0 Q110,12 120,0 Q130,12 140,0 Q150,12 160,0 Q170,12 180,0 Q190,12 200,0 Q210,12 220,0 Q230,12 240,0 Q250,12 260,0 Q270,12 280,0 Q290,12 300,0 Q310,12 320,0 Q330,12 340,0 Q350,12 360,0 Q370,12 380,0 Q390,12 400,0 L400,16 L0,16 Z" fill="white"/>
                </svg>
              </div>
            </div>
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
