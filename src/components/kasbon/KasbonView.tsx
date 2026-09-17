import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Transaction } from '../../types';
import { formatRupiah, formatDateTimeIndo, formatDateIndo } from '../../utils/formatters';
import { EditKasbonModal } from './EditKasbonModal';
import { 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  Phone, 
  Calendar, 
  Search, 
  ArrowDownCircle,
  Edit,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  RefreshCw,
  Database
} from 'lucide-react';

export const KasbonView: React.FC = () => {
  const { 
    transactions, 
    payKasbon, 
    deleteTransaction,
    isSupabaseConfigured,
    isSupabaseConnected,
    isTransactionsLoading,
    transactionsError,
    clearTransactionsError,
    refreshTransactions
  } = useStore();

  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');

  // Modal states
  const [editingKasbon, setEditingKasbon] = useState<Transaction | null>(null);
  const [deletingKasbon, setDeletingKasbon] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessingPay, setIsProcessingPay] = useState(false);

  // Filter kasbon transactions
  const kasbonList = transactions.filter(t => t.paymentMethod === 'kasbon');

  const filteredKasbon = kasbonList.filter(k => {
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'unpaid' && !k.isKasbonPaid) ||
      (statusFilter === 'paid' && k.isKasbonPaid);

    const matchText =
      !filterQuery ||
      (k.customerName && k.customerName.toLowerCase().includes(filterQuery.toLowerCase())) ||
      k.invoiceNumber.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (k.customerPhone && k.customerPhone.includes(filterQuery));

    return matchStatus && matchText;
  });

  const totalOutstandingPiutang = kasbonList
    .filter(k => !k.isKasbonPaid)
    .reduce((sum, k) => sum + k.totalAmount, 0);

  const totalPaidPiutang = kasbonList
    .filter(k => k.isKasbonPaid)
    .reduce((sum, k) => sum + k.totalAmount, 0);

  const [pelunasanTarget, setPelunasanTarget] = useState<{ id: string; customerName?: string; amount?: number } | null>(null);

  const handlePelunasan = (id: string, customerName?: string, amount?: number) => {
    setPelunasanTarget({ id, customerName, amount });
  };

  const handleConfirmDelete = async () => {
    if (!deletingKasbon) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(deletingKasbon.id);
      setDeletingKasbon(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExecutePelunasan = async () => {
    if (!pelunasanTarget) return;
    setIsProcessingPay(true);
    try {
      await payKasbon(pelunasanTarget.id);
      setPelunasanTarget(null);
    } finally {
      setIsProcessingPay(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      {/* Header & Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total Piutang Belum Lunas
            </span>
            <span className="text-xl font-black font-mono text-amber-700">
              {formatRupiah(totalOutstandingPiutang)}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {kasbonList.filter(k => !k.isKasbonPaid).length} transaksi aktif
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total Piutang Telah Lunas
            </span>
            <span className="text-xl font-black font-mono text-emerald-700">
              {formatRupiah(totalPaidPiutang)}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Kas masuk dari pelunasan</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Status Database Supabase
            </span>
            <button
              type="button"
              onClick={() => refreshTransactions()}
              disabled={isTransactionsLoading}
              className="text-xs text-slate-500 hover:text-emerald-700 font-semibold inline-flex items-center gap-1 transition cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isTransactionsLoading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
              isSupabaseConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : isSupabaseConfigured
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-slate-100 text-slate-600 border-slate-300'
            }`}>
              <Database className="w-3 h-3" />
              {isSupabaseConnected ? 'Tersambung ke Supabase' : isSupabaseConfigured ? 'Menghubungkan...' : 'Mode Lokal'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Data piutang & pelunasan tersimpan aman di tabel Supabase.
          </p>
        </div>
      </div>

      {/* Supabase Error Alert Banner */}
      {transactionsError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-start justify-between gap-3 text-rose-800 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">Terjadi Kesalahan Sinkronisasi Supabase:</p>
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

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            placeholder="Cari nama langganan / nomor WA..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('unpaid')}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'unpaid'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Belum Lunas ({kasbonList.filter(k => !k.isKasbonPaid).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('paid')}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'paid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Sudah Lunas ({kasbonList.filter(k => k.isKasbonPaid).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Semua
          </button>
        </div>
      </div>

      {/* Kasbon Records Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {isTransactionsLoading && filteredKasbon.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs font-semibold">Mengambil data kasbon dari database Supabase...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Nama Pelanggan</th>
                  <th className="py-3.5 px-4">No. Invoice & Tanggal</th>
                  <th className="py-3.5 px-4">Jatuh Tempo</th>
                  <th className="py-3.5 px-4">Item Kasbon</th>
                  <th className="py-3.5 px-4 text-right">Jumlah Piutang</th>
                  <th className="py-3.5 px-4 text-center">Status & Pelunasan</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKasbon.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Tidak ada catatan kasbon pelanggan yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredKasbon.map(item => {
                    const isOverdue =
                      !item.isKasbonPaid &&
                      item.dueDate &&
                      new Date(item.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-900 text-sm">
                            {item.customerName || 'Pelanggan Langganan'}
                          </div>
                          {item.customerPhone && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{item.customerPhone}</span>
                            </div>
                          )}
                          {item.kasbonNotes && (
                            <p className="text-[11px] text-amber-700 italic mt-0.5">
                              &ldquo;{item.kasbonNotes}&rdquo;
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-mono font-bold text-slate-800">
                            {item.invoiceNumber}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatDateTimeIndo(item.timestamp)}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {item.dueDate ? (
                            <div className={`flex items-center gap-1 font-semibold ${
                              isOverdue ? 'text-rose-600' : 'text-slate-700'
                            }`}>
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{formatDateIndo(item.dueDate)}</span>
                              {isOverdue && (
                                <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold">
                                  Lewat Tempo!
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 max-w-xs">
                          <div className="space-y-0.5">
                            {item.items.map((it, idx) => (
                              <div key={idx} className="text-[11px] text-slate-600 truncate">
                                • {it.productName} ({it.quantity} {it.unit})
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-black text-sm text-slate-900">
                          {formatRupiah(item.totalAmount)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {item.isKasbonPaid ? (
                            <div className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Lunas ({formatDateIndo(item.kasbonPaidDate || item.timestamp)})</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handlePelunasan(item.id, item.customerName, item.totalAmount)
                              }
                              className="py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-98"
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5" />
                              <span>Pelunasan (Bayar)</span>
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingKasbon(item)}
                              className="py-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                              title="Edit data kasbon ini"
                            >
                              <Edit className="w-3.5 h-3.5 text-amber-700" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingKasbon(item)}
                              className="py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs inline-flex items-center gap-1 transition cursor-pointer"
                              title="Hapus data kasbon ini"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT KASBON MODAL */}
      <EditKasbonModal
        transaction={editingKasbon}
        onClose={() => setEditingKasbon(null)}
      />

      {/* CONFIRMATION MODAL: HAPUS KASBON */}
      {deletingKasbon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Hapus Data Kasbon</h3>
                <p className="text-xs text-slate-500">Konfirmasi pembatalan piutang di database Supabase</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <p className="text-slate-800 font-bold text-sm">
                Apakah Anda yakin ingin menghapus data kasbon ini?
              </p>
              <div className="pt-2 border-t border-slate-200 space-y-1 font-mono text-slate-600 text-[11px]">
                <div className="flex justify-between">
                  <span>Nama Pelanggan:</span>
                  <span className="font-bold text-slate-900">{deletingKasbon.customerName || 'Pelanggan'}</span>
                </div>
                <div className="flex justify-between">
                  <span>No. Invoice:</span>
                  <span className="font-bold text-slate-800">{deletingKasbon.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Jumlah Kasbon:</span>
                  <span className="font-bold text-amber-700">{formatRupiah(deletingKasbon.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-bold ${deletingKasbon.isKasbonPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {deletingKasbon.isKasbonPaid ? 'Sudah Lunas' : 'Belum Lunas'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal:</span>
                  <span>{formatDateIndo(deletingKasbon.timestamp)}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-900">
              💡 <strong>Catatan:</strong> Data kasbon akan dihapus dari tabel Supabase, dan stok barang akan dikembalikan ke gudang otomatis.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingKasbon(null)}
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
                    <span>Ya, Hapus Kasbon</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: PELUNASAN KASBON */}
      {pelunasanTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-900">Konfirmasi Pelunasan Kasbon</h3>
              <p className="text-xs text-slate-500">
                Terima pembayaran kasbon dari pelanggan <strong className="text-slate-800">{pelunasanTarget.customerName || 'Pelanggan'}</strong>?
              </p>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-150 text-center">
                <span className="text-[11px] text-emerald-800 font-medium block">Nominal Pelunasan:</span>
                <span className="text-xl font-black font-mono text-emerald-700">{formatRupiah(pelunasanTarget.amount || 0)}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Data pelunasan akan langsung diperbarui ke database Supabase dan kasir tercatat menerima uang.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                id="btn-cancel-pelunasan"
                disabled={isProcessingPay}
                onClick={() => setPelunasanTarget(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-pelunasan"
                disabled={isProcessingPay}
                onClick={handleExecutePelunasan}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isProcessingPay ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memperbarui DB...</span>
                  </>
                ) : (
                  <span>Ya, Konfirmasi Lunas</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT KASBON MODAL */}
      <EditKasbonModal
        transaction={editingKasbon}
        onClose={() => setEditingKasbon(null)}
      />
    </div>
  );
};
