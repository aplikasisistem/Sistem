import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  Scale, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Printer, 
  Clock, 
  User, 
  Calendar, 
  DollarSign, 
  Coins, 
  Layers, 
  History,
  Lock,
  Unlock,
  FileSpreadsheet
} from 'lucide-react';
import { formatRupiah } from '../../utils/formatters';
import { CashierShift } from '../../types';

// Standard Indonesian Rupiah Currency Denominations
const RUPIAH_DENOMINATIONS = [
  { value: 100000, label: 'Rp 100.000', type: 'kertas' },
  { value: 50000, label: 'Rp 50.000', type: 'kertas' },
  { value: 20000, label: 'Rp 20.000', type: 'kertas' },
  { value: 10000, label: 'Rp 10.000', type: 'kertas' },
  { value: 5000, label: 'Rp 5.000', type: 'kertas' },
  { value: 2000, label: 'Rp 2.000', type: 'kertas' },
  { value: 1000, label: 'Rp 1.000 (Kertas/Koin)', type: 'campur' },
  { value: 500, label: 'Rp 500 (Koin)', type: 'koin' },
  { value: 200, label: 'Rp 200 (Koin)', type: 'koin' },
  { value: 100, label: 'Rp 100 (Koin)', type: 'koin' },
];

export const ShiftReconciliationView: React.FC = () => {
  const { currentShift, shiftHistory, closeShift, reconcileShift, currentUser, expenses, transactions } = useStore();

  // Denomination counter state for counting cash
  const [denominations, setDenominations] = useState<Record<string, number>>({
    '100000': 0,
    '50000': 0,
    '20000': 0,
    '10000': 0,
    '5000': 0,
    '2000': 0,
    '1000': 0,
    '500': 0,
    '200': 0,
    '100': 0,
  });

  const [customManualCash, setCustomManualCash] = useState<string>('');
  const [useDenominationCalculator, setUseDenominationCalculator] = useState<boolean>(true);
  const [reconciliationNotes, setReconciliationNotes] = useState<string>('');
  const [selectedHistoryShift, setSelectedHistoryShift] = useState<CashierShift | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  // Calculate total from denomination inputs
  const calculatedDenominationTotal = useMemo(() => {
    return Object.entries(denominations).reduce((sum, [valStr, count]) => {
      const val = parseInt(valStr, 10);
      const qty = Number(count) || 0;
      return sum + val * qty;
    }, 0);
  }, [denominations]);

  // Actual cash in drawer determined by calculator or manual input
  const actualCountedCash = useMemo(() => {
    if (useDenominationCalculator) {
      return calculatedDenominationTotal;
    }
    return Math.max(0, parseInt(customManualCash.replace(/\D/g, ''), 10) || 0);
  }, [useDenominationCalculator, calculatedDenominationTotal, customManualCash]);

  // Target shift being reviewed (either active or selected from history)
  const targetShift = selectedHistoryShift || currentShift;

  // Compute live financial totals for the target shift
  const metrics = useMemo(() => {
    if (!targetShift) {
      return {
        startingCash: 0,
        totalCashIntake: 0,
        totalExpensesPaid: 0,
        expectedDrawerCash: 0,
        discrepancy: 0,
      };
    }

    const startingCash = targetShift.startingCash || 0;
    const totalCashIntake = targetShift.totalCashIntake ?? targetShift.totalCashSales ?? 0;
    const totalExpensesPaid = targetShift.totalExpensesPaid ?? 0;
    const expectedDrawerCash = startingCash + totalCashIntake - totalExpensesPaid;
    const discrepancy = (targetShift.status === 'closed' && targetShift.actualDrawerCash !== undefined)
      ? (targetShift.actualDrawerCash - expectedDrawerCash)
      : (actualCountedCash - expectedDrawerCash);

    return {
      startingCash,
      totalCashIntake,
      totalExpensesPaid,
      expectedDrawerCash,
      discrepancy,
    };
  }, [targetShift, actualCountedCash]);

  const handleDenominationChange = (valStr: string, deltaOrValue: number, isDirect = false) => {
    setDenominations(prev => {
      const current = prev[valStr] || 0;
      const nextVal = isDirect ? Math.max(0, deltaOrValue) : Math.max(0, current + deltaOrValue);
      return { ...prev, [valStr]: nextVal };
    });
  };

  const handleResetCalculator = () => {
    setDenominations({
      '100000': 0,
      '50000': 0,
      '20000': 0,
      '10000': 0,
      '5000': 0,
      '2000': 0,
      '1000': 0,
      '500': 0,
      '200': 0,
      '100': 0,
    });
    setCustomManualCash('');
  };

  const handleCloseAndReconcileActiveShift = () => {
    if (!currentShift) return;
    const closed = closeShift(actualCountedCash, reconciliationNotes, denominations);
    if (closed) {
      setShowSuccessToast(`Shift Kasir berhasil ditutup dan direkonsiliasi. Total kas fisik: ${formatRupiah(actualCountedCash)}`);
      setTimeout(() => setShowSuccessToast(null), 5000);
    }
  };

  const handlePrintReconciliationReceipt = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-500 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-sm font-semibold">{showSuccessToast}</span>
        </div>
      )}

      {/* Header View */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Scale className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Rekonsiliasi Shift & Saldo Laci Kasir
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Audit penghitungan uang kas fisik, penerimaan kas, dan pengeluaran shift untuk balancing laci kasir yang presisi
              </p>
            </div>
          </div>
        </div>

        {/* Action Quick Print & Status Pill */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border bg-slate-50 text-slate-700 text-xs font-semibold">
            {currentShift ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Shift Aktif: {currentShift.cashierName}</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Tidak Ada Shift Aktif</span>
              </>
            )}
          </div>

          <button
            type="button"
            id="btn-print-reconciliation"
            onClick={handlePrintReconciliationReceipt}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekonsiliasi (Thermal)</span>
          </button>
        </div>
      </div>

      {/* Main 4 Metric Cards (Starting Cash, Cash Intake, Expenses Paid, Expected Cash) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Modal Awal Kasir */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              1. Modal Awal (Starting Cash)
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {formatRupiah(metrics.startingCash)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Uang receh/kembalian saat buka shift</p>
          </div>
        </div>

        {/* 2. Total Kas Masuk (Sales + Pelunasan Kasbon) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              2. Total Pemasukan Kas (Intake)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
              +{formatRupiah(metrics.totalCashIntake)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Penjualan tunai + pelunasan kasbon</p>
          </div>
        </div>

        {/* 3. Pengeluaran Operasional Shift */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
              3. Pengeluaran Shift (Expenses)
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-black text-rose-600 font-mono">
              -{formatRupiah(metrics.totalExpensesPaid)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Kas keluar (listrik, galon, dsb)</p>
          </div>
        </div>

        {/* 4. Saldo Kas Laci Seharusnya */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              4. Saldo Laci Seharusnya
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/10 text-emerald-300 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {formatRupiah(metrics.expectedDrawerCash)}
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5">Rumus: Kas Awal + Intake - Beban</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Cash Denomination Calculator & Shift Balancing Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Physical Cash Counter / Denomination Table (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                Penghitungan Uang Fisik (Denominasi Rupiah)
              </h2>
            </div>
            <button
              type="button"
              id="btn-reset-denominations"
              onClick={handleResetCalculator}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition cursor-pointer"
            >
              Reset Hitungan
            </button>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setUseDenominationCalculator(true)}
              className={`flex-1 py-1.5 rounded-lg text-center font-bold transition cursor-pointer ${
                useDenominationCalculator
                  ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Kalkulator Pecahan Lembar & Koin
            </button>
            <button
              type="button"
              onClick={() => setUseDenominationCalculator(false)}
              className={`flex-1 py-1.5 rounded-lg text-center font-bold transition cursor-pointer ${
                !useDenominationCalculator
                  ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Input Nominal Langsung
            </button>
          </div>

          {useDenominationCalculator ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Pecahan Rupiah</th>
                    <th className="py-2.5 px-3 text-center">Jumlah Lembar / Keping</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {RUPIAH_DENOMINATIONS.map(item => {
                    const count = denominations[String(item.value)] || 0;
                    const subtotal = item.value * count;
                    return (
                      <tr key={item.value} className="hover:bg-slate-50/70 transition">
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${item.type === 'koin' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                            <span>{item.label}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDenominationChange(String(item.value), -1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition cursor-pointer active:scale-95"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={count === 0 ? '' : count}
                              placeholder="0"
                              onChange={e => handleDenominationChange(String(item.value), parseInt(e.target.value, 10) || 0, true)}
                              className="w-16 h-7 text-center font-mono font-bold text-slate-900 border border-slate-200 rounded-lg focus:outline-emerald-600 focus:border-emerald-600 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleDenominationChange(String(item.value), 1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition cursor-pointer active:scale-95"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Masukkan Total Uang Tunai Fisik di Laci:
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                <input
                  type="text"
                  value={customManualCash}
                  onChange={e => setCustomManualCash(e.target.value)}
                  placeholder="0"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-base font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Subtotal Total Counted Banner */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">Total Uang Fisik Terhitung:</span>
            <span className="text-lg font-black text-emerald-800 font-mono">
              {formatRupiah(actualCountedCash)}
            </span>
          </div>
        </div>

        {/* Right Column: Shift Balancing & Reconciliation Result (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Hasil Balancing & Selisih Kas
                </h2>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Audit Kasir
              </span>
            </div>

            {/* Reconciliation Comparison Card */}
            <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Saldo Kas Seharusnya:</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatRupiah(metrics.expectedDrawerCash)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total Uang Fisik Di Laci:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {formatRupiah(actualCountedCash)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-700">Status Selisih (Discrepancy):</span>
                <div className="text-right font-mono font-black text-sm">
                  {metrics.discrepancy === 0 ? (
                    <span className="text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      PAS (Seimbang / Rp 0)
                    </span>
                  ) : metrics.discrepancy > 0 ? (
                    <span className="text-blue-700">
                      LEBIH (+{formatRupiah(metrics.discrepancy)})
                    </span>
                  ) : (
                    <span className="text-rose-700">
                      KURANG ({formatRupiah(metrics.discrepancy)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Reconciliation Explanatory Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Catatan / Alasan Selisih Kas (Opsional):
              </label>
              <textarea
                value={reconciliationNotes}
                onChange={e => setReconciliationNotes(e.target.value)}
                placeholder="Contoh: Selisih Rp 500 karena pembulatan koin kembalian..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-emerald-600"
              />
            </div>
          </div>

          {/* Action Close Shift & Reconcile */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            {currentShift && currentShift.status === 'open' ? (
              <button
                type="button"
                id="btn-confirm-reconcile-close-shift"
                onClick={handleCloseAndReconcileActiveShift}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition cursor-pointer active:scale-98"
              >
                <Lock className="w-4 h-4" />
                <span>Tutup & Rekonsiliasi Shift Kasir Sekarang</span>
              </button>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-800 font-semibold">
                Sesi kasir saat ini ditutup. Buka shift baru di menu Kasir jika ingin memulai shift baru.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History of Past Shift Reconciliations */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              Riwayat Rekonsiliasi Shift Terdahulu
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {shiftHistory.length} Sesi Terdata
          </span>
        </div>

        {shiftHistory.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            Belum ada riwayat shift yang ditutup.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Kasir & Waktu Selesai</th>
                  <th className="py-2.5 px-3 text-right">Kas Awal</th>
                  <th className="py-2.5 px-3 text-right">Pemasukan</th>
                  <th className="py-2.5 px-3 text-right">Pengeluaran</th>
                  <th className="py-2.5 px-3 text-right">Kas Seharusnya</th>
                  <th className="py-2.5 px-3 text-right">Kas Fisik</th>
                  <th className="py-2.5 px-3 text-right">Selisih</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shiftHistory.map(shift => {
                  const intake = shift.totalCashIntake ?? shift.totalCashSales ?? 0;
                  const exp = shift.totalExpensesPaid ?? 0;
                  const expected = shift.startingCash + intake - exp;
                  const actual = shift.actualDrawerCash ?? expected;
                  const disc = shift.discrepancy ?? (actual - expected);

                  return (
                    <tr key={shift.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{shift.cashierName}</div>
                        <div className="text-[10px] text-slate-400">
                          {shift.endTime ? new Date(shift.endTime).toLocaleString('id-ID') : 'Belum Ditutup'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700">
                        {formatRupiah(shift.startingCash)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-700">
                        +{formatRupiah(intake)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-rose-600">
                        -{formatRupiah(exp)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(expected)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(actual)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {disc === 0 ? (
                          <span className="text-emerald-700">Pas (Rp 0)</span>
                        ) : disc > 0 ? (
                          <span className="text-blue-700">+{formatRupiah(disc)}</span>
                        ) : (
                          <span className="text-rose-600">{formatRupiah(disc)}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          disc === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {disc === 0 ? 'Balanced' : 'Ada Selisih'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden Printable Thermal Struk for Shift Reconciliation */}
      <div id="printable-shift-reconciliation" className="hidden print:block text-black font-mono text-xs p-4">
        <div className="text-center font-bold text-sm mb-1">ALUNK STORE</div>
        <div className="text-center text-[11px] mb-2">LAPORAN REKONSILIASI SHIFT KASIR</div>
        <div className="border-b border-dashed border-black pb-1 mb-2 text-[10px]">
          <div>Kasir: {targetShift?.cashierName || currentUser?.name || 'Kasir'}</div>
          <div>Mulai: {targetShift?.startTime ? new Date(targetShift.startTime).toLocaleString('id-ID') : '-'}</div>
          <div>Selesai: {new Date().toLocaleString('id-ID')}</div>
        </div>

        <div className="space-y-1 text-[11px] mb-2">
          <div className="flex justify-between">
            <span>Modal Awal Kas:</span>
            <span>{formatRupiah(metrics.startingCash)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pemasukan Tunai:</span>
            <span>+{formatRupiah(metrics.totalCashIntake)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pengeluaran Kas:</span>
            <span>-{formatRupiah(metrics.totalExpensesPaid)}</span>
          </div>
          <div className="border-t border-dashed border-black pt-1 flex justify-between font-bold">
            <span>Saldo Kas Seharusnya:</span>
            <span>{formatRupiah(metrics.expectedDrawerCash)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Uang Kas Fisik:</span>
            <span>{formatRupiah(actualCountedCash)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Selisih (Discrepancy):</span>
            <span>{formatRupiah(metrics.discrepancy)}</span>
          </div>
        </div>

        {reconciliationNotes && (
          <div className="border-t border-dashed border-black pt-1 text-[10px] mb-2">
            Catatan: {reconciliationNotes}
          </div>
        )}

        <div className="text-center text-[10px] pt-2 border-t border-dashed border-black">
          <div>Tanda Tangan Kasir: ___________________</div>
          <div className="mt-2">Dicetak pada: {new Date().toLocaleTimeString('id-ID')}</div>
        </div>
      </div>
    </div>
  );
};
