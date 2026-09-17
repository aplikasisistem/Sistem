import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { User, OperationalExpense, Product } from '../../types';
import { formatRupiah, formatDateTimeIndo, parseThousand } from '../../utils/formatters';
import FormattedNumberInput from '../common/FormattedNumberInput';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Layers, 
  Plus, 
  Receipt, 
  AlertCircle, 
  ShieldCheck, 
  Trash2, 
  Edit, 
  UserCheck, 
  Briefcase, 
  Calendar,
  Zap,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface AdminDashboardViewProps {
  initialTab?: 'overview' | 'expenses' | 'users' | 'prices';
  onTabChange?: (tab: 'overview' | 'expenses' | 'users' | 'prices') => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  initialTab = 'overview',
  onTabChange
}) => {
  const {
    products,
    transactions,
    expenses,
    addExpense,
    deleteExpense,
    users,
    addUser,
    updateUser,
    deleteUser,
    supplierPurchases,
    currentUser,
    deleteProduct,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'users' | 'prices'>(initialTab);

  // Deletion confirmation modal states
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<OperationalExpense | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabChange = (tab: 'overview' | 'expenses' | 'users' | 'prices') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Expense modal states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expCategory, setExpCategory] = useState<'listrik' | 'gaji' | 'plastik' | 'sewa' | 'lainnya'>('listrik');
  const [expAmount, setExpAmount] = useState('');
  const [expDescription, setExpDescription] = useState('');

  // User modal states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [uUsername, setUUsername] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uName, setUName] = useState('');
  const [uRole, setURole] = useState<'kasir' | 'gudang' | 'admin'>('kasir');

  // Price bulk editor search
  const [priceSearch, setPriceSearch] = useState('');
  const { updateProduct } = useStore();

  // Financial calculations
  const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);

  // Total COGS / HPP
  const totalCogs = transactions.reduce((sum, t) => {
    return (
      sum +
      t.items.reduce((itemSum, i) => {
        return itemSum + i.costPrice * i.quantity;
      }, 0)
    );
  }, 0);

  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;

  // Total stock asset valuation (HPP * stock)
  const totalStockValuation = products.reduce((sum, p) => sum + p.costPrice * p.stock, 0);

  // Piutang kasbon belum lunas
  const totalOutstandingPiutang = transactions
    .filter(t => t.paymentMethod === 'kasbon' && !t.isKasbonPaid)
    .reduce((sum, t) => sum + t.totalAmount, 0);

  // Chart data: 7 days mock or calculated
  const chartData = [
    { name: 'Sen', omset: 1850000, laba: 320000 },
    { name: 'Sel', omset: 2400000, laba: 480000 },
    { name: 'Rab', omset: 2100000, laba: 410000 },
    { name: 'Kam', omset: 2750000, laba: 550000 },
    { name: 'Jum', omset: 3200000, laba: 690000 },
    { name: 'Sab', omset: 4100000, laba: 840000 },
    { name: 'Min', omset: totalRevenue, laba: grossProfit },
  ];

  // Submit expense
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseThousand(expAmount);
    if (amt <= 0) return;

    addExpense({
      date: new Date().toISOString().slice(0, 10),
      category: expCategory,
      amount: amt,
      description: expDescription.trim(),
    });

    setExpAmount('');
    setExpDescription('');
    setIsExpenseModalOpen(false);
  };

  // Submit user
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uUsername.trim() || !uPassword.trim() || !uName.trim()) return;

    if (editingUser) {
      updateUser({
        ...editingUser,
        username: uUsername.trim(),
        password: uPassword.trim(),
        name: uName.trim(),
        role: uRole,
        isActive: true,
      });
    } else {
      addUser({
        username: uUsername.trim(),
        password: uPassword.trim(),
        name: uName.trim(),
        role: uRole,
        isActive: true,
      });
    }

    setIsUserModalOpen(false);
  };

  const openNewUserModal = () => {
    setEditingUser(null);
    setUUsername('');
    setUPassword('');
    setUName('');
    setURole('kasir');
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    setUUsername(u.username);
    setUPassword(u.password);
    setUName(u.name);
    setURole(u.role);
    setIsUserModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Panel Manajemen Pemilik (Admin / Owner)</span>
          </div>
          <h2 className="text-2xl font-black">Sistem Manajemen Sembako - Pandir Store</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Kontrol penuh atas keuangan, master harga sembako, dan otorisasi staf toko.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpenseModalOpen(true)}
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pengeluaran</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => handleTabChange('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Ringkasan Keuangan
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('expenses')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Pengeluaran Operasional ({expenses.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'users'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Kelola Pengguna & Staf ({users.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('prices')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'prices'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Master Harga Pokok & Jual
        </button>
      </div>

      {/* TAB 1: FINANCIAL OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total Omset Penjualan
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-slate-900">
                  {formatRupiah(totalRevenue)}
                </span>
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-2">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Dari {transactions.length} transaksi toko</span>
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Laba Kotor (Gross Profit)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-emerald-700">
                  {formatRupiah(grossProfit)}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2 block">
                Total HPP: {formatRupiah(totalCogs)}
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Beban Operasional
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-rose-700">
                  {formatRupiah(totalExpenses)}
                </span>
              </div>
              <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-0.5 mt-2">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Listrik, gaji, plastik & lainnya</span>
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-emerald-300 shadow-xs bg-emerald-50/40">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                Laba Bersih (Net Profit)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-emerald-800">
                  {formatRupiah(netProfit)}
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 mt-2 block font-semibold">
                Laba kotor dikurangi biaya operasional
              </span>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Nilai Aset Stok Sembako di Toko
                </span>
                <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
                  {formatRupiah(totalStockValuation)}
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dihitung berdasarkan HPP barang x sisa stok fisik
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Piutang Kasbon Pelanggan Tertahan
                </span>
                <span className="text-xl font-black font-mono text-amber-700 mt-1 block">
                  {formatRupiah(totalOutstandingPiutang)}
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uang tertahan di pelanggan yang belum dilunasi
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <Receipt className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Grafik Omset & Laba 7 Hari Terakhir</h3>
                <p className="text-xs text-slate-500">Pertumbuhan penjualan sembako harian Pandir Store</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
                  <span className="text-slate-600 font-medium">Omset Penjualan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-teal-400 inline-block" />
                  <span className="text-slate-600 font-medium">Estimasi Laba</span>
                </div>
              </div>
            </div>

            {/* Custom Bar & Trend Visualizer */}
            <div className="pt-4">
              <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-52 pb-6 border-b border-slate-150">
                {chartData.map((d, i) => {
                  const maxVal = Math.max(...chartData.map(c => c.omset), 5000000);
                  const omsetHeightPct = Math.max(15, Math.min(100, Math.round((d.omset / maxVal) * 100)));
                  const labaHeightPct = Math.max(8, Math.min(omsetHeightPct, Math.round((d.laba / maxVal) * 100)));

                  return (
                    <div key={i} className="flex flex-col items-center h-full justify-end group relative cursor-pointer">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20 bg-slate-900 text-white text-[11px] p-2 rounded-xl shadow-lg whitespace-nowrap">
                        <div className="font-bold text-emerald-400">{d.name}: {formatRupiah(d.omset)}</div>
                        <div className="text-teal-300 text-[10px]">Laba: {formatRupiah(d.laba)}</div>
                      </div>

                      {/* Stacked bars */}
                      <div className="w-full max-w-[40px] flex items-end justify-center gap-1 h-full">
                        {/* Omset Bar */}
                        <div
                          style={{ height: `${omsetHeightPct}%` }}
                          className="w-full bg-emerald-600 group-hover:bg-emerald-700 rounded-t-lg transition-all relative overflow-hidden"
                        >
                          <div
                            style={{ height: `${(labaHeightPct / omsetHeightPct) * 100}%` }}
                            className="w-full bg-emerald-400/80 absolute bottom-0"
                          />
                        </div>
                      </div>

                      {/* Day Label */}
                      <span className="text-xs font-bold text-slate-600 mt-2.5">{d.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:block">
                        {(d.omset / 1000000).toFixed(1)}jt
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-3">
                <span>Rata-rata Penjualan Harian: <strong>Rp 2.800.000</strong></span>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">
                  Target Mingguan Tercapai (104%)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OPERATIONAL EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Beban Biaya Operasional Toko</h3>
              <p className="text-xs text-slate-500">
                Pencatatan pengeluaran arus kas keluar (listrik, gaji karyawan, plastik kantong, sewa tempat, dll)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(true)}
              className="py-2.5 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Biaya</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Kategori Pengeluaran</th>
                  <th className="py-3 px-4">Deskripsi / Keterangan</th>
                  <th className="py-3 px-4 text-right">Nominal Biaya</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      Belum ada catatan pengeluaran operasional.
                    </td>
                  </tr>
                ) : (
                  expenses.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-medium">{e.date}</td>
                      <td className="py-3.5 px-4">
                        <span className="capitalize font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md text-[11px]">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{e.description}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-rose-700 text-sm">
                        {formatRupiah(e.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          id={`btn-delete-expense-${e.id}`}
                          onClick={() => setExpenseToDelete(e)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition cursor-pointer inline-flex items-center justify-center"
                          title="Hapus Pengeluaran Ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Manajemen Hak Akses Akun Staf</h3>
              <p className="text-xs text-slate-500">
                Kelola login staf untuk 3 peran: Kasir (POS & shift), Gudang (stok & supplier), Admin (pemilik/manajer)
              </p>
            </div>
            <button
              type="button"
              onClick={openNewUserModal}
              className="py-2.5 px-3.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pengguna</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {users.map(u => (
              <div
                key={u.id}
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3 relative group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{u.name}</h4>
                    <span className="text-xs text-slate-500 font-mono">@{u.username}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    u.role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : u.role === 'gudang'
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {u.role}
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-150 space-y-1">
                  <div className="flex justify-between">
                    <span>Password:</span>
                    <span className="font-mono text-slate-500">••••••</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Otoritas:</span>
                    <span>
                      {u.role === 'kasir' && 'POS & Shift Harian'}
                      {u.role === 'gudang' && 'Stok & Supplier'}
                      {u.role === 'admin' && 'Akses Penuh Owner'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openEditUserModal(u)}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                    title="Edit Staf"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  {currentUser?.id === u.id ? (
                    <button
                      type="button"
                      disabled
                      className="p-1.5 rounded-lg text-slate-300 cursor-not-allowed opacity-50"
                      title="Tidak dapat menghapus akun Anda sendiri yang sedang aktif"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      id={`btn-delete-user-${u.id}`}
                      onClick={() => setUserToDelete(u)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                      title="Hapus Staf"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MASTER PRICE EDITOR */}
      {activeTab === 'prices' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Master Harga Pokok (HPP) & Harga Jual</h3>
              <p className="text-xs text-slate-500">
                Pengaturan harga hanya dapat diakses oleh Admin. Kasir tidak memiliki wewenang mengubah harga ini.
              </p>
            </div>
            <input
              type="text"
              value={priceSearch}
              onChange={e => setPriceSearch(e.target.value)}
              placeholder="Cari barang sembako..."
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-full sm:w-64"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Barang Sembako</th>
                  <th className="py-3 px-4">Satuan</th>
                  <th className="py-3 px-4 text-right">HPP (Harga Beli)</th>
                  <th className="py-3 px-4 text-right">Harga Eceran</th>
                  <th className="py-3 px-4 text-right">Harga Grosir/Partai</th>
                  <th className="py-3 px-4 text-right">Margin Laba Eceran</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products
                  .filter(p => !priceSearch || p.name.toLowerCase().includes(priceSearch.toLowerCase()))
                  .map(p => {
                    const profitMargin = p.retailPrice - p.costPrice;
                    const marginPct = p.costPrice > 0 ? (profitMargin / p.costPrice) * 100 : 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                        <td className="py-3 px-4 text-slate-600">{p.baseUnit}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {formatRupiah(p.costPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(p.retailPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-teal-800">
                          {formatRupiah(p.wholesalePrice)} (min. {p.minWholesaleQty})
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          +{formatRupiah(profitMargin)} ({marginPct.toFixed(1)}%)
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            id={`btn-delete-product-${p.id}`}
                            onClick={() => setProductToDelete(p)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition cursor-pointer inline-flex items-center justify-center"
                            title="Hapus Barang Sembako"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD OPERATIONAL EXPENSE */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-base mb-1">Catat Beban Operasional</h3>
            <p className="text-xs text-slate-500 mb-4">Pengeluaran ini akan mengurangi laba bersih toko.</p>

            <form onSubmit={handleSaveExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kategori Pengeluaran *
                </label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                >
                  <option value="listrik">Listrik, Air & Internet Toko</option>
                  <option value="gaji">Gaji / Insentif Karyawan</option>
                  <option value="plastik">Plastik Kresek / Kantong Sembako</option>
                  <option value="sewa">Sewa Ruko / Tempat</option>
                  <option value="lainnya">Biaya Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nominal Pengeluaran (Rp) *
                </label>
                <FormattedNumberInput
                  required
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                  placeholder="50.000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan Lengkap *
                </label>
                <input
                  type="text"
                  required
                  value={expDescription}
                  onChange={e => setExpDescription(e.target.value)}
                  placeholder="Contoh: Beli token listrik PLN 100rb"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
                >
                  Simpan Beban
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT USER */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-slate-900 text-base mb-1">
              {editingUser ? 'Edit Staf Pengguna' : 'Tambah Staf Pengguna'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">Pengaturan otorisasi dan kata sandi login staf.</p>

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Staf *
                </label>
                <input
                  type="text"
                  required
                  value={uName}
                  onChange={e => setUName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username Login *
                </label>
                <input
                  type="text"
                  required
                  value={uUsername}
                  onChange={e => setUUsername(e.target.value)}
                  placeholder="kasir1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi *
                </label>
                <input
                  type="text"
                  required
                  value={uPassword}
                  onChange={e => setUPassword(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Peran (Role) Akses *
                </label>
                <select
                  value={uRole}
                  onChange={e => setURole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                >
                  <option value="kasir">Kasir (POS, Scan & Sesi Shift Harian)</option>
                  <option value="gudang">Gudang / Petugas Stok (Penerimaan Supplier & Opname)</option>
                  <option value="admin">Admin / Pemilik Toko (Akses Seluruh Fitur)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Simpan Staf
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE USER */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-900">Hapus Akun Staf Pengguna?</h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus akun <strong className="text-slate-800">{userToDelete.name}</strong> (<span className="font-mono text-slate-600">@{userToDelete.username}</span>) dengan peran <span className="capitalize font-bold text-slate-700">{userToDelete.role}</span>?
              </p>
              <p className="text-[11px] text-rose-600 font-medium bg-rose-50 p-2 rounded-xl border border-rose-150">
                Akun ini tidak akan dapat login lagi ke sistem.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-user"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-delete-user"
                onClick={() => {
                  deleteUser(userToDelete.id);
                  setUserToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Ya, Hapus Staf
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE EXPENSE */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-900">Hapus Beban Operasional?</h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus catatan biaya kategori <strong className="capitalize text-slate-800">{expenseToDelete.category}</strong>:
              </p>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-left space-y-1">
                <div className="text-xs text-slate-600">Keterangan: <span className="font-semibold text-slate-800">{expenseToDelete.description}</span></div>
                <div className="text-xs text-slate-600">Tanggal: <span className="font-semibold text-slate-800">{expenseToDelete.date}</span></div>
                <div className="text-xs text-slate-600">Nominal: <span className="font-mono font-black text-rose-700 text-sm">{formatRupiah(expenseToDelete.amount)}</span></div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-expense"
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-delete-expense"
                onClick={() => {
                  deleteExpense(expenseToDelete.id);
                  setExpenseToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Ya, Hapus Beban
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: DELETE PRODUCT */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-900">Hapus Barang Sembako?</h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus barang <strong className="text-slate-800">{productToDelete.name}</strong> dari master data toko?
              </p>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-left space-y-1 text-xs text-slate-600">
                <div>Satuan: <span className="font-semibold text-slate-800">{productToDelete.baseUnit}</span></div>
                <div>Harga Jual: <span className="font-mono font-bold text-slate-800">{formatRupiah(productToDelete.retailPrice)}</span></div>
                <div>Sisa Stok: <span className="font-mono font-bold text-slate-800">{productToDelete.stock} {productToDelete.baseUnit}</span></div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-product"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-delete-product"
                onClick={() => {
                  deleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Ya, Hapus Barang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
