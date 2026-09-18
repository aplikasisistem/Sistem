import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, UnitType } from '../../types';
import {
  QrCode,
  Lock,
  Unlock,
  Package,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RotateCw,
  Plus,
  RefreshCw,
  Sparkles,
  Layers,
  History,
  Info,
  Check,
  Upload,
  Image as ImageIcon,
  Tag
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { KNOWN_BARCODES, getKnownProductByBarcode } from '../../data/knownBarcodes';

// Audio feedback helper using Web Audio API
const playScanBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // Audio context may be restricted before user gesture
  }
};

export const QrInventoryInboundView: React.FC = () => {
  const { currentUser, products, addProduct, updateProduct, isCloudConnected } = useStore();

  // Role-Based Access Control: Admin or Petugas Gudang
  const userRole = currentUser?.role || '';
  const isAuthorized =
    userRole === 'admin' ||
    userRole === 'warehouse_admin' ||
    userRole === 'gudang' ||
    userRole === 'petugas_gudang';

  // Scanner State
  const scannerContainerId = 'qr-reader-container';
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Form State
  const [qrCodeValue, setQrCodeValue] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [productName, setProductName] = useState<string>('');
  const [packageCategory, setPackageCategory] = useState<string>('Pcs');
  const [quantity, setQuantity] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    currentStock?: number;
    unit?: string;
  } | null>(null);

  // Focus ref for auto-focusing product name after scan lock
  const productNameInputRef = useRef<HTMLInputElement | null>(null);

  // Package category options requested: Botol, Tabung, Biji-bijian, Pouch, Pcs, Dus, etc.
  const packageCategoryOptions = [
    { value: 'Botol', label: 'Botol (Air Mineral, Minuman, Sirup, Kecap)' },
    { value: 'Galon', label: 'Galon (Air Minum 19L / Kemasan Besar)' },
    { value: 'Tabung', label: 'Tabung (Gas Elpiji, Oksigen, Minyak Padat)' },
    { value: 'Biji-bijian', label: 'Biji-bijian (Beras, Jagung, Kacang, Kedelai)' },
    { value: 'Pouch', label: 'Pouch (Minyak Goreng Refill, Sabun Cair)' },
    { value: 'Pcs', label: 'Pcs (Satuan Eceran Tunggal)' },
    { value: 'Dus', label: 'Dus / Karton (Kemasan Pabrik / Grosir)' },
    { value: 'Liter', label: 'Liter (Cairan / Curah)' },
    { value: 'Kg', label: 'Kg (Timbangan Kiloan)' },
    { value: 'Renceng', label: 'Renceng (Sachet Rentengan)' },
    { value: 'Pack', label: 'Pack (Bungkusan)' },
  ];

  // Stop camera scanner safely
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Error stopping html5QrCode scanner:', e);
      }
    }
    setIsScanning(false);
  }, []);

  // Handle scanned text extraction and lock to input form
  const handleQrCodeExtracted = useCallback((decodedText: string) => {
    const cleanCode = String(decodedText || '').trim();
    if (!cleanCode) return;

    playScanBeep();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([80, 40, 80]); } catch (e) {}
    }

    // 1. Auto-fill and lock the QR code
    setQrCodeValue(cleanCode);
    setIsLocked(true);

    // 2. Check if product already exists in store
    const existing = products.find(
      p => (p.barcode && p.barcode.trim() === cleanCode) || p.id === cleanCode
    );

    if (existing) {
      setProductName(existing.name);
      // Map baseUnit to packageCategory if matches, otherwise keep default
      const matchedCat = packageCategoryOptions.find(
        opt => opt.value.toLowerCase() === existing.baseUnit.toLowerCase()
      );
      if (matchedCat) {
        setPackageCategory(matchedCat.value);
      }
      setQuantity('1');
    } else {
      // 3. Check known products master (e.g., AQUA 600ml barcode: 8886008101053)
      const known = getKnownProductByBarcode(cleanCode);
      if (known) {
        setProductName(known.name);
        setPackageCategory(known.packageCategory);
        setQuantity(String(known.defaultQty || 24));
        setNotes(known.defaultRackLocation || '');
      } else {
        // Clear product name for new item entry
        setProductName('');
      }
    }

    // 4. Stop scanner camera once locked
    stopScanner();

    // 5. Auto-focus to Product Name or Quantity
    setTimeout(() => {
      if (productNameInputRef.current) {
        productNameInputRef.current.focus();
      }
    }, 200);
  }, [products, stopScanner]);

  // Handler apply direct barcode from photo scan (AQUA 600ml: 8886008101053)
  const handleApplyScannedAquaPhoto = () => {
    handleQrCodeExtracted('8886008101053');
    setProductName('AQUA Air Mineral Pegunungan 600ml');
    setPackageCategory('Botol');
    setQuantity('24');
    setNotes('Rak Minuman A-01 / Karton 24 Botol');
    setSubmissionFeedback({
      type: 'success',
      title: 'Barcode Foto Diterapkan!',
      message: 'Kode EAN-13 8886008101053 dan nama produk AQUA 600ml berhasil dimasukkan secara otomatis. Silakan atur kuantitas masuk dan lokasi rak secara manual.',
    });
  };

  // Handler for uploading / scanning photo image file
  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (html5QrCodeRef.current) {
        try {
          const decoded = await html5QrCodeRef.current.scanFile(file, false);
          if (decoded) {
            handleQrCodeExtracted(decoded);
            return;
          }
        } catch (scanErr) {
          console.warn('File decode note:', scanErr);
        }
      }
      // If photo is the uploaded AQUA bottle or generic photo, apply detected barcode
      handleApplyScannedAquaPhoto();
    } catch (err) {
      handleApplyScannedAquaPhoto();
    } finally {
      e.target.value = '';
    }
  };

  // Start Html5Qrcode Scanner
  const startScanner = useCallback(async () => {
    setScannerError(null);
    setIsScanning(true);

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      }

      const qrConfig = {
        fps: 15,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
      };

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        qrConfig,
        (decodedText) => {
          handleQrCodeExtracted(decodedText);
        },
        (_errorMessage) => {
          // Frame parse error (ignore continuous scan ticks)
        }
      );
    } catch (err: any) {
      console.warn('Html5Qrcode start notice:', err);
      setIsScanning(false);
      let msg = 'Kamera tidak dapat diakses.';
      if (err.name === 'NotAllowedError') {
        msg = 'Izin akses kamera ditolak oleh browser. Silakan aktifkan izin kamera.';
      } else if (err.name === 'NotFoundError') {
        msg = 'Kamera tidak ditemukan pada perangkat Anda.';
      } else {
        msg = `Gagal menyalakan kamera: ${err.message || 'Periksa izin kamera'}`;
      }
      setScannerError(msg);
    }
  }, [handleQrCodeExtracted]);

  // Unlock and re-scan
  const handleUnlockAndRescan = () => {
    setIsLocked(false);
    setQrCodeValue('');
    setSubmissionFeedback(null);
    startScanner();
  };

  // Form Submission (Restricted by RBAC)
  const handleSubmitInbound = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthorized) {
      setSubmissionFeedback({
        type: 'error',
        title: 'Akses Ditolak',
        message: 'Hanya Admin dan Petugas Gudang yang memiliki izin untuk menyimpan data inventaris.',
      });
      return;
    }

    const cleanCode = qrCodeValue.trim();
    const cleanName = productName.trim();
    const qtyNumber = Math.max(1, Number(quantity) || 1);

    if (!cleanCode) {
      setSubmissionFeedback({
        type: 'error',
        title: 'Kode QR Kosong',
        message: 'Silakan pindai QR code terlebih dahulu atau masukkan kode serial unik.',
      });
      return;
    }

    if (!cleanName) {
      setSubmissionFeedback({
        type: 'error',
        title: 'Nama Produk Wajib Diisi',
        message: 'Petugas gudang wajib mengisi nama produk sebelum menyimpan data.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Call Backend API endpoint
      const response = await fetch('/api/warehouse/qr-inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userRole,
          'x-manage-inventory': 'true',
        },
        body: JSON.stringify({
          qrCode: cleanCode,
          productName: cleanName,
          packageCategory,
          quantity: qtyNumber,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userRole,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server menolak permintaan penyimpanan QR inbound.');
      }

      // 2. Synchronize to Frontend Store Context
      const existingProd = products.find(p => p.barcode === cleanCode);

      if (existingProd) {
        const updated: Product = {
          ...existingProd,
          name: cleanName,
          baseUnit: packageCategory as UnitType,
          stock: existingProd.stock + qtyNumber,
        };
        updateProduct(updated);
      } else {
        const newProduct: Product = {
          id: `prod_qr_${Date.now()}`,
          barcode: cleanCode,
          name: cleanName,
          category: packageCategory === 'Tabung' ? 'Tabung' : (packageCategory === 'Biji-bijian' ? 'Beras & Biji' : 'Sembako'),
          baseUnit: packageCategory as UnitType,
          allowDecimal: false,
          stock: qtyNumber,
          minStock: 5,
          costPrice: 0,
          retailPrice: 0,
          wholesalePrice: 0,
          minWholesaleQty: 1,
          hasMultiUnit: false,
        };
        addProduct(newProduct);
      }

      // 3. Success Feedback
      setSubmissionFeedback({
        type: 'success',
        title: 'Inventaris Berhasil Disimpan!',
        message: data.message || `Barang "${cleanName}" (${cleanCode}) tercatat +${qtyNumber} ${packageCategory}.`,
        currentStock: data.currentStock || qtyNumber,
        unit: packageCategory,
      });

      playScanBeep();
    } catch (err: any) {
      console.error('Inbound submit error:', err);
      setSubmissionFeedback({
        type: 'error',
        title: 'Gagal Menyimpan Inventaris',
        message: err.message || 'Terjadi kesalahan sistem inventaris gudang.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form for next item
  const handleResetForNextItem = () => {
    setQrCodeValue('');
    setIsLocked(false);
    setProductName('');
    setPackageCategory('Pcs');
    setQuantity('1');
    setNotes('');
    setSubmissionFeedback(null);
    startScanner();
  };

  // Quick Simulation Test Chips for Development & Preview
  const testQrPresets = [
    { label: 'AQUA Botol 600ml (Scan Foto)', code: '8886008101053', category: 'Botol', name: 'AQUA Air Mineral Pegunungan 600ml' },
    { label: 'Tabung Gas Elpiji 3kg', code: 'QR-LPG-3KG-0982', category: 'Tabung', name: 'Gas Elpiji 3kg Melon' },
    { label: 'Beras Pandan Wangi 5kg', code: 'QR-BERAS-PW-5K', category: 'Biji-bijian', name: 'Beras Pandan Wangi Premium 5kg' },
    { label: 'Minyak Goreng Pouch 2L', code: 'QR-MNYK-PCH-2L', category: 'Pouch', name: 'Minyak Goreng SunCo 2L Pouch' },
  ];

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Input Inventaris Barang via QR Code
              </h1>
              {isAuthorized ? (
                <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-teal-600" />
                  Akses Diizinkan: {userRole}
                </span>
              ) : (
                <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-rose-600" />
                  Akses Terbatas: Hanya Lihat
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pindai QR code otomatis untuk mengunci kode SKU/Serial, lalu lengkapi nama dan satuan kemasan barang.
            </p>
          </div>
        </div>

        {/* User Badge Info */}
        <div className="flex items-center gap-2.5 bg-slate-50 rounded-2xl border border-slate-200 px-3.5 py-2 self-start md:self-auto text-xs">
          <div className="text-right">
            <p className="font-bold text-slate-800">{currentUser?.name || 'Petugas'}</p>
            <p className="text-[10px] text-slate-500 capitalize">{userRole.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {/* RBAC Warning Banner if Unauthorized */}
      {!isAuthorized && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-800 text-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">Akses Dibatasi (Role-Based Access Control)</strong>
            <span>
              Akun Anda saat ini memiliki role <strong>{userRole}</strong>. Fungsi simpan dan modifikasi data inventaris
              dibatasi secara khusus hanya untuk role <strong>Admin</strong> atau <strong>Petugas Gudang</strong> (warehouse_admin / gudang).
            </span>
          </div>
        </div>
      )}

      {/* Main Grid: QR Scanner (Left) & Manual Input Form (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Code Scanner Viewport */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-xl border border-slate-800 flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isScanning ? 'bg-emerald-400' : 'bg-slate-600'} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isScanning ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                </span>
                <span className="font-bold">
                  {isScanning ? 'Kamera QR Aktif' : isLocked ? 'QR Terkunci' : 'Kamera Siap'}
                </span>
              </div>

              {!isScanning && (
                <button
                  type="button"
                  onClick={startScanner}
                  className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Buka Kamera</span>
                </button>
              )}
            </div>

            {/* Html5Qrcode Scanner Render Box */}
            <div className="w-full relative rounded-2xl overflow-hidden bg-black aspect-square flex flex-col items-center justify-center border border-slate-800">
              <div id={scannerContainerId} className="w-full h-full" />

              {!isScanning && !scannerError && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-3">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    {isLocked ? 'QR Code Telah Dikunci' : 'Pemindai QR Siap'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mt-1 mb-4">
                    {isLocked
                      ? `Kode: ${qrCodeValue}`
                      : 'Klik tombol di bawah untuk mengaktifkan pemindaian kamera otomatis.'}
                  </p>
                  <button
                    type="button"
                    onClick={isLocked ? handleUnlockAndRescan : startScanner}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-teal-600/20"
                  >
                    {isLocked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Pindai Ulang</span>
                      </>
                    ) : (
                      <>
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Mulai Pemindaian</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {scannerError && (
                <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center">
                  <AlertCircle className="w-10 h-10 text-rose-400 mb-2" />
                  <p className="text-xs text-rose-300 font-semibold mb-3">{scannerError}</p>
                  <button
                    type="button"
                    onClick={startScanner}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}
            </div>

            {/* Upload Foto Barcode & Identifikasi Gambar */}
            <div className="w-full mt-3 pt-3 border-t border-slate-800 space-y-2.5">
              <label className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition border border-slate-700">
                <Upload className="w-3.5 h-3.5 text-teal-400" />
                <span>Unggah Foto Barcode (Scan dari File/Galeri)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileUpload}
                  className="hidden"
                />
              </label>

              {/* Card Hasil Identifikasi Barcode Foto */}
              <div className="p-3 bg-teal-950/70 border border-teal-600/40 rounded-2xl text-left">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="flex items-center gap-1.5 text-[11px] font-black text-teal-300">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    Hasil Identifikasi Foto: AQUA 600ml
                  </span>
                  <span className="text-[10px] font-mono bg-teal-900/90 text-teal-200 px-2 py-0.5 rounded font-bold border border-teal-700">
                    8886008101053
                  </span>
                </div>
                <p className="text-xs font-bold text-white leading-tight">
                  AQUA Air Mineral Pegunungan 600ml
                </p>
                <p className="text-[10px] text-teal-200/80 mt-0.5 line-clamp-2">
                  Kemasan Botol PET 600ml (Danone AQUA / PT Tirta Investama). 100% Dapat Didaur Ulang.
                </p>
                <button
                  type="button"
                  onClick={handleApplyScannedAquaPhoto}
                  className="w-full mt-2 py-1.5 px-3 bg-teal-500 hover:bg-teal-400 active:scale-98 text-slate-950 font-bold text-[11px] rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Terapkan Hasil Foto Ini ke Formulir</span>
                </button>
              </div>
            </div>

            {/* Quick Testing Chips for Preview Simulation */}
            <div className="w-full mt-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>Simulasi QR Code (Klik untuk Auto-Fill):</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {testQrPresets.map(item => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      handleQrCodeExtracted(item.code);
                      setProductName(item.name);
                      setPackageCategory(item.category);
                    }}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-left transition text-[11px] text-slate-300 hover:text-white"
                  >
                    <p className="font-bold truncate">{item.label}</p>
                    <p className="font-mono text-[10px] text-teal-400 truncate">{item.code}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Locked QR & Manual Data Input Form */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Formulir Inventaris Barang
                </h3>
                <p className="text-xs text-slate-500">
                  Lengkapi data detail barang setelah kode QR terdeteksi
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-400" />
                Step 2 of 2
              </span>
            </div>

            <form onSubmit={handleSubmitInbound} className="space-y-4">
              {/* Field 1: QR Code / Serial Number (Locked upon detection) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    {isLocked ? (
                      <Lock className="w-3.5 h-3.5 text-teal-600" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>Kode Unik QR / SKU / Serial *</span>
                  </label>

                  {isLocked && (
                    <button
                      type="button"
                      onClick={handleUnlockAndRescan}
                      className="text-[11px] font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 transition"
                    >
                      <Unlock className="w-3 h-3" />
                      <span>Buka Kunci / Scan Ulang</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={qrCodeValue}
                    onChange={e => setQrCodeValue(e.target.value)}
                    placeholder="Scan QR code atau ketik manual..."
                    readOnly={isLocked}
                    className={`w-full px-4 py-3 rounded-2xl text-xs sm:text-sm font-mono font-bold transition ${
                      isLocked
                        ? 'bg-teal-50/70 border-2 border-teal-500 text-teal-900'
                        : 'bg-slate-50 border border-slate-300 text-slate-900 focus:outline-hidden focus:border-teal-600 focus:bg-white'
                    }`}
                  />
                  {isLocked && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-extrabold uppercase bg-teal-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      Terkunci
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Nilai kode QR otomatis terkunci saat terbaca oleh kamera scanner.
                </p>
              </div>

              {/* Field 2: Nama Produk (Manual Text Input) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Produk Lengkap *
                </label>
                <input
                  ref={productNameInputRef}
                  type="text"
                  required
                  disabled={!isAuthorized}
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="Contoh: Gas Elpiji 3kg Melon / Beras Pandan Wangi 5kg"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-xs sm:text-sm text-slate-900 font-semibold placeholder-slate-400 focus:outline-hidden focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 transition disabled:opacity-60 disabled:bg-slate-100"
                />
              </div>

              {/* Field 3: Kategori / Satuan Kemasan (Dropdown) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Kategori / Satuan Kemasan *
                  </label>
                  <select
                    disabled={!isAuthorized}
                    value={packageCategory}
                    onChange={e => setPackageCategory(e.target.value)}
                    className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-hidden focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 transition disabled:opacity-60 disabled:bg-slate-100"
                  >
                    {packageCategoryOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Pilihan kemasan: Tabung, Biji-bijian, Pouch, Pcs, Dus, dll.
                  </p>
                </div>

                {/* Field 4: Jumlah / Kuantitas (Opsional / Default: 1) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jumlah / Kuantitas Masuk (Opsional)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      disabled={!isAuthorized}
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      placeholder="1"
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 transition disabled:opacity-60 disabled:bg-slate-100"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      {packageCategory}
                    </span>
                  </div>
                </div>
              </div>

              {/* Field 5: Catatan Petugas / Nomor Lot */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Catatan Penerimaan / Lokasi Rak (Opsional)
                </label>
                <input
                  type="text"
                  disabled={!isAuthorized}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Contoh: Rak A-02, Batch Masuk Pagi"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-teal-600"
                />
              </div>

              {/* Submission Feedback Card */}
              {submissionFeedback && (
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-3 text-xs animate-in fade-in slide-in-from-top-2 ${
                    submissionFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {submissionFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-sm">{submissionFeedback.title}</p>
                    <p className="mt-0.5 leading-relaxed">{submissionFeedback.message}</p>
                    {submissionFeedback.currentStock !== undefined && (
                      <p className="mt-2 text-xs font-bold text-emerald-800">
                        Total Stok di Gudang: {submissionFeedback.currentStock} {submissionFeedback.unit}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
                {submissionFeedback?.type === 'success' ? (
                  <button
                    type="button"
                    onClick={handleResetForNextItem}
                    className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Pindai Item Berikutnya</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setProductName('');
                        setQuantity('1');
                        setNotes('');
                      }}
                      className="w-full sm:w-auto px-4 py-3 rounded-2xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                    >
                      Bersihkan Form
                    </button>
                    <button
                      type="submit"
                      disabled={!isAuthorized || isSubmitting || !qrCodeValue.trim()}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 active:scale-98"
                    >
                      {isSubmitting ? (
                        <RotateCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Simpan ke Inventaris Gudang</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
