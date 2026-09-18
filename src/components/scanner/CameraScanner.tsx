import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, SwitchCamera, AlertTriangle, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

interface CameraScannerProps {
  buttonLabel?: string;
  onCapture: (base64Image: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
  instructionText?: string;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  buttonLabel = 'Scan Produk',
  onCapture,
  isProcessing = false,
  disabled = false,
  instructionText = 'Arahkan kamera ke kemasan produk atau label sembako',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Notice stopping track:', e);
        }
      });
      streamRef.current = null;
      setStream(null);
      setIsCameraReady(false);
    }
  }, []);

  // Start camera with requested facingMode
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setCameraError(null);
    setIsCameraReady(false);

    // Stop current stream before requesting new one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      streamRef.current = null;
    }

    // 1. Check secure context (HTTPS / localhost)
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setCameraError('Akses kamera memerlukan koneksi aman (HTTPS atau localhost). Pastikan URL menggunakan https://');
      setHasPermission(false);
      return;
    }

    // 2. Check getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser atau perangkat ini tidak mendukung akses kamera langsung (navigator.mediaDevices.getUserMedia).');
      setHasPermission(false);
      return;
    }

    const attachStreamToVideo = async (mediaStream: MediaStream) => {
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasPermission(true);

      const videoElement = videoRef.current;
      if (videoElement) {
        // Critical attributes for Mobile Safari and Chrome Android
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('webkit-playsinline', 'true');
        videoElement.muted = true;
        videoElement.autoplay = true;

        // Directly attach stream to srcObject
        videoElement.srcObject = mediaStream;

        // Invoke play() directly and also on metadata load
        try {
          await videoElement.play();
          setIsCameraReady(true);
        } catch (_playErr) {
          // Fallback: wait for onloadedmetadata
          videoElement.onloadedmetadata = () => {
            videoElement.play()
              .then(() => setIsCameraReady(true))
              .catch(err => {
                console.warn('Playback requires user gesture:', err);
                setIsCameraReady(true);
              });
          };
        }
      }
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
      console.warn('Camera access with ideal constraint not available, trying fallback:', err);

      // Fallback: try basic video constraint without specific facing mode
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        await attachStreamToVideo(fallbackStream);
      } catch (fallbackErr: any) {
        console.warn('Camera access could not be acquired:', fallbackErr);
        setHasPermission(false);
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          setCameraError('Izin akses kamera belum diberikan atau diblokir oleh peramban/perangkat.');
        } else if (fallbackErr.name === 'NotFoundError' || fallbackErr.name === 'DevicesNotFoundError') {
          setCameraError('Kamera tidak ditemukan pada perangkat ini.');
        } else if (fallbackErr.name === 'NotReadableError' || fallbackErr.name === 'TrackStartError') {
          setCameraError('Kamera sedang digunakan oleh aplikasi lain atau sistem operasi.');
        } else {
          setCameraError(`Kamera tidak dapat diakses: ${fallbackErr.message || 'Periksa pengaturan izin kamera'}`);
        }
      }
    }
  }, []);

  // Initial camera startup
  useEffect(() => {
    startCamera(facingMode);

    return () => {
      // Clean up on component unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [facingMode]);

  // Switch between front and rear camera
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Capture frame from video element
  const handleCapture = () => {
    if (!videoRef.current || isProcessing || disabled) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Visual flash effect on shutter
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 200);

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);

    // Get high-quality JPEG base64
    const base64Data = canvas.toDataURL('image/jpeg', 0.88);
    onCapture(base64Data);
  };

  // Fallback: Handle file upload from gallery / camera
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onCapture(reader.result);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = '';
  };

  return (
    <div className="w-full bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-800 text-white relative">
      {/* Hidden canvas for capturing frame */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for gallery fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Controls Bar */}
      <div className="p-3 bg-slate-950/70 backdrop-blur border-b border-slate-800/80 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200">
            {facingMode === 'environment' ? 'Kamera Belakang HP (Environment)' : 'Kamera Depan (User)'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleFacingMode}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition-colors"
            title="Ganti Kamera Depan / Belakang"
          >
            <SwitchCamera className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px]">Putar Kamera</span>
          </button>

          <button
            type="button"
            onClick={() => startCamera(facingMode)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition-colors"
            title="Muat Ulang Kamera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1 transition-colors"
            title="Unggah dari Galeri atau File"
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px]">Pilih Foto</span>
          </button>
        </div>
      </div>

      {/* Video Viewport with Scan Frame Overlay */}
      <div className="relative aspect-4/3 sm:aspect-16/9 bg-black flex items-center justify-center overflow-hidden">
        {/* Shutter flash animation */}
        {isFlashActive && (
          <div className="absolute inset-0 bg-white z-30 transition-opacity duration-200 opacity-90" />
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isCameraReady ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Scanning Target Crosshair / Viewfinder Frame */}
        {isCameraReady && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-10">
            {/* Center Reticle Box */}
            <div className="relative w-64 sm:w-80 h-48 sm:h-56 rounded-2xl border-2 border-dashed border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

              {/* Animated Laser Scanning Line */}
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#34d399] animate-pulse"
                style={{
                  top: '50%',
                  animation: 'scannerMove 2.4s ease-in-out infinite alternate',
                }}
              />

              <div className="bg-slate-950/60 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-medium text-emerald-300 border border-emerald-500/30">
                Posisikan Produk Sembako
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-300/90 text-center bg-slate-950/70 px-3 py-1 rounded-full backdrop-blur max-w-xs">
              {instructionText}
            </p>
          </div>
        )}

        {/* Loading Spinner when camera is initializing */}
        {!isCameraReady && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center z-10 bg-slate-900">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <div>
              <p className="text-sm font-semibold text-slate-200">Menghubungkan ke Kamera HP...</p>
              <p className="text-xs text-slate-400 mt-0.5">Meminta izin akses kamera belakang (WebRTC)</p>
            </div>
          </div>
        )}

        {/* Camera Permission / Error Fallback Screen */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center z-20 bg-slate-950/95 backdrop-blur-xs">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-100">Akses Kamera Belum Aktif</h4>
            <p className="text-xs text-slate-300 mt-1 max-w-sm mb-4 leading-relaxed">
              {cameraError}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-sm">
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-700/20 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Izinkan / Buka Kamera</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span>Ambil / Unggah Foto</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    window.open(window.location.href, '_blank');
                  } catch {
                    // ignore if blocked
                  }
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition border border-slate-800 cursor-pointer"
                title="Buka aplikasi langsung di tab peramban baru jika izin iframe dibatasi"
              >
                Buka di Tab Baru ↗
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Area: Tombol "Scan Produk" */}
      <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Deteksi AI Gemini Model 3.8 Flash otomatis mengenali barang</span>
        </div>

        <button
          type="button"
          id="btn-scan-product-action"
          disabled={isProcessing || disabled}
          onClick={() => {
            if (isCameraReady) {
              handleCapture();
            } else {
              // Fallback to native photo capture/gallery if camera is not active
              fileInputRef.current?.click();
            }
          }}
          className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
            isProcessing
              ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white shadow-emerald-700/30'
          }`}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Memproses dengan Gemini AI...</span>
            </>
          ) : isCameraReady ? (
            <>
              <Camera className="w-5 h-5 text-white" />
              <span>{buttonLabel}</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-5 h-5 text-emerald-300" />
              <span>Ambil / Unggah Foto Barang</span>
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes scannerMove {
          0% { top: 10%; }
          100% { top: 90%; }
        }
      `}</style>
    </div>
  );
};
