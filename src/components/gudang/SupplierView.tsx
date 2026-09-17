import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, Supplier, SupplierPurchase } from '../../types';
import { formatRupiah, formatNumber, formatDateIndo, formatDateTimeIndo, parseThousand } from '../../utils/formatters';
import FormattedNumberInput from '../common/FormattedNumberInput';
import { 
  Truck, 
  Plus, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  DollarSign, 
  Box, 
  ArrowRight,
  Clock,
  Building,
  CreditCard,
  X,
  Edit,
  Trash2,
  Shield,
  ShieldCheck,
  Lock
} from 'lucide-react';

export const SupplierView: React.FC = () => {
  const {
    suppliers,
    supplierPurchases,
    addSupplierPurchase,
    updateSupplierPurchase,
    deleteSupplierPurchase,
    paySupplierDebt,
    products,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    currentUser,
  } = useStore();

  const isAdmin = currentUser?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'purchases' | 'debts' | 'suppliers'>('purchases');
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);

  // Edit / Delete states for Supplier (Admin only)
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [editSupName, setEditSupName] = useState('');
  const [editSupPhone, setEditSupPhone] = useState('');
  const [editSupAddress, setEditSupAddress] = useState('');

  // Edit / Delete states for Purchase/Debt (Admin only)
  const [purchaseToEdit, setPurchaseToEdit] = useState<SupplierPurchase | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<SupplierPurchase | null>(null);
  const [editInvoiceNo, setEditInvoiceNo] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTempoDueDate, setEditTempoDueDate] = useState('');
  const [editPaymentType, setEditPaymentType] = useState<'tunai' | 'tempo'>('tempo');
  const [editIsPaid, setEditIsPaid] = useState(false);
  const [editTotalAmount, setEditTotalAmount] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Form states for Receiving goods
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [paymentType, setPaymentType] = useState<'tunai' | 'tempo'>('tempo');
  
  // Default tempo: 14 days
  const defaultTempoDate = new Date();
  defaultTempoDate.setDate(defaultTempoDate.getDate() + 14);
  const [tempoDueDate, setTempoDueDate] = useState(defaultTempoDate.toISOString().slice(0, 10));

  // Selected product item for entry
  const [entryProductId, setEntryProductId] = useState(products[0]?.id || '');
  const [entryUnitType, setEntryUnitType] = useState<'dus' | 'base'>('dus');
  const [entryQty, setEntryQty] = useState('1');
  const [entryUnitPrice, setEntryUnitPrice] = useState('150000');
  const [entryExpiredDate, setEntryExpiredDate] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // New Supplier form
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [debtPaymentTarget, setDebtPaymentTarget] = useState<SupplierPurchase | null>(null);

  // Outstanding supplier debts
  const unpaidPurchases = supplierPurchases.filter(p => p.paymentType === 'tempo' && !p.isPaid);
  const totalOutstandingDebt = unpaidPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

  // When product changes in modal, auto-populate unit and default box price
  const handleProductChange = (prodId: string) => {
    setEntryProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      if (prod.hasMultiUnit) {
        setEntryUnitType('dus');
        const boxRatio = prod.boxConversionRatio || 12;
        setEntryUnitPrice((prod.costPrice * boxRatio).toString());
      } else {
        setEntryUnitType('base');
        setEntryUnitPrice(prod.costPrice.toString());
      }
      setEntryExpiredDate(prod.expiredDate || '');
    }
  };

  const handleConfirmReceive = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find(s => s.id === selectedSupplierId);
    const prod = products.find(p => p.id === entryProductId);

    if (!sup || !prod) return;

    const qtyEntered = parseThousand(entryQty) || 1;
    const unitPrice = parseThousand(entryUnitPrice) || 0;
    const subtotal = qtyEntered * unitPrice;

    // AUTOMATIC UNIT CONVERSION:
    // If entered in "Dus" and product has 1 Dus = 12 Pouch,
    // baseQtyAdded = 12 * qtyEntered!
    let baseQtyAdded = qtyEntered;
    let unitLabel = prod.baseUnit;

    if (entryUnitType === 'dus' && prod.hasMultiUnit && prod.boxConversionRatio) {
      baseQtyAdded = qtyEntered * prod.boxConversionRatio;
      unitLabel = prod.boxUnitName || 'Dus';
    }

    addSupplierPurchase({
      supplierId: sup.id,
      supplierName: sup.name,
      date: new Date().toISOString().slice(0, 10),
      paymentType,
      tempoDueDate: paymentType === 'tempo' ? tempoDueDate : undefined,
      isPaid: paymentType === 'tunai',
      paidDate: paymentType === 'tunai' ? new Date().toISOString() : undefined,
      items: [
        {
          productId: prod.id,
          productName: prod.name,
          quantityEntered: qtyEntered,
          unitEntered: unitLabel,
          baseQtyAdded, // This is the converted base quantity that adds to stock!
          unitPrice,
          subtotal,
          expiredDate: entryExpiredDate || undefined,
        },
      ],
      totalAmount: subtotal,
      notes: purchaseNotes.trim() || undefined,
    });

    setIsReceiveModalOpen(false);
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;

    addSupplier({
      name: supName.trim(),
      phone: supPhone.trim(),
      address: supAddress.trim(),
    });

    setSupName('');
    setSupPhone('');
    setSupAddress('');
    setIsNewSupplierModalOpen(false);
  };

  // Open Edit Supplier (Admin Only)
  const openEditSupplier = (s: Supplier) => {
    if (!isAdmin) return;
    setSupplierToEdit(s);
    setEditSupName(s.name);
    setEditSupPhone(s.phone);
    setEditSupAddress(s.address);
  };

  const handleSaveEditSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierToEdit || !isAdmin) return;
    if (!editSupName.trim() || !editSupPhone.trim()) return;

    updateSupplier({
      ...supplierToEdit,
      name: editSupName.trim(),
      phone: editSupPhone.trim(),
      address: editSupAddress.trim(),
    });

    setSupplierToEdit(null);
    setActionSuccessMsg(`Data supplier "${editSupName.trim()}" berhasil diperbarui.`);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handleConfirmDeleteSupplier = () => {
    if (!supplierToDelete || !isAdmin) return;
    const name = supplierToDelete.name;
    deleteSupplier(supplierToDelete.id);
    setSupplierToDelete(null);
    setActionSuccessMsg(`Supplier "${name}" berhasil dihapus dari sistem.`);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  // Open Edit Purchase / Debt (Admin Only)
  const openEditPurchase = (p: SupplierPurchase) => {
    if (!isAdmin) return;
    setPurchaseToEdit(p);
    setEditInvoiceNo(p.invoiceNumber);
    setEditDate(p.date);
    setEditTempoDueDate(p.tempoDueDate || '');
    setEditPaymentType(p.paymentType);
    setEditIsPaid(p.isPaid);
    setEditTotalAmount(p.totalAmount.toString());
  };

  const handleSaveEditPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseToEdit || !isAdmin) return;

    const newTotal = parseThousand(editTotalAmount) || purchaseToEdit.totalAmount;
    updateSupplierPurchase({
      ...purchaseToEdit,
      invoiceNumber: editInvoiceNo.trim() || purchaseToEdit.invoiceNumber,
      date: editDate || purchaseToEdit.date,
      paymentType: editPaymentType,
      tempoDueDate: editPaymentType === 'tempo' ? editTempoDueDate : undefined,
      isPaid: editIsPaid,
      paidDate: editIsPaid ? (purchaseToEdit.paidDate || new Date().toISOString()) : undefined,
      totalAmount: newTotal,
    });

    setPurchaseToEdit(null);
    setActionSuccessMsg(`Data pembelian/hutang faktur ${purchaseToEdit.invoiceNumber} berhasil diperbarui.`);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handleConfirmDeletePurchase = () => {
    if (!purchaseToDelete || !isAdmin) return;
    const inv = purchaseToDelete.invoiceNumber;
    deleteSupplierPurchase(purchaseToDelete.id);
    setPurchaseToDelete(null);
    setActionSuccessMsg(`Catatan faktur "${inv}" berhasil dihapus.`);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handlePaySupplierDebt = (purchase: SupplierPurchase) => {
    setDebtPaymentTarget(purchase);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total Penerimaan Stok
            </span>
            <span className="text-xl font-black font-mono text-slate-900">
              {supplierPurchases.length} Transaksi
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Barang masuk dari distributor</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Hutang Pembelian Tempo (7-14 Hari)
            </span>
            <span className="text-xl font-black font-mono text-amber-700">
              {formatRupiah(totalOutstandingDebt)}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">{unpaidPurchases.length} faktur belum lunas</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Distributor Sembako
            </span>
            <span className="text-sm font-bold text-slate-800">{suppliers.length} Mitra Supplier</span>
          </div>
          <button
            type="button"
            id="btn-open-receive-modal"
            onClick={() => {
              if (products.length > 0) handleProductChange(products[0].id);
              setIsReceiveModalOpen(true);
            }}
            className="py-2.5 px-3.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Barang Masuk</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'purchases'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Riwayat Barang Masuk ({supplierPurchases.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('debts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'debts'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Jadwal Hutang Tempo ({unpaidPurchases.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'suppliers'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Daftar Supplier ({suppliers.length})
        </button>
      </div>

        {/* TAB 1: PURCHASES HISTORY */}
        {activeTab === 'purchases' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">No. Faktur & Tanggal</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Barang Masuk & Konversi</th>
                    <th className="py-3 px-4">Pembayaran</th>
                    <th className="py-3 px-4 text-right">Total Pembelian</th>
                    <th className="py-3 px-4 text-center">Status Pembayaran</th>
                    {isAdmin && <th className="py-3 px-4 text-center">Aksi (Admin)</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-slate-400">
                        Belum ada riwayat penerimaan stok dari supplier.
                      </td>
                    </tr>
                  ) : (
                    supplierPurchases.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">{p.invoiceNumber}</div>
                          <div className="text-[11px] text-slate-500">{p.date}</div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {p.supplierName}
                        </td>
                        <td className="py-3.5 px-4 max-w-sm">
                          <div className="space-y-1">
                            {p.items.map((it, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-semibold text-slate-900">{it.productName}: </span>
                                <span className="text-teal-700 font-bold">
                                  {it.quantityEntered} {it.unitEntered}
                                </span>
                                {it.unitEntered !== 'pcs' && it.unitEntered !== 'pouch' && (
                                  <span className="text-[11px] text-slate-500 ml-1">
                                    (&rarr; Stok bertambah <strong>+{it.baseQtyAdded}</strong>)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            p.paymentType === 'tunai'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {p.paymentType === 'tunai' ? 'Tunai (Cash)' : 'Tempo (Utang)'}
                          </span>
                          {p.paymentType === 'tempo' && p.tempoDueDate && (
                            <div className="text-[11px] text-slate-500 mt-1">
                              Jatuh tempo: {p.tempoDueDate}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-slate-900">
                          {formatRupiah(p.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {p.isPaid ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Lunas</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePaySupplierDebt(p)}
                              className="py-1 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                              Bayar Utang
                            </button>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditPurchase(p)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 transition cursor-pointer"
                                title="Edit Faktur / Hutang (Admin)"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPurchaseToDelete(p)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                                title="Hapus Faktur / Hutang (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SUPPLIER DEBTS */}
        {activeTab === 'debts' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Jadwal Pembayaran Hutang Supplier (Tempo)</h3>
                <p className="text-xs text-slate-500">Pantau jatuh tempo 7–14 hari agar reputasi toko terjaga baik dengan distributor.</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Total Tagihan Belum Dibayar:</span>
                <span className="text-lg font-black font-mono text-amber-700">
                  {formatRupiah(totalOutstandingDebt)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nama Distributor</th>
                    <th className="py-3 px-4">No. Faktur</th>
                    <th className="py-3 px-4">Tanggal Pembelian</th>
                    <th className="py-3 px-4">Jatuh Tempo</th>
                    <th className="py-3 px-4 text-right">Nominal Tagihan</th>
                    <th className="py-3 px-4 text-center">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unpaidPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-700">Tidak ada hutang supplier yang aktif!</p>
                        <p className="text-xs">Semua pembelian barang telah dilunasi dengan tertib.</p>
                      </td>
                    </tr>
                  ) : (
                    unpaidPurchases.map(p => {
                      const isOverdue = p.tempoDueDate && new Date(p.tempoDueDate) < new Date(new Date().setHours(0,0,0,0));

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                            {p.supplierName}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                            {p.invoiceNumber}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{p.date}</td>
                          <td className="py-3.5 px-4">
                            <div className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                              {p.tempoDueDate ? formatDateIndo(p.tempoDueDate) : '-'}
                              {isOverdue && (
                                <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md ml-2 font-bold">
                                  Jatuh Tempo Lewat!
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-slate-900">
                            {formatRupiah(p.totalAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handlePaySupplierDebt(p)}
                                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                              >
                                Pelunasan Hutang
                              </button>
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditPurchase(p)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 transition cursor-pointer"
                                    title="Edit Data Hutang (Admin)"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPurchaseToDelete(p)}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                                    title="Hapus Catatan Hutang (Admin)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SUPPLIERS LIST */}
        {activeTab === 'suppliers' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Daftar Distributor & Supplier Sembako</h3>
                <p className="text-xs text-slate-500">Data kontak dan alamat supplier untuk pemesanan stok</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewSupplierModalOpen(true)}
                className="py-2 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Supplier</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {suppliers.length === 0 ? (
                <div className="col-span-3 py-10 text-center text-slate-400">
                  Belum ada data supplier. Klik tombol &ldquo;Tambah Supplier&rdquo; di atas untuk mendaftarkan mitra distributor.
                </div>
              ) : (
                suppliers.map(s => (
                  <div key={s.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-teal-800 mb-1">
                        <Building className="w-5 h-5" />
                        <h4 className="font-bold text-slate-900 text-sm">{s.name}</h4>
                      </div>
                      <p className="text-xs text-slate-600">Telp: <strong className="text-slate-800">{s.phone}</strong></p>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">{s.address || 'Alamat belum diatur'}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                      {isAdmin ? (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => openEditSupplier(s)}
                            className="py-1 px-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Edit Supplier (Admin)"
                          >
                            <Edit className="w-3.5 h-3.5 text-teal-700" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSupplierToDelete(s)}
                            className="py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Hapus Supplier (Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 italic ml-auto">
                          <Lock className="w-3 h-3" />
                          <span>Akses Edit/Hapus khusus Admin</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      {/* MODAL: CATAT BARANG MASUK DARI SUPPLIER */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-teal-800">
                <Truck className="w-5 h-5" />
                <h3 className="font-black text-lg text-slate-900">Penerimaan Barang Masuk (Stok In)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceive} className="space-y-4">
              {/* Supplier Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Distributor / Supplier *
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-teal-500"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {s.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Barang Sembako yang Diterima *
                </label>
                <select
                  value={entryProductId}
                  onChange={e => handleProductChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-teal-500"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.hasMultiUnit ? `1 ${p.boxUnitName || 'Dus'} = ${p.boxConversionRatio} ${p.baseUnit}` : `Satuan: ${p.baseUnit}`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Conversion Demo Notification */}
              {(() => {
                const curProd = products.find(p => p.id === entryProductId);
                if (!curProd) return null;
                const isDus = entryUnitType === 'dus' && curProd.hasMultiUnit;
                const ratio = curProd.boxConversionRatio || 12;
                const calculatedBase = (parseFloat(entryQty) || 0) * (isDus ? ratio : 1);

                return (
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-teal-900">Satuan Input Masuk:</span>
                      {curProd.hasMultiUnit ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEntryUnitType('dus')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              entryUnitType === 'dus'
                                ? 'bg-teal-700 text-white'
                                : 'bg-white text-slate-700 border border-slate-300'
                            }`}
                          >
                            Input Satuan Besar ({curProd.boxUnitName || 'Dus'})
                          </button>
                          <button
                            type="button"
                            onClick={() => setEntryUnitType('base')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              entryUnitType === 'base'
                                ? 'bg-teal-700 text-white'
                                : 'bg-white text-slate-700 border border-slate-300'
                            }`}
                          >
                            Input Satuan Dasar ({curProd.baseUnit})
                          </button>
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-600">Hanya {curProd.baseUnit}</span>
                      )}
                    </div>

                    <div className="text-[11px] text-teal-800 bg-white p-2 rounded-xl border border-teal-150 flex items-center justify-between">
                      <span>Hasil Konversi Otomatis ke Stok Toko:</span>
                      <span className="font-bold text-teal-900 font-mono text-xs">
                        +{formatNumber(calculatedBase)} {curProd.baseUnit}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Quantity & Unit Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jumlah Masuk *
                  </label>
                  <FormattedNumberInput
                    allowDecimal={true}
                    required
                    value={entryQty}
                    onChange={e => setEntryQty(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Harga Beli Total per Satuan Input (Rp) *
                  </label>
                  <FormattedNumberInput
                    required
                    value={entryUnitPrice}
                    onChange={e => setEntryUnitPrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Expired Date Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Expired Barang Masuk (Kadaluwarsa)
                </label>
                <input
                  type="date"
                  value={entryExpiredDate}
                  onChange={e => setEntryExpiredDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Wajib untuk mi instan, susu, roti, bumbu instan agar notifikasi H-30 aktif.
                </p>
              </div>

              {/* Payment Type: Tunai vs Tempo */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Metode Pembayaran ke Supplier *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('tunai')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      paymentType === 'tunai'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Tunai / Cash Lunas
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentType('tempo')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      paymentType === 'tempo'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Tempo (Hutang 7-14 Hari)
                  </button>
                </div>

                {paymentType === 'tempo' && (
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      Jatuh Tempo Pembayaran Distributor:
                    </label>
                    <input
                      type="date"
                      value={tempoDueDate}
                      onChange={e => setTempoDueDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-900"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Penerimaan / No. Surat Jalan (Opsional)
                </label>
                <input
                  type="text"
                  value={purchaseNotes}
                  onChange={e => setPurchaseNotes(e.target.value)}
                  placeholder="Contoh: Pengiriman batch pagi, kondisi baik"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              {/* Total Calculation Display */}
              <div className="p-3 bg-slate-100 rounded-2xl flex justify-between items-center text-sm font-bold">
                <span className="text-slate-700">Total Nilai Pembelian:</span>
                <span className="font-mono text-slate-900 text-base">
                  {formatRupiah((parseThousand(entryQty) || 0) * (parseThousand(entryUnitPrice) || 0))}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-2 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20"
                >
                  Simpan & Tambah Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW SUPPLIER */}
      {isNewSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Tambah Mitra Distributor</h3>
              <button
                type="button"
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Perusahaan / Agen *
                </label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={e => setSupName(e.target.value)}
                  placeholder="Contoh: PT Sinar Sembako Utama"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  No. Kontak / Telepon
                </label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={e => setSupPhone(e.target.value)}
                  placeholder="0812345678"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Gudang / Kantor
                </label>
                <textarea
                  rows={2}
                  value={supAddress}
                  onChange={e => setSupAddress(e.target.value)}
                  placeholder="Kawasan Pergudangan..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewSupplierModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold"
                >
                  Simpan Mitra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: PAY SUPPLIER DEBT */}
      {debtPaymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-900">Konfirmasi Bayar Hutang Supplier</h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin mencatat pelunasan hutang pembelian tempo ke supplier <strong className="text-slate-800">{debtPaymentTarget.supplierName}</strong>?
              </p>
              <div className="bg-teal-50 p-3 rounded-2xl border border-teal-150 text-center space-y-1">
                <span className="text-[11px] text-teal-800 font-medium block">Total Pembayaran Hutang:</span>
                <span className="text-xl font-black font-mono text-teal-700">{formatRupiah(debtPaymentTarget.totalAmount)}</span>
                <div className="text-[11px] text-slate-500 font-mono">Invoice: {debtPaymentTarget.invoiceNumber}</div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                id="btn-cancel-pay-supplier"
                onClick={() => setDebtPaymentTarget(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-pay-supplier"
                onClick={() => {
                  paySupplierDebt(debtPaymentTarget.id);
                  setDebtPaymentTarget(null);
                }}
                className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Ya, Lunasi Hutang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SUPPLIER (ADMIN ONLY) */}
      {supplierToEdit && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Edit Data Mitra Supplier</h3>
                  <p className="text-[11px] text-slate-400">Hak Akses: Administrator</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupplierToEdit(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Supplier / PT / Distributor</label>
                <input
                  type="text"
                  required
                  value={editSupName}
                  onChange={e => setEditSupName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">No. Telepon / WhatsApp Sales</label>
                <input
                  type="text"
                  required
                  value={editSupPhone}
                  onChange={e => setEditSupPhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Kantor / Gudang Supplier</label>
                <textarea
                  rows={2}
                  value={editSupAddress}
                  onChange={e => setEditSupAddress(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSupplierToEdit(null)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold transition shadow-sm cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE SUPPLIER (ADMIN ONLY) */}
      {supplierToDelete && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900">Hapus Mitra Supplier?</h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus data supplier <strong className="text-slate-900">{supplierToDelete.name}</strong>?
              </p>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-left text-[11px] text-slate-600 space-y-0.5">
                <div>Telp: <span className="font-semibold">{supplierToDelete.phone}</span></div>
                <div className="line-clamp-2">Alamat: {supplierToDelete.address || '-'}</div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSupplier}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Ya, Hapus Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PURCHASE / DEBT (ADMIN ONLY) */}
      {purchaseToEdit && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Edit Data Faktur Pembelian / Hutang</h3>
                  <p className="text-[11px] text-slate-400">Supplier: {purchaseToEdit.supplierName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPurchaseToEdit(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPurchase} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Faktur / Invoice</label>
                <input
                  type="text"
                  required
                  value={editInvoiceNo}
                  onChange={e => setEditInvoiceNo(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Pembelian</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Metode Bayar</label>
                  <select
                    value={editPaymentType}
                    onChange={e => setEditPaymentType(e.target.value as 'tunai' | 'tempo')}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="tunai">Tunai (Cash)</option>
                    <option value="tempo">Tempo (Hutang)</option>
                  </select>
                </div>
              </div>

              {editPaymentType === 'tempo' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Jatuh Tempo</label>
                  <input
                    type="date"
                    value={editTempoDueDate}
                    onChange={e => setEditTempoDueDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Total Nominal Pembelian (Rp)</label>
                <FormattedNumberInput
                  required
                  value={editTotalAmount}
                  onChange={e => setEditTotalAmount(e.target.value)}
                  placeholder="0"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono font-bold"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">Status Pembayaran</div>
                  <div className="text-[11px] text-slate-500">Tandai apakah faktur ini sudah lunas</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsPaid}
                    onChange={e => setEditIsPaid(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPurchaseToEdit(null)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold transition shadow-sm cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE PURCHASE / DEBT (ADMIN ONLY) */}
      {purchaseToDelete && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900">Hapus Catatan Pembelian?</h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus faktur <strong className="font-mono text-slate-900">{purchaseToDelete.invoiceNumber}</strong> dari supplier <strong className="text-slate-900">{purchaseToDelete.supplierName}</strong>?
              </p>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs space-y-0.5">
                <div className="text-slate-500">Nominal Faktur:</div>
                <div className="text-base font-black font-mono text-slate-800">{formatRupiah(purchaseToDelete.totalAmount)}</div>
                <div className="text-[11px] text-slate-400">Tanggal: {purchaseToDelete.date}</div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPurchaseToDelete(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePurchase}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Ya, Hapus Faktur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
