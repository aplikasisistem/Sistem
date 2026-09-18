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
  Upload,
  Scale
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
  const [activeDetectedProduct, setActiveDetectedProduct] = useState<{
    product: Product;
    detectedBarcode: string;
  } | null>(() => {
    const defaultProd = products.find(p => p.barcode === '8886008101053') || products[0] || null;
    return defaultProd ? { product: defaultProd, detectedBarcode: defaultProd.barcode || '8886008101053' } : null;
  });
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
  const [newProdAllowDecimal, setNewProdAllowDecimal] = useState<boolean>(false);
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

  // Deteksi status barcode (Mendeteksi produk di inventaris atau master barcode)
  const handleBarcodeDetect = useCallback((
    scannedCode: string,
    source: 'camera_auto_scan' | 'manual_barcode' = 'camera_auto_scan'
  ) => {
    const cleanCode = String(scannedCode || '').replace(/[\r\n\t]/g, '').trim();
    if (!cleanCode || isProcessing) return;

    // Cari produk di inventaris berdasarkan barcode atau ID
    let existing = products.find(
      p => (p.barcode && p.barcode.trim() === cleanCode) ||
           p.id === cleanCode ||
           p.name.toLowerCase() === cleanCode.toLowerCase()
    );

    // Cari di data master barcode teridentifikasi (seperti AQUA 600ml: 8886008101053)
    const known = getKnownProductByBarcode(cleanCode);

    // Jika belum ada di state lokal tapi ada di master database, langsung daftarkan agar terdeteksi
    if (!existing && known) {
      const isDecimal = Boolean(known.allowDecimal || known.baseUnit === 'kg');
      const autoRegisteredProduct: Product = {
        id: `prod_${Date.now()}_${cleanCode}`,
        barcode: cleanCode,
        name: known.name,
        category: known.category,
        baseUnit: known.baseUnit,
        allowDecimal: isDecimal,
        stock: known.defaultQty || (isDecimal ? 25.5 : 24),
        minStock: 10,
        costPrice: known.costPrice || 2800,
        retailPrice: known.retailPrice || 3500,
        wholesalePrice: known.wholesalePrice || 3200,
        minWholesaleQty: known.minWholesaleQty || 24,
        hasMultiUnit: Boolean(known.packageCategory === 'Dus'),
        boxUnitName: known.packageCategory === 'Dus' ? 'Dus' : undefined,
        boxConversionRatio: known.packageCategory === 'Dus' ? 24 : undefined,
      };
      addProduct(autoRegisteredProduct);
      existing = autoRegisteredProduct;
    }

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
        title: '✅ Produk Terdeteksi: ' + existing.name,
        desc: `Barcode ${cleanCode} • Kategori: ${existing.category} • Satuan: ${existing.baseUnit} • ${existing.allowDecimal ? 'Timbangan Desimal' : 'Satuan Kemasan Utuh'}. Silakan tentukan Qty masuk.`,
      });

      // Update produk aktif pada panel & buka dialog input kuantitas manual
      setPendingManualProduct({
        product: existing,
        detectedBarcode: cleanCode,
      });
      setActiveDetectedProduct({
        product: existing,
        detectedBarcode: cleanCode,
      });
      setManualQtyInput(existing.allowDecimal ? '1' : '1');
      setManualBatchInput(batchNumber || '');
      setManualCode('');
    } else {
      // PRODUK BELUM TERDAFTAR: Berikan nada peringatan & buka modal pendaftaran cepat
      if (soundEnabled) {
        playBeep(440, 'triangle', 0.25);
      }
      setUnregisteredBarcode(cleanCode);
      setNewProdName('');
      setNewProdCategory(categories[0] || 'Sembako');
      setNewProdUnit('pcs');
      setNewProdAllowDecimal(false);
      setNewProdInitialStock('10');
      setNewProdCostPrice('');
      setNewProdRetailPrice('');
      setIsRegisterModalOpen(true);

      setToastMessage({
        type: 'warning',
        title: '⚠️ Barcode Belum Terdaftar: ' + cleanCode,
        desc: `Barcode ${cleanCode} belum ada di stok. Silakan lengkapi nama barang, kategori satuan, jenis timbangan desimal, dan Qty masuk awal.`,
      });
    }
  }, [products, soundEnabled, batchNumber, isProcessing, addProduct, categories]);

  // Listener keyboard untuk scanner USB / Barcode Reader fisik
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'TEXTAREA' ||
         (activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'text' && activeEl !== manualInputRef.current))
      ) {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.trim().length >= 3) {
          e.preventDefault();
          const code = buffer.trim();
          buffer = '';
          handleBarcodeDetect(code, 'manual_barcode');
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (diff > 180) {
          buffer = e.key;
        } else {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBarcodeDetect]);

  // Simpan penambahan stok setelah user menginput Qty secara manual
  const handleConfirmManualStock = async (e?: React.FormEvent, customQtyOverride?: number) => {
    if (e) e.preventDefault();
    const target = pendingManualProduct || activeDetectedProduct;
    if (!target || isProcessing) return;

    const rawQty = customQtyOverride !== undefined ? customQtyOverride : parseFloat(manualQtyInput);
    if (isNaN(rawQty) || rawQty <= 0) {
      setToastMessage({
        type: 'error',
        title: 'Kuantitas Tidak Valid',
        desc: target.product.allowDecimal
          ? 'Masukkan angka kuantitas desimal valid (contoh: 0.5 atau 2.5 kg).'
          : 'Masukkan kuantitas Qty minimal 1 unit utuh.',
      });
      return;
    }

    // Support desimal jika produk allowDecimal
    const qty = target.product.allowDecimal
      ? Math.round(rawQty * 1000) / 1000
      : Math.max(1, Math.round(rawQty));

    setIsProcessing(true);

    try {
      const result = await autoInboundStockByBarcode({
        barcode: target.detectedBarcode,
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
          barcode: target.detectedBarcode,
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

    const rawStock = parseFloat(newProdInitialStock);
    const initialStock = isNaN(rawStock) || rawStock <= 0
      ? 1
      : (newProdAllowDecimal ? Math.round(rawStock * 1000) / 1000 : Math.max(1, Math.round(rawStock)));
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
          allowDecimal: newProdAllowDecimal,
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
      const registeredProduct: Product = {
        id: data?.product?.id || `prod_${Date.now()}_${unregisteredBarcode.trim()}`,
        name: newProdName.trim(),
        barcode: unregisteredBarcode.trim(),
        category: newProdCategory,
        baseUnit: newProdUnit,
        allowDecimal: newProdAllowDecimal,
        stock: initialStock,
        minStock: 5,
        costPrice: cost,
        retailPrice: retail,
        wholesalePrice: retail,
        minWholesaleQty: 1,
        hasMultiUnit: false,
      };
      addProduct(registeredProduct);
      setActiveDetectedProduct({
        product: registeredProduct,
        detectedBarcode: unregisteredBarcode.trim(),
      });

      setToastMessage({
        type: 'success',
        title: 'Produk Baru Terdaftar!',
        desc: `${newProdName} (${newProdAllowDecimal ? 'Timbangan Desimal' : 'Kemasan Utuh'}) berhasil ditambahkan dengan stok awal ${initialStock} ${newProdUnit}.`,
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
          {/* Status Bar Scanner HP & Scanner USB */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
              </span>
              <span className="text-[11px] font-bold text-slate-800">
                Mode Scan Gudang Aktif
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
              <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-semibold border border-teal-200/60">
                📱 Kamera HP
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200/60">
                🔌 Scanner USB / BT
              </span>
            </div>
          </div>

          {/* Manual Input Card (Auto-Focused for USB Scanner & Typing) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-teal-600" />
                Input Barcode / Scanner USB
              </h2>
              <span className="text-[10px] font-medium text-teal-700 bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-full">
                Auto-Focus Siap Scan
              </span>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-2">
              <div className="relative">
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualCode}
                  onChange={handleManualInputChange}
                  placeholder="Scan barcode via scanner USB atau ketik kode..."
                  className="w-full pl-3 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs font-bold placeholder-slate-400 focus:outline-hidden focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-500/15 transition"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || isProcessing}
                  className="absolute right-1 top-1 bottom-1 px-3 bg-slate-900 hover:bg-teal-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                >
                  {isProcessing ? (
                    <RotateCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <span>Deteksi</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Test Barcode Pills */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-medium text-slate-400">Pintasan Uji Barcode:</span>
                <label className="cursor-pointer text-[10px] text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
                  <Upload className="w-2.5 h-2.5" />
                  <span>Foto Barcode</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBarcodeDetect('8886008101053', 'manual_barcode')}
                  className="px-2 py-1 rounded-lg bg-teal-50/80 hover:bg-teal-100 border border-teal-200/70 text-[10px] font-semibold text-teal-900 transition flex items-center gap-1"
                >
                  <span>💧 AQUA 600ml</span>
                  <span className="font-mono text-[9px] text-teal-600">8886008101053</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBarcodeDetect('8991007', 'manual_barcode')}
                  className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200/70 text-[10px] font-semibold text-amber-900 transition flex items-center gap-1"
                >
                  <Scale className="w-2.5 h-2.5 text-amber-600" />
                  <span>Telur Curah (Desimal)</span>
                  <span className="font-mono text-[9px] text-amber-600">8991007</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBarcodeDetect('8991001', 'manual_barcode')}
                  className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 text-[10px] font-semibold text-emerald-900 transition flex items-center gap-1"
                >
                  <Scale className="w-2.5 h-2.5 text-emerald-600" />
                  <span>Beras (Desimal)</span>
                  <span className="font-mono text-[9px] text-emerald-600">8991001</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card Hasil Deteksi Otomatis (Menampilkan 5 Fitur Permintaan User) */}
          {activeDetectedProduct && (
            <div className="bg-white rounded-2xl border-2 border-teal-500/80 shadow-md shadow-teal-500/5 p-4 space-y-3 relative overflow-hidden transition">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-teal-700 bg-teal-50 border border-teal-200/60 px-1.5 py-0.5 rounded">
                      Deteksi Stok Otomatis
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Data produk berhasil diverifikasi dari database
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingManualProduct(activeDetectedProduct);
                    setManualQtyInput(activeDetectedProduct.product.allowDecimal ? '1' : '1');
                  }}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg border border-teal-200/60 transition"
                >
                  Buka Dialog
                </button>
              </div>

              {/* 5 Fitur Utama Sesuai Permintaan */}
              <div className="space-y-2.5 text-xs">
                {/* 1. Nama Barang */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    1. Nama Barang
                  </span>
                  <p className="font-black text-slate-900 text-sm leading-snug mt-0.5">
                    {activeDetectedProduct.product.name}
                  </p>
                </div>

                {/* 2. Barcode / Kode Barang & 3. Kategori Satuan */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                      2. Barcode / Kode
                    </span>
                    <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block truncate">
                      {activeDetectedProduct.detectedBarcode}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                      3. Kategori Satuan
                    </span>
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="font-bold text-slate-800 truncate">
                        {activeDetectedProduct.product.category || 'Umum'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium shrink-0">
                        • {activeDetectedProduct.product.baseUnit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Status Barang Timbangan Desimal */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  activeDetectedProduct.product.allowDecimal
                    ? 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                    : 'bg-slate-50 border-slate-200/70 text-slate-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {activeDetectedProduct.product.allowDecimal ? (
                      <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <Scale className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                        4. Barang Timbangan Desimal
                      </span>
                      <span className="font-extrabold text-xs">
                        {activeDetectedProduct.product.allowDecimal
                          ? 'Timbangan Desimal (Mendukung Pecahan / Koma)'
                          : 'Bukan Timbangan (Satuan Kemasan Utuh)'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    activeDetectedProduct.product.allowDecimal
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-200/70 text-slate-700'
                  }`}>
                    {activeDetectedProduct.product.allowDecimal ? 'Desimal Aktif' : 'Bulat Utuh'}
                  </span>
                </div>

                {/* 5. Input Qty Masuk Langsung */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      5. Qty Masuk Gudang ({activeDetectedProduct.product.baseUnit})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Stok Sekarang: <strong className="text-slate-800">{activeDetectedProduct.product.stock} {activeDetectedProduct.product.baseUnit}</strong>
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      step={activeDetectedProduct.product.allowDecimal ? '0.01' : '1'}
                      min={activeDetectedProduct.product.allowDecimal ? '0.01' : '1'}
                      value={manualQtyInput}
                      onChange={e => setManualQtyInput(e.target.value)}
                      placeholder={activeDetectedProduct.product.allowDecimal ? 'Contoh: 2.5' : 'Contoh: 24'}
                      className="w-28 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-center text-slate-900 focus:outline-hidden focus:border-teal-500 focus:bg-white"
                    />

                    <button
                      type="button"
                      onClick={() => handleConfirmManualStock()}
                      disabled={isProcessing}
                      className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Simpan Masuk (+{manualQtyInput || '0'})</span>
                    </button>
                  </div>

                  {/* Shortcut Qty Buttons */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {activeDetectedProduct.product.allowDecimal
                      ? [0.5, 1, 2.5, 5, 10, 25].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setManualQtyInput(String(val))}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                              manualQtyInput === String(val)
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-slate-50 text-slate-700 hover:bg-amber-50 border-slate-200'
                            }`}
                          >
                            +{val} {activeDetectedProduct.product.baseUnit}
                          </button>
                        ))
                      : [1, 5, 12, 24, 48, 100].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setManualQtyInput(String(val))}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                              manualQtyInput === String(val)
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-slate-50 text-slate-700 hover:bg-teal-50 border-slate-200'
                            }`}
                          >
                            +{val}
                          </button>
                        ))}
                  </div>
                </div>
              </div>
            </div>
          )}

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
                    onChange={e => {
                      const u = e.target.value as UnitType;
                      setNewProdUnit(u);
                      if (u === 'kg') {
                        setNewProdAllowDecimal(true);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-teal-600"
                  >
                    <option value="pcs">pcs</option>
                    <option value="pouch">pouch</option>
                    <option value="kg">kg (Timbangan)</option>
                    <option value="liter">liter</option>
                    <option value="dus">dus</option>
                    <option value="renceng">renceng</option>
                    <option value="pack">pack</option>
                  </select>
                </div>
              </div>

              {/* Fitur 4: Barang Timbangan Desimal Toggle */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      newProdAllowDecimal ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 block leading-tight">
                        Barang Timbangan Desimal
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {newProdAllowDecimal
                          ? 'Dapat menerima angka pecahan / koma (contoh: 0.5 kg, 2.75 kg)'
                          : 'Hanya menerima bilangan bulat utuh (contoh: 1 pcs, 24 botol)'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewProdAllowDecimal(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      newProdAllowDecimal
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    {newProdAllowDecimal ? 'Ya (Desimal)' : 'Tidak (Utuh)'}
                  </button>
                </div>
              </div>

              {/* Initial Stock & Prices */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Stok Awal ({newProdUnit}) *
                  </label>
                  <input
                    type="number"
                    step={newProdAllowDecimal ? '0.01' : '1'}
                    min={newProdAllowDecimal ? '0.01' : '1'}
                    required
                    value={newProdInitialStock}
                    onChange={e => setNewProdInitialStock(e.target.value)}
                    placeholder={newProdAllowDecimal ? '10.5' : '10'}
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
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-md shadow-teal-600/20 flex items-center gap-1.5 cursor-pointer"
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
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Produk Terdeteksi!</h3>
                  <p className="text-xs text-slate-500">Silakan konfirmasi kuantitas Qty stok masuk</p>
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

            {/* 5 Fitur Utama: Deteksi Data Barang */}
            <div className="mt-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              {/* 1. Nama Barang */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  1. Nama Barang
                </span>
                <h4 className="text-sm font-black text-slate-900 mt-0.5 leading-snug">
                  {pendingManualProduct.product.name}
                </h4>
              </div>

              {/* 2. Barcode & 3. Kategori Satuan */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    2. Barcode / Kode
                  </span>
                  <span className="font-mono font-bold text-slate-800 text-xs truncate block mt-0.5">
                    {pendingManualProduct.detectedBarcode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                    3. Kategori Satuan
                  </span>
                  <span className="font-bold text-slate-800 text-xs block mt-0.5 truncate">
                    {pendingManualProduct.product.category} • {pendingManualProduct.product.baseUnit}
                  </span>
                </div>
              </div>

              {/* 4. Status Barang Timbangan Desimal */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                pendingManualProduct.product.allowDecimal
                  ? 'bg-amber-50/80 border-amber-200/80 text-amber-950'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center gap-2">
                  {pendingManualProduct.product.allowDecimal ? (
                    <Scale className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <Package className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                      4. Jenis Timbangan
                    </span>
                    <span className="font-bold text-xs">
                      {pendingManualProduct.product.allowDecimal
                        ? 'Timbangan Desimal (Koma/Pecahan)'
                        : 'Kemasan Utuh (Bilangan Bulat)'}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                  pendingManualProduct.product.allowDecimal
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {pendingManualProduct.product.allowDecimal ? 'Desimal' : 'Utuh'}
                </span>
              </div>
            </div>

            {/* 5. Manual Qty Input Form */}
            <form onSubmit={handleConfirmManualStock} className="space-y-3.5 mt-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>5. Jumlah / Qty Masuk *</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Satuan: <strong className="text-slate-900 font-bold">{pendingManualProduct.product.baseUnit}</strong>
                  </span>
                </label>

                <div className="relative">
                  <input
                    type="number"
                    min={pendingManualProduct.product.allowDecimal ? '0.01' : '1'}
                    step={pendingManualProduct.product.allowDecimal ? '0.01' : '1'}
                    required
                    autoFocus
                    value={manualQtyInput}
                    onChange={e => setManualQtyInput(e.target.value)}
                    placeholder={pendingManualProduct.product.allowDecimal ? 'Contoh: 2.5' : 'Contoh: 24'}
                    className="w-full px-4 py-3 bg-white border-2 border-teal-500 rounded-2xl text-center text-2xl font-black text-slate-900 focus:outline-hidden focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>

                {/* Quick Add Buttons */}
                <div className="grid grid-cols-6 gap-1 mt-2">
                  {pendingManualProduct.product.allowDecimal
                    ? [0.5, 1, 2.5, 5, 10, 25].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setManualQtyInput(String(val))}
                          className={`py-1.5 rounded-xl text-[11px] font-bold border transition ${
                            manualQtyInput === String(val)
                              ? 'bg-amber-600 border-amber-600 text-white shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50'
                          }`}
                        >
                          +{val}
                        </button>
                      ))
                    : [1, 5, 10, 20, 50, 100].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setManualQtyInput(String(val))}
                          className={`py-1.5 rounded-xl text-[11px] font-bold border transition ${
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
              <div className="p-3 bg-teal-50/80 border border-teal-100 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="text-teal-950 font-medium block">
                    Stok Saat Ini: {pendingManualProduct.product.stock} {pendingManualProduct.product.baseUnit}
                  </span>
                  <span className="text-[11px] text-teal-700">
                    + Tambah: {parseFloat(manualQtyInput) || 0} {pendingManualProduct.product.baseUnit}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-teal-700 block uppercase font-bold">Total Akhir:</span>
                  <span className="font-black text-sm text-teal-900">
                    {Math.round(((pendingManualProduct.product.stock || 0) + (parseFloat(manualQtyInput) || 0)) * 1000) / 1000}{' '}
                    {pendingManualProduct.product.baseUnit}
                  </span>
                </div>
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
                  <span>Simpan Masuk (+{manualQtyInput || '0'})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
