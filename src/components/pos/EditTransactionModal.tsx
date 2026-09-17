import React, { useState, useEffect } from 'react';
import { Transaction, PaymentMethod } from '../../types';
import { useStore } from '../../context/StoreContext';
import { formatRupiah, formatNumber, parseThousand } from '../../utils/formatters';
import FormattedNumberInput from '../common/FormattedNumberInput';
import { 
  X, 
  Save, 
  Trash2, 
  CreditCard, 
  User, 
  Calendar, 
  Receipt, 
  AlertCircle,
  Clock,
  Plus
} from 'lucide-react';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

interface EditableItem {
  productId: string;
  productName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  costPrice: number;
  priceType: 'retail' | 'wholesale';
  allowDecimal?: boolean;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  onClose,
}) => {
  const { updateTransaction, products } = useStore();

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tunai');
  const [amountPaid, setAmountPaid] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [kasbonNotes, setKasbonNotes] = useState('');
  const [isKasbonPaid, setIsKasbonPaid] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (transaction) {
      setInvoiceNumber(transaction.invoiceNumber);
      // Format timestamp for datetime-local: YYYY-MM-DDTHH:mm
      try {
        const d = new Date(transaction.timestamp);
        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setTimestamp(isoLocal);
      } catch {
        setTimestamp(transaction.timestamp.slice(0, 16));
      }
      setCashierName(transaction.cashierName);
      setCustomerName(transaction.customerName || '');
      setCustomerPhone(transaction.customerPhone || '');
      setPaymentMethod(transaction.paymentMethod);
      setAmountPaid(String(transaction.amountPaid || 0));
      setDueDate(transaction.dueDate || '');
      setKasbonNotes(transaction.kasbonNotes || '');
      setIsKasbonPaid(!!transaction.isKasbonPaid);

      setItems(
        transaction.items.map(item => {
          const matchedProd = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            productName: item.productName,
            quantity: String(item.quantity),
            unit: item.unit,
            unitPrice: String(item.unitPrice),
            costPrice: item.costPrice,
            priceType: item.priceType,
            allowDecimal: matchedProd?.allowDecimal,
          };
        })
      );
      setErrorMessage('');
    }
  }, [transaction, products]);

  if (!transaction) return null;

  // Recalculate totals
  const calculatedItems = items.map(item => {
    const qty = parseThousand(item.quantity) || 0;
    const price = parseThousand(item.unitPrice) || 0;
    const subtotal = qty * price;
    const costSubtotal = qty * item.costPrice;
    return {
      ...item,
      numQty: qty,
      numPrice: price,
      subtotal,
      costSubtotal,
    };
  });

  const totalAmount = calculatedItems.reduce((acc, item) => acc + item.subtotal, 0);
  const totalCost = calculatedItems.reduce((acc, item) => acc + item.costSubtotal, 0);

  const numAmountPaid = parseThousand(amountPaid) || 0;
  const change = paymentMethod === 'tunai' ? Math.max(0, numAmountPaid - totalAmount) : 0;

  const handleUpdateItemQty = (index: number, val: string) => {
    const updated = [...items];
    updated[index].quantity = val;
    setItems(updated);
  };

  const handleUpdateItemPrice = (index: number, val: string) => {
    const updated = [...items];
    updated[index].unitPrice = val;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setErrorMessage('Transaksi harus memiliki minimal 1 item barang belanjaan.');
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    setErrorMessage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (items.length === 0) {
      setErrorMessage('Transaksi tidak boleh kosong.');
      return;
    }

    // Check invalid quantities
    for (const item of calculatedItems) {
      if (item.numQty <= 0) {
        setErrorMessage(`Kuantitas untuk "${item.productName}" harus lebih dari 0.`);
        return;
      }
      if (item.numPrice < 0) {
        setErrorMessage(`Harga untuk "${item.productName}" tidak boleh bernilai negatif.`);
        return;
      }
    }

    if (paymentMethod === 'kasbon' && !customerName.trim()) {
      setErrorMessage('Nama pelanggan wajib diisi untuk transaksi metode Kasbon/Hutang.');
      return;
    }

    if (paymentMethod === 'tunai' && numAmountPaid < totalAmount) {
      setErrorMessage(`Uang tunai diterima (${formatRupiah(numAmountPaid)}) kurang dari total belanja (${formatRupiah(totalAmount)}).`);
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

    const updatedTransaction: Transaction = {
      ...transaction,
      invoiceNumber: invoiceNumber.trim() || transaction.invoiceNumber,
      timestamp: parsedIsoTimestamp,
      cashierName: cashierName.trim() || transaction.cashierName,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      paymentMethod,
      totalAmount,
      totalCost,
      amountPaid: paymentMethod === 'tunai' ? numAmountPaid : totalAmount,
      change,
      dueDate: paymentMethod === 'kasbon' && dueDate ? dueDate : undefined,
      kasbonNotes: paymentMethod === 'kasbon' && kasbonNotes ? kasbonNotes.trim() : undefined,
      isKasbonPaid: paymentMethod === 'kasbon' ? isKasbonPaid : undefined,
      items: calculatedItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.numQty,
        unit: item.unit,
        unitPrice: item.numPrice,
        costPrice: item.costPrice,
        subtotal: item.subtotal,
        priceType: item.priceType,
      })),
    };

    updateTransaction(updatedTransaction);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg">Edit Struk Transaksi</h3>
              <p className="text-xs text-slate-500 font-mono">
                No. Struk: <span className="font-bold text-slate-800">{transaction.invoiceNumber}</span>
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
        <form id="edit-trx-form" onSubmit={handleSubmit} className="overflow-y-auto py-4 space-y-4 pr-1">
          {/* Metadata Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Waktu Transaksi
              </label>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={e => setTimestamp(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Nama Kasir
              </label>
              <input
                type="text"
                value={cashierName}
                onChange={e => setCashierName(e.target.value)}
                placeholder="Nama kasir..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Nama Pelanggan
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Pelanggan Umum (opsional)"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                No. HP / WA Pelanggan
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="08123xxxxxxx (opsional)"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <label className="block text-[11px] font-bold text-slate-600">
              Metode Pembayaran
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('tunai');
                  if (numAmountPaid < totalAmount) setAmountPaid(String(totalAmount));
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  paymentMethod === 'tunai'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>Tunai</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('qris')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  paymentMethod === 'qris'
                    ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>QRIS</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('kasbon')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  paymentMethod === 'kasbon'
                    ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>Kasbon (Hutang)</span>
              </button>
            </div>

            {paymentMethod === 'tunai' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Uang Tunai Diterima (Rp)
                  </label>
                  <FormattedNumberInput
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kembalian Kasir (Rp)
                  </label>
                  <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono font-bold text-emerald-800">
                    {formatRupiah(change)}
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'kasbon' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    Tanggal Jatuh Tempo
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    Catatan Kasbon
                  </label>
                  <input
                    type="text"
                    value={kasbonNotes}
                    onChange={e => setKasbonNotes(e.target.value)}
                    placeholder="Catatan barang/janji bayar..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isKasbonPaidCheck"
                    checked={isKasbonPaid}
                    onChange={e => setIsKasbonPaid(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="isKasbonPaidCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Tandai Hutang/Kasbon Sudah Dilunasi
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Items List Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Item Belanja Transaksi ({items.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Ubah kuantitas atau harga satuan jika ada revisi
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Produk</th>
                      <th className="py-2.5 px-3 w-28">Jumlah (Qty)</th>
                      <th className="py-2.5 px-3 w-32">Harga Satuan</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-2 text-center w-10">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calculatedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{item.productName}</div>
                          <div className="text-[10px] text-slate-500">
                            Satuan: {item.unit} • {item.priceType === 'wholesale' ? 'Harga Grosir' : 'Harga Eceran'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <FormattedNumberInput
                            allowDecimal={item.allowDecimal}
                            value={item.quantity}
                            onChange={e => handleUpdateItemQty(idx, e.target.value)}
                            placeholder="1"
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <FormattedNumberInput
                            value={item.unitPrice}
                            onChange={e => handleUpdateItemPrice(idx, e.target.value)}
                            placeholder="0"
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(item.subtotal)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className={`p-1 rounded-lg transition ${
                              items.length <= 1
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-rose-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer'
                            }`}
                            title={items.length <= 1 ? 'Minimal harus ada 1 item' : 'Hapus item ini'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Total Summary Footer */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                Total Transaksi Baru
              </span>
              <span className="text-xl font-black font-mono text-emerald-400">
                {formatRupiah(totalAmount)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                Perkiraan Modal HPP
              </span>
              <span className="text-sm font-bold font-mono text-slate-300">
                {formatRupiah(totalCost)}
              </span>
            </div>
          </div>
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
            form="edit-trx-form"
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
