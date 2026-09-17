import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, Transaction } from '../../types';
import { formatRupiah, formatNumber } from '../../utils/formatters';
import { PaymentModal } from './PaymentModal';
import { ReceiptModal } from './ReceiptModal';
import { HeldTransactionsModal } from './HeldTransactionsModal';
import { ShiftModal } from './ShiftModal';
import FormattedNumberInput from '../common/FormattedNumberInput';
import { 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  PauseCircle, 
  ShoppingBag, 
  Tag, 
  Scale, 
  Box, 
  CheckCircle, 
  Layers, 
  CreditCard,
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';

export const PosView: React.FC = () => {
  const {
    products,
    cart,
    addToCart,
    updateCartQuantity,
    toggleCartPriceType,
    removeFromCart,
    clearCart,
    holdTransaction,
    heldTransactions,
    checkout,
    currentShift,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [holdNoteInput, setHoldNoteInput] = useState('');
  const [showHoldDialog, setShowHoldDialog] = useState(false);

  // Categories extraction
  const categories = useMemo(() => {
    const list = ['Semua', ...Array.from(new Set(products.map(p => p.category)))];
    return list;
  }, [products]);

  // Fast Instant Search Filter (< 1s execution)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter(p => {
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.category.toLowerCase().includes(q);
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      return matchQuery && matchCat;
    });
  }, [products, searchQuery, selectedCategory]);

  // Fast Barcode Scanner Simulation Handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const matched = products.find(p => p.barcode === code);
    if (matched) {
      addToCart(matched, 1);
      setBarcodeInput('');
    } else {
      alert(`Barang dengan barcode ${code} tidak ditemukan!`);
    }
  };

  // Cart total calculations
  const totalCartAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalCartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Trigger Hold
  const handleConfirmHold = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    holdTransaction(holdNoteInput.trim() || 'Antrean Sembako Tertahan');
    setHoldNoteInput('');
    setShowHoldDialog(false);
  };

  // Checkout Finish
  const handleConfirmPayment = (
    method: any,
    amountPaid: number,
    kasbonDetails?: any
  ) => {
    const trx = checkout(method, amountPaid, kasbonDetails);
    setIsPaymentOpen(false);
    if (trx) {
      setCompletedTransaction(trx);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
      {/* Shift Alert Banner if Shift is closed */}
      {!currentShift && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Sesi Kasir Harian Belum Dibuka!</h3>
              <p className="text-xs text-amber-700">
                Wajib input modal uang kembalian (Cash Drawer Base) untuk mengunci perhitungan uang di laci fisik.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsShiftModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition shadow-sm shrink-0"
          >
            Buka Shift & Masukkan Modal
          </button>
        </div>
      )}

      {/* Main Grid: Left Products Catalog (65%), Right Cart & Actions (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Search, Category Filter, Product Grid */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search Bar & Barcode Scanner Row */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Quick Text Search */}
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="pos-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari beras, minyak, gula, mie instan, atau scan..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                  >
                    Hapus
                  </button>
                )}
              </div>

              {/* Barcode Quick Form Input */}
              <form onSubmit={handleBarcodeSubmit} className="relative sm:w-60">
                <Barcode className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="pos-barcode-input"
                  type="text"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  placeholder="Scan / Ketik Barcode..."
                  className="w-full pl-10 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold"
                >
                  Enter
                </button>
              </form>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredProducts.map(product => {
              const isLowStock = product.stock <= product.minStock;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-500/50 p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group"
                >
                  {/* Item Header */}
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-150">
                        {product.category}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isLowStock ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        Stok: {formatNumber(product.stock)} {product.baseUnit}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </h4>

                    {/* Price Tiers Display */}
                    <div className="mt-2.5 p-2 bg-slate-50 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Eceran:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatRupiah(product.retailPrice)} / {product.baseUnit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          <span>Grosir (min. {product.minWholesaleQty} {product.baseUnit}):</span>
                        </span>
                        <span className="font-mono font-bold">
                          {formatRupiah(product.wholesalePrice)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Adding (Supports Multi-Unit Dus & Decimal Weight) */}
                  <div className="mt-3 pt-2.5 border-t border-slate-150 space-y-2">
                    {/* If fractional (Beras, Telur, Gula), show quick weight increment presets */}
                    {product.allowDecimal && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
                          <Scale className="w-3 h-3" /> Timbang:
                        </span>
                        <button
                          type="button"
                          onClick={() => addToCart(product, 0.25, 'retail', product.baseUnit)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold border border-amber-200 transition"
                        >
                          +0.25 {product.baseUnit}
                        </button>
                        <button
                          type="button"
                          onClick={() => addToCart(product, 0.5, 'retail', product.baseUnit)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold border border-amber-200 transition"
                        >
                          +0.5 {product.baseUnit}
                        </button>
                        <button
                          type="button"
                          onClick={() => addToCart(product, 1, 'retail', product.baseUnit)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold border border-amber-200 transition"
                        >
                          +1 {product.baseUnit}
                        </button>
                      </div>
                    )}

                    {/* Standard Add Buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => addToCart(product, 1, 'retail', product.baseUnit)}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-98"
                      >
                        <Plus className="w-4 h-4" />
                        <span>1 {product.baseUnit}</span>
                      </button>

                      {/* Multi-unit wholesale conversion (e.g. 1 Dus = 12 pcs) */}
                      {product.hasMultiUnit && product.boxConversionRatio && (
                        <button
                          type="button"
                          onClick={() =>
                            addToCart(
                              product,
                              product.boxConversionRatio || 1,
                              'wholesale',
                              product.baseUnit
                            )
                          }
                          className="py-2 px-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                          title={`Beli 1 ${product.boxUnitName || 'Dus'} (${product.boxConversionRatio} ${product.baseUnit}) harga grosir`}
                        >
                          <Box className="w-3.5 h-3.5" />
                          <span>1 {product.boxUnitName || 'Dus'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 mx-auto stroke-1 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">Barang sembako tidak ditemukan</p>
              <p className="text-xs">Coba kata kunci lain atau pilih kategori &apos;Semua&apos;</p>
            </div>
          )}
        </div>

        {/* RIGHT: Active Cart Panel */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 sticky top-24 space-y-4">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Keranjang Kasir</h3>
                <p className="text-[11px] text-slate-500">
                  {cart.length} Jenis Barang ({formatNumber(totalCartItemsCount)} Qty)
                </p>
              </div>
            </div>

            {/* Held Queue Button with Badge */}
            <button
              type="button"
              id="btn-open-held-modal"
              onClick={() => setIsHeldModalOpen(true)}
              className="relative p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Lihat Antrean Tertahan"
            >
              <PauseCircle className="w-4 h-4 text-amber-600" />
              <span>Tertahan</span>
              {heldTransactions.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {heldTransactions.length}
                </span>
              )}
            </button>
          </div>

          {/* Cart Items List */}
          <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShoppingBag className="w-10 h-10 mx-auto stroke-1 text-slate-300" />
                <p className="text-xs font-semibold">Keranjang masih kosong</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                  Pilih barang dari daftar di samping atau scan barcode langsung.
                </p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const isWholesale = item.selectedPriceType === 'wholesale';
                const currentUnitPrice = isWholesale
                  ? item.product.wholesalePrice
                  : item.product.retailPrice;

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/30 border border-slate-200/80 transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-slate-900 text-xs truncate">
                          {item.product.name}
                        </h5>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono font-semibold text-slate-600">
                            {formatRupiah(currentUnitPrice)}
                          </span>

                          {/* Toggle Eceran / Grosir button */}
                          <button
                            type="button"
                            onClick={() => toggleCartPriceType(idx)}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition cursor-pointer ${
                              isWholesale
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                            title="Klik untuk ubah jenis harga (Eceran / Grosir)"
                          >
                            {isWholesale ? 'Grosir' : 'Eceran'}
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Hapus barang"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity Adjustment + Subtotal */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      {/* Stepper with Decimal Support */}
                      <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            const step = item.product.allowDecimal ? 0.25 : 1;
                            updateCartQuantity(idx, Math.max(0, item.quantity - step));
                          }}
                          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <FormattedNumberInput
                          allowDecimal={item.product.allowDecimal}
                          value={item.quantity}
                          onChangeValue={val => updateCartQuantity(idx, val)}
                          className="w-14 text-center font-mono font-bold text-xs bg-transparent focus:outline-none"
                        />

                        <span className="text-[10px] text-slate-400 font-semibold pr-1">
                          {item.unitUsed}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            const step = item.product.allowDecimal ? 0.25 : 1;
                            updateCartQuantity(idx, item.quantity + step);
                          }}
                          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Subtotal */}
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Summary & Actions */}
          {cart.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal Belanja:</span>
                  <span className="font-mono">{formatRupiah(totalCartAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>TOTAL BAYAR:</span>
                  <span className="font-mono text-emerald-700 text-lg">
                    {formatRupiah(totalCartAmount)}
                  </span>
                </div>
              </div>

              {/* Hold Transaction & Clear */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-hold-transaction"
                  onClick={() => setShowHoldDialog(true)}
                  className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <PauseCircle className="w-4 h-4 text-amber-600" />
                  <span>Tahan Antrean</span>
                </button>

                <button
                  type="button"
                  onClick={clearCart}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Kosongkan
                </button>
              </div>

              {/* Big Pay Button */}
              <button
                type="button"
                id="btn-open-payment"
                onClick={() => setIsPaymentOpen(true)}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 transition cursor-pointer active:scale-98"
              >
                <CreditCard className="w-5 h-5" />
                <span>Bayar Sekarang ({formatRupiah(totalCartAmount)})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hold Dialog Modal */}
      {showHoldDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-base mb-1">Tahan Transaksi (Pending)</h3>
            <p className="text-xs text-slate-500 mb-3">
              Masukkan nama pelanggan atau catatan agar mudah dikenali saat dipulihkan kembali.
            </p>
            <form onSubmit={handleConfirmHold} className="space-y-3">
              <input
                type="text"
                autoFocus
                value={holdNoteInput}
                onChange={e => setHoldNoteInput(e.target.value)}
                placeholder="Contoh: Ibu baju biru / Mas Joko"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowHoldDialog(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
                >
                  Tahan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <PaymentModal
        isOpen={isPaymentOpen}
        totalAmount={totalCartAmount}
        onClose={() => setIsPaymentOpen(false)}
        onConfirmPayment={handleConfirmPayment}
      />

      <ReceiptModal
        transaction={completedTransaction}
        onClose={() => setCompletedTransaction(null)}
      />

      <HeldTransactionsModal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
      />

      <ShiftModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
      />
    </div>
  );
};
