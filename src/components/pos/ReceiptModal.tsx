import React from 'react';
import { Transaction } from '../../types';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { generateThermalReceiptPDF } from '../../utils/pdfExport';
import { Printer, Download, X, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  if (!transaction) return null;

  const handlePrintThermal = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    generateThermalReceiptPDF(transaction);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header Alert */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-sm">Transaksi Berhasil Disimpan!</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div 
          id="printable-receipt"
          className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-slate-900 text-xs shadow-inner select-all"
        >
          {/* Thermal Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <h3 className="font-black text-base tracking-tight text-slate-900">ALUNK STORE</h3>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Sistem Manajemen Sembako Terintegrasi</p>
            <p className="text-[10px] text-slate-600 leading-tight">
              Jl. Tambak Pamarayan. Kp. Kedung Sapi Masjid RT. 009 / RW 003. Desa Kp. Baru. Kec. Pamarayan Serang - Banten
            </p>
            <p className="text-[10px] text-emerald-800 font-bold">Tel/Wa : +62821-2584-5237</p>
          </div>

          {/* Meta Info */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px] text-slate-700">
            <div className="flex justify-between">
              <span>No. Struk:</span>
              <span className="font-bold text-slate-900">{transaction.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu:</span>
              <span>{formatDateTimeIndo(transaction.timestamp)}</span>
            </div>
            <div className="flex justify-between">
              <span>Kasir:</span>
              <span>{transaction.cashierName}</span>
            </div>
            {transaction.customerName && (
              <div className="flex justify-between text-emerald-800 font-semibold">
                <span>Pelanggan:</span>
                <span>{transaction.customerName}</span>
              </div>
            )}
          </div>

          {/* Items List */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-2">
            {transaction.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between text-slate-900 font-semibold text-[11px]">
                  <span className="truncate pr-2">{item.productName}</span>
                  <span className="shrink-0">{formatRupiah(item.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>
                    {item.quantity} {item.unit} x {formatRupiah(item.unitPrice)}
                  </span>
                  <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-200 text-slate-700">
                    {item.priceType === 'wholesale' ? 'Grosir' : 'Eceran'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Total & Payment */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
            <div className="flex justify-between text-sm font-black text-slate-900 pt-0.5">
              <span>TOTAL BELANJA</span>
              <span>{formatRupiah(transaction.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-600 pt-1">
              <span>Metode Pembayaran:</span>
              <span className="font-bold uppercase text-slate-800">{transaction.paymentMethod}</span>
            </div>

            {transaction.paymentMethod === 'tunai' && (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Tunai Diterima:</span>
                  <span>{formatRupiah(transaction.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>Kembalian:</span>
                  <span className="text-emerald-700">{formatRupiah(transaction.change)}</span>
                </div>
              </>
            )}

            {transaction.paymentMethod === 'kasbon' && (
              <div className="p-2 bg-amber-100 rounded-lg text-amber-900 text-[10px] mt-1">
                <p className="font-bold">STATUS: KASBON / HUTANG</p>
                {transaction.dueDate && <p>Jatuh Tempo: {transaction.dueDate}</p>}
                {transaction.customerPhone && <p>Kontak: {transaction.customerPhone}</p>}
              </div>
            )}
          </div>

          {/* Footer Receipt Note */}
          <div className="text-center pt-3 space-y-1 text-[9px] text-slate-400">
            <p>Barang yang sudah dibeli tidak dapat ditukar</p>
            <p>Terima kasih atas kunjungan Anda!</p>
            <p className="font-bold tracking-wider text-slate-800">*** ALUNK STORE ***</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="btn-print-direct"
              onClick={handlePrintThermal}
              className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Cetak Thermal</span>
            </button>
            <button
              type="button"
              id="btn-download-pdf-receipt"
              onClick={handleDownloadPDF}
              className="py-3 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Struk PDF</span>
            </button>
          </div>

          <button
            type="button"
            id="btn-close-receipt"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-emerald-700/20"
          >
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
};
