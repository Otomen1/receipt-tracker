"use client";

import { useEffect, useState, useCallback } from "react";
import { Receipt } from "@/lib/types";
import StatsBar from "@/components/StatsBar";
import ReceiptGrid from "@/components/ReceiptGrid";
import UploadDropzone from "@/components/UploadDropzone";
import ReceiptDetail from "@/components/ReceiptDetail";
import ManualReceiptModal from "@/components/ManualReceiptModal";

export default function Home() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const fetchReceipts = useCallback(async () => {
    try {
      const res = await fetch("/api/receipts");
      const data = await res.json();
      setReceipts(data);
    } catch (err) {
      console.error("Failed to fetch receipts", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const filtered = receipts.filter((r) => {
    const q = search.toLowerCase();
    return (
      (r.merchant ?? "").toLowerCase().includes(q) ||
      (r.category ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receipt Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload and manage your receipts
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManual(true)}
            className="border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            + Add Manually
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Upload Receipt
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar receipts={receipts} />

      {/* Search */}
      <div className="mt-6 mb-4">
        <input
          type="text"
          placeholder="Search by merchant or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <ReceiptGrid
          receipts={filtered}
          onSelect={setSelectedReceipt}
          onDelete={fetchReceipts}
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadDropzone
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false);
            fetchReceipts();
          }}
        />
      )}

      {/* Manual Entry Modal */}
      {showManual && (
        <ManualReceiptModal
          onClose={() => setShowManual(false)}
          onSaved={() => {
            setShowManual(false);
            fetchReceipts();
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedReceipt && (
        <ReceiptDetail
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onUpdated={(updated) => {
            setReceipts((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            setSelectedReceipt(updated);
          }}
        />
      )}
    </div>
  );
}
