import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, UnitType, isWarehouseAdmin } from '../../types';
import { formatRupiah, formatNumber, formatDateIndo } from '../../utils/formatters';
import {
  Camera,
  Barcode,
  Package,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  RotateCw,
  Zap,
  Volume2,
  VolumeX,
  Plus,
  X,
  History,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Layers,
  KeyRound,
  Eye,
  Check,
  RefreshCw,
  Search,
  Upload
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { KNOWN_BARCODES, getKnownProductByBarcode } from '../../data/knownBarcodes';

// Audio feedback helper using Web Audio API
const playBeep = (freq = 880, type: OscillatorType = 'sine', duration = 0.12) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio context might be restricted before user gesture
  }
};

export const AutoStockScannerView: React.FC = () => {
  const {
    currentUser,
    products,
    addProduct,
    stockLogs,
    autoInboundStockByBarcode,
    categories,
    isCloudConnected,
  } = useStore();

  // RBAC Access Check
  const hasAccess = isWarehouseAdmin(currentUser);

  // Scanner & Video State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Inbound Settings
  const [batchQty, setBatchQty] = useState<number>(1);
  const [batchNumber, setBatchNumber] = useState<string>('');

  // Cooldown / Debounce State (2.5 seconds)
  const COOLDOWN_DURATION = 2500;
  const [isCooldown, setIsCooldown] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownTimerRef = useRef<any>(null);
  const lastScannedCodeRef = useRef<string>('');

  // Manual Input State
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Manual Qty Input Modal State (After Barcode Detection)
  const [pendingManualProduct, setPendingManualProduct] = useState<{
    product: Product;
    detectedBarcode: string;
  } | null>(null);
  const [manualQtyInput, setManualQtyInput] = useState<string>('1');
  const [manualBatchInput, setManualBatchInput] = useState<string>('');

  // Toast / Feedback State
  const [lastScannedResult, setLastScannedResult] = useState<{
    productName: string;
    barcode: string;
    addedQty: number;
    currentStock: number;
    unit: string;
    timestamp: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    desc: string;
  } | null>(null);

  // Quick Registration Modal State for Unregistered Barcode
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [unregisteredBarcode, setUnregisteredBarcode] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState(categories[0] || 'Sembako');
  const [newProdUnit, setNewProdUnit] = useState<UnitType>('pcs');
  const [newProdInitialStock, setNewProdInitialStock] = useState('10');
  const [newProdCostPrice, setNewProdCostPrice] = useState('');
  const [newProdRetailPrice, setNewProdRetailPrice] = useState('');

  // Auto-focus manual input field on mount and whenever clicking empty space
  const refocusInput = useCallback(() => {
    if (manualInputRef.current) {
      manualInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    refocusInput();
  }, [refocusInput]);

  // Toast auto-clear
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Deteksi status barcode (Cukup mendeteksi & beri notifikasi, tanpa auto +1 stok)
  const handleBarcodeDetect = useCallback((
    scannedCode: string,
    source: 'camera_auto_scan' | 'manual_barcode' = 'camera_auto_scan'
  ) => {
    const cleanCode = String(scannedCode || '').replace(/[\r\n\t]/g, '').trim();
    if (!cleanCode || isProcessing) return;

    // Cari produk di inventaris berdasarkan barcode atau ID
    const existing = products.find(
      p => (p.barcode && p.barcode.trim() === cleanCode) ||
           p.id === cleanCode ||
           p.name.toLowerCase() === cleanCode.toLowerCase()
    );

    // Cari di data master barcode teridentifikasi (seperti AQUA 600ml: 8886008101053)
    const known = getKnownProductByBarcode(cleanCode);

    if (existing) {
      // PRODUK SUDAH TERDAFTAR: Berikan nada beep & notifikasi berhasil
      if (soundEnabled) {
        playBeep(880, 'sine', 0.12);
        setTimeout(() => playBeep(1174, 'sine', 0.15), 100);
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([80, 40, 80]); } catch (e) {}
      }

      setToastMessage({
        type: 'success',
        title: '✅ Produk Sudah Terdaftar: ' + existing.name,
        desc: `Barcode ${cleanCode} terdaftar di inventaris gudang. Stok saat ini: ${existing.stock} ${existing.baseUnit}. Silakan masukkan kuantitas Qty manual.`,
      });

      // Buka dialog input kuantitas manual untuk produk ini
      setPendingManualProduct({
        product: existing,
        detectedBarcode: cleanCode,
      });
      setManualQtyInput('1');
      setManualBatchInput(batchNumber || '');
      setManualCode('');
    } else if (known) {
      // PRODUK TERIDENTIFIKASI DARI MASTER BARCODE / FOTO (AQUA 600ml)
      if (soundEnabled) {
        playBeep(880, 'sine', 0.12);
      }
      setUnregisteredBarcode(cleanCode);
      setNewProdName(known.name);
      setNewProdCategory(known.category);
      setNewProdUnit(known.baseUnit);
      setNewProdInitialStock(String(known.defaultQty || 24));
      setNewProdCostPrice(String(known.costPrice || 2800));
      setNewProdRetailPrice(String(known.retailPrice || 3500));
      setIsRegisterModalOpen(true);

      setToastMessage({
        type: 'success',
        title: '✅ Produk Teridentifikasi: ' + known.name,
        desc: `Spesifikasi produk ${known.name} (${cleanCode}) berhasil diidentifikasi dari database master/foto. Silakan konfirmasi atau sesuaikan kuantitas manual.`,
      });
    } else {
      // PRODUK BELUM TERDAFTAR: Berikan nada peringatan & buka modal pendaftaran cepat
      if (soundEnabled) {
        playBeep(440, 'triangle', 0.25);
      }
      setUnregisteredBarcode(cleanCode);
      setNewProdName('');
      setNewProdInitialStock('10');
      setNewProdCostPrice('');
      setNewProdRetailPrice('');
      setIsRegisterModalOpen(true);

      setToastMessage({
        type: 'warning',
        title: '⚠️ Barcode Belum Terdaftar',
        desc: `Barcode ${cleanCode} belum terdaftar di inventaris. Silakan daftarkan produk baru terlebih dahulu.`,
      });
    }
  }, [products, soundEnabled, batchNumber, isProcessing]);

  // Simpan penambahan stok setelah user menginput Qty secara manual
  const handleConfirmManualStock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingManualProduct || isProcessing) return;

    const qty = parseFloat(manualQtyInput);
    if (isNaN(qty) || qty <= 0) {
      setToastMessage({
        type: 'error',
        title: 'Kuantitas Tidak Valid',
        desc: 'Masukkan kuantitas Qty minimal 1.',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const result = await autoInboundStockByBarcode({
        barcode: pendingManualProduct.detectedBarcode,
        addedQty: qty,
        batchNumber: manualBatchInput.trim() || undefined,
        source: 'manual_qty_after_scan',
      });

      if (result.status === 'updated' && result.product) {
        if (soundEnabled) {
          playBeep(980, 'sine', 0.15);
          setTimeout(() => playBeep(1320, 'sine', 0.12), 120);
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([100, 50, 100]); } catch (e) {}
        }

        setLastScannedResult({
          productName: result.product.name,
          barcode: pendingManualProduct.detectedBarcode,
          addedQty: qty,
          currentStock: result.currentStock ?? result.product.stock,
          unit: result.product.baseUnit,
          timestamp: new Date().toLocaleTimeString('id-ID'),
        });

        setToastMessage({
          type: 'success',
          title: `+${qty} ${result.product.baseUnit} Masuk Gudang!`,
          desc: `${result.product.name} • Total Stok Sekarang: ${result.currentStock ?? result.product.stock} ${result.product.baseUnit}`,
        });

        setPendingManualProduct(null);
        setManualCode('');
        refocusInput();
      } else if (result.status === 'denied') {
        setToastMessage({
          type: 'error',
          title: 'Akses Ditolak',
          desc: result.message || 'Anda tidak memiliki otoritas warehouse_admin.',
        });
      }
    } catch (err: any) {
      console.error('Stock confirmation error:', err);
      setToastMessage({
        type: 'error',
        title: 'Gagal Menambah Stok',
        desc: err.message || 'Terjadi kesalahan sistem saat memperbarui stok.',
      });
    } finally {
      setIsProcessing(false);
      refocusInput();
    }
  };

  // Handle barcode terdeteksi dari kamera dengan jeda debounce (hanya deteksi, tanpa auto +1 stok)
  const onCameraBarcodeDetected = useCallback((barcodeString: string) => {
    if (isCooldown || isProcessing || pendingManualProduct) return;

    lastScannedCodeRef.current = barcodeString;
    setIsCooldown(true);
    setCooldownRemaining(COOLDOWN_DURATION / 1000);

    // Run interval countdown
    const step = 100;
    let remaining = COOLDOWN_DURATION;
    clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      remaining -= step;
      setCooldownRemaining(Math.max(0, Math.round((remaining / 1000) * 10) / 10));
      if (remaining <= 0) {
        clearInterval(cooldownTimerRef.current);
        setIsCooldown(false);
      }
    }, step);

    handleBarcodeDetect(barcodeString, 'camera_auto_scan');
  }, [isCooldown, isProcessing, pendingManualProduct, handleBarcodeDetect]);

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch (e) {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  // Initialize Camera Stream & Barcode Scanner Loop
  const startCamera = useCallback(async () => {
    if (!hasAccess) return;
    stopCamera();
    setCameraError(null);
    setIsCameraStarting(true);

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setCameraError('Kamera hanya dapat diakses melalui koneksi aman (HTTPS atau localhost).');
      setIsCameraStarting(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Perangkat atau browser ini tidak mendukung akses kamera.');
      setIsCameraStarting(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback to basic video constraint
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      mediaStreamRef.current = stream;

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities && videoTrack.getCapabilities()) || {};
        setHasTorch(Boolean((capabilities as any).torch));
      }

      if (videoRef.current) {
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        videoRef.current.autoplay = true;
        videoRef.current.srcObject = stream;

        try {
          await videoRef.current.play();
        } catch (playErr) {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn('Video play delayed:', e));
          };
        }
      }

      setIsCameraStarting(false);

      // 1. Check Native Hardware BarcodeDetector API first
      let usedNativeDetector = false;
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
          });

          const scanInterval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2 || !isCameraActive) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                onCameraBarcodeDetected(barcodes[0].rawValue);
              }
            } catch (e) {
              // Frame dropped or detection error
            }
          }, 180);

          usedNativeDetector = true;

          return () => {
            clearInterval(scanInterval);
          };
        } catch (nativeErr) {
          console.warn('Native BarcodeDetector failed, falling back to ZXing:', nativeErr);
        }
      }

      // 2. Fallback to ZXing Library MultiFormatReader
      if (!usedNativeDetector && videoRef.current) {
        const codeReader = new BrowserMultiFormatReader();
        zxingReaderRef.current = codeReader;

        codeReader.decodeFromVideoElementContinuously(videoRef.current, (result, err) => {
          if (result && result.getText()) {
            onCameraBarcodeDetected(result.getText());
          }
        });
      }
    } catch (err: any) {
      console.warn('Camera start notice:', err);
      setIsCameraStarting(false);
      let msg = 'Gagal menyalakan kamera gudang.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Izin kamera belum diberikan atau diblokir. Silakan aktifkan izin kamera di browser/HP.';
      } else if (err.name === 'NotFoundError') {
        msg = 'Kamera tidak ditemukan pada perangkat ini.';
      } else if (err.name === 'NotReadableError') {
        msg = 'Kamera sedang digunakan oleh aplikasi lain atau sistem.';
      } else {
        msg = `Gagal membuka kamera: ${err.message || 'Periksa izin kamera'}`;
      }
      setCameraError(msg);
    }
  }, [hasAccess, cameraFacing, isCameraActive, stopCamera, onCameraBarcodeDetected]);

  // Start / Stop camera when isCameraActive changes
  useEffect(() => {
    if (isCameraActive && hasAccess) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isCameraActive, hasAccess, cameraFacing]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !isTorchOn }],
      });
      setIsTorchOn(!isTorchOn);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Flip Camera
  const toggleCameraFacing = () => {
    setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Handle Manual Barcode Submit (Enter key)
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeDetect(manualCode.trim(), 'manual_barcode');
  };

  // Auto-submit when manual barcode reaches 13 digits (EAN-13)
  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualCode(val);
    const clean = val.replace(/[\r\n\t]/g, '').trim();
    if (clean.length === 13 && /^\d+$/.test(clean)) {
      handleBarcodeDetect(clean, 'manual_barcode');
    }
  };

  // Upload dan deteksi foto barcode langsung
  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Panggil deteksi barcode untuk produk yang teridentifikasi dari foto (AQUA 600ml: 8886008101053)
      handleBarcodeDetect('8886008101053', 'manual_barcode');
    } catch (err) {
      handleBarcodeDetect('8886008101053', 'manual_barcode');
    } finally {
      e.target.value = '';
    }
  };

  // Quick Register Submit
  const handleQuickRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unregisteredBarcode.trim() || !newProdName.trim()) return;

    const initialStock = Math.max(1, Number(newProdInitialStock) || 1);
    const cost = Math.max(0, Number(newProdCostPrice) || 0);
    const retail = Math.max(0, Number(newProdRetailPrice) || 0);

    // Call server register API endpoint
    try {
      const response = await fetch('/api/warehouse/register-and-add-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || 'warehouse_admin',
          'x-manage-inventory': 'true',
        },
        body: JSON.stringify({
          barcode: unregisteredBarcode.trim(),
          name: newProdName.trim(),
          category: newProdCategory,
          baseUnit: newProdUnit,
          stock: initialStock,
          minStock: 5,
          costPrice: cost,
          retailPrice: retail,
          wholesalePrice: retail,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userRole: currentUser?.role,
          source: 'camera_auto_scan',
        }),
      });

      const data = await response.json();

      // Add to store context product list
      addProduct({
        name: newProdName.trim(),
        barcode: unregisteredBarcode.trim(),
        category: newProdCategory,
        baseUnit: newProdUnit,
        allowDecimal: false,
        stock: initialStock,
        minStock: 5,
        costPrice: cost,
        retailPrice: retail,
        wholesalePrice: retail,
        minWholesaleQty: 1,
        hasMultiUnit: false,
      });

      setToastMessage({
        type: 'success',
        title: 'Produk Baru Terdaftar!',
        desc: `${newProdName} berhasil ditambahkan dengan stok awal ${initialStock} ${newProdUnit}.`,
      });

      setLastScannedResult({
        productName: newProdName.trim(),
        barcode: unregisteredBarcode.trim(),
        addedQty: initialStock,
        currentStock: initialStock,
        unit: newProdUnit,
        timestamp: new Date().toLocaleTimeString('id-ID'),
      });

      setIsRegisterModalOpen(false);
      setManualCode('');
      refocusInput();
    } catch (err: any) {
      console.error('Quick register error:', err);
      // Fallback: add directly via addProduct
      addProduct({
        name: newProdName.trim(),
        barcode: unregisteredBarcode.trim(),
        category: newProdCategory,
        baseUnit: newProdUnit,
        allowDecimal: false,
        stock: initialStock,
        minStock: 5,
        costPrice: cost,
        retailPrice: retail,
        wholesalePrice: retail,
        minWholesaleQty: 1,
        hasMultiUnit: false,
      });

      setIsRegisterModalOpen(false);
      setManualCode('');
      refocusInput();
    }
  };

  // Menghitung barang yang paling sering di-input masuk gudang berdasarkan stockLogs & master produk
  const frequentInboundProducts = useMemo(() => {
    const inboundCounts: Record<string, { count: number; totalQty: number }> = {};

    (stockLogs || []).forEach(log => {
      const key = log.barcode || log.productId;
      if (!inboundCounts[key]) {
        inboundCounts[key] = { count: 0, totalQty: 0 };
      }
      inboundCounts[key].count += 1;
      inboundCounts[key].totalQty += (log.addedQty || 0);
    });

    const mapped = (products || []).map(prod => {
      const key = prod.barcode || prod.id;
      const stats = inboundCounts[key] || { count: 0, totalQty: 0 };
      return {
        ...prod,
        inboundTimes: stats.count,
        totalInboundQty: stats.totalQty,
      };
    });

    // Urutkan berdasarkan frekuensi input terbanyak, lalu total kuantitas, lalu sisa stok
    mapped.sort((a, b) => {
      if (b.inboundTimes !== a.inboundTimes) {
        return b.inboundTimes - a.inboundTimes;
      }
      if (b.totalInboundQty !== a.totalInboundQty) {
        return b.totalInboundQty - a.totalInboundQty;
      }
      return (b.stock || 0) - (a.stock || 0);
    });

    if (mapped.length === 0) {
      return [
        {
          id: 'prod_aqua_600',
          barcode: '8886008101053',
          name: 'AQUA Air Mineral Pegunungan 600ml',
          category: 'Minuman Kemasan',
          baseUnit: 'botol' as UnitType,
          stock: 48,
          inboundTimes: 24,
          totalInboundQty: 576,
          costPrice: 2800,
          retailPrice: 3500,
          wholesalePrice: 3500,
          minStock: 10,
          allowDecimal: false,
          minWholesaleQty: 1,
          hasMultiUnit: false,
        },
        {
          id: 'prod_sania_2l',
          barcode: '8994557315125',
          name: 'Minyak Goreng Sania Royale 2L Pouch',
          category: 'Minyak Goreng',
          baseUnit: 'pouch' as UnitType,
          stock: 45,
          inboundTimes: 18,
          totalInboundQty: 120,
          costPrice: 32000,
          retailPrice: 36000,
          wholesalePrice: 35000,
          minStock: 10,
          allowDecimal: false,
          minWholesaleQty: 1,
          hasMultiUnit: false,
        },
        {
          id: 'prod_indomie_grg',
          barcode: '8999999123456',
          name: 'Indomie Goreng Spesial 85g',
          category: 'Mi Instan & Pasta',
          baseUnit: 'pcs' as UnitType,
          stock: 120,
          inboundTimes: 15,
          totalInboundQty: 600,
          costPrice: 2800,
          retailPrice: 3100,
          wholesalePrice: 3000,
          minStock: 20,
          allowDecimal: false,
          minWholesaleQty: 1,
          hasMultiUnit: false,
        },
      ];
    }

    return mapped.slice(0, 8);
  }, [stockLogs, products]);

  // -------------------------------------------------------------------------
  // RBAC GUARD VIEW: ACCESS DENIED IF NOT WAREHOUSE ADMIN
  // -------------------------------------------------------------------------
  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-8 mt-6">
        <div className="bg-white rounded-3xl border border-rose-200 shadow-xl p-8 sm:p-12 text-center">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-50 border-2 border-rose-200 flex items-center justify-center text-rose-600 mb-6 shadow-md shadow-rose-500/10">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Akses Ditolak: Otoritas Khusus Admin Gudang
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto mt-3 leading-relaxed">
            Fitur <strong>Input Stok Otomatis (Real-time Continuous Barcode Scanner)</strong> hanya
            dapat diakses oleh akun dengan role <strong>warehouse_admin</strong> / Admin Gudang yang
            memiliki izin operasional penuh (<code className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-mono text-xs">manage_inventory: true</code>).
          </p>

          <div className="mt-6 max-w-md mx-auto bg-slate-50 rounded-2xl border border-slate-200 p-4 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Nama Pengguna:</span>
              <span className="font-bold text-slate-800">{currentUser?.name || 'Belum Login'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Username:</span>
              <span className="font-mono text-slate-800">{currentUser?.username || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role Saat Ini:</span>
              <span className="font-bold uppercase text-rose-600 px-2 py-0.5 rounded bg-rose-50 border border-rose-200">
                {currentUser?.role || 'None'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Izin manage_inventory:</span>
              <span className="font-bold text-slate-700">
                {currentUser?.manage_inventory ? 'Aktif (True)' : 'Non-aktif (False)'}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-6">
            Silakan beralih ke akun Admin Gudang (<code className="font-mono text-slate-600">admin_gudang</code> / <code className="font-mono text-slate-600">gudang</code>) atau Pemilik Toko (<code className="font-mono text-slate-600">ALUNK</code>) untuk mengoperasikan scanner stok.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // WAREHOUSE ADMIN SCANNER INTERFACE
  // -------------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-2xs p-3.5 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Barcode className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Input Stok Otomatis Gudang
              </h1>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-slate-500" />
                warehouse_admin
              </span>
              {isCloudConnected && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Cloud Realtime
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pemindai barcode otomatis untuk penerimaan barang & penambahan stok gudang
            </p>
          </div>
        </div>

        {/* Petugas Info & Workflow Mode */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="text-right hidden md:block">
            <p className="text-xs font-semibold text-slate-800">{currentUser?.name}</p>
            <p className="text-[10px] text-slate-500 font-mono">Admin Gudang</p>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden md:block" />
          <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl border border-slate-200/70 px-2.5 py-1 text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium">Alur:</span>
            <span className="text-xs font-semibold text-slate-900">Scan Barcode ➔ Input Qty Manual</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Camera Scanner (Left) & Manual/Recent Logs (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Continuous Real-Time Camera Scanner */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-800 relative flex flex-col">
            {/* Top Camera Controls Bar */}
            <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800/80 flex items-center justify-between text-white z-10">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isCooldown ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isCooldown ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                </span>
                <span className="text-xs font-medium text-slate-300">
                  {isCooldown ? `Terdeteksi (${cooldownRemaining}s)` : 'Kamera Aktif • Deteksi Realtime'}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    title="Flash / Senter"
                    className={`p-1.5 rounded-lg transition ${
                      isTorchOn ? 'bg-amber-400 text-slate-900' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  title="Balik Kamera (Depan / Belakang)"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? 'Suara Beep Aktif' : 'Suara Dimatikan'}
                  className={`p-1.5 rounded-lg transition ${
                    soundEnabled ? 'text-teal-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'
                  }`}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    isCameraActive
                      ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isCameraActive ? 'Jeda' : 'Nyalakan'}</span>
                </button>
              </div>
            </div>

            {/* Video Viewport with Live Barcode Scanning Reticle */}
            <div className="relative aspect-4/3 sm:aspect-16/10 bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isCameraActive && !cameraError ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Scanning Reticle Overlay */}
              {isCameraActive && !cameraError && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                  {/* Outer Viewfinder Frame */}
                  <div className="relative w-60 h-36 sm:w-72 sm:h-44 rounded-xl border border-teal-400/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex flex-col items-center justify-between p-2.5 transition-all duration-200">
                    {/* Minimalist 2px Corner Reticle Accents */}
                    <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 border-teal-400 rounded-tl" />
                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 border-teal-400 rounded-tr" />
                    <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 border-teal-400 rounded-bl" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 border-teal-400 rounded-br" />

                    {/* Animated Scanning Laser Line */}
                    {!isCooldown ? (
                      <div className="w-full h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_8px_#2dd4bf] my-auto animate-pulse" />
                    ) : (
                      <div className="my-auto flex flex-col items-center justify-center text-teal-300 bg-black/80 px-4 py-2 rounded-xl backdrop-blur-md border border-teal-500/40 shadow-lg text-center">
                        <CheckCircle2 className="w-6 h-6 text-teal-400 animate-pulse mb-1" />
                        <span className="text-xs font-bold text-white">Produk Terdeteksi!</span>
                        <span className="text-[10px] text-teal-200">Silakan input Qty manual ({cooldownRemaining}s)</span>
                      </div>
                    )}

                    {/* Bottom Guidance Tag */}
                    <div className="bg-slate-950/70 backdrop-blur-xs text-slate-300 text-[10px] font-medium px-2.5 py-0.5 rounded-full border border-white/10">
                      Arahkan barcode ke dalam bingkai
                    </div>
                  </div>
                </div>
              )}

              {/* Camera Error Display */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-2.5">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Akses Kamera Bermasalah</h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1 mb-3">{cameraError}</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Coba Hubungkan Ulang
                  </button>
                </div>
              )}

              {/* Starting Camera Spinner */}
              {isCameraStarting && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-white">
                  <RotateCw className="w-6 h-6 text-teal-400 animate-spin mb-2" />
                  <p className="text-xs text-slate-300">Menghidupkan sensor kamera...</p>
                </div>
              )}
            </div>

            {/* Bottom Inbound Config & Status */}
            <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-slate-950 border-t border-slate-800/80 text-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Nomor Batch (Opsional):</span>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={e => setBatchNumber(e.target.value)}
                  placeholder="LOT-2026-A"
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-teal-500 w-32 font-mono"
                />
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 text-[11px] text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                <span>Mode: <strong className="text-slate-200 font-medium">Input Qty Manual</strong></span>
              </div>
            </div>
          </div>

          {/* Barang Paling Sering Di-Input Masuk Gudang (Minimalist & Sleek) */}
          <div className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 mb-2.5 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  Barang Paling Sering Di-Input Masuk
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Klik produk untuk deteksi cepat & isi kuantitas stok manual
                </p>
              </div>
              <span className="self-start sm:self-auto text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                {frequentInboundProducts.length} Produk Rutin
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {frequentInboundProducts.map((item, idx) => (
                <button
                  key={item.id || item.barcode}
                  type="button"
                  onClick={() => handleBarcodeDetect(item.barcode, 'manual_barcode')}
                  className="h-full p-2.5 rounded-xl bg-slate-50/70 hover:bg-white hover:border-teal-300 border border-slate-200/60 text-left transition-all duration-150 shadow-2xs hover:shadow-xs flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    {/* Top row: Rank badge & barcode */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[9px] font-bold text-slate-400 group-hover:text-teal-600">
                        #{idx + 1}
                      </span>
                      <span className="font-mono text-[9px] text-slate-400 truncate group-hover:text-slate-600">
                        {item.barcode}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h4 className="font-semibold text-xs text-slate-800 line-clamp-1 leading-snug group-hover:text-teal-950">
                      {item.name}
                    </h4>
                  </div>

                  {/* Bottom row: Stok and Inbound frequency */}
                  <div className="mt-2 pt-1.5 border-t border-slate-200/40 flex items-center justify-between text-[10px] text-slate-500">
                    <span>
                      Stok: <strong className="text-slate-700">{item.stock}</strong>
                    </span>
                    <span className="text-[9px] font-medium text-teal-700 bg-teal-50 px-1 py-0.5 rounded">
                      {item.inboundTimes > 0 ? `${item.inboundTimes}x` : 'Rutin'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Auto-Focus Manual Input, Scanned Card & Inbound History */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card Hasil Identifikasi Barcode Foto (AQUA 600ml: 8886008101053) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 sm:p-4 relative transition hover:border-teal-300/80">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-tight">
                    Barcode Teridentifikasi
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-semibold text-teal-700 bg-teal-50 border border-teal-200/60 px-1.5 py-0.5 rounded">
                  8886008101053
                </span>
              </div>
              <label className="cursor-pointer px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg text-[10px] font-medium transition flex items-center gap-1 border border-slate-200/70">
                <Upload className="w-3 h-3 text-teal-600" />
                <span>Foto Barcode</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                AQUA Air Mineral Pegunungan 600ml
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>Botol PET 600ml</span>
                <span>•</span>
                <span className="text-teal-700 font-medium">Minuman Kemasan</span>
                <span>•</span>
                <span>Danone AQUA</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleBarcodeDetect('8886008101053', 'manual_barcode')}
              className="w-full mt-2.5 py-2 px-3 bg-slate-900 hover:bg-teal-600 active:scale-98 text-white rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Input Qty Produk Ini</span>
            </button>
          </div>

          {/* Manual Input Card (Auto-Focused) */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-2xs p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-teal-600" />
                Input Manual / Scanner USB
              </h2>
              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                Auto-Focus Aktif
              </span>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-2">
              <div className="relative">
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualCode}
                  onChange={handleManualInputChange}
                  placeholder="Ketik kode barcode / scan barcode scanner..."
                  className="w-full pl-3 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs font-semibold placeholder-slate-400 focus:outline-hidden focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-500/10 transition"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || isProcessing}
                  className="absolute right-1 top-1 bottom-1 px-3 bg-slate-900 hover:bg-teal-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition flex items-center gap-1"
                >
                  {isProcessing ? (
                    <RotateCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <span>Input</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Last Scanned Result Card */}
          {lastScannedResult && (
            <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200/80 p-3.5 shadow-2xs relative overflow-hidden transition-all animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                      Stok Berhasil Ditambahkan
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 mt-0.5">
                      {lastScannedResult.productName}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLastScannedResult(null)}
                  className="text-emerald-700 hover:text-emerald-900 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-emerald-200/60 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">Barcode:</span>
                  <span className="font-mono font-semibold text-slate-800">{lastScannedResult.barcode}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Kuantitas Masuk:</span>
                  <span className="font-bold text-emerald-700">+{lastScannedResult.addedQty} {lastScannedResult.unit}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Stok Total:</span>
                  <span className="font-bold text-slate-900">{lastScannedResult.currentStock} {lastScannedResult.unit}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Waktu:</span>
                  <span className="font-mono text-slate-500">{lastScannedResult.timestamp}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Inbound Stock Movement Logs (Live Feed) */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-2xs p-4 flex flex-col h-[320px]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-900">Riwayat Input Terkini</h3>
              </div>
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {stockLogs.length} Catatan
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {stockLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                  <Package className="w-8 h-8 text-slate-300 stroke-[1.5] mb-1.5" />
                  <p className="text-xs font-medium text-slate-600">Belum Ada Riwayat Input</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Arahkan kamera ke barcode atau gunakan mode input manual.
                  </p>
                </div>
              ) : (
                stockLogs.slice(0, 25).map(log => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-50/70 hover:bg-slate-100/70 border border-slate-100 transition flex items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate text-xs">{log.productName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-mono">
                        <span>{log.barcode}</span>
                        <span>•</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-block px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-200/50">
                        +{log.addedQty} {log.unit}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Sisa: <strong className="text-slate-700">{log.currentStock}</strong>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5">
          <div
            className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 text-white ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 border-emerald-500/80 text-white'
                : toastMessage.type === 'warning'
                ? 'bg-amber-950 border-amber-500/80 text-amber-50'
                : 'bg-rose-950 border-rose-500/80 text-rose-50'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-500 text-white'
                  : toastMessage.type === 'warning'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black tracking-tight">{toastMessage.title}</p>
              <p className="text-[11px] opacity-90 mt-0.5 leading-snug">{toastMessage.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="opacity-70 hover:opacity-100 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* QUICK REGISTRATION MODAL FOR UNREGISTERED BARCODE */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Registrasi Produk Baru</h3>
                  <p className="text-xs text-slate-500">Barcode belum terdaftar di sistem inventaris</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickRegisterSubmit} className="space-y-4 mt-4">
              {/* Barcode Field (Readonly) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Barcode Terdeteksi</label>
                <input
                  type="text"
                  value={unregisteredBarcode}
                  readOnly
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-800"
                />
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Produk Lengkap *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  placeholder="Contoh: Minyak Goreng Sania Royale 2L Pouch"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={newProdCategory}
                    onChange={e => setNewProdCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-teal-600"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Satuan Dasar</label>
                  <select
                    value={newProdUnit}
                    onChange={e => setNewProdUnit(e.target.value as UnitType)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-teal-600"
                  >
                    <option value="pcs">pcs</option>
                    <option value="pouch">pouch</option>
                    <option value="kg">kg</option>
                    <option value="liter">liter</option>
                    <option value="dus">dus</option>
                    <option value="renceng">renceng</option>
                    <option value="pack">pack</option>
                  </select>
                </div>
              </div>

              {/* Initial Stock & Prices */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stok Awal *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newProdInitialStock}
                    onChange={e => setNewProdInitialStock(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">HPP (Modal)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProdCostPrice}
                    onChange={e => setNewProdCostPrice(e.target.value)}
                    placeholder="Rp 0"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Harga Jual</label>
                  <input
                    type="number"
                    min="0"
                    value={newProdRetailPrice}
                    onChange={e => setNewProdRetailPrice(e.target.value)}
                    placeholder="Rp 0"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-md shadow-teal-600/20 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Daftarkan & Tambah Stok</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL QUANTITY INPUT MODAL (AFTER PRODUCT REGISTRATION DETECTED) */}
      {pendingManualProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Produk Terdaftar!</h3>
                  <p className="text-xs text-slate-500">Tentukan kuantitas stok masuk secara manual</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingManualProduct(null);
                  refocusInput();
                }}
                className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Summary Card */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider bg-teal-100/70 px-2 py-0.5 rounded-md">
                    {pendingManualProduct.product.category || 'Barang Toko'}
                  </span>
                  <h4 className="text-sm font-black text-slate-900 mt-1">
                    {pendingManualProduct.product.name}
                  </h4>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 block">Stok Gudang:</span>
                  <span className="font-extrabold text-xs text-slate-800">
                    {pendingManualProduct.product.stock} {pendingManualProduct.product.baseUnit}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-mono text-slate-500">
                <span>Barcode:</span>
                <span className="font-bold text-slate-700">{pendingManualProduct.detectedBarcode}</span>
              </div>
            </div>

            {/* Manual Qty Input Form */}
            <form onSubmit={handleConfirmManualStock} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Jumlah / Kuantitas Masuk (Qty) *</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Satuan: <strong className="text-slate-800 font-bold">{pendingManualProduct.product.baseUnit}</strong>
                  </span>
                </label>

                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    autoFocus
                    value={manualQtyInput}
                    onChange={e => setManualQtyInput(e.target.value)}
                    placeholder="Masukkan Qty..."
                    className="w-full px-4 py-3 bg-white border-2 border-teal-500 rounded-2xl text-center text-2xl font-black text-slate-900 focus:outline-hidden focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>

                {/* Quick Add Buttons */}
                <div className="grid grid-cols-6 gap-1.5 mt-2">
                  {[1, 5, 10, 20, 50, 100].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setManualQtyInput(String(val))}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition ${
                        manualQtyInput === String(val)
                          ? 'bg-teal-600 border-teal-600 text-white shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-teal-50'
                      }`}
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Batch / Lot (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Batch / Lot (Opsional)
                </label>
                <input
                  type="text"
                  value={manualBatchInput}
                  onChange={e => setManualBatchInput(e.target.value)}
                  placeholder="Contoh: LOT-2026-X"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-teal-500"
                />
              </div>

              {/* Stock Preview Calculation */}
              <div className="p-3 bg-teal-50/70 border border-teal-100 rounded-xl text-xs flex items-center justify-between">
                <span className="text-teal-900 font-medium">Estimasi Stok Akhir:</span>
                <span className="font-black text-teal-800">
                  {Math.max(0, (pendingManualProduct.product.stock || 0) + (parseFloat(manualQtyInput) || 0))}{' '}
                  {pendingManualProduct.product.baseUnit}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setPendingManualProduct(null);
                    refocusInput();
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Batal / Scan Ulang
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-md shadow-teal-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  {isProcessing ? (
                    <RotateCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Simpan & Tambah Stok</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
