"use client";

import { useState } from "react";
import { ReceiptItem } from "@/lib/types";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIES = ["Groceries", "Restaurant", "Transport", "Shopping", "Other"];

export default function ManualReceiptModal({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    merchant: "",
    receipt_date: "",
    total: "",
    currency: "MYR",
    category: "Other",
  });
  const [items, setItems] = useState<ReceiptItem[]>([]);

  const addItem = () => setItems([...items, { name: "", quantity: null, price: null }]);

  const updateItem = (index: number, field: keyof ReceiptItem, value: string) => {
    setItems(items.map((item, i) => {
      if (i !== index) return item;
      if (field === "name") return { ...item, name: value };
      const num = value === "" ? null : parseFloat(value);
      return { ...item, [field]: isNaN(num as number) ? null : num };
    }));
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          total: form.total ? parseFloat(form.total) : null,
          items,
          raw_text: null,
          file_url: null,
          file_type: null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Add Receipt Manually</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Merchant</label>
            <input
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="e.g. Tesco, McDonald's"
              value={form.merchant}
              onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Date</label>
              <input
                type="date"
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.receipt_date}
                onChange={(e) => setForm({ ...form, receipt_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Total</label>
              <input
                type="number"
                step="0.01"
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="0.00"
                value={form.total}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Currency</label>
              <input
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Category</label>
              <select
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">Items (optional)</label>
              <button
                onClick={addItem}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add item
              </button>
            </div>
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Item name"
                      value={item.name}
                      onChange={(e) => updateItem(i, "name", e.target.value)}
                    />
                    <input
                      type="number"
                      className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Qty"
                      value={item.quantity ?? ""}
                      onChange={(e) => updateItem(i, "quantity", e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Price"
                      value={item.price ?? ""}
                      onChange={(e) => updateItem(i, "price", e.target.value)}
                    />
                    <button
                      onClick={() => removeItem(i)}
                      className="text-gray-400 hover:text-red-500 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Receipt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
