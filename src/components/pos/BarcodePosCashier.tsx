import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  Barcode,
  Plus,
  Minus,
  Trash2,
  Printer,
  ShoppingBag,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Zap,
  Volume2,
  VolumeX,
  CreditCard,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { MobileBarcodeScanner } from './MobileBarcodeScanner';

// Mockup product database structure as specified in requirements
export interface MockProduct {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
}

export interface CashierCartItem {
  product: MockProduct;
  qty: number;
  subtotal: number;
}

// Default Mockup Product Database (array of objects: id, code, name, price, stock)
export const DEFAULT_MOCK_PRODUCTS: MockProduct[] = [
  { id: 'P001', code: '8991001', name: 'Beras Rojolele Super 5kg', price: 72000, stock: 25, category: 'Beras' },
  { id: 'P002', code: '8991002', name: 'Minyak Goreng Bimoli 1L', price: 18500, stock: 40, category: 'Minyak' },
  { id: 'P003', code: '8991003', name: 'Minyak Goreng Bimoli 2L', price: 36000, stock: 30, category: 'Minyak' },
  { id: 'P004', code: '8991004', name: 'Gula Pasir Gulaku Kuning 1kg', price: 17500, stock: 50, category: 'Gula' },
  { id: 'P005', code: '8991005', name: 'Indomie Goreng Spesial 85g', price: 3100, stock: 120, category: 'Mie' },
  { id: 'P006', code: '8991006', name: 'Indomie Kuah Ayam Bawang 69g', price: 3000, stock: 100, category: 'Mie' },
  { id: 'P007', code: '8991007', name: 'Telur Ayam Negeri 1kg', price: 28000, stock: 35, category: 'Telur' },
  { id: 'P008', code: '8991008', name: 'Kopi Kapal Api Special Mix 10s', price: 14000, stock: 60, category: 'Kopi' },
  { id: 'P009', code: '8991009', name: 'Kecap Manis Bango 520ml', price: 24000, stock: 28, category: 'Bumbu' },
  { id: 'P010', code: '8991010', name: 'Tepung Terigu Segitiga Biru 1kg', price: 12500, stock: 45, category: 'Tepung' },
  { id: 'P011', code: '8991011', name: 'Susu Kental Manis Frisian Flag 370g', price: 12000, stock: 35, category: 'Susu' },
  { id: 'P012', code: '8991012', name: 'Sabun Cuci Piring Sunlight 650ml', price: 13500, stock: 50, category: 'Sabun' },
];

interface CartRowItemProps {
  item: CashierCartItem;
  index: number;
  onIncrement: (index: number) => void;
  onDecrement: (index: number) => void;
  onRemove: (index: number) => void;
}

const CartRowItem = React.memo<CartRowItemProps>(({ item, index, onIncrement, onDecrement, onRemove }) => {
  return (
    <tr className="hover:bg-slate-50/60 transition">
      {/* Product Code */}
      <td className="py-3 px-4 font-mono font-bold text-slate-500 text-xs">
        {item.product.code}
      </td>
      {/* Product Name */}
      <td className="py-3 px-4 font-bold text-slate-900">
        {item.product.name}
      </td>
      {/* Unit Price */}
      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700">
        {formatRupiah(item.product.price)}
      </td>
      {/* Quick Qty (+ / -) */}
      <td className="py-3 px-4 text-center">
        <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => onDecrement(index)}
            title="Kurangi Qty (Hapus jika 0)"
            className="w-7 h-7 rounded-lg bg-white hover:bg-rose-50 hover:text-rose-600 active:scale-95 text-slate-700 font-black flex items-center justify-center transition border border-slate-200 cursor-pointer text-xs"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center font-mono font-extrabold text-slate-900 text-sm">
            {item.qty}
          </span>
          <button
            type="button"
            onClick={() => onIncrement(index)}
            title="Tambah Qty"
            className="w-7 h-7 rounded-lg bg-white hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 text-slate-700 font-black flex items-center justify-center transition border border-slate-200 cursor-pointer text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      {/* Subtotal */}
      <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
        {formatRupiah(item.subtotal)}
      </td>
      {/* Action: Delete line item */}
      <td className="py-3 px-4 text-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          title="Hapus baris ini"
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
});

export const BarcodePosCashier: React.FC = () => {
  const { products: storeProducts, currentUser, transactions, checkoutDirect } = useStore();

  // Active state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [activeMode, setActiveMode] = useState<'desktop' | 'mobile'>('desktop');
  const [cart, setCart] = useState<CashierCartItem[]>([]);
  const [cashPaid, setCashPaid] = useState<number>(0);
  const [alertInfo, setAlertInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Manual Quantity Confirmation State (NO AUTO-INCREMENT)
  const [pendingScanProduct, setPendingScanProduct] = useState<MockProduct | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState<string>('1');
  const pendingQtyInputRef = useRef<HTMLInputElement | null>(null);

  // References for autofocus
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const alertTimerRef = useRef<any>(null);

  // Merge mockup database with existing store products if any
  const combinedProductDb: MockProduct[] = React.useMemo(() => {
    const db = [...DEFAULT_MOCK_PRODUCTS];
    if (storeProducts && storeProducts.length > 0) {
      storeProducts.forEach((sp: Product) => {
        const existingIdx = db.findIndex(
          (item) => item.code === sp.barcode || item.id === sp.id
        );
        if (existingIdx > -1) {
          db[existingIdx] = {
            id: sp.id,
            code: sp.barcode || db[existingIdx].code,
            name: sp.name,
            price: sp.retailPrice,
            stock: sp.stock,
            category: sp.category,
          };
        } else if (sp.barcode) {
          db.push({
            id: sp.id,
            code: sp.barcode,
            name: sp.name,
            price: sp.retailPrice,
            stock: sp.stock,
            category: sp.category,
          });
        }
      });
    }
    return db;
  }, [storeProducts]);

  // Calculate best-selling products (Produk Terlaris) dynamically from transactions & staple demand
  const bestSellingProducts = React.useMemo(() => {
    const salesMap: Record<string, number> = {};
    if (transactions && transactions.length > 0) {
      transactions.forEach((trx) => {
        trx.items?.forEach((item) => {
          const key = item.productId || item.name;
          salesMap[key] = (salesMap[key] || 0) + (item.quantity || 1);
        });
      });
    }

    const popularStaples = [
      'Beras',
      'Minyak',
      'Gulaku',
      'Gula',
      'Telur',
      'Indomie',
      'Mie',
      'Kopi',
      'Sania',
      'Bimoli',
      'Terigu',
      'Segitiga',
    ];

    const list = combinedProductDb.map((p) => {
      const soldCount = (salesMap[p.id] || 0) + (salesMap[p.name] || 0);
      return {
        ...p,
        soldCount,
      };
    });

    list.sort((a, b) => {
      if (b.soldCount !== a.soldCount) {
        return b.soldCount - a.soldCount;
      }
      const aIdx = popularStaples.findIndex(
        (s) => a.category?.toLowerCase().includes(s.toLowerCase()) || a.name.toLowerCase().includes(s.toLowerCase())
      );
      const bIdx = popularStaples.findIndex(
        (s) => b.category?.toLowerCase().includes(s.toLowerCase()) || b.name.toLowerCase().includes(s.toLowerCase())
      );
      const aRank = aIdx === -1 ? 999 : aIdx;
      const bRank = bIdx === -1 ? 999 : bIdx;
      return aRank - bRank;
    });

    return list.slice(0, 8);
  }, [combinedProductDb, transactions]);

  // Audio synthesize scanner beep (Web Audio API)
  const playBeep = (isSuccess: boolean) => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (isSuccess) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1900, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch {
      // Ignored if browser prevents audio autoplay
    }
  };

  // Keep barcode input automatically focused
  const refocusInput = useCallback(() => {
    setTimeout(() => {
      if (barcodeInputRef.current && document.activeElement?.tagName !== 'INPUT') {
        barcodeInputRef.current.focus();
      }
    }, 40);
  }, []);

  // Refocus on mount and on interaction
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  const triggerAlert = useCallback((message: string, type: 'success' | 'error') => {
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    setAlertInfo({ message, type });
    alertTimerRef.current = setTimeout(() => {
      setAlertInfo(null);
    }, 3500);
  }, []);

  // 1. AUTO-DETECT BARCODE SCAN (NO AUTO-INCREMENT)
  const processBarcodeScan = (codeToScan: string) => {
    const trimmed = (codeToScan || '').trim();
    if (!trimmed) return;

    // Direct lookup in mockup product database
    const matched = combinedProductDb.find(
      (p) => p.code === trimmed || p.id.toLowerCase() === trimmed.toLowerCase()
    );

    if (matched) {
      // Do NOT auto-increment! Select product and prompt for manual quantity
      playBeep(true);
      triggerAlert(`Produk "${matched.name}" terdeteksi. Silakan tentukan kuantitas manual.`, 'success');
      setPendingScanProduct(matched);
      setPendingQuantity('1');
      setBarcodeInput('');

      setTimeout(() => {
        if (pendingQtyInputRef.current) {
          pendingQtyInputRef.current.focus();
          pendingQtyInputRef.current.select();
        }
      }, 60);
      return;
    } else {
      playBeep(false);
      triggerAlert(`Kode barcode "${trimmed}" tidak ditemukan dalam sistem!`, 'error');
    }

    setBarcodeInput('');
    refocusInput();
  };

  // Handle manual confirmation of quantity (NO AUTO-INCREMENT)
  const handleConfirmPendingQuantity = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingScanProduct) return;
    const qtyNum = Math.max(1, parseInt(pendingQuantity, 10) || 1);

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((item) => item.product.code === pendingScanProduct.code);
      if (existingIdx > -1) {
        const updated = [...prevCart];
        const newQty = updated[existingIdx].qty + qtyNum;
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: newQty,
          subtotal: newQty * pendingScanProduct.price,
        };
        return updated;
      } else {
        return [
          ...prevCart,
          {
            product: pendingScanProduct,
            qty: qtyNum,
            subtotal: qtyNum * pendingScanProduct.price,
          },
        ];
      }
    });

    playBeep(true);
    triggerAlert(`+${qtyNum} "${pendingScanProduct.name}" berhasil masuk ke keranjang!`, 'success');
    setPendingScanProduct(null);
    setPendingQuantity('1');
    refocusInput();
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processBarcodeScan(barcodeInput);
  };

  // Instant detect on input change if length matches standard barcodes
  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBarcodeInput(val);
    const trimmed = val.trim();
    if (trimmed.length >= 7) {
      const match = combinedProductDb.find((p) => p.code === trimmed);
      if (match) {
        processBarcodeScan(trimmed);
      }
    }
  };

  // 2. INTERACTIVE CART CONTROLS (Memoized to prevent unnecessary re-renders)
  const handleIncrement = useCallback((index: number) => {
    setCart((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        const newQty = updated[index].qty + 1;
        updated[index] = {
          ...updated[index],
          qty: newQty,
          subtotal: newQty * updated[index].product.price,
        };
      }
      return updated;
    });
    refocusInput();
  }, [refocusInput]);

  const handleDecrement = useCallback((index: number) => {
    setCart((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        if (updated[index].qty > 1) {
          const newQty = updated[index].qty - 1;
          updated[index] = {
            ...updated[index],
            qty: newQty,
            subtotal: newQty * updated[index].product.price,
          };
          return updated;
        } else {
          // If qty reaches 0, remove item from list
          return updated.filter((_, i) => i !== index);
        }
      }
      return updated;
    });
    refocusInput();
  }, [refocusInput]);

  const handleRemove = useCallback((index: number) => {
    setCart((prev) => {
      const itemToRemove = prev[index];
      if (itemToRemove) {
        triggerAlert(`"${itemToRemove.product.name}" dihapus dari keranjang.`, 'success');
      }
      return prev.filter((_, i) => i !== index);
    });
    refocusInput();
  }, [refocusInput, triggerAlert]);

  const handleClearCart = useCallback(() => {
    setCart((prev) => {
      if (prev.length === 0) return prev;
      triggerAlert('Keranjang transaksi berhasil dikosongkan.', 'success');
      return [];
    });
    setCashPaid(0);
    refocusInput();
  }, [refocusInput, triggerAlert]);

  // Memoized Computations (grandTotal, totalQty, changeAmount, isCashUnderpaid)
  const { grandTotal, totalQty, changeAmount, isCashUnderpaid } = useMemo(() => {
    let sumTotal = 0;
    let sumQty = 0;
    for (let i = 0; i < cart.length; i++) {
      sumTotal += cart[i].subtotal;
      sumQty += cart[i].qty;
    }
    return {
      grandTotal: sumTotal,
      totalQty: sumQty,
      changeAmount: Math.max(0, cashPaid - sumTotal),
      isCashUnderpaid: cashPaid > 0 && cashPaid < sumTotal,
    };
  }, [cart, cashPaid]);

  // 3. RECEIPT PRINT OUT WITH AUTOMATIC STOCK DEDUCTION & PERSISTENCE
  const handlePrintReceipt = async () => {
    if (cart.length === 0) {
      triggerAlert('Keranjang belanja masih kosong! Scan produk sebelum mencetak struk.', 'error');
      refocusInput();
      return;
    }

    if (isProcessingCheckout) return;

    try {
      setIsProcessingCheckout(true);

      const effectivePaid = cashPaid < grandTotal ? grandTotal : cashPaid;
      if (cashPaid < grandTotal) {
        setCashPaid(grandTotal);
      }

      // Generate Invoice Code
      const newInvoice = `TRX-${Date.now().toString().slice(-6)}`;
      setLastInvoiceNumber(newInvoice);

      // Auto deduct stock from inventory & save transaction to database and shift
      await checkoutDirect({
        items: cart.map((item) => ({
          productId: item.product.id,
          barcode: item.product.code,
          productName: item.product.name,
          quantity: item.qty,
          unitPrice: item.product.price,
          subtotal: item.subtotal,
        })),
        paymentMethod: 'tunai',
        amountPaid: effectivePaid,
        customInvoice: newInvoice,
      });

      if (soundEnabled) {
        playBeep(true);
      }

      triggerAlert(
        `Pembayaran berhasil! Stok otomatis terpotong & nota transaksi ${newInvoice} dicetak.`,
        'success'
      );

      // Call browser native thermal print dialog
      setTimeout(() => {
        window.print();
      }, 150);

      // Clear cart after checkout
      setTimeout(() => {
        setCart([]);
        setCashPaid(0);
        refocusInput();
      }, 500);
    } catch (err) {
      console.error('Error during checkout & stock deduction:', err);
      triggerAlert('Terjadi kendala saat memproses transaksi & potong stok.', 'error');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  if (activeMode === 'mobile') {
    return (
      <MobileBarcodeScanner
        onBackToDesktop={() => setActiveMode('desktop')}
        externalProducts={combinedProductDb}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Top Banner / Headline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 leading-tight">
                POS Kasir Barcode & Struk Otomatis
              </h2>
              <p className="text-xs text-slate-500">
                Mode scan cepat tanpa dropdown, auto-detect & pencetakan struk termal standar
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Switch to Mobile Camera Scanner Mode */}
          <button
            type="button"
            onClick={() => setActiveMode('mobile')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-700/20 transition flex items-center gap-1.5 cursor-pointer"
            title="Buka Antarmuka Khusus Layar HP dengan Scan Kamera Otomatis"
          >
            <Smartphone className="w-4 h-4" />
            <span>Mode Kamera HP (Auto-Detect)</span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
            title={soundEnabled ? 'Suara Scanner Aktif' : 'Suara Scanner Mati'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Beep Aktif' : 'Mute'}</span>
          </button>

          {/* Direct Link to Standalone HTML POS */}
          <a
            href="/pos-cashier.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition flex items-center gap-1.5"
            title="Buka versi Single-File Vanilla JS di Tab Baru"
          >
            <ExternalLink className="w-4 h-4 text-slate-500" />
            <span className="hidden xs:inline">Standalone POS (Tab Baru)</span>
          </a>
        </div>
      </div>

      {/* INLINE ALERT NOTIFICATION */}
      {alertInfo && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between shadow-xs transition-all ${
            alertInfo.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertInfo.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span>{alertInfo.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertInfo(null)}
            className="text-slate-400 hover:text-slate-600 font-bold px-2 py-0.5 text-xs"
          >
            Tutup
          </button>
        </div>
      )}

      {/* CORE FEATURE 1: BARCODE SCANNER INPUT WITH AUTOFOCUS */}
      <section className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>Input / Scan Barcode Produk (Auto-Detect)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Arahkan scanner fisik atau ketik kode barcode lalu tekan Enter. Produk langsung masuk ke keranjang.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Autofocus Siap
          </span>
        </div>

        <form onSubmit={handleBarcodeSubmit} className="relative">
          <div className="relative flex items-center">
            <Barcode className="w-6 h-6 absolute left-4 text-slate-400 pointer-events-none" />
            <input
              ref={barcodeInputRef}
              type="text"
              autoFocus
              autoComplete="off"
              value={barcodeInput}
              onChange={handleBarcodeInput}
              placeholder="Arahkan barcode scanner / ketik kode (contoh: 8991001, 8991002)..."
              className="w-full pl-13 pr-32 py-4 bg-slate-50 border-2 border-emerald-500 rounded-2xl text-base sm:text-lg font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-inner"
            />
            <button
              type="submit"
              className="absolute right-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-md shadow-emerald-700/20 cursor-pointer flex items-center gap-1.5"
            >
              <span>Scan (Enter)</span>
            </button>
          </div>
        </form>

        {/* MANUAL QUANTITY CONFIRMATION PANEL (NO AUTO-INCREMENT) */}
        {pendingScanProduct && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 shadow-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200/60">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  Produk Terdeteksi (Scan Berhasil)
                </span>
                <h4 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  {pendingScanProduct.name}
                </h4>
                <p className="text-xs text-slate-600 font-mono mt-0.5">
                  Barcode: <span className="font-bold text-slate-900">{pendingScanProduct.code}</span> • Harga:{' '}
                  <span className="font-bold text-emerald-700">{formatRupiah(pendingScanProduct.price)}</span> • Stok:{' '}
                  <span className="font-bold text-slate-800">{pendingScanProduct.stock} pcs</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => { setPendingScanProduct(null); refocusInput(); }}
                className="self-end sm:self-center text-xs text-slate-500 hover:text-slate-800 font-bold px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
              >
                Batal (Esc)
              </button>
            </div>

            <form onSubmit={handleConfirmPendingQuantity} className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tentukan Jumlah Kuantitas Manual:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingQuantity(prev => String(Math.max(1, (parseInt(prev, 10) || 1) - 1)))}
                      className="w-11 h-11 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 font-black text-lg flex items-center justify-center text-slate-700 shadow-xs active:scale-95 transition cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      ref={pendingQtyInputRef}
                      type="number"
                      min="1"
                      required
                      value={pendingQuantity}
                      onChange={e => setPendingQuantity(e.target.value)}
                      className="w-24 h-11 bg-white border-2 border-emerald-600 rounded-xl text-center font-black text-lg text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setPendingQuantity(prev => String((parseInt(prev, 10) || 0) + 1))}
                      className="w-11 h-11 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 font-black text-lg flex items-center justify-center text-slate-700 shadow-xs active:scale-95 transition cursor-pointer"
                    >
                      +
                    </button>

                    {/* Quick Preset Buttons Desktop */}
                    <div className="hidden sm:flex items-center gap-1 ml-2">
                      {[1, 2, 5, 10, 12, 24].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setPendingQuantity(String(num))}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            parseInt(pendingQuantity, 10) === num
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sm:text-right bg-white/80 p-3 rounded-xl border border-emerald-100 sm:min-w-[170px]">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Subtotal Item</p>
                  <p className="text-base font-black text-emerald-700">
                    {formatRupiah((parseInt(pendingQuantity, 10) || 1) * pendingScanProduct.price)}
                  </p>
                </div>
              </div>

              {/* Mobile preset buttons */}
              <div className="flex sm:hidden items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                {[1, 2, 5, 10, 12, 24].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPendingQuantity(String(num))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition shrink-0 cursor-pointer ${
                      parseInt(pendingQuantity, 10) === num
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setPendingScanProduct(null); refocusInput(); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md shadow-emerald-700/20 active:scale-98 transition flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambahkan ke Keranjang (Enter)</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Quick Sample Code Chips for Testing: PRODUK TERLARIS */}
        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold shrink-0">
                🔥
              </span>
              <div>
                <p className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Produk Terlaris Sembako (Pilihan Cepat Barcode)
                </p>
                <p className="text-[11px] text-slate-500">
                  Setiap kolom tersusun rapih & terstruktur untuk scan barcode instan
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Stok Sinkron Otomatis</span>
            </div>
          </div>

          {/* Structured Responsive Grid: 4 neat columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {bestSellingProducts.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => processBarcodeScan(p.code)}
                className="p-3 rounded-xl bg-white hover:bg-emerald-50/70 hover:border-emerald-300 border border-slate-200 text-xs transition-all shadow-xs cursor-pointer flex flex-col justify-between gap-2.5 group active:scale-98 text-left h-full"
                title={`Coba cepat scan: ${p.name} (${p.code})`}
              >
                {/* Top Row: Rank Badge, Barcode, Stock Badge */}
                <div className="flex items-center justify-between gap-1.5 w-full">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-amber-50 text-amber-700 font-black text-[10px] flex items-center justify-center border border-amber-200 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-mono text-slate-800 font-extrabold text-xs tracking-tight">
                      {p.code}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${
                      p.stock <= 5
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Stok: {p.stock}
                  </span>
                </div>

                {/* Middle Row: Product Name */}
                <div className="w-full">
                  <p className="text-slate-800 font-bold text-xs leading-snug line-clamp-2 group-hover:text-emerald-800">
                    {p.name}
                  </p>
                </div>

                {/* Bottom Row: Price & Sold Status */}
                <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 w-full mt-auto">
                  <span className="text-emerald-700 font-black font-mono text-xs">
                    {formatRupiah(p.price)}
                  </span>
                  {p.soldCount > 0 ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold shrink-0">
                      {p.soldCount}x laku
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Scan Cepat
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CORE FEATURE 2: INTERACTIVE CART TABLE & PAYMENT SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: CART TABLE */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <span>Daftar Transaksi Aktif</span>
              </h3>
              <p className="text-xs text-slate-500">Tabel belanjaan kasir langsung</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                {totalQty} Item ({cart.length} Jenis)
              </span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="px-3 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-lg text-xs font-bold transition border border-slate-200 cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-600 uppercase text-[11px] font-extrabold border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Barang</th>
                  <th className="py-3 px-4 text-right">Harga Satuan</th>
                  <th className="py-3 px-4 text-center">Jumlah (Qty)</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-slate-400">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-700 text-sm">Keranjang Masih Kosong</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Arahkan scanner ke produk untuk mulai mencatat penjualan
                      </p>
                    </td>
                  </tr>
                ) : (
                  cart.map((item, index) => (
                    <CartRowItem
                      key={`${item.product.code}-${index}`}
                      item={item}
                      index={index}
                      onIncrement={handleIncrement}
                      onDecrement={handleDecrement}
                      onRemove={handleRemove}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: SUMMARY & PRINT RECEIPT ACTION */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Pembayaran & Cetak</h3>
              <p className="text-xs text-slate-500">Hitung total belanja dan kembalian kasir</p>
            </div>

            {/* GRAND TOTAL */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-700/20">
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-100 block">
                Total Tagihan (Grand Total)
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight mt-1">
                {formatRupiah(grandTotal)}
              </div>
            </div>

            {/* CASH TENDERED INPUT */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Uang Tunai Diterima (Rp):
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={cashPaid || ''}
                onChange={(e) => setCashPaid(Number(e.target.value) || 0)}
                placeholder="Contoh: 50000"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />

              {/* Quick Money Buttons */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCashPaid(grandTotal);
                    refocusInput();
                  }}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition"
                >
                  Uang Pas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCashPaid(20000);
                    refocusInput();
                  }}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition"
                >
                  20.000
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCashPaid(50000);
                    refocusInput();
                  }}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition"
                >
                  50.000
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCashPaid(100000);
                    refocusInput();
                  }}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition"
                >
                  100.000
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCashPaid(200000);
                    refocusInput();
                  }}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition"
                >
                  200.000
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCashPaid(0);
                    refocusInput();
                  }}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-500 font-bold text-[11px] rounded-lg transition"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* CHANGE / KEMBALIAN */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Kembalian:</span>
              <span
                className={`font-mono font-black ${
                  isCashUnderpaid ? 'text-xs text-rose-600' : 'text-lg text-emerald-700'
                }`}
              >
                {isCashUnderpaid
                  ? `Kurang ${formatRupiah(grandTotal - cashPaid)}`
                  : formatRupiah(changeAmount)}
              </span>
            </div>

            {/* CORE FEATURE 3: PRINT RECEIPT (BAYAR & CETAK STRUK) */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isProcessingCheckout || cart.length === 0}
                onClick={handlePrintReceipt}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 text-white font-black text-sm sm:text-base rounded-2xl transition shadow-lg shadow-emerald-700/25 cursor-pointer flex items-center justify-center gap-2"
              >
                {isProcessingCheckout ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memotong Stok & Mencetak...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    <span>Bayar & Cetak Struk (Print)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Lihat Desain Struk Thermal</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* THERMAL PAPER RECEIPT (CETAK STRUK PRINT-SPECIFIC CSS)        */}
      {/* ID matches index.css @media print rule (#printable-receipt)   */}
      {/* ============================================================== */}
      <div
        id="printable-receipt"
        className="hidden bg-white text-black p-3 font-mono text-[11px] leading-relaxed max-w-[76mm] mx-auto"
      >
        <div className="text-center pb-2 border-b-2 border-dashed border-black">
          <h2 className="text-sm font-black uppercase tracking-wider">ALUNK STORE</h2>
          <p className="text-[10px] font-bold">PUSAT SEMBAKO & KEBUTUHAN POKOK</p>
          <p className="text-[9px] mt-0.5 leading-tight">Jl. Tambak Pamarayan, Kp. Kedung Sapi Masjid</p>
          <p className="text-[9px] leading-tight">RT. 009 / RW 003, Pamarayan, Serang - Banten</p>
          <p className="text-[9px] font-bold mt-0.5">Telp/WA: +62821-2584-5237</p>
        </div>

        <div className="py-2 text-[10px] border-b border-dashed border-black space-y-0.5">
          <div className="flex justify-between">
            <span>No. Struk:</span>
            <span className="font-bold">{lastInvoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Waktu:</span>
            <span>{new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex justify-between">
            <span>Kasir:</span>
            <span className="font-bold">{currentUser?.name || 'Kasir'}</span>
          </div>
          <div className="flex justify-between">
            <span>Metode:</span>
            <span className="font-bold">TUNAI (CASH)</span>
          </div>
        </div>

        <div className="py-2 border-b border-dashed border-black space-y-1.5">
          {cart.map((item, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="font-black text-[11px] uppercase tracking-tight text-black">
                {item.product.name}
              </div>
              <div className="flex justify-between text-[10px] pl-1">
                <span>
                  {item.qty} x {item.product.price.toLocaleString('id-ID')}
                </span>
                <span className="font-black">
                  {item.subtotal.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="py-2 text-[10px] space-y-1 border-b-2 border-dashed border-black">
          <div className="flex justify-between">
            <span>Total Item:</span>
            <span className="font-bold">{totalQty} pcs ({cart.length} jenis)</span>
          </div>
          <div className="flex justify-between text-xs font-black pt-1 border-t border-dotted border-black">
            <span>TOTAL BELANJA:</span>
            <span>{formatRupiah(grandTotal)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>BAYAR TUNAI:</span>
            <span>{formatRupiah(cashPaid || grandTotal)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>KEMBALIAN:</span>
            <span>{formatRupiah(changeAmount)}</span>
          </div>
        </div>

        <div className="pt-2 text-center text-[9px] space-y-0.5">
          <p className="font-black uppercase tracking-wider">*** TERIMA KASIH ATAS KUNJUNGAN ANDA ***</p>
          <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
          <p className="font-bold text-[8px] pt-1 tracking-widest">ALUNK STORE POS SYSTEM</p>
        </div>
      </div>

      {/* MODAL PREVIEW FOR SCREEN USERS */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm">Preview Format Struk Thermal 58mm/80mm</h3>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base px-2 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="bg-white p-3 border border-slate-300 rounded shadow-xs font-mono text-[11px] leading-relaxed text-black space-y-2">
                <div className="text-center pb-2 border-b-2 border-dashed border-slate-400">
                  <h4 className="font-black uppercase">ALUNK STORE</h4>
                  <p className="text-[10px] font-bold text-slate-700">PUSAT SEMBAKO & KEBUTUHAN POKOK</p>
                  <p className="text-[9px] text-slate-600 leading-tight">Jl. Tambak Pamarayan, Kp. Kedung Sapi Masjid</p>
                  <p className="text-[9px] text-slate-600 leading-tight">RT. 009 / RW 003, Pamarayan, Serang - Banten</p>
                  <p className="text-[9px] font-bold text-slate-800">Telp/WA: +62821-2584-5237</p>
                </div>

                <div className="py-1 text-[10px] border-b border-dashed border-slate-400 space-y-0.5">
                  <div className="flex justify-between">
                    <span>No. Struk:</span>
                    <span className="font-bold">{lastInvoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu:</span>
                    <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span className="font-bold">{currentUser?.name || 'Kasir'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Metode:</span>
                    <span className="font-bold">TUNAI (CASH)</span>
                  </div>
                </div>

                <div className="py-1 border-b border-dashed border-slate-400 space-y-1.5">
                  {cart.length === 0 ? (
                    <p className="text-center text-slate-400 italic py-2">Tidak ada item di keranjang</p>
                  ) : (
                    cart.map((item, i) => (
                      <div key={i} className="space-y-0.5">
                        <div className="font-black text-slate-900 text-[11px] uppercase">{item.product.name}</div>
                        <div className="flex justify-between text-slate-700 text-[10px] pl-1">
                          <span>{item.qty} x {item.product.price.toLocaleString('id-ID')}</span>
                          <span className="font-black text-slate-900">{item.subtotal.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-1 text-[10px] space-y-1 border-b-2 border-dashed border-slate-400 pb-2">
                  <div className="flex justify-between">
                    <span>Total Item:</span>
                    <span className="font-bold">{totalQty} pcs ({cart.length} jenis)</span>
                  </div>
                  <div className="flex justify-between font-black text-xs pt-0.5 border-t border-dotted border-slate-400">
                    <span>TOTAL BELANJA:</span>
                    <span>{formatRupiah(grandTotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>BAYAR TUNAI:</span>
                    <span>{formatRupiah(cashPaid || grandTotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>KEMBALIAN:</span>
                    <span>{formatRupiah(changeAmount)}</span>
                  </div>
                </div>

                <div className="text-center text-[9px] text-slate-600 pt-1 space-y-0.5">
                  <p className="font-black uppercase">*** TERIMA KASIH ATAS KUNJUNGAN ANDA ***</p>
                  <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
                  <p className="font-bold text-[8px] pt-0.5 tracking-widest text-slate-500">ALUNK STORE POS SYSTEM</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPreviewModal(false);
                  handlePrintReceipt();
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Thermal Sekarang</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
