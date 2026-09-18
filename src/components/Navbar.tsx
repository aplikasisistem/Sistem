import React, { useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  Store, 
  LogOut, 
  ShoppingBag, 
  Package, 
  CreditCard, 
  BarChart3, 
  Settings, 
  Users, 
  DollarSign, 
  Clock, 
  AlertCircle,
  Tag,
  FileText,
  Cloud,
  CloudOff,
  Barcode,
  ChevronLeft,
  ChevronRight,
  Scale
} from 'lucide-react';
import { formatRupiah } from '../utils/formatters';

interface NavbarProps {
  currentTab?: string;
  setCurrentTab?: (tab: string) => void;
  onOpenShiftModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab = 'pos',
  setCurrentTab = (_tab: string) => {},
  onOpenShiftModal = () => {}
}) => {
  const { currentUser, logout, currentShift, isCloudConnected } = useStore();
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const scrollTabsLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };

  const scrollTabsRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };

  // Automatically scroll active tab into view
  useEffect(() => {
    if (!tabsContainerRef.current || !currentTab) return;
    const activeBtn = tabsContainerRef.current.querySelector(`#tab-${currentTab}`) as HTMLElement;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentTab]);

  if (!currentUser) return null;

  const role = currentUser.role;

  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return { label: 'Pemilik (Admin)', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'warehouse_admin':
        return { label: 'Admin Gudang (Inbound)', bg: 'bg-teal-100 text-teal-800 border-teal-300' };
      case 'gudang':
        return { label: 'User Gudang (In)', bg: 'bg-teal-100 text-teal-800 border-teal-300' };
      case 'kasir':
      default:
        return { label: 'User Kasir', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
  };

  const badge = getRoleBadge();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          {/* Logo & Store Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-700/20 shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none">
                  ALUNK STORE
                </span>
                <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                  {badge.label}
                </span>
                <span
                  title={isCloudConnected ? 'Database Cloud Terhubung Realtime' : 'Mode Offline / Memuat Cloud'}
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                    isCloudConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {isCloudConnected ? (
                    <>
                      <Cloud className="w-3 h-3 text-emerald-600 animate-pulse" />
                      <span>Cloud Realtime</span>
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-3 h-3 text-amber-600" />
                      <span>Offline / Syncing</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block mt-0.5">
                Sistem Manajemen Sembako Terintegrasi
              </p>
            </div>
          </div>

          {/* Center Info / Cash Drawer Shift Pill for Cashier */}
          {(role === 'kasir' || role === 'admin') && (
            <div className="hidden lg:flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs">
              <button
                type="button"
                id="btn-nav-shift-status"
                onClick={onOpenShiftModal}
                className="flex items-center gap-2 hover:opacity-80 transition cursor-pointer"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${currentShift ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="font-semibold text-slate-700">
                  {currentShift ? 'Sesi Kasir: Terbuka' : 'Sesi Kasir: Ditutup'}
                </span>
                {currentShift && (
                  <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                    Laci Kas: {formatRupiah(currentShift.expectedDrawerCash)}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Right User & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">{currentUser.name}</p>
              <p className="text-[11px] text-slate-500">@{currentUser.username}</p>
            </div>

            {(role === 'kasir' || role === 'admin') && (
              <button
                type="button"
                id="btn-shift-mobile"
                onClick={onOpenShiftModal}
                className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs flex items-center gap-1 font-semibold"
                title="Kelola Shift Kasir"
              >
                <Clock className="w-4 h-4 text-emerald-600" />
                <span className="hidden xs:inline">Shift</span>
              </button>
            )}

            <button
              type="button"
              id="btn-logout"
              onClick={logout}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Keluar / Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs based on Role with Shift/Scroll Buttons for Laptop/PC */}
        <div className="relative flex items-center border-t border-slate-100 pt-1 pb-2">
          {/* Tombol Pergeseran Kiri (Left Shift Button for Laptop/PC) */}
          <button
            type="button"
            id="btn-shift-tabs-left"
            onClick={scrollTabsLeft}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 border border-slate-200 transition-all shrink-0 mr-1.5 shadow-xs cursor-pointer active:scale-95 z-10 text-xs font-bold"
            title="Geser menu tab ke kiri"
            aria-label="Geser tab ke kiri"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden xl:inline text-[11px]">Geser</span>
          </button>

          {/* Scrollable Tabs Bar */}
          <div
            ref={tabsContainerRef}
            className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-0.5"
          >
            {/* Kasir Barcode Cepat (Accessible for Kasir, Gudang, Warehouse Admin, and Admin) */}
            {(role === 'kasir' || role === 'gudang' || role === 'warehouse_admin' || role === 'admin') && (
              <button
                type="button"
                id="tab-barcode-pos"
                onClick={() => setCurrentTab('barcode-pos')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  currentTab === 'barcode-pos'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Barcode className="w-4 h-4" />
                <span>Kasir Barcode Cepat</span>
              </button>
            )}

            {/* Kasir Tabs (POS Manual, History, Shift Reconciliation, Kasbon) */}
            {(role === 'kasir' || role === 'admin') && (
              <>
                <button
                  type="button"
                  id="tab-pos"
                  onClick={() => setCurrentTab('pos')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'pos'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Kasir Manual (POS)</span>
                </button>

                <button
                  type="button"
                  id="tab-history"
                  onClick={() => setCurrentTab('history')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'history'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Riwayat Hari Ini</span>
                </button>

                <button
                  type="button"
                  id="tab-shift-reconciliation"
                  onClick={() => setCurrentTab('shift-reconciliation')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'shift-reconciliation'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/20'
                      : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                  <span>Rekonsiliasi Shift Kasir</span>
                </button>

                <button
                  type="button"
                  id="tab-kasbon"
                  onClick={() => setCurrentTab('kasbon')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'kasbon'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Kasbon / Hutang Pelanggan</span>
                </button>
              </>
            )}

            {/* Gudang Tabs */}
            {(role === 'gudang' || role === 'warehouse_admin' || role === 'admin') && (
              <>
                <button
                  type="button"
                  id="tab-auto-stock-scanner"
                  onClick={() => setCurrentTab('auto-stock-scanner')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'auto-stock-scanner'
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-700/25'
                      : 'text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200'
                  }`}
                >
                  <Barcode className="w-4 h-4" />
                  <span>Input Stok Otomatis (Scan Gudang)</span>
                </button>

                <button
                  type="button"
                  id="tab-gudang"
                  onClick={() => setCurrentTab('gudang')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'gudang'
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Stok & Inventaris Sembako</span>
                </button>

                <button
                  type="button"
                  id="tab-supplier"
                  onClick={() => setCurrentTab('supplier')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'supplier'
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Penerimaan & Hutang Supplier</span>
                </button>
              </>
            )}

            {/* Admin Exclusive Tabs */}
            {role === 'admin' && (
              <>
                <button
                  type="button"
                  id="tab-overview"
                  onClick={() => setCurrentTab('overview')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'overview'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Ringkasan Keuangan</span>
                </button>

                <button
                  type="button"
                  id="tab-master-price"
                  onClick={() => setCurrentTab('master-price')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'master-price'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  <span>Master Harga (HPP/Grosir)</span>
                </button>

                <button
                  type="button"
                  id="tab-expenses"
                  onClick={() => setCurrentTab('expenses')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'expenses'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Arus Kas Non-Stok</span>
                </button>

                <button
                  type="button"
                  id="tab-reports"
                  onClick={() => setCurrentTab('reports')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'reports'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Laporan & PDF</span>
                </button>

                <button
                  type="button"
                  id="tab-users"
                  onClick={() => setCurrentTab('users')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    currentTab === 'users'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Kelola Akun</span>
                </button>
              </>
            )}
          </div>

          {/* Tombol Pergeseran Kanan (Right Shift Button for Laptop/PC) */}
          <button
            type="button"
            id="btn-shift-tabs-right"
            onClick={scrollTabsRight}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 border border-slate-200 transition-all shrink-0 ml-1.5 shadow-xs cursor-pointer active:scale-95 z-10 text-xs font-bold"
            title="Geser menu tab ke kanan"
            aria-label="Geser tab ke kanan"
          >
            <span className="hidden xl:inline text-[11px]">Geser</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
