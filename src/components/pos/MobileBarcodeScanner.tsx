import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import {
  Camera,
  CameraOff,
  Flashlight,
  SwitchCamera,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Printer,
  ShoppingBag,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Keyboard,
  RefreshCw,
  Zap,
  Info
} from 'lucide-react';
import { MockProduct, CashierCartItem, DEFAULT_MOCK_PRODUCTS } from './BarcodePosCashier';
import { formatRupiah } from '../../utils/formatters';

interface MobileBarcodeScannerProps {
  onBackToDesktop?: () => void;
  externalProducts?: MockProduct[];
}

export const MobileBarcodeScanner: React.FC<MobileBarcodeScannerProps> = ({
  onBackToDesktop,
  externalProducts
}) => {
  // Database
  const productDb = externalProducts && externalProducts.length > 0 ? externalProducts : DEFAULT_MOCK_PRODUCTS;

  // Camera & Scanner State
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isScanningCooldown, setIsScanningCooldown] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // Cart & Cashier State
  const [cart, setCart] = useState<CashierCartItem[]>([]);
  const [cashPaid, setCashPaid] = useState<number>(0);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertInfo, setAlertInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState(`TRX-${Date.now().toString().slice(-6)}`);

  // Manual Quantity Confirmation State (NO AUTO-INCREMENT)
  const [pendingScannedProduct, setPendingScannedProduct] = useState<MockProduct | null>(null);
  const [manualQtyInput, setManualQtyInput] = useState<string>('1');
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const lastScanTimestampRef = useRef<number>(0);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const alertTimeoutRef = useRef<any>(null);

  // Audio Feedback Synthesizer (Web Audio API)
  const playSound = useCallback((type: 'success' | 'error') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1950, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }, [soundEnabled]);

  const showAlert = useCallback((message: string, type: 'success' | 'error') => {
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    setAlertInfo({ message, type });
    alertTimeoutRef.current = setTimeout(() => {
      setAlertInfo(null);
    }, 3200);
  }, []);

  // Core Barcode Processor
  const handleDetectedCode = useCallback((rawCode: string) => {
    const cleanCode = rawCode.replace(/[\r\n\t]/g, '').trim();
    if (!cleanCode) return;

    // Cooldown check (prevent double scanning within 1.2 seconds)
    const now = Date.now();
    if (now - lastScanTimestampRef.current < 1200) {
      return;
    }
    lastScanTimestampRef.current = now;
    setIsScanningCooldown(true);
    setLastScannedCode(cleanCode);
    setTimeout(() => setIsScanningCooldown(false), 1200);

    // Lookup in database
    const matched = productDb.find(
      (p) => p.code === cleanCode || p.id.toLowerCase() === cleanCode.toLowerCase()
    );

    if (matched) {
      playSound('success');
      showAlert(`"${matched.name}" terdeteksi! Masukkan jumlah kuantitas.`, 'success');

      // Do NOT auto-increment. Store pending product and open manual quantity confirmation.
      setPendingScannedProduct(matched);
      setManualQtyInput('1');

      setTimeout(() => {
        if (qtyInputRef.current) {
          qtyInputRef.current.focus();
          qtyInputRef.current.select();
        }
      }, 100);
    } else {
      playSound('error');
      showAlert(`Barcode "${cleanCode}" belum terdaftar di sistem.`, 'error');
    }
  }, [productDb, playSound, showAlert]);

  // Handle Manual Confirmation of Quantity (NO AUTO-INCREMENT)
  const handleConfirmAddQuantity = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingScannedProduct) return;
    const qtyNumber = Math.max(1, parseInt(manualQtyInput, 10) || 1);

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.code === pendingScannedProduct.code);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].qty + qtyNumber;
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: newQty,
          subtotal: newQty * pendingScannedProduct.price
        };
        return updated;
      } else {
        return [
          {
            product: pendingScannedProduct,
            qty: qtyNumber,
            subtotal: qtyNumber * pendingScannedProduct.price
          },
          ...prev
        ];
      }
    });

    playSound('success');
    showAlert(`+${qtyNumber} "${pendingScannedProduct.name}" masuk keranjang!`, 'success');
    setPendingScannedProduct(null);
    setManualQtyInput('1');
  };

  // Stop camera tracks & active decoders cleanly
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch (err) {
        console.warn('ZXing reset warning:', err);
      }
      zxingReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.warn('Track stop error:', err);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
    setIsTorchOn(false);
    setIsTorchSupported(false);
  }, []);

  // Continuous Barcode Detection Engine
  const startBarcodeEngine = useCallback((videoElement: HTMLVideoElement) => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // Check Native BarcodeDetector (Chrome Android / modern WebKit)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        });

        scanIntervalRef.current = setInterval(async () => {
          if (!videoElement || videoElement.readyState < 2 || videoElement.paused) return;
          try {
            const barcodes = await barcodeDetector.detect(videoElement);
            if (barcodes && barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              if (code) {
                handleDetectedCode(code);
              }
            }
          } catch {
            // Continual frame pass
          }
        }, 200);
        return;
      } catch (e) {
        console.warn('Native BarcodeDetector init fallback:', e);
      }
    }

    // Universal fallback: ZXing MultiFormat Reader
    try {
      const zxing = new BrowserMultiFormatReader();
      zxingReaderRef.current = zxing;
      zxing.decodeFromVideoElementContinuously(videoElement, (result, err) => {
        if (result) {
          const text = result.getText();
          if (text) {
            handleDetectedCode(text);
          }
        }
      });
    } catch (zxingErr) {
      console.warn('ZXing initialization warning:', zxingErr);
    }
  }, [handleDetectedCode]);

  // Start Camera with userMedia constraints and video binding
  const startCamera = useCallback(async (modeToUse?: 'environment' | 'user') => {
    setCameraError(null);
    setIsCameraReady(false);

    // Clean previous streams
    stopCamera();

    const mode = modeToUse || facingMode;

    // 1. Insecure Context Check (Camera blocked on plain HTTP on mobile)
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setCameraError('Kamera hanya dapat diakses melalui koneksi aman (HTTPS atau localhost). Pastikan URL diawali https://');
      setIsCameraActive(false);
      return;
    }

    // 2. Hardware API Availability Check
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser ini tidak mendukung navigator.mediaDevices.getUserMedia untuk akses kamera.');
      setIsCameraActive(false);
      return;
    }

    const attachStreamToVideo = async (mediaStream: MediaStream) => {
      streamRef.current = mediaStream;
      setIsCameraActive(true);

      const video = videoRef.current;
      if (!video) return;

      // Ensure critical mobile attributes are set for iOS Safari & Android Chrome
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.muted = true;
      video.autoplay = true;

      // Bind stream directly to srcObject
      video.srcObject = mediaStream;

      // Invoke play()
      try {
        await video.play();
        setIsCameraReady(true);
      } catch (playErr) {
        console.warn('Immediate play blocked, binding to onloadedmetadata:', playErr);
        video.onloadedmetadata = () => {
          video.play()
            .then(() => setIsCameraReady(true))
            .catch((err) => {
              console.warn('Playback requires user gesture:', err);
              setIsCameraReady(true);
            });
        };
      }

      // Check flashlight/torch capability
      const track = mediaStream.getVideoTracks()[0];
      if (track && 'getCapabilities' in track) {
        try {
          const caps = (track as any).getCapabilities?.();
          if (caps && caps.torch) {
            setIsTorchSupported(true);
          }
        } catch {
          setIsTorchSupported(false);
        }
      }

      // Start decoding loop
      startBarcodeEngine(video);
    };

    try {
      // Prioritize rear camera (facingMode: { ideal: "environment" }) as requested
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      await attachStreamToVideo(mediaStream);
    } catch (err: any) {
      console.warn('Camera failed with ideal constraints, trying basic fallback:', err);
      try {
        // Fallback constraint
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        await attachStreamToVideo(fallbackStream);
      } catch (fallbackErr: any) {
        console.warn('Camera access could not be acquired:', fallbackErr);
        let errMsg = 'Gagal mengakses kamera.';
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          errMsg = 'Izin kamera belum diberikan atau diblokir oleh browser/perangkat.';
          setShowManualInput(true);
        } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
          errMsg = 'Kamera tidak ditemukan pada perangkat ini.';
          setShowManualInput(true);
        } else if (fallbackErr.name === 'NotReadableError' || fallbackErr.name === 'TrackStartError') {
          errMsg = 'Kamera sedang digunakan oleh aplikasi lain atau sistem operasi.';
        } else if (fallbackErr.name === 'OverconstrainedError') {
          errMsg = 'Konfigurasi kamera tidak didukung perangkat.';
        } else {
          errMsg = `Gagal menyalakan kamera: ${fallbackErr.message || 'Periksa izin kamera'}`;
        }
        setCameraError(errMsg);
        setIsCameraActive(false);
      }
    }
  }, [facingMode, stopCamera, startBarcodeEngine]);

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    if (!streamRef.current || !isTorchSupported) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && 'applyConstraints' in track) {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setIsTorchOn(nextState);
      }
    } catch (err) {
      console.error('Torch toggle error:', err);
    }
  };

  // Flip Camera (Front / Rear)
  const handleSwitchCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  // Lifecycle & Visibility cleanup (stops camera cleanly when tab or screen is hidden)
  useEffect(() => {
    startCamera(facingMode);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopCamera();
      } else if (document.visibilityState === 'visible') {
        startCamera(facingMode);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopCamera();
    };
  }, [facingMode, startCamera, stopCamera]);

  // Manual fallback input submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDetectedCode(manualInput);
    setManualInput('');
    if (manualInputRef.current) {
      manualInputRef.current.focus();
    }
  };

  // Cart Adjustments
  const handleQtyChange = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (!item) return prev;
      const nextQty = item.qty + delta;
      if (nextQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index] = {
        ...item,
        qty: nextQty,
        subtotal: nextQty * item.product.price
      };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setCashPaid(0);
    showAlert('Keranjang kasir dikosongkan.', 'success');
  };

  // Calculations
  const grandTotal = cart.reduce((sum, i) => sum + i.subtotal, 0);
  const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);
  const changeAmount = Math.max(0, cashPaid - grandTotal);

  // Print Thermal Receipt
  const handlePrint = () => {
    if (cart.length === 0) {
      showAlert('Keranjang masih kosong!', 'error');
      return;
    }
    if (cashPaid < grandTotal) {
      setCashPaid(grandTotal);
    }
    setInvoiceNumber(`TRX-${Date.now().toString().slice(-6)}`);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-slate-900 text-slate-100 flex flex-col pb-44 select-none font-sans overflow-x-hidden relative">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">Kasir Cepat Mobile</h1>
            <p className="text-[10px] text-emerald-400 font-medium">Auto-Detect Kamera HP</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`min-h-[40px] min-w-[40px] p-2 rounded-xl border flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
              soundEnabled ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-800/40 border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Suara scanner aktif' : 'Suara scanner hening'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {onBackToDesktop && (
            <button
              type="button"
              onClick={onBackToDesktop}
              className="min-h-[40px] text-xs bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl border border-slate-700 text-slate-300 font-bold cursor-pointer transition active:scale-95 flex items-center"
            >
              Mode Desktop
            </button>
          )}
        </div>
      </header>

      {/* Inline Alert Notification */}
      {alertInfo && (
        <div
          className={`fixed top-14 left-4 right-4 z-40 max-w-sm mx-auto p-3 rounded-xl border shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
            alertInfo.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500 text-rose-200'
          }`}
        >
          {alertInfo.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="truncate">{alertInfo.message}</span>
        </div>
      )}

      {/* SECTION 1: CAMERA VIEWPORT */}
      <section className="relative bg-black w-full overflow-hidden border-b border-slate-800 flex flex-col items-center justify-center">
        {/* Real HTML5 Mobile Video Element */}
        <div className="w-full h-64 sm:h-72 bg-black flex items-center justify-center relative overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isCameraReady ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Loading indicator while stream starts */}
          {!isCameraReady && !cameraError && isCameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-black/80">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <span className="text-[11px] font-medium text-slate-300">Menghubungkan kamera HP...</span>
            </div>
          )}

          {/* Camera Paused Overlay */}
          {!isCameraActive && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-950/90">
              <CameraOff className="w-8 h-8 text-slate-500" />
              <span className="text-xs font-semibold text-slate-300">Kamera Dijeda</span>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 cursor-pointer"
              >
                Aktifkan Kamera
              </button>
            </div>
          )}
        </div>

        {/* Visual Scanner Reticle & Laser Beam (Active when camera is scanning) */}
        {isCameraActive && isCameraReady && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            {/* Viewfinder Target Box */}
            <div className="relative w-64 h-40 rounded-2xl border-2 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

              {/* Laser Animation Bar */}
              <div
                className={`w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] ${
                  isScanningCooldown ? 'opacity-30' : 'animate-pulse'
                }`}
              />

              {/* Status text */}
              <div className="absolute -bottom-7 bg-black/75 px-3 py-0.5 rounded-full text-[10px] text-emerald-300 font-medium tracking-wide">
                {isScanningCooldown ? 'Memproses...' : 'Arahkan Barcode ke Kotak'}
              </div>
            </div>
          </div>
        )}

        {/* Error Fallback Panel */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-10 space-y-3 backdrop-blur-xs">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <CameraOff className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-300">{cameraError}</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                Anda dapat mencoba meminta izin ulang, menggunakan input kode barcode manual, atau membuka aplikasi di tab baru.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold cursor-pointer transition shadow-md shadow-emerald-700/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Izinkan Kamera</span>
              </button>
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold cursor-pointer transition border border-slate-700"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Input Manual</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.open(window.location.href, '_blank');
                  } catch {}
                }}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium cursor-pointer transition border border-slate-800"
                title="Buka langsung di tab baru browser"
              >
                <span>Tab Baru ↗</span>
              </button>
            </div>
          </div>
        )}

        {/* Camera Action Overlay Toolbar */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between z-20 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1 rounded-2xl border border-slate-800 shadow-lg">
            {isTorchSupported && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors cursor-pointer active:scale-90 ${
                  isTorchOn ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Lampu Senter / Flash"
              >
                <Flashlight className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleSwitchCamera}
              className="min-w-[44px] min-h-[44px] rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5 px-2.5 active:scale-90"
              title={`Ganti Kamera (${facingMode === 'environment' ? 'Belakang' : 'Depan'})`}
            >
              <SwitchCamera className="w-5 h-5" />
              <span className="text-xs font-semibold hidden xs:inline">{facingMode === 'environment' ? 'Belakang' : 'Depan'}</span>
            </button>

            <button
              type="button"
              onClick={() => (isCameraActive ? stopCamera() : startCamera(facingMode))}
              className="min-w-[44px] min-h-[44px] rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center active:scale-90"
              title={isCameraActive ? 'Jeda Kamera' : 'Aktifkan Kamera'}
            >
              {isCameraActive ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className={`min-h-[44px] flex items-center gap-2 px-4 rounded-2xl border text-xs font-bold backdrop-blur-md transition-all cursor-pointer shadow-lg active:scale-95 ${
              showManualInput
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-slate-950/85 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Ketik Kode</span>
          </button>
        </div>
      </section>

      {/* SECTION 2: FALLBACK MANUAL INPUT (Collapsible / Toggleable) */}
      {showManualInput && (
        <section className="bg-slate-950 px-4 py-3.5 border-b border-slate-800 animate-in fade-in duration-150">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={manualInputRef}
                type="text"
                autoFocus
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Scan barcode OTG / ketik kode..."
                className="w-full h-11 bg-slate-900 border border-slate-700 rounded-xl px-3.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] min-w-[70px] bg-emerald-600 hover:bg-emerald-500 active:scale-95 px-4 rounded-xl text-xs font-bold text-white cursor-pointer transition shadow-md shadow-emerald-700/20"
            >
              Cari
            </button>
          </form>

          {/* Quick Demo Chips */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-slate-400 shrink-0 text-[11px] font-semibold">Tes:</span>
            {['8999999123456', '8991001100123', '8886008101050', '8991001', '8991005'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => handleDetectedCode(code)}
                className="min-h-[32px] bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-300 px-2.5 py-1 rounded-lg border border-slate-700 shrink-0 font-mono text-xs font-medium cursor-pointer transition"
              >
                {code}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 3: TRANSACTION CART LIST */}
      <section className="flex-1 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Keranjang ({totalItems} Item)
            </h2>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={handleClearCart}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
            >
              Kosongkan
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
            <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500">
              <Barcode className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-300">Belum Ada Barang</p>
            <p className="text-[11px] text-slate-500 max-w-xs">
              Arahkan kamera ke barcode barang atau ketik kode barang secara manual.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item, index) => (
              <div
                key={`${item.product.code}-${index}`}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-white truncate">{item.product.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span className="font-mono text-emerald-400">{item.product.code}</span>
                    <span>•</span>
                    <span>{formatRupiah(item.product.price)}</span>
                  </div>
                  <p className="text-xs font-extrabold text-emerald-400 mt-1">
                    {formatRupiah(item.subtotal)}
                  </p>
                </div>

                {/* Qty Controls */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQtyChange(index, -1)}
                    className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer transition shadow-xs"
                    title="Kurangi kuantitas"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-white select-none">{item.qty}</span>
                  <button
                    type="button"
                    onClick={() => handleQtyChange(index, 1)}
                    className="min-w-[36px] min-h-[36px] w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-90 text-white flex items-center justify-center text-sm font-bold cursor-pointer transition shadow-xs shadow-emerald-700/20"
                    title="Tambah kuantitas"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-slate-900 active:scale-90 transition-all shrink-0 cursor-pointer"
                  title="Hapus barang"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quick Tips */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-slate-400">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Pindai barcode mendeteksi produk otomatis. Kuantitas ditentukan secara manual demi akurasi transaksi.
          </span>
        </div>
      </section>

      {/* MANUAL QUANTITY CONFIRMATION MODAL (NO AUTO-INCREMENT) */}
      {pendingScannedProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl space-y-4 text-slate-100">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-md">
                  Barcode Terdeteksi
                </span>
                <h3 className="text-sm font-bold text-white mt-1.5 leading-snug">
                  {pendingScannedProduct.name}
                </h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  SKU: {pendingScannedProduct.code} • {formatRupiah(pendingScannedProduct.price)} / item
                </p>
                <p className="text-[10px] text-emerald-400 mt-0.5 font-medium">
                  Stok Tersedia: {pendingScannedProduct.stock} unit
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingScannedProduct(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Manual Quantity Input Stepper */}
            <form onSubmit={handleConfirmAddQuantity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Masukkan Kuantitas Manual:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManualQtyInput(prev => String(Math.max(1, (parseInt(prev, 10) || 1) - 1)))}
                    className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-lg flex items-center justify-center border border-slate-700 transition cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    required
                    value={manualQtyInput}
                    onChange={e => setManualQtyInput(e.target.value)}
                    className="flex-1 h-12 bg-slate-950 border-2 border-emerald-500 rounded-2xl text-center font-bold text-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setManualQtyInput(prev => String((parseInt(prev, 10) || 0) + 1))}
                    className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-lg flex items-center justify-center border border-slate-700 transition cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Preset Quick Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {[1, 2, 5, 10, 12, 24].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setManualQtyInput(String(num))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      parseInt(manualQtyInput, 10) === num
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Subtotal Preview */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Subtotal:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {formatRupiah((parseInt(manualQtyInput, 10) || 1) * pendingScannedProduct.price)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingScannedProduct(null)}
                  className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 text-xs font-extrabold transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Konfirmasi Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 4: FIXED BOTTOM PAYMENT BAR */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 max-w-md mx-auto bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-4 space-y-3">
        {/* Quick Cash Buttons */}
        {cart.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-slate-400 text-[11px] font-semibold shrink-0">Uang:</span>
            <button
              type="button"
              onClick={() => setCashPaid(grandTotal)}
              className="min-h-[38px] bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 shrink-0 font-semibold cursor-pointer transition"
            >
              Uang Pas
            </button>
            {[20000, 50000, 100000, 200000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setCashPaid(amt)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border shrink-0 font-semibold cursor-pointer transition active:scale-95 ${
                  cashPaid === amt
                    ? 'bg-emerald-600 border-emerald-500 text-white font-bold shadow-md shadow-emerald-700/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {amt / 1000}k
              </button>
            ))}
          </div>
        )}

        {/* Total & Checkout button */}
        <div className="flex items-center justify-between gap-3">
          <div className="shrink-0">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Tagihan</p>
            <p className="text-lg font-black text-emerald-400 leading-tight">
              {formatRupiah(grandTotal)}
            </p>
            {cashPaid > 0 && (
              <p className="text-[10px] text-slate-400">
                Kembalian: <span className="text-white font-bold">{formatRupiah(changeAmount)}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handlePrint}
            disabled={cart.length === 0}
            className={`flex-1 min-h-[48px] flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-black shadow-lg transition-all cursor-pointer active:scale-98 ${
              cart.length > 0
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Bayar & Cetak</span>
          </button>
        </div>
      </footer>

      {/* HIDDEN PRINT-ONLY THERMAL RECEIPT (@media print) */}
      <div className="hidden print:block print:w-[58mm] print:text-black print:font-mono print:text-xs print:p-2 bg-white text-black">
        <div className="text-center pb-2 border-b border-dashed border-black">
          <h2 className="font-bold text-sm">ALUNK STORE</h2>
          <p className="text-[10px]">Toko Sembako & Kebutuhan Pokok</p>
          <p className="text-[10px]">Telp: 0812-3456-7890</p>
        </div>

        <div className="py-2 text-[10px] border-b border-dashed border-black space-y-0.5">
          <div className="flex justify-between">
            <span>No: {invoiceNumber}</span>
            <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div>Tgl: {new Date().toLocaleDateString('id-ID')}</div>
          <div>Kasir: Smartphone POS</div>
        </div>

        <div className="py-2 border-b border-dashed border-black space-y-1.5 text-[10px]">
          {cart.map((item, idx) => (
            <div key={idx}>
              <div className="font-semibold truncate">{item.product.name}</div>
              <div className="flex justify-between text-[9px] text-gray-700">
                <span>{item.qty} x {formatRupiah(item.product.price)}</span>
                <span className="font-bold">{formatRupiah(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="py-2 border-b border-dashed border-black text-[10px] space-y-1">
          <div className="flex justify-between">
            <span>Total Item:</span>
            <span className="font-bold">{totalItems}</span>
          </div>
          <div className="flex justify-between font-bold text-xs">
            <span>GRAND TOTAL:</span>
            <span>{formatRupiah(grandTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tunai:</span>
            <span>{formatRupiah(cashPaid || grandTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Kembali:</span>
            <span>{formatRupiah(changeAmount)}</span>
          </div>
        </div>

        <div className="text-center pt-3 text-[9px] space-y-1">
          <p>Terima kasih atas kunjungan Anda!</p>
          <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.</p>
        </div>
      </div>
    </div>
  );
};
