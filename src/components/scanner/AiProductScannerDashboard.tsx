import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { CameraScanner } from './CameraScanner';
import { formatRupiah, formatThousand, parseThousand } from '../../utils/formatters';
import { Product, Transaction } from '../../types';
import {
  ShoppingBag,
  PackagePlus,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  DollarSign,
  Search,
  Plus,
  RefreshCw,
  Clock,
  Layers,
  Zap,
  Tag,
  Trash2,
  Calendar
} from 'lucide-react';

type DashboardTab = 'kasir' | 'tambah-stok' | 'laporan';

export const AiProductScannerDashboard: React.FC = () => {
  const {
    products,
    transactions,
    expenses,
    addOrIncreaseStock,
    recordQuickSale,
    addExpense,
    deleteExpense,
    isCloudConnected,
  } = useStore();

  const [activeTab, setActiveTab] = useState<DashboardTab>('kasir');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ----------------------------------------------------
  // Tab 1: KASIR / PENJUALAN STATE (Stok Keluar)
  // ----------------------------------------------------
  const [detectedSaleItem, setDetectedSaleItem] = useState<{
    rawAiName: string;
    matchedProduct: Product | null;
    candidateProducts: Product[];
  } | null>(null);
  const [saleQty, setSaleQty] = useState<number>(1);
  const [lastSaleReceipt, setLastSaleReceipt] = useState<Transaction | null>(null);

  // ----------------------------------------------------
  // Tab 2: TAMBAH STOK STATE (Stok Masuk)
  // ----------------------------------------------------
  const [stockForm, setStockForm] = useState<{
    name: string;
    retailPrice: string;
    qty: number;
    category: string;
    baseUnit: string;
    isExisting: boolean;
    existingStock: number;
  }>({
    name: '',
    retailPrice: '',
    qty: 1,
    category: 'Sembako',
    baseUnit: 'pcs',
    isExisting: false,
    existingStock: 0,
  });

  // ----------------------------------------------------
  // Tab 3: PENGELUARAN OPERASIONAL STATE
  // ----------------------------------------------------
  const [expenseForm, setExpenseForm] = useState<{
    category: string;
    amount: string;
    notes: string;
  }>({
    category: 'Listrik',
    amount: '',
    notes: '',
  });

  // ----------------------------------------------------
  // Real-time Stock Table Filter & Search
  // ----------------------------------------------------
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');

  // Categories list for filters
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products for the real-time stock table
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchQuery =
        p.name.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(stockSearchQuery.toLowerCase()));
      const matchCategory =
        selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter;
      return matchQuery && matchCategory;
    });
  }, [products, stockSearchQuery, selectedCategoryFilter]);

  // ----------------------------------------------------
  // DAILY PROFIT CALCULATIONS (Tanpa Modal)
  // Profit Bersih = Total Penjualan Kotor - Total Pengeluaran Operasional
  // ----------------------------------------------------
  const todayDateStr = useMemo(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }, []);

  // Today's completed sales
  const todayTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.status === 'cancelled') return false;
      const dateStr = t.timestamp ? t.timestamp.slice(0, 10) : '';
      return dateStr === todayDateStr;
    });
  }, [transactions, todayDateStr]);

  // Gross Sales Today
  const totalGrossSalesToday = useMemo(() => {
    return todayTransactions.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);
  }, [todayTransactions]);

  // Today's Operational Expenses
  const todayExpenses = useMemo(() => {
    return expenses.filter(e => {
      const expDate = e.date ? e.date.slice(0, 10) : '';
      return expDate === todayDateStr;
    });
  }, [expenses, todayDateStr]);

  const totalOperationalExpensesToday = useMemo(() => {
    return todayExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [todayExpenses]);

  // Profit Bersih Harian = Gross Sales - Total Operational Expenses
  const netDailyProfit = totalGrossSalesToday - totalOperationalExpensesToday;

  // ----------------------------------------------------
  // GEMINI AI PRODUCT RECOGNITION API CALL
  // ----------------------------------------------------
  const callGeminiRecognizeProduct = async (base64Image: string) => {
    setIsAiProcessing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/recognize-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          existingProducts: products.map(p => ({
            id: p.id,
            name: p.name,
            retailPrice: p.retailPrice,
            category: p.category,
          })),
        }),
      });

      const json = await response.json();
      return json?.data || {
        nama_barang: '',
        kategori: 'Sembako',
        satuan: 'pcs',
        estimasi_harga_jual: 0,
        confidence: 0,
        matched_existing: false,
        fallback: true,
      };
    } catch (err: any) {
      console.warn('Gemini recognition notice:', err?.message || err);
      return {
        nama_barang: '',
        kategori: 'Sembako',
        satuan: 'pcs',
        estimasi_harga_jual: 0,
        confidence: 0,
        matched_existing: false,
        fallback: true,
      };
    } finally {
      setIsAiProcessing(false);
    }
  };

  // ----------------------------------------------------
  // ACTION: SCAN PENJUALAN (Tab Kasir)
  // ----------------------------------------------------
  const handleScanPenjualan = async (base64Image: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastSaleReceipt(null);

    try {
      const aiResult = await callGeminiRecognizeProduct(base64Image);
      const recognizedName = aiResult.nama_barang || '';

      // Match with store products
      const cleanRec = recognizedName.toLowerCase();
      let matched = recognizedName ? products.find(p => p.name.toLowerCase() === cleanRec) : undefined;

      // Partial fuzzy search if exact match not found
      if (!matched && recognizedName) {
        matched = products.find(p => {
          const pLower = p.name.toLowerCase();
          return cleanRec.includes(pLower) || pLower.includes(cleanRec);
        });
      }

      // Find other candidates as fallback
      const candidates = recognizedName
        ? products.filter(
            p => p.id !== matched?.id && (cleanRec.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleanRec))
          )
        : products.slice(0, 15);

      setDetectedSaleItem({
        rawAiName: recognizedName,
        matchedProduct: matched || null,
        candidateProducts: candidates,
      });

      setSaleQty(1);

      if (matched) {
        setSuccessMessage(`Berhasil mendeteksi: "${matched.name}". Sisa stok: ${matched.stock} ${matched.baseUnit}`);
      } else if (recognizedName) {
        setErrorMessage(
          `AI mendeteksi "${recognizedName}", namun barang belum terdaftar di stok toko. Silakan tambahkan stok terlebih dahulu di tab [Tambah Stok] atau pilih barang manual di bawah.`
        );
      } else {
        if (products.length > 0) {
          setSuccessMessage(
            '📸 Foto berhasil diambil! Silakan pilih nama barang yang dijual dari daftar stok toko di bawah untuk menyelesaikan transaksi kasir.'
          );
        } else {
          setErrorMessage(
            '📸 Foto berhasil diambil, namun belum ada stok barang di toko. Silakan tambahkan stok barang terlebih dahulu di tab [Tambah Stok].'
          );
        }
      }
    } catch (err: any) {
      setErrorMessage(`Gagal memproses gambar: ${err.message || 'Periksa koneksi internet dan coba lagi.'}`);
    }
  };

  // Confirm Sale Transaction
  const handleConfirmSale = async () => {
    if (!detectedSaleItem?.matchedProduct) return;
    const prod = detectedSaleItem.matchedProduct;

    if (saleQty <= 0) {
      setErrorMessage('Jumlah terjual minimal 1.');
      return;
    }

    if (saleQty > prod.stock) {
      setErrorMessage(`Stok tidak mencukupi! Stok ${prod.name} yang tersedia hanya ${prod.stock} ${prod.baseUnit}.`);
      return;
    }

    try {
      const trx = await recordQuickSale({
        productId: prod.id,
        productName: prod.name,
        quantity: saleQty,
        price: prod.retailPrice,
        paymentMethod: 'tunai',
      });

      setLastSaleReceipt(trx);
      setSuccessMessage(`Transaksi ${trx.invoiceNumber} berhasil dicatat! Stok berkurang -${saleQty} ${prod.baseUnit}.`);
      setDetectedSaleItem(null);
      setSaleQty(1);
    } catch (err: any) {
      setErrorMessage(`Gagal mencatat transaksi: ${err.message || 'Coba lagi'}`);
    }
  };

  // ----------------------------------------------------
  // ACTION: SCAN PRODUK MASUK (Tab Tambah Stok)
  // ----------------------------------------------------
  const handleScanProdukMasuk = async (base64Image: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const aiResult = await callGeminiRecognizeProduct(base64Image);
      const recognizedName = aiResult.nama_barang || '';
      const estimatedPrice = aiResult.estimasi_harga_jual || 0;
      const category = aiResult.kategori || 'Sembako';
      const unit = aiResult.satuan || 'pcs';

      // Check if product already exists in store
      const existing = recognizedName
        ? products.find(p => p.name.trim().toLowerCase() === recognizedName.trim().toLowerCase())
        : undefined;

      setStockForm({
        name: recognizedName,
        retailPrice: existing ? formatThousand(existing.retailPrice) : (estimatedPrice > 0 ? formatThousand(estimatedPrice) : ''),
        qty: 1,
        category: existing?.category || category,
        baseUnit: existing?.baseUnit || unit,
        isExisting: Boolean(existing),
        existingStock: existing ? existing.stock : 0,
      });

      if (existing) {
        setSuccessMessage(
          `Barang "${existing.name}" sudah terdaftar di toko dengan stok ${existing.stock} ${existing.baseUnit}. Stok akan otomatis bertambah!`
        );
      } else if (recognizedName) {
        setSuccessMessage(
          `AI mendeteksi produk baru: "${recognizedName}". Silakan periksa harga jual satuan dan jumlah stok masuk.`
        );
      } else {
        setSuccessMessage(
          `📸 Foto berhasil diambil! Silakan lengkapi nama barang, harga jual satuan, dan jumlah stok masuk pada formulir di bawah.`
        );
      }
    } catch (err: any) {
      setErrorMessage(`Gagal memproses gambar: ${err.message || 'Periksa koneksi internet'}`);
    }
  };

  // Save Stock In to Database
  const handleSaveStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!stockForm.name.trim()) {
      setErrorMessage('Nama barang tidak boleh kosong.');
      return;
    }

    const priceNum = parseThousand(stockForm.retailPrice);
    if (priceNum <= 0) {
      setErrorMessage('Harga jual satuan harus lebih dari 0.');
      return;
    }

    const qtyNum = Number(stockForm.qty);
    if (qtyNum <= 0) {
      setErrorMessage('Jumlah masuk (Qty) minimal 1.');
      return;
    }

    try {
      const result = await addOrIncreaseStock({
        name: stockForm.name,
        retailPrice: priceNum,
        qty: qtyNum,
        category: stockForm.category,
        baseUnit: stockForm.baseUnit,
      });

      setSuccessMessage(
        result.isNew
          ? `Produk baru "${result.product.name}" berhasil disimpan ke database! Stok: ${result.product.stock} ${result.product.baseUnit}.`
          : `Stok "${result.product.name}" berhasil ditambahkan +${qtyNum}! Total stok sekarang: ${result.product.stock} ${result.product.baseUnit}.`
      );

      // Reset form
      setStockForm({
        name: '',
        retailPrice: '',
        qty: 1,
        category: 'Sembako',
        baseUnit: 'pcs',
        isExisting: false,
        existingStock: 0,
      });
    } catch (err: any) {
      setErrorMessage(`Gagal menyimpan ke database: ${err.message || 'Coba lagi'}`);
    }
  };

  // ----------------------------------------------------
  // ACTION: SIMPAN PENGELUARAN OPERASIONAL (Tab Laporan Harian)
  // ----------------------------------------------------
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const amountNum = parseThousand(expenseForm.amount);
    if (amountNum <= 0) {
      setErrorMessage('Nominal pengeluaran harus lebih besar dari Rp 0.');
      return;
    }

    try {
      addExpense({
        date: todayDateStr,
        category: expenseForm.category as any,
        amount: amountNum,
        notes: expenseForm.notes || `Biaya ${expenseForm.category} harian`,
        recordedBy: 'Admin / Kasir',
      });

      setSuccessMessage(`Pengeluaran ${expenseForm.category} sebesar ${formatRupiah(amountNum)} berhasil dicatat!`);
      setExpenseForm({
        category: 'Listrik',
        amount: '',
        notes: '',
      });
    } catch (err: any) {
      setErrorMessage(`Gagal mencatat pengeluaran: ${err.message || 'Coba lagi'}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Header Banner with Real-time Cloud Status */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-4 sm:p-6 rounded-3xl shadow-lg border border-slate-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Kamera AI Gemini 3.8 Flash</span>
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700">
              WebRTC Rear Camera Auto-Permission
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight">
            Kasir AI & Manajemen Stok Sembako
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Arahkan kamera HP ke produk untuk scan otomatis, penambahan stok instan, pencatatan kasir, dan laporan profit bersih harian.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/60 backdrop-blur px-3.5 py-2 rounded-2xl border border-slate-700/80 shrink-0">
          <div className={`w-3 h-3 rounded-full ${isCloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <div className="text-left">
            <p className="text-[11px] font-bold text-slate-200">
              {isCloudConnected ? 'Database Realtime Aktif' : 'Menghubungkan Database...'}
            </p>
            <p className="text-[10px] text-slate-400">Sinkron semua device & pengguna</p>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-800 font-bold text-xs px-2 py-0.5 rounded-md hover:bg-rose-100"
          >
            Tutup
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{successMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold text-xs px-2 py-0.5 rounded-md hover:bg-emerald-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Navigation Switch Tabs: [Kasir / Jual], [Tambah Stok], [Laporan Harian] */}
      <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between gap-1 overflow-x-auto">
        <button
          type="button"
          id="tab-btn-kasir-jual"
          onClick={() => {
            setActiveTab('kasir');
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className={`flex-1 min-w-[130px] py-2.5 sm:py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'kasir'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>[Kasir / Jual]</span>
        </button>

        <button
          type="button"
          id="tab-btn-tambah-stok"
          onClick={() => {
            setActiveTab('tambah-stok');
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className={`flex-1 min-w-[130px] py-2.5 sm:py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'tambah-stok'
              ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PackagePlus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>[Tambah Stok]</span>
        </button>

        <button
          type="button"
          id="tab-btn-laporan-harian"
          onClick={() => {
            setActiveTab('laporan');
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className={`flex-1 min-w-[130px] py-2.5 sm:py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'laporan'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>[Laporan Harian]</span>
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: KASIR / PENJUALAN (STOK KELUAR) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'kasir' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: WebRTC Camera Scanner */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                    <span>Scan Penjualan (Kamera HP)</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Arahkan kamera ke barang, klik "Scan Penjualan" untuk mencocokkan stok dan catat penjualan.
                  </p>
                </div>
              </div>

              <CameraScanner
                buttonLabel="Scan Penjualan"
                onCapture={handleScanPenjualan}
                isProcessing={isAiProcessing}
                instructionText="Arahkan kamera ke barang sembako yang ingin dijual"
              />
            </div>

            {/* Quick Action: Select from available inventory if camera is busy */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pilih Cepat Barang dari Stok</span>
                </span>
                <span className="text-[11px] text-slate-400">Total {products.length} barang</span>
              </div>
              <select
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                defaultValue=""
                onChange={(e) => {
                  const prod = products.find(p => p.id === e.target.value);
                  if (prod) {
                    setDetectedSaleItem({
                      rawAiName: prod.name,
                      matchedProduct: prod,
                      candidateProducts: [],
                    });
                    setSaleQty(1);
                  }
                  e.target.value = '';
                }}
              >
                <option value="" disabled>-- Atau pilih produk dari daftar toko langsung --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — Stok: {p.stock} {p.baseUnit} — {formatRupiah(p.retailPrice)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Column: Matched Product & Confirm Sale Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-3 flex items-center justify-between">
                <span>Detail Penjualan</span>
                {detectedSaleItem?.matchedProduct && (
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                    Produk Cocok
                  </span>
                )}
              </h3>

              {detectedSaleItem?.matchedProduct ? (
                <div className="space-y-4">
                  {/* Product Overview Card */}
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                          {detectedSaleItem.matchedProduct.category || 'Sembako'}
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900">
                          {detectedSaleItem.matchedProduct.name}
                        </h4>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                        {formatRupiah(detectedSaleItem.matchedProduct.retailPrice)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs pt-1 border-t border-emerald-200/50 text-slate-600">
                      <div>
                        <span className="text-slate-500">Sisa Stok: </span>
                        <span className={`font-bold ${detectedSaleItem.matchedProduct.stock <= 5 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {detectedSaleItem.matchedProduct.stock} {detectedSaleItem.matchedProduct.baseUnit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Satuan: </span>
                        <span className="font-semibold text-slate-800">{detectedSaleItem.matchedProduct.baseUnit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quantity Input Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Jumlah Terjual (Qty):</span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        Maks: {detectedSaleItem.matchedProduct.stock} {detectedSaleItem.matchedProduct.baseUnit}
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSaleQty(prev => Math.max(1, prev - 1))}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center transition cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={detectedSaleItem.matchedProduct.stock}
                        value={saleQty}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          setSaleQty(Math.min(val, detectedSaleItem.matchedProduct?.stock || 999999));
                        }}
                        className="flex-1 text-center font-bold text-base bg-slate-50 border border-slate-300 rounded-xl py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setSaleQty(prev => Math.min(prev + 1, detectedSaleItem.matchedProduct?.stock || 999999))}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Total Pendapatan Live Calculation */}
                  <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400">Total Pendapatan (Qty x Harga):</p>
                      <p className="text-xs text-slate-300">
                        {saleQty} x {formatRupiah(detectedSaleItem.matchedProduct.retailPrice)}
                      </p>
                    </div>
                    <p className="text-lg sm:text-xl font-black text-emerald-400">
                      {formatRupiah(saleQty * detectedSaleItem.matchedProduct.retailPrice)}
                    </p>
                  </div>

                  {/* Confirm Button */}
                  <button
                    type="button"
                    id="btn-confirm-sale"
                    onClick={handleConfirmSale}
                    disabled={detectedSaleItem.matchedProduct.stock <= 0}
                    className={`w-full py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                      detectedSaleItem.matchedProduct.stock <= 0
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/25 active:scale-98'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Konfirmasi Transaksi (Potong Stok)</span>
                  </button>
                </div>
              ) : detectedSaleItem && (detectedSaleItem.candidateProducts.length > 0 || products.length > 0) ? (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Pilih Barang dari Stok Toko:</span>
                    </p>
                    <p className="text-[11px] text-amber-800">
                      Klik produk di bawah untuk memilih barang yang discan dan memproses penjualan:
                    </p>
                  </div>

                  {/* Quick Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nama barang di stok..."
                      value={candidateSearchQuery}
                      onChange={e => setCandidateSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {(candidateSearchQuery.trim()
                      ? products.filter(p => p.name.toLowerCase().includes(candidateSearchQuery.toLowerCase()))
                      : (detectedSaleItem.candidateProducts.length > 0 ? detectedSaleItem.candidateProducts : products)
                    ).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setDetectedSaleItem({
                            rawAiName: p.name,
                            matchedProduct: p,
                            candidateProducts: [],
                          });
                          setCandidateSearchQuery('');
                          setSaleQty(1);
                        }}
                        className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/60 transition-all flex items-center justify-between group cursor-pointer bg-white shadow-2xs"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">{p.name}</p>
                          <p className="text-[10px] text-slate-500">Stok: <span className="font-bold text-slate-700">{p.stock} {p.baseUnit}</span></p>
                        </div>
                        <span className="text-xs font-extrabold text-emerald-700">{formatRupiah(p.retailPrice)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Belum Ada Barang yang Dipilih</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Klik tombol <strong>"Scan Penjualan"</strong> pada kamera di samping atau pilih produk secara langsung untuk memulai transaksi.
                  </p>
                </div>
              )}

              {/* Struk Mini Bukti Transaksi Terakhir */}
              {lastSaleReceipt && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Struk Berhasil Tercatat</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">{lastSaleReceipt.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Nama Barang:</span>
                    <span className="font-bold text-slate-800">{lastSaleReceipt.items[0]?.productName}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Qty Terjual:</span>
                    <span className="font-bold text-slate-800">{lastSaleReceipt.items[0]?.quantity} item</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Pendapatan:</span>
                    <span className="font-extrabold text-emerald-700 text-sm">
                      {formatRupiah(lastSaleReceipt.totalAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: TAMBAH STOK (STOK MASUK) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'tambah-stok' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Camera Scanner for Stock In */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
              <div className="mb-3">
                <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <PackagePlus className="w-5 h-5 text-teal-700" />
                  <span>Scan Produk Masuk (Kamera HP)</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Arahkan kamera ke barang sembako baru/lama, lalu klik tombol "Scan Produk Masuk".
                </p>
              </div>

              <CameraScanner
                buttonLabel="Scan Produk Masuk"
                onCapture={handleScanProdukMasuk}
                isProcessing={isAiProcessing}
                instructionText="Arahkan kamera ke kemasan/merk produk yang baru masuk"
              />
            </div>
          </div>

          {/* Right: Form Input Barang (Stok Masuk) */}
          <div className="lg:col-span-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <Tag className="w-4 h-4 text-teal-600" />
                  <span>Form Input Barang Masuk</span>
                </h3>
                {stockForm.isExisting && (
                  <span className="text-[10px] px-2.5 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-full">
                    Stok Lama: {stockForm.existingStock} {stockForm.baseUnit}
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveStockIn} className="space-y-4">
                {/* Field: Nama Barang */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Nama Barang <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={stockForm.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = products.find(p => p.name.toLowerCase() === val.trim().toLowerCase());
                      setStockForm(prev => ({
                        ...prev,
                        name: val,
                        isExisting: Boolean(match),
                        existingStock: match ? match.stock : 0,
                        retailPrice: match ? formatThousand(match.retailPrice) : prev.retailPrice,
                      }));
                    }}
                    placeholder="Contoh: Minyak Goreng Bimoli 1L, Beras Ramos 5kg"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    Dikenali otomatis oleh Gemini AI atau ketik manual.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Field: Harga Jual Satuan */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Harga Jual Satuan (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">Rp</span>
                      <input
                        type="text"
                        required
                        value={stockForm.retailPrice}
                        onChange={(e) => {
                          const formatted = formatThousand(e.target.value);
                          setStockForm(prev => ({ ...prev, retailPrice: formatted }));
                        }}
                        placeholder="15.000"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Field: Jumlah Masuk (Qty) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Jumlah Masuk (Qty) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={stockForm.qty}
                      onChange={(e) => setStockForm(prev => ({ ...prev, qty: Math.max(1, Number(e.target.value) || 1) }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Field: Kategori */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Kategori</label>
                    <input
                      type="text"
                      value={stockForm.category}
                      onChange={(e) => setStockForm(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="Sembako"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  {/* Field: Satuan */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Satuan Dasar</label>
                    <input
                      type="text"
                      value={stockForm.baseUnit}
                      onChange={(e) => setStockForm(prev => ({ ...prev, baseUnit: e.target.value }))}
                      placeholder="pcs, kg, liter, bks"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Status Notice */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                  {stockForm.isExisting ? (
                    <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                      <span>Barang sudah ada di database. Stok akan otomatis bertambah (+{stockForm.qty}).</span>
                    </span>
                  ) : (
                    <span className="text-teal-800 font-semibold flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-teal-600" />
                      <span>Barang baru akan disimpan ke database & langsung tersinkronisasi ke seluruh perangkat.</span>
                    </span>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  id="btn-save-stock-in"
                  className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-600 active:scale-98 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-700/20 transition cursor-pointer"
                >
                  <PackagePlus className="w-5 h-5" />
                  <span>Simpan ke Database (Update Stok)</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: LAPORAN PROFIT HARIAN BERSIH (TANPA MODAL) */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'laporan' && (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-600" />
                <span>Laporan Profit Harian Bersih (Tanpa Modal)</span>
              </h2>
              <p className="text-xs text-slate-500">
                Formula: Profit Bersih = Total Penjualan Kotor (Gross Sales) - Total Pengeluaran Operasional.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span className="font-semibold">Hari Ini: {todayDateStr}</span>
            </div>
          </div>

          {/* 3 Main Metric Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Total Penjualan Kotor */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Penjualan Kotor (Gross Sales)
              </span>
              <p className="text-xl sm:text-2xl font-black text-slate-900">
                {formatRupiah(totalGrossSalesToday)}
              </p>
              <p className="text-[11px] text-slate-400">
                Dari {todayTransactions.length} transaksi penjualan hari ini
              </p>
            </div>

            {/* 2. Total Pengeluaran Operasional */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Biaya Operasional Harian
              </span>
              <p className="text-xl sm:text-2xl font-black text-rose-600">
                {formatRupiah(totalOperationalExpensesToday)}
              </p>
              <p className="text-[11px] text-slate-400">
                Dari {todayExpenses.length} pos pengeluaran tercatat hari ini
              </p>
            </div>

            {/* 3. Profit Bersih Harian */}
            <div className={`p-5 rounded-3xl border shadow-xs space-y-1 ${
              netDailyProfit >= 0
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white border-emerald-600 shadow-emerald-700/20'
                : 'bg-rose-600 text-white border-rose-700'
            }`}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                Profit Bersih Harian
              </span>
              <p className="text-2xl sm:text-3xl font-black tracking-tight">
                {formatRupiah(netDailyProfit)}
              </p>
              <p className="text-[11px] text-emerald-100/90 font-medium">
                (Penjualan Kotor - Pengeluaran Operasional)
              </p>
            </div>
          </div>

          {/* Form Input Pengeluaran Operasional Harian */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <span>Form Input Pengeluaran Operasional</span>
              </h3>

              <form onSubmit={handleSaveExpense} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Kategori / Jenis Biaya</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="Listrik">Listrik & Air Toko</option>
                    <option value="Bensin">Bensin / Transportasi Belanja</option>
                    <option value="Sewa">Sewa Harian / Lapak</option>
                    <option value="Konsumsi">Konsumsi & Air Galon Karyawan</option>
                    <option value="Plastik">Plastik Kresek & Kebutuhan Kasir</option>
                    <option value="Pemeliharaan">Pemeliharaan & Kebersihan</option>
                    <option value="Lain-lain">Lain-lain / Biaya Tak Terduga</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nominal Biaya (Rp) <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">Rp</span>
                    <input
                      type="text"
                      required
                      value={expenseForm.amount}
                      onChange={(e) => {
                        const formatted = formatThousand(e.target.value);
                        setExpenseForm(prev => ({ ...prev, amount: formatted }));
                      }}
                      placeholder="50.000"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Keterangan / Catatan</label>
                  <input
                    type="text"
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Contoh: Token listrik toko 50rb"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  id="btn-save-expense"
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 transition cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  <span>Catat Pengeluaran Operasional</span>
                </button>
              </form>
            </div>

            {/* List of Today's Expenses */}
            <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Rincian Pengeluaran Hari Ini</span>
                </h3>
                <span className="text-xs font-semibold text-rose-600">
                  Total: {formatRupiah(totalOperationalExpensesToday)}
                </span>
              </div>

              {todayExpenses.length > 0 ? (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                  {todayExpenses.map(exp => (
                    <div key={exp.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{exp.category}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {exp.date}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{exp.notes || '-'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-rose-600 text-xs sm:text-sm">
                          -{formatRupiah(exp.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteExpense(exp.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                          title="Hapus Pengeluaran"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">
                  Belum ada pengeluaran operasional yang dicatat hari ini.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. TABEL SISA STOK BARANG SECARA REAL-TIME */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Tabel Sisa Stok Barang (Real-Time)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Sinkronisasi real-time otomatis tersimpan di Cloud Database dan bisa diakses oleh siapapun di perangkat manapun.
            </p>
          </div>

          {/* Search & Category Filter */}
          <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                placeholder="Cari nama barang..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Semua Kategori</option>
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-3 px-3">No</th>
                <th className="py-3 px-3">Nama Barang</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3 text-right">Harga Jual Satuan</th>
                <th className="py-3 px-3 text-center">Sisa Stok Tersedia</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((prod, idx) => {
                  const isLow = prod.stock <= (prod.minStock || 5) && prod.stock > 0;
                  const isOut = prod.stock <= 0;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {prod.name}
                        {prod.barcode && (
                          <span className="block text-[10px] font-mono text-slate-400 font-normal">
                            Code: {prod.barcode}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {prod.category || 'Sembako'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700">
                        {formatRupiah(prod.retailPrice)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-extrabold text-sm text-slate-900">
                          {prod.stock}
                        </span>
                        <span className="text-slate-500 text-[11px] ml-1">{prod.baseUnit}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isOut ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                            Habis
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Menipis
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Tersedia
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('kasir');
                              setDetectedSaleItem({
                                rawAiName: prod.name,
                                matchedProduct: prod,
                                candidateProducts: [],
                              });
                              setSaleQty(1);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={prod.stock <= 0}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] disabled:opacity-40 cursor-pointer"
                            title="Jual Produk Ini"
                          >
                            Jual
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('tambah-stok');
                              setStockForm({
                                name: prod.name,
                                retailPrice: formatThousand(prod.retailPrice),
                                qty: 5,
                                category: prod.category || 'Sembako',
                                baseUnit: prod.baseUnit || 'pcs',
                                isExisting: true,
                                existingStock: prod.stock,
                              });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-[11px] cursor-pointer"
                            title="Tambah Stok Produk Ini"
                          >
                            + Stok
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ada barang yang cocok dengan pencarian "{stockSearchQuery}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
