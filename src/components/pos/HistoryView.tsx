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
  X 
} from 'lucide-react';

export const HistoryView: React.FC = () => {
  const { transactions, currentUser, deleteTransaction } = useStore();
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [editingTrx, setEditingTrx] = useState<Transaction | null>(null);
  const [deletingTrx, setDeletingTrx] = useState<Transaction | null>(null);
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

  const handleConfirmDelete = () => {
    if (!deletingTrx) return;
    deleteTransaction(deletingTrx.id);
    setDeletingTrx(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Riwayat Transaksi Hari Ini</h2>
            <p className="text-xs text-slate-500">
              Daftar seluruh struk dan transaksi penjualan oleh {currentUser?.name}
            </p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-2xl">
          <span className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider block">
            Total Omset Kasir Hari Ini
          </span>
          <span className="text-xl font-black font-mono text-emerald-700">
            {formatRupiah(totalTodaySales)}
          </span>
        </div>
      </div>

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
                <p className="text-xs text-slate-500">Konfirmasi pembatalan struk penjualan</p>
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
              💡 <strong>Catatan:</strong> Stok produk pada transaksi ini akan otomatis dikembalikan ke stok gudang/toko, dan omset kasir akan diperbarui.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTrx(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Struk</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
