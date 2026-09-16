import React, { useState } from 'react';
import { PaymentMethod } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { Banknote, QrCode, CreditCard, Check, X, AlertCircle, Calendar } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  totalAmount: number;
  onClose: () => void;
  onConfirmPayment: (
    method: PaymentMethod,
    amountPaid: number,
    kasbonDetails?: { customerName: string; customerPhone?: string; dueDate?: string; notes?: string }
  ) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  totalAmount,
  onClose,
  onConfirmPayment,
}) => {
  const [method, setMethod] = useState<PaymentMethod>('tunai');
  const [cashGiven, setCashGiven] = useState<number>(totalAmount);
  const [customCashInput, setCustomCashInput] = useState<string>(totalAmount.toString());

  // Kasbon form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Default due date: 7 days from now
  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 7);
  const [dueDate, setDueDate] = useState(defaultDue.toISOString().slice(0, 10));
  const [kasbonNotes, setKasbonNotes] = useState('');

  if (!isOpen) return null;

  const change = Math.max(0, cashGiven - totalAmount);
  const isCashInsufficient = method === 'tunai' && cashGiven < totalAmount;

  const handleCashChange = (val: string) => {
    setCustomCashInput(val);
    const num = parseFloat(val.replace(/\D/g, '')) || 0;
    setCashGiven(num);
  };

  const handleSetPresetCash = (amt: number) => {
    setCashGiven(amt);
    setCustomCashInput(amt.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCashInsufficient) return;

    if (method === 'kasbon') {
      if (!customerName.trim()) {
        alert('Harap isi Nama Pelanggan untuk kasbon/hutang!');
        return;
      }
      onConfirmPayment('kasbon', 0, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        dueDate,
        notes: kasbonNotes.trim(),
      });
    } else if (method === 'qris') {
      onConfirmPayment('qris', totalAmount);
    } else {
      onConfirmPayment('tunai', cashGiven);
    }
  };

  // Preset cash suggestions
  const presetAmounts = [
    { label: 'Uang Pas', value: totalAmount },
    { label: 'Rp 20.000', value: 20000 },
    { label: 'Rp 50.000', value: 50000 },
    { label: 'Rp 100.000', value: 100000 },
    { label: 'Rp 200.000', value: 200000 },
    { label: 'Rp 500.000', value: 500000 },
  ].filter(p => p.value >= totalAmount || p.label === 'Uang Pas');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Pembayaran Kasir</span>
            <h2 className="text-xl font-black text-slate-900">Total: {formatRupiah(totalAmount)}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <button
            type="button"
            id="btn-method-tunai"
            onClick={() => setMethod('tunai')}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
              method === 'tunai'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Banknote className="w-5 h-5 mb-1 text-emerald-600" />
            <span>Tunai (Cash)</span>
          </button>

          <button
            type="button"
            id="btn-method-qris"
            onClick={() => setMethod('qris')}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
              method === 'qris'
                ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-xs'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <QrCode className="w-5 h-5 mb-1 text-teal-600" />
            <span>QRIS / Non-Tunai</span>
          </button>

          <button
            type="button"
            id="btn-method-kasbon"
            onClick={() => setMethod('kasbon')}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
              method === 'kasbon'
                ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-5 h-5 mb-1 text-amber-600" />
            <span>Kasbon (Hutang)</span>
          </button>
        </div>

        {/* Method Content */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {method === 'tunai' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Uang Tunai Diterima (Rp)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold">
                    Rp
                  </span>
                  <input
                    id="input-cash-given"
                    type="number"
                    autoFocus
                    value={customCashInput}
                    onChange={e => handleCashChange(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {presetAmounts.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSetPresetCash(preset.value)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                        cashGiven === preset.value
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change / Kembalian Calculation Box */}
              <div className={`p-4 rounded-2xl border ${
                isCashInsufficient
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold">
                    {isCashInsufficient ? 'Uang Masih Kurang:' : 'Uang Kembalian:'}
                  </span>
                  <span className="font-mono font-black text-xl">
                    {isCashInsufficient
                      ? formatRupiah(totalAmount - cashGiven)
                      : formatRupiah(change)}
                  </span>
                </div>
                {isCashInsufficient && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Uang tunai kurang dari total belanja!</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {method === 'qris' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-3">
              <div className="w-36 h-36 mx-auto bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                {/* Simulated dynamic QR code SVG */}
                <svg viewBox="0 0 100 100" className="w-full h-full text-slate-800">
                  <rect width="100" height="100" fill="#fff" />
                  <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M20,20 h10 v10 h-10 z" fill="#0f172a" />
                  <path d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M70,20 h10 v10 h-10 z" fill="#0f172a" />
                  <path d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M20,70 h10 v10 h-10 z" fill="#0f172a" />
                  <circle cx="50" cy="50" r="12" fill="#10b981" />
                  <rect x="45" y="15" width="10" height="20" fill="#0f172a" />
                  <rect x="50" y="65" width="20" height="10" fill="#0f172a" />
                  <rect x="75" y="75" width="15" height="15" fill="#0f172a" />
                  <rect x="65" y="50" width="10" height="10" fill="#0f172a" />
                </svg>
              </div>

              <div>
                <p className="font-bold text-sm text-slate-800">PANDIR STORE SEMBAKO</p>
                <p className="text-xs text-slate-500">NMID: ID1020269876123 - Merchant Resmi</p>
                <p className="text-base font-black text-emerald-700 font-mono mt-1">
                  {formatRupiah(totalAmount)}
                </p>
              </div>

              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-800 text-xs flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                <span>Menunggu scan pembayaran dari pelanggan...</span>
              </div>
            </div>
          )}

          {method === 'kasbon' && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs pb-1 border-b border-amber-200/80">
                <CreditCard className="w-4 h-4 text-amber-700" />
                <span>Pencatatan Piutang / Kasbon Pelanggan Langganan</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nama Pelanggan *
                </label>
                <input
                  id="input-kasbon-customer-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Contoh: Bu RT Endang / Mas Joko"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jatuh Tempo Bayar
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Kasbon (Opsional)
                </label>
                <input
                  type="text"
                  value={kasbonNotes}
                  onChange={e => setKasbonNotes(e.target.value)}
                  placeholder="Contoh: Janji bayar gajian tgl 25"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              id="btn-confirm-checkout-done"
              disabled={isCashInsufficient}
              className="flex-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Selesaikan & Cetak Struk</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
