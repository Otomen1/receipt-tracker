"use client";

import { useState, useCallback } from "react";
import { ExtractedReceiptData, ReceiptItem } from "@/lib/types";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIES = ["Groceries", "Restaurant", "Transport", "Shopping", "Healthcare", "Entertainment", "Utilities", "Travel", "Beauty", "Education", "Other"];

export default function UploadDropzone({ onClose, onSaved }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<(ExtractedReceiptData & { file_url: string; file_type: string; confidence?: string; warnings?: string[] }) | null>(null);
  const [form, setForm] = useState({
    merchant: "",
    receipt_date: "",
    total: "",
    currency: "MYR",
    category: "Other",
  });
  const [items, setItems] = useState<ReceiptItem[]>([]);

  const processFile = useCallback(async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setError("Only JPEG, PNG, or PDF files are supported.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      setExtracted(data);
      setItems(Array.isArray(data.items) ? data.items : []);
      setForm({
        merchant: data.merchant || "",
        receipt_date: data.receipt_date || "",
        total: data.total != null ? String(data.total) : "",
        currency: data.currency || "MYR",
        category: data.category || "Other",
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const addItem = () => setItems([...items, { name: "" }]);

  const updateItem = (index: number, field: keyof ReceiptItem, value: string) => {
    setItems(items.map((item, i) => {
      if (i !== index) return item;
      if (field === "name") return { ...item, name: value };
      const num = parseFloat(value);
      return { ...item, [field]: value === "" || isNaN(num) ? undefined : num };
    }));
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!extracted) return;
    setSaving(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          total: form.total ? parseFloat(form.total) : null,
          items,
          raw_text: extracted.raw_text,
          file_url: extracted.file_url,
          file_type: extracted.file_type,
          sst_amount: extracted.sst_amount ?? null,
          discount: extracted.discount ?? null,
          payment_method: extracted.payment_method ?? null,
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
          <h2 className="font-semibold text-gray-900">Upload Receipt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-5 overflow-y-auto">
          {!extracted && !uploading && (
            <div className="space-y-3">
              <label
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-10 cursor-pointer transition-colors ${
                  dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="text-4xl mb-3">📎</span>
                <p className="text-sm font-medium text-gray-700">Drag & drop a receipt</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse • PDF, JPEG, PNG</p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-100" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 border-t border-gray-100" />
              </div>

              <label className="flex items-center justify-center gap-2 w-full border border-gray-200 rounded-xl py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <span className="text-lg">📷</span>
                <span className="text-sm font-medium text-gray-700">Scan with Camera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </div>
          )}

          {uploading && (
            <div className="flex flex-col items-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">Extracting data with OCR…</p>
            </div>
          )}

          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          {extracted && (
            <div className="space-y-3">
              {extracted.confidence && extracted.confidence !== "high" && (
                <div className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2">
                  <span className="font-medium">Review recommended</span> — some fields may be inaccurate.
                  {extracted.warnings && extracted.warnings.length > 0 && (
                    <ul className="mt-1 list-disc list-inside space-y-0.5">
                      {extracted.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600">Merchant</label>
                <input
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                  <label className="text-xs font-medium text-gray-600">
                    Items {items.length > 0 && <span className="text-gray-400">({items.length} found)</span>}
                  </label>
                  <button
                    onClick={addItem}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add item
                  </button>
                </div>

                {items.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {/* Column headers */}
                    <div className="flex gap-2 text-xs text-gray-400 px-0.5">
                      <span className="flex-1">Name</span>
                      <span className="w-14 text-center">Qty</span>
                      <span className="w-20 text-center">Price</span>
                      <span className="w-5" />
                    </div>
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
                          placeholder="—"
                          value={item.quantity ?? ""}
                          onChange={(e) => updateItem(i, "quantity", e.target.value)}
                        />
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="0.00"
                          value={item.price ?? ""}
                          onChange={(e) => updateItem(i, "price", e.target.value)}
                        />
                        <button
                          onClick={() => removeItem(i)}
                          className="text-gray-300 hover:text-red-500 text-lg leading-none w-5 shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No items detected — click + Add item to add manually.</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setExtracted(null); setItems([]); setError(null); }}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Re-upload
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
          )}
        </div>
      </div>
    </div>
  );
}
