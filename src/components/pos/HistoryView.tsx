import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Transaction } from '../../types';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { ReceiptModal } from './ReceiptModal';
import { EditTransactionModal } from './EditTransactionModal';
import { 
  Clock, 
  Printer, 
  Search, 
  Calendar, 
  CheckCircle2, 
  User, 
  Edit, 
  Trash2, 
  AlertTriangle,
  X,
  RefreshCw,
  Database,
  Loader2,
  AlertCircle
} from 'lucide-react';

export const HistoryView: React.FC = () => {
  const { 
    transactions, 
    currentUser, 
    deleteTransaction,
    isSupabaseConfigured,
    isSupabaseConnected,
    isTransactionsLoading,
    transactionsError,
    clearTransactionsError,
    refreshTransactions
  } = useStore();

  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [editingTrx, setEditingTrx] = useState<Transaction | null>(null);
  const [deletingTrx, setDeletingTrx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Filter transactions for today or current cashier
  const todayStr = new Date().toISOString().slice(0, 10);
  
  const relevantTransactions = transactions.filter(t => {
    const isToday = t.timestamp.startsWith(todayStr);
    const isMyCashier = currentUser?.role === 'admin' || t.cashierId === currentUser?.id;
    const matchSearch =
      !searchFilter ||
      t.invoiceNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (t.customerName && t.customerName.toLowerCase().includes(searchFilter.toLowerCase())) ||
      t.items.some(i => i.productName.toLowerCase().includes(searchFilter.toLowerCase()));

    return isToday && isMyCashier && matchSearch;
  });

  const totalTodaySales = relevantTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  const handleConfirmDelete = async () => {
    if (!deletingTrx) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(deletingTrx.id);
      setDeletingTrx(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900">Riwayat Transaksi Hari Ini</h2>
              {/* Supabase Status Pill */}
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                isSupabaseConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : isSupabaseConfigured
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}>
                <Database className="w-3 h-3" />
                {isSupabaseConnected ? 'Supabase Database Aktif' : isSupabaseConfigured ? 'Menghubungkan Supabase...' : 'Mode Offline / Local DB'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar seluruh struk dan transaksi penjualan oleh {currentUser?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={() => refreshTransactions()}
            disabled={isTransactionsLoading}
            className="py-2 px-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            title="Muat ulang data dari database Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTransactionsLoading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isTransactionsLoading ? 'Memuat...' : 'Refresh DB'}</span>
          </button>

          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl">
            <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">
              Total Omset Hari Ini
            </span>
            <span className="text-lg font-black font-mono text-emerald-700">
              {formatRupiah(totalTodaySales)}
            </span>
          </div>
        </div>
      </div>

      {/* Supabase Error Alert Banner */}
      {transactionsError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-start justify-between gap-3 text-rose-800 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">Terjadi Kendala pada Sinkronisasi Database Supabase:</p>
              <p className="text-rose-700 mt-0.5 font-mono">{transactionsError}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => refreshTransactions()}
              className="py-1 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition cursor-pointer"
            >
              Coba Lagi
            </button>
            <button
              type="button"
              onClick={clearTransactionsError}
              className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          placeholder="Cari nomor struk / nama pelanggan / nama barang..."
          className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none"
        />
        {searchFilter && (
          <button
            type="button"
            onClick={() => setSearchFilter('')}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Reset
          </button>
        )}
      </div>

      {/* Transactions Table / Cards */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {isTransactionsLoading && relevantTransactions.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs font-semibold">Mengambil data transaksi dari tabel Supabase...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No. Invoice</th>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Kasir / Pelanggan</th>
                  <th className="py-3 px-4">Item Belanja</th>
                  <th className="py-3 px-4">Metode Bayar</th>
                  <th className="py-3 px-4 text-right">Total Transaksi</th>
                  <th className="py-3 px-4 text-center">Aksi / Struk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relevantTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Belum ada transaksi yang tercatat hari ini.
                    </td>
                  </tr>
                ) : (
                  relevantTransactions.map(trx => (
                    <tr key={trx.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {trx.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {formatDateTimeIndo(trx.timestamp)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{trx.cashierName}</div>
                        {trx.customerName && (
                          <div className="text-[11px] text-amber-700 font-medium">
                            Pelanggan: {trx.customerName}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-xs">
                          {trx.items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-[11px] text-slate-600 truncate">
                              • {item.productName} ({item.quantity} {item.unit})
                            </div>
                          ))}
                          {trx.items.length > 2 && (
                            <div className="text-[10px] text-slate-400 italic">
                              +{trx.items.length - 2} item lainnya
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          trx.paymentMethod === 'tunai'
                            ? 'bg-emerald-100 text-emerald-800'
                            : trx.paymentMethod === 'qris'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {trx.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-slate-900">
                        {formatRupiah(trx.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedTrx(trx)}
                            className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 text-slate-700 font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                            title="Lihat dan cetak ulang struk"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                            <span className="hidden sm:inline">Struk</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTrx(trx)}
                            className="py-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                            title="Edit transaksi struk ini"
                          >
                            <Edit className="w-3.5 h-3.5 text-amber-700" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTrx(trx)}
                            className="py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                            title="Hapus transaksi struk ini"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        transaction={selectedTrx}
        onClose={() => setSelectedTrx(null)}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        transaction={editingTrx}
        onClose={() => setEditingTrx(null)}
      />

      {/* Delete Confirmation Modal */}
      {deletingTrx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Hapus Struk Transaksi</h3>
                <p className="text-xs text-slate-500">Konfirmasi pembatalan struk di database Supabase</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <p className="text-slate-800 font-bold text-sm">
                Apakah Anda yakin ingin menghapus struk ini?
              </p>
              <div className="pt-2 border-t border-slate-200 space-y-1 font-mono text-slate-600 text-[11px]">
                <div className="flex justify-between">
                  <span>No. Invoice:</span>
                  <span className="font-bold text-slate-900">{deletingTrx.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Belanja:</span>
                  <span className="font-bold text-emerald-700">{formatRupiah(deletingTrx.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Metode Bayar:</span>
                  <span className="uppercase">{deletingTrx.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Waktu:</span>
                  <span>{formatDateTimeIndo(deletingTrx.timestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kasir:</span>
                  <span>{deletingTrx.cashierName}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-900">
              💡 <strong>Catatan:</strong> Data akan dihapus dari tabel Supabase, stok produk dikembalikan ke gudang/toko, dan omset kasir diperbarui.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingTrx(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus Struk</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        transaction={selectedTrx}
        onClose={() => setSelectedTrx(null)}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        transaction={editingTrx}
        onClose={() => setEditingTrx(null)}
      />
    </div>
  );
};
