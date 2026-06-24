"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Receipt } from "@/lib/types";
import StatsBar from "@/components/StatsBar";
import ReceiptGrid from "@/components/ReceiptGrid";
import UploadDropzone from "@/components/UploadDropzone";
import ReceiptDetail from "@/components/ReceiptDetail";
import ManualReceiptModal from "@/components/ManualReceiptModal";
import FilterBar from "@/components/FilterBar";
import SpendingChart from "@/components/SpendingChart";
import BudgetModal from "@/components/BudgetModal";
import { ToastProvider } from "@/components/Toast";

function AppContent() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("date-desc");
  const [showUpload, setShowUpload] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);
  const deferredPrompt = useRef<any>(null);

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

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShowPwaBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setShowPwaBanner(false);
  };

  // Filter
  const filtered = receipts.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (r.merchant ?? "").toLowerCase().includes(q) ||
      (r.category ?? "").toLowerCase().includes(q);
    const matchCat = !category || r.category === category;
    const matchFrom = !dateFrom || (r.receipt_date ?? "") >= dateFrom;
    const matchTo = !dateTo || (r.receipt_date ?? "") <= dateTo;
    return matchSearch && matchCat && matchFrom && matchTo;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "date-asc") return (a.receipt_date ?? "").localeCompare(b.receipt_date ?? "");
    if (sort === "date-desc") return (b.receipt_date ?? "").localeCompare(a.receipt_date ?? "");
    if (sort === "amount-desc") return (b.total ?? 0) - (a.total ?? 0);
    if (sort === "amount-asc") return (a.total ?? 0) - (b.total ?? 0);
    if (sort === "merchant-asc") return (a.merchant ?? "").localeCompare(b.merchant ?? "");
    return 0;
  });

  // CSV export
  const handleExport = () => {
    const header = ["Date", "Merchant", "Category", "Total", "Currency", "Payment Method"];
    const rows = sorted.map((r) => [
      r.receipt_date ?? "",
      `"${(r.merchant ?? "").replace(/"/g, '""')}"`,
      r.category ?? "",
      r.total?.toFixed(2) ?? "",
      r.currency,
      r.payment_method ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receipts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* PWA Banner */}
      {showPwaBanner && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-blue-700">Install Receipt Tracker as an app for quick access</p>
          <div className="flex gap-2 ml-4">
            <button
              onClick={handleInstall}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
            >
              Install
            </button>
            <button
              onClick={() => setShowPwaBanner(false)}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receipt Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Upload and manage your receipts</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowBudget(true)}
            className="border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Budgets
          </button>
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

      {/* Charts */}
      <div className="mt-6">
        <SpendingChart receipts={receipts} />
      </div>

      {/* Filters */}
      <div className="mt-6 mb-4">
        <FilterBar
          search={search} onSearch={setSearch}
          category={category} onCategory={setCategory}
          dateFrom={dateFrom} onDateFrom={setDateFrom}
          dateTo={dateTo} onDateTo={setDateTo}
          sort={sort} onSort={setSort}
          receipts={sorted} onExport={handleExport}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <ReceiptGrid
          receipts={sorted}
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

      {/* Budget Modal */}
      {showBudget && (
        <BudgetModal onClose={() => setShowBudget(false)} />
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

export default function Home() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
