import React, { useState, useEffect } from 'react';
import { Transaction } from '../../types';
import { useStore } from '../../context/StoreContext';
import { formatRupiah, parseThousand } from '../../utils/formatters';
import FormattedNumberInput from '../common/FormattedNumberInput';
import { 
  X, 
  Save, 
  CreditCard, 
  User, 
  Calendar, 
  Phone, 
  AlertCircle, 
  FileText, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';

interface EditKasbonModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const EditKasbonModal: React.FC<EditKasbonModalProps> = ({
  transaction,
  onClose,
}) => {
  const { updateTransaction } = useStore();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('0');
  const [kasbonNotes, setKasbonNotes] = useState('');
  const [status, setStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [paidDate, setPaidDate] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (transaction) {
      setCustomerName(transaction.customerName || '');
      setCustomerPhone(transaction.customerPhone || '');
      
      // Format timestamp for datetime-local (YYYY-MM-DDTHH:mm)
      try {
        const d = new Date(transaction.timestamp);
        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setTimestamp(isoLocal);
      } catch {
        setTimestamp(transaction.timestamp.slice(0, 16));
      }

      setDueDate(transaction.dueDate || '');
      setTotalAmount(String(transaction.totalAmount || 0));
      setKasbonNotes(transaction.kasbonNotes || '');
      setStatus(transaction.isKasbonPaid ? 'paid' : 'unpaid');
      
      if (transaction.kasbonPaidDate) {
        setPaidDate(transaction.kasbonPaidDate.slice(0, 10));
      } else {
        setPaidDate(new Date().toISOString().slice(0, 10));
      }
      setErrorMessage('');
    }
  }, [transaction]);

  if (!transaction) return null;

  const numTotalAmount = parseThousand(totalAmount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customerName.trim()) {
      setErrorMessage('Nama pelanggan wajib diisi.');
      return;
    }

    if (numTotalAmount <= 0) {
      setErrorMessage('Jumlah kasbon / hutang harus lebih dari 0.');
      return;
    }

    let parsedIsoTimestamp = transaction.timestamp;
    try {
      if (timestamp) {
        parsedIsoTimestamp = new Date(timestamp).toISOString();
      }
    } catch {
      parsedIsoTimestamp = transaction.timestamp;
    }

    const isPaid = status === 'paid';
    let finalPaidDate = transaction.kasbonPaidDate;
    if (isPaid) {
      finalPaidDate = paidDate 
        ? new Date(paidDate).toISOString() 
        : transaction.kasbonPaidDate || new Date().toISOString();
    } else {
      finalPaidDate = undefined;
    }

    // Preserve and proportionally update items if total changed
    let updatedItems = transaction.items;
    if (transaction.items && transaction.items.length === 1) {
      const singleItem = transaction.items[0];
      const qty = singleItem.quantity || 1;
      updatedItems = [{
        ...singleItem,
        unitPrice: Math.round(numTotalAmount / qty),
        subtotal: numTotalAmount,
      }];
    }

    const updatedTransaction: Transaction = {
      ...transaction,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      timestamp: parsedIsoTimestamp,
      dueDate: dueDate || undefined,
      kasbonNotes: kasbonNotes.trim() || undefined,
      totalAmount: numTotalAmount,
      amountPaid: isPaid ? numTotalAmount : 0,
      isKasbonPaid: isPaid,
      kasbonPaidDate: finalPaidDate,
      items: updatedItems,
    };

    updateTransaction(updatedTransaction);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg">
                Edit Data Kasbon Pelanggan
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                No. Invoice: <span className="font-bold text-slate-800">{transaction.invoiceNumber}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body - Scrollable */}
        <form id="edit-kasbon-form" onSubmit={handleSubmit} className="overflow-y-auto py-4 space-y-4 pr-1">
          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Nama Pelanggan <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Nama pelanggan..."
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>No. HP / WA (Opsional)</span>
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="0812xxxxxxx"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Timestamps: Tanggal Transaksi & Jatuh Tempo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Tanggal Transaksi</span>
              </label>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={e => setTimestamp(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Jatuh Tempo</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Jumlah Kasbon */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              <span>Jumlah Kasbon / Total Piutang (Rp) <span className="text-rose-500">*</span></span>
            </label>
            <FormattedNumberInput
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              placeholder="0"
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Terformat otomatis ribuan: <span className="font-bold text-amber-700">{formatRupiah(numTotalAmount)}</span>
            </p>
          </div>

          {/* Keterangan / Catatan Kasbon */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Keterangan / Catatan</span>
            </label>
            <textarea
              rows={2}
              value={kasbonNotes}
              onChange={e => setKasbonNotes(e.target.value)}
              placeholder="Contoh: Belanja sembako bulanan, janji bayar hari senin..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />
          </div>

          {/* Status Kasbon */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              Status Kasbon / Hutang
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('unpaid')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  status === 'unpaid'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Belum Lunas</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('paid')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  status === 'paid'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sudah Lunas</span>
              </button>
            </div>

            {status === 'paid' && (
              <div className="pt-1">
                <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                  Tanggal Pelunasan
                </label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={e => setPaidDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Daftar Barang (Jika Ada) */}
          {transaction.items && transaction.items.length > 0 && (
            <div className="border border-slate-200 rounded-2xl p-3 bg-white">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Item Belanja Transaksi ({transaction.items.length})
              </span>
              <div className="space-y-1">
                {transaction.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-slate-700">
                    <span className="truncate">• {it.productName} ({it.quantity} {it.unit})</span>
                    <span className="font-mono text-slate-500 shrink-0">{formatRupiah(it.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            form="edit-kasbon-form"
            className="py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
