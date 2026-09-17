import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Eye, EyeOff, Store, UserCircle, ArrowRight, MapPin, Phone, CheckCircle2 } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    setTimeout(() => {
      const success = login(username.trim(), password.trim());
      setIsLoading(false);
      if (!success) {
        setErrorMsg('Username atau kata sandi tidak cocok! Silakan periksa kembali.');
      }
    }, 300);
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-900">
      {/* Background Graphic Elements */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-luminosity scale-105"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.15), rgba(15, 23, 42, 0.95)), url('https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1920&q=80')`
        }}
      />
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-lg bg-slate-900/90 backdrop-blur-xl border border-slate-700/70 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/30 mb-3 ring-4 ring-emerald-500/20">
            <Store className="w-8 h-8" />
          </div>
          
          <div className="space-y-1.5">
            <div className="inline-block">
              <span className="text-xs font-black tracking-wider text-emerald-400 uppercase bg-emerald-950/80 px-3.5 py-1 rounded-full border border-emerald-800/70">
                ALUNK STORE
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Sistem Manajemen Sembako Terintegrasi
            </h1>
          </div>

          {/* Store Address Card */}
          <div className="mt-4 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col items-center justify-center space-y-2.5 text-center">
            <div className="flex items-start justify-center gap-2 text-xs text-slate-300 max-w-md mx-auto leading-relaxed text-left">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-snug text-slate-300">
                Jl. Tambak Pamarayan, Kp. Kedung Sapi Masjid RT. 009 / RW 003, Desa Kp. Baru, Kec. Pamarayan, Serang - Banten
              </span>
            </div>
            <div className="inline-flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/50 px-3 py-1 rounded-full">
              <Phone className="w-3.5 h-3.5" />
              <span>+62821-2584-5237</span>
            </div>
          </div>
        </div>

        {/* Form Login */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Username Pengguna
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserCircle className="w-5 h-5" />
              </div>
              <input
                id="login-username"
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masukkan username staf..."
                className="w-full pl-11 pr-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Kata Sandi (Password)
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi..."
                className="w-full pl-4 pr-12 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                id="btn-toggle-password-visibility"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? "Sembunyikan sandi" : "Lihat sandi"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="btn-login-submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-700/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-70"
          >
            {isLoading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Masuk ke Sistem</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Feature Highlights */}
        <div className="mt-6 pt-4 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Konversi Satuan & Multi-Kemasan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Manajemen Kasbon & Hutang</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Laporan Keuangan & Laba Bersih</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Cetak Struk & Ekspor PDF</span>
          </div>
        </div>
      </div>
    </div>
  );
};
