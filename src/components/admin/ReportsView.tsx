import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatRupiah, formatDateIndo, formatDateTimeIndo } from '../../utils/formatters';
import { generateCashFlowPDF, generateProfitLossPDF, generateInventoryPDF } from '../../utils/pdfExport';
import { FileText, Download, Calendar, DollarSign, TrendingUp, Layers, CheckCircle2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const {
    transactions,
    expenses,
    supplierPurchases,
    products,
    shiftHistory,
    currentShift,
  } = useStore();

  const [activeReportTab, setActiveReportTab] = useState<'cashflow' | 'pl' | 'inventory'>('cashflow');
  const [reportPeriod, setReportPeriod] = useState<'today' | 'month' | 'all'>('month');

  // Calculations for reports
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const filterByPeriod = (dateStr: string) => {
    if (reportPeriod === 'today') return dateStr.startsWith(todayStr);
    if (reportPeriod === 'month') return dateStr.startsWith(currentMonthStr);
    return true;
  };

  // Filtered datasets
  const filteredTrx = transactions.filter(t => filterByPeriod(t.timestamp));
  const filteredExpenses = expenses.filter(e => filterByPeriod(e.date));
  const filteredSupplierPayments = supplierPurchases.filter(
    s => s.isPaid && s.paidDate && filterByPeriod(s.paidDate)
  );

  // Financial totals
  const totalCashSales = filteredTrx
    .filter(t => t.paymentMethod === 'tunai')
    .reduce((sum, t) => sum + t.totalAmount, 0);

  const totalQrisSales = filteredTrx
    .filter(t => t.paymentMethod === 'qris')
    .reduce((sum, t) => sum + t.totalAmount, 0);

  const totalKasbonPaidIn = transactions
    .filter(t => t.isKasbonPaid && t.kasbonPaidDate && filterByPeriod(t.kasbonPaidDate))
    .reduce((sum, t) => sum + t.totalAmount, 0);

  const totalInflow = totalCashSales + totalQrisSales + totalKasbonPaidIn;

  const totalExpensesOut = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSupplierPaidOut = filteredSupplierPayments.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalOutflow = totalExpensesOut + totalSupplierPaidOut;

  const netCashFlow = totalInflow - totalOutflow;

  // Profit & Loss calculations
  const totalRevenue = filteredTrx.reduce((sum, t) => sum + t.totalAmount, 0);
  const totalHpp = filteredTrx.reduce((sum, t) => {
    return (
      sum +
      t.items.reduce((itemSum, i) => {
        return itemSum + i.costPrice * i.quantity;
      }, 0)
    );
  }, 0);
  const grossProfit = totalRevenue - totalHpp;
  const netProfit = grossProfit - totalExpensesOut;

  // Inventory valuation
  const totalAssetHpp = products.reduce((sum, p) => sum + p.costPrice * p.stock, 0);
  const totalAssetRetail = products.reduce((sum, p) => sum + p.retailPrice * p.stock, 0);
  const potentialProfit = totalAssetRetail - totalAssetHpp;

  // PDF Export Handlers
  const periodLabel = reportPeriod === 'today' ? 'Hari Ini' : reportPeriod === 'month' ? 'Bulan Ini' : 'Semua Periode';

  const handleExportCashFlow = () => {
    generateCashFlowPDF(filteredTrx, supplierPurchases, filteredExpenses, periodLabel);
  };

  const handleExportPL = () => {
    generateProfitLossPDF(filteredTrx, filteredExpenses, periodLabel);
  };

  const handleExportInventory = () => {
    generateInventoryPDF(products);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Pusat Laporan Keuangan & Stok Sembako</h2>
            <p className="text-xs text-slate-500">
              Cetak dan unduh laporan resmi berstandar PDF untuk pembukuan dan audit toko.
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setReportPeriod('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              reportPeriod === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => setReportPeriod('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              reportPeriod === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Bulan Ini
          </button>
          <button
            type="button"
            onClick={() => setReportPeriod('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              reportPeriod === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Semua
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveReportTab('cashflow')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeReportTab === 'cashflow'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Laporan Arus Kas (Cash Flow)
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('pl')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeReportTab === 'pl'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Laporan Laba Rugi (Profit & Loss)
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeReportTab === 'inventory'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Laporan Nilai Aset Stok (Inventaris)
        </button>
      </div>

      {/* TAB 1: CASH FLOW REPORT */}
      {activeReportTab === 'cashflow' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-emerald-800">
              <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
              <div>
                <h4 className="font-bold text-sm">Arus Kas Bersih (Net Cash Flow)</h4>
                <p className="text-xs text-emerald-700">Total Kas Masuk dikurangi Total Kas Keluar</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-black font-mono text-emerald-900">
                {formatRupiah(netCashFlow)}
              </span>
              <button
                type="button"
                id="btn-export-cashflow-pdf"
                onClick={handleExportCashFlow}
                className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Arus Kas Masuk */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-emerald-700">
                  <ArrowUpCircle className="w-4 h-4" />
                  <span>Arus Kas Masuk (Inflow)</span>
                </h4>
                <span className="font-mono font-black text-emerald-700">{formatRupiah(totalInflow)}</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-600">Penjualan Kasir Tunai (Cash)</span>
                  <span className="font-mono font-bold">{formatRupiah(totalCashSales)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-600">Penjualan Kasir QRIS / Non-Tunai</span>
                  <span className="font-mono font-bold">{formatRupiah(totalQrisSales)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-600">Pelunasan Kasbon Langganan</span>
                  <span className="font-mono font-bold">{formatRupiah(totalKasbonPaidIn)}</span>
                </div>
              </div>
            </div>

            {/* Arus Kas Keluar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 text-rose-700">
                  <ArrowDownCircle className="w-4 h-4" />
                  <span>Arus Kas Keluar (Outflow)</span>
                </h4>
                <span className="font-mono font-black text-rose-700">{formatRupiah(totalOutflow)}</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-600">Beban Operasional (Listrik, Gaji, Plastik)</span>
                  <span className="font-mono font-bold text-rose-600">{formatRupiah(totalExpensesOut)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-600">Pembelian & Pembayaran Supplier</span>
                  <span className="font-mono font-bold text-rose-600">{formatRupiah(totalSupplierPaidOut)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROFIT & LOSS REPORT */}
      {activeReportTab === 'pl' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-black text-slate-900">Laporan Laba Rugi Berdasarkan HPP</h3>
              <p className="text-xs text-slate-500">
                Perhitungan akurat margin laba bersih toko sembako dari omset dikurangi HPP dan beban operasional.
              </p>
            </div>
            <button
              type="button"
              id="btn-export-pl-pdf"
              onClick={handleExportPL}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Cetak / Download PDF</span>
            </button>
          </div>

          <div className="space-y-3 max-w-2xl mx-auto">
            <div className="flex justify-between text-sm py-2 border-b border-slate-100">
              <span className="font-bold text-slate-900">1. Total Pendapatan Penjualan (Omset)</span>
              <span className="font-mono font-black text-slate-900 text-base">{formatRupiah(totalRevenue)}</span>
            </div>

            <div className="flex justify-between text-sm py-2 border-b border-slate-100 text-slate-600">
              <span>2. Harga Pokok Penjualan (Total HPP Barang Terjual)</span>
              <span className="font-mono font-bold">({formatRupiah(totalHpp)})</span>
            </div>

            <div className="flex justify-between text-base py-2.5 bg-emerald-50/70 px-3 rounded-xl font-bold text-emerald-900">
              <span>= LABA KOTOR (GROSS PROFIT)</span>
              <span className="font-mono">{formatRupiah(grossProfit)}</span>
            </div>

            <div className="pt-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                3. Rincian Beban Operasional:
              </span>
              <div className="space-y-1.5 pl-3 border-l-2 border-slate-200 text-xs text-slate-600">
                {filteredExpenses.map(e => (
                  <div key={e.id} className="flex justify-between">
                    <span>{e.category}: {e.description}</span>
                    <span className="font-mono text-rose-600">({formatRupiah(e.amount)})</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                  <span>Total Beban Operasional</span>
                  <span className="font-mono text-rose-700">({formatRupiah(totalExpensesOut)})</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between text-lg py-3.5 bg-slate-900 text-white px-4 rounded-2xl font-black mt-4">
              <span>= LABA BERSIH (NET PROFIT)</span>
              <span className="font-mono text-emerald-400">{formatRupiah(netProfit)}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY VALUATION REPORT */}
      {activeReportTab === 'inventory' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-black text-slate-900">Laporan Nilai Aset Stok Sembako (Inventaris)</h3>
              <p className="text-xs text-slate-500">
                Valuasi total modal barang yang tersimpan di toko dan gudang berdasarkan HPP dan harga eceran.
              </p>
            </div>
            <button
              type="button"
              id="btn-export-inventory-pdf"
              onClick={handleExportInventory}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Cetak / Download PDF</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total Nilai Aset Modal (HPP)
              </span>
              <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
                {formatRupiah(totalAssetHpp)}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Potensi Nilai Jual Eceran
              </span>
              <span className="text-xl font-black font-mono text-emerald-700 mt-1 block">
                {formatRupiah(totalAssetRetail)}
              </span>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Proyeksi Margin Laba Kotor Stok
              </span>
              <span className="text-xl font-black font-mono text-emerald-900 mt-1 block">
                +{formatRupiah(potentialProfit)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Barang</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Sisa Stok</th>
                  <th className="py-3 px-4 text-right">HPP</th>
                  <th className="py-3 px-4 text-right">Subtotal Nilai Aset (HPP)</th>
                  <th className="py-3 px-4 text-right">Harga Jual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 text-slate-600">{p.category}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {p.stock} {p.baseUnit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{formatRupiah(p.costPrice)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(p.costPrice * p.stock)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">{formatRupiah(p.retailPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
