import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { CashierShift } from '../../types';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { Clock, DollarSign, AlertTriangle, CheckCircle, X, ShieldAlert } from 'lucide-react';
import FormattedNumberInput from '../common/FormattedNumberInput';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({ isOpen, onClose }) => {
  const { currentShift, openShift, closeShift, currentUser } = useStore();
  const [mode, setMode] = useState<'open' | 'close'>('open');
  const [startingCashInput, setStartingCashInput] = useState('200000');
  const [actualCashInput, setActualCashInput] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [closedSummary, setClosedSummary] = useState<CashierShift | null>(null);

  if (!isOpen) return null;

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(startingCashInput.replace(/\D/g, '')) || 0;
    openShift(cash, shiftNotes || 'Buka shift kasir');
    onClose();
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    const actual = parseFloat(actualCashInput.replace(/\D/g, '')) || 0;
    const closed = closeShift(actual, shiftNotes);
    setClosedSummary(closed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Manajemen Sesi Shift Kasir</h2>
              <p className="text-xs text-slate-500">Kasir: {currentUser?.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {closedSummary ? (
          /* Summary Screen after Closing Shift */
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-900">Sesi Kasir Berhasil Ditutup</h3>
              <p className="text-xs text-slate-500">
                Waktu Tutup: {formatDateTimeIndo(closedSummary.endTime || new Date().toISOString())}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Modal Awal Kasir:</span>
                <span className="font-mono font-bold">{formatRupiah(closedSummary.startingCash)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Penjualan Tunai:</span>
                <span className="font-mono font-bold text-emerald-600">{formatRupiah(closedSummary.totalCashSales)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Penjualan QRIS (Non-Tunai):</span>
                <span className="font-mono">{formatRupiah(closedSummary.totalQrisSales)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Penjualan Kasbon/Kredit:</span>
                <span className="font-mono">{formatRupiah(closedSummary.totalKasbonSales)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Seharusnya Uang di Laci:</span>
                <span className="font-mono text-base">{formatRupiah(closedSummary.expectedDrawerCash)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>Uang Fisik Dihitung Kasir:</span>
                <span className="font-mono text-base">{formatRupiah(closedSummary.actualDrawerCash || 0)}</span>
              </div>
              <div className={`pt-2 border-t border-slate-200 flex justify-between font-bold ${
                (closedSummary.discrepancy || 0) === 0
                  ? 'text-emerald-700'
                  : (closedSummary.discrepancy || 0) > 0
                  ? 'text-blue-700'
                  : 'text-rose-700'
              }`}>
                <span>Selisih Fisik Laci:</span>
                <span className="font-mono text-base">
                  {(closedSummary.discrepancy || 0) === 0
                    ? 'PAS (Rp 0)'
                    : (closedSummary.discrepancy || 0) > 0
                    ? `LEBIH +${formatRupiah(closedSummary.discrepancy || 0)}`
                    : `KURANG ${formatRupiah(closedSummary.discrepancy || 0)}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setClosedSummary(null);
                onClose();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition"
            >
              Selesai & Tutup Jendela
            </button>
          </div>
        ) : currentShift ? (
          /* Active Shift: Option to view drawer calculation or Close Shift */
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Shift Sedang Berjalan</span>
                <span className="text-[11px] text-emerald-700">Dibuka: {formatDateTimeIndo(currentShift.startTime)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-slate-500 block">Modal Awal Laci</span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    {formatRupiah(currentShift.startingCash)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-slate-500 block">Penjualan Tunai</span>
                  <span className="text-base font-extrabold text-emerald-700 font-mono">
                    {formatRupiah(currentShift.totalCashSales)}
                  </span>
                </div>
              </div>

              <div className="mt-3 bg-white p-3.5 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-600 block">Total Fisik Laci Seharusnya:</span>
                  <span className="text-[11px] text-slate-400">Modal Awal + Penjualan Tunai</span>
                </div>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {formatRupiah(currentShift.expectedDrawerCash)}
                </span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-start gap-2 text-amber-800 text-xs mb-3 font-semibold">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    Formulir Tutup Shift Kasir. Harap hitung seluruh uang fisik kertas & koin di laci kasir secara teliti untuk mencegah selisih.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Hitungan Uang Fisik Riil di Laci (Rp) *
                  </label>
                  <FormattedNumberInput
                    id="input-actual-cash"
                    required
                    value={actualCashInput}
                    onChange={e => setActualCashInput(e.target.value)}
                    placeholder={`Masukkan nominal fisik (misal: ${currentShift.expectedDrawerCash})`}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setActualCashInput(currentShift.expectedDrawerCash.toString())}
                      className="text-[11px] bg-white hover:bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-semibold"
                    >
                      Set Nilai Pas ({formatRupiah(currentShift.expectedDrawerCash)})
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Kasir (Opsional)
                  </label>
                  <input
                    type="text"
                    value={shiftNotes}
                    onChange={e => setShiftNotes(e.target.value)}
                    placeholder="Contoh: Pecahan uang koin banyak, dll"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
                >
                  Kembali Transaksi
                </button>
                <button
                  type="submit"
                  id="btn-confirm-close-shift"
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition shadow-md shadow-rose-700/20"
                >
                  Tutup Shift & Finalisasi
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* No Active Shift: Open Shift Form */
          <form onSubmit={handleOpenShift} className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Sesi Kasir Belum Dibuka</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Setiap kasir yang bertugas wajib menginput modal uang kembalian (Cash Drawer Base) sebelum memulai transaksi POS.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Modal Awal Uang Kembalian di Laci (Rp) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-bold text-sm">
                  Rp
                </span>
                <FormattedNumberInput
                  id="input-starting-cash"
                  required
                  value={startingCashInput}
                  onChange={e => setStartingCashInput(e.target.value)}
                  placeholder="200.000"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                {[100000, 200000, 300000, 500000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setStartingCashInput(amt.toString())}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition"
                  >
                    {formatRupiah(amt)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Shift (Opsional)
              </label>
              <input
                type="text"
                value={shiftNotes}
                onChange={e => setShiftNotes(e.target.value)}
                placeholder="Contoh: Shift Pagi Kasir 1"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                id="btn-confirm-open-shift"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-700/25 cursor-pointer"
              >
                Buka Shift Kasir Sekarang
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
