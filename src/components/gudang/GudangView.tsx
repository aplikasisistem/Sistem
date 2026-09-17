import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, UnitType } from '../../types';
import { formatRupiah, formatNumber, getDaysUntilExpired, formatDateIndo } from '../../utils/formatters';
import { 
  Package, 
  Plus, 
  AlertTriangle, 
  Calendar, 
  Scale, 
  Box, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  ClipboardCheck, 
  Search,
  CheckCircle2,
  X,
  Clock
} from 'lucide-react';

export const GudangView: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    performStockOpname,
    recordDamageOrReturn,
    stockOpnames,
    damageLogs,
    currentUser,
    categories: storeCategories,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'inventory' | 'near-expiry' | 'opname' | 'damage'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Modals state
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [opnameTargetProduct, setOpnameTargetProduct] = useState<Product | null>(null);
  const [damageTargetProduct, setDamageTargetProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Form states for Add / Edit product
  const [pName, setPName] = useState('');
  const [pBarcode, setPBarcode] = useState('');
  const [pCategory, setPCategory] = useState('Minyak Goreng');
  const [pBaseUnit, setPBaseUnit] = useState<UnitType>('pcs');
  const [pAllowDecimal, setPAllowDecimal] = useState(false);
  const [pStock, setPStock] = useState('0');
  const [pMinStock, setPMinStock] = useState('10');
  const [pCostPrice, setPCostPrice] = useState('0');
  const [pRetailPrice, setPRetailPrice] = useState('0');
  const [pWholesalePrice, setPWholesalePrice] = useState('0');
  const [pMinWholesaleQty, setPMinWholesaleQty] = useState('12');
  const [pHasMultiUnit, setPHasMultiUnit] = useState(false);
  const [pBoxUnitName, setPBoxUnitName] = useState('Dus');
  const [pBoxRatio, setPBoxRatio] = useState('12');
  const [pBoxWholesalePrice, setPBoxWholesalePrice] = useState('');
  const [pExpiredDate, setPExpiredDate] = useState('');

  // Opname form
  const [opnamePhysicalStock, setOpnamePhysicalStock] = useState('');
  const [opnameReason, setOpnameReason] = useState('');

  // Damage form
  const [damageQty, setDamageQty] = useState('');
  const [damageReason, setDamageReason] = useState<'rusak' | 'kadaluwarsa' | 'retur'>('rusak');
  const [damageNotes, setDamageNotes] = useState('');

  const categories = ['Semua', ...Array.from(new Set(products.map(p => p.category)))];

  // Expired alerts calculation (H-30)
  const nearExpiryProducts = products.filter(p => {
    const status = getDaysUntilExpired(p.expiredDate);
    return status && (status.isNearExpired || status.isExpired);
  });

  const lowStockProducts = products.filter(p => p.stock <= p.minStock);

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchQuery =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchQuery && matchCat;
  });

  // Open Add Product Modal
  const openNewProductModal = () => {
    setEditingProduct(null);
    setPName('');
    setPBarcode(`899${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    setPCategory('Beras & Biji-bijian');
    setPBaseUnit('kg');
    setPAllowDecimal(true);
    setPStock('50');
    setPMinStock('10');
    setPCostPrice('12000');
    setPRetailPrice('15000');
    setPWholesalePrice('14000');
    setPMinWholesaleQty('25');
    setPHasMultiUnit(false);
    setPBoxUnitName('Dus');
    setPBoxRatio('12');
    setPBoxWholesalePrice('');
    setPExpiredDate('');
    setIsAddProductOpen(true);
  };

  // Open Edit Product Modal
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setPName(p.name);
    setPBarcode(p.barcode);
    setPCategory(p.category);
    setPBaseUnit(p.baseUnit);
    setPAllowDecimal(p.allowDecimal);
    setPStock(p.stock.toString());
    setPMinStock(p.minStock.toString());
    setPCostPrice(p.costPrice.toString());
    setPRetailPrice(p.retailPrice.toString());
    setPWholesalePrice(p.wholesalePrice.toString());
    setPMinWholesaleQty(p.minWholesaleQty.toString());
    setPHasMultiUnit(p.hasMultiUnit);
    setPBoxUnitName(p.boxUnitName || 'Dus');
    setPBoxRatio((p.boxConversionRatio || 12).toString());
    setPBoxWholesalePrice(p.boxWholesalePrice ? p.boxWholesalePrice.toString() : '');
    setPExpiredDate(p.expiredDate || '');
    setIsAddProductOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();

    const productPayload: Omit<Product, 'id'> = {
      name: pName.trim(),
      barcode: pBarcode.trim(),
      category: pCategory,
      baseUnit: pBaseUnit,
      allowDecimal: pAllowDecimal,
      stock: parseFloat(pStock) || 0,
      minStock: parseFloat(pMinStock) || 0,
      costPrice: parseFloat(pCostPrice) || 0,
      retailPrice: parseFloat(pRetailPrice) || 0,
      wholesalePrice: parseFloat(pWholesalePrice) || 0,
      minWholesaleQty: parseFloat(pMinWholesaleQty) || 1,
      hasMultiUnit: pHasMultiUnit,
      boxUnitName: pHasMultiUnit ? pBoxUnitName : undefined,
      boxConversionRatio: pHasMultiUnit ? parseFloat(pBoxRatio) || 1 : undefined,
      boxWholesalePrice: pHasMultiUnit && pBoxWholesalePrice ? parseFloat(pBoxWholesalePrice) : undefined,
      expiredDate: pExpiredDate || undefined,
    };

    if (editingProduct) {
      updateProduct({
        ...productPayload,
        id: editingProduct.id,
      });
    } else {
      addProduct(productPayload);
    }

    setIsAddProductOpen(false);
  };

  // Stock Opname Submit
  const handleConfirmOpname = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opnameTargetProduct) return;
    const physical = parseFloat(opnamePhysicalStock) || 0;
    performStockOpname(opnameTargetProduct.id, physical, opnameReason.trim());
    setOpnameTargetProduct(null);
    setOpnamePhysicalStock('');
    setOpnameReason('');
  };

  // Damage / Return Submit
  const handleConfirmDamage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageTargetProduct) return;
    const qty = parseFloat(damageQty) || 0;
    recordDamageOrReturn(damageTargetProduct.id, qty, damageReason, damageNotes.trim());
    setDamageTargetProduct(null);
    setDamageQty('');
    setDamageNotes('');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      {/* Gudang Header & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Jenis Barang
            </span>
            <span className="text-xl font-black font-mono text-slate-900">
              {products.length} Item
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Stok Menipis (&le; Min)
            </span>
            <span className="text-xl font-black font-mono text-amber-700">
              {lowStockProducts.length} Item
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Peringatan Kadaluwarsa (H-30)
            </span>
            <span className="text-xl font-black font-mono text-rose-700">
              {nearExpiryProducts.length} Item
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Aksi Cepat
            </span>
            <span className="text-xs font-semibold text-slate-700">Petugas: {currentUser?.name}</span>
          </div>
          <button
            type="button"
            id="btn-add-new-product"
            onClick={openNewProductModal}
            className="py-2.5 px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Katalog Stok Sembako ({products.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('near-expiry')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'near-expiry'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Kadaluwarsa H-30 ({nearExpiryProducts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('opname')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'opname'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Riwayat Stock Opname ({stockOpnames.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('damage')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'damage'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Barang Rusak / Retur ({damageLogs.length})
        </button>
      </div>

      {/* TAB 1: MAIN INVENTORY CATALOG */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Search & Category Filter */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari barcode atau nama barang..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
              {categories.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCategory(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === c
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Product Inventory Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Barang Sembako</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Konversi Satuan</th>
                    <th className="py-3 px-4 text-right">Sisa Stok</th>
                    <th className="py-3 px-4">Kadaluwarsa</th>
                    <th className="py-3 px-4 text-center">Aksi Gudang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map(p => {
                    const isLow = p.stock <= p.minStock;
                    const expStatus = getDaysUntilExpired(p.expiredDate);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Barcode: {p.barcode}</span>
                            {p.allowDecimal && (
                              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-sans font-bold flex items-center gap-0.5">
                                <Scale className="w-3 h-3" /> Timbang (Desimal)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {p.hasMultiUnit && p.boxConversionRatio ? (
                            <div className="text-[11px] text-teal-800 font-semibold bg-teal-50 border border-teal-200 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                              <Box className="w-3 h-3" />
                              <span>
                                1 {p.boxUnitName || 'Dus'} = {p.boxConversionRatio} {p.baseUnit}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Satuan Tunggal ({p.baseUnit})</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono font-bold text-sm text-slate-900">
                            {formatNumber(p.stock)} {p.baseUnit}
                          </div>
                          {isLow ? (
                            <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                              Menipis! (Min: {p.minStock})
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Aman (Min: {p.minStock})</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {p.expiredDate ? (
                            <div>
                              <div className="font-medium text-slate-700">{formatDateIndo(p.expiredDate)}</div>
                              {expStatus && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded inline-block mt-0.5 ${
                                  expStatus.isExpired
                                    ? 'bg-rose-100 text-rose-800'
                                    : expStatus.isNearExpired
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'text-slate-400'
                                }`}>
                                  {expStatus.label}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1">
                            {/* Stock Opname Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setOpnameTargetProduct(p);
                                setOpnamePhysicalStock(p.stock.toString());
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 transition"
                              title="Stock Opname (Sesuaikan Stok Fisik)"
                            >
                              <ClipboardCheck className="w-4 h-4" />
                            </button>

                            {/* Mark Damaged / Expired */}
                            <button
                              type="button"
                              onClick={() => {
                                setDamageTargetProduct(p);
                                setDamageQty('1');
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 transition"
                              title="Catat Barang Rusak / Kadaluwarsa / Retur"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            {/* Edit Product */}
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                              title="Edit Data Barang"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete Product (admin only or warehouse) */}
                            {currentUser?.role === 'admin' && (
                              <button
                                type="button"
                                id={`btn-gudang-delete-product-${p.id}`}
                                onClick={() => setProductToDelete(p)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                                title="Hapus Barang"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NEAR EXPIRY H-30 ALERT LIST */}
      {activeTab === 'near-expiry' && (
        <div className="bg-white rounded-3xl border border-rose-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Peringatan Dini Produk Kadaluwarsa (H-30)
              </h3>
              <p className="text-xs text-slate-500">
                Sistem mendeteksi produk sembako (susu, bumbu, mi, dll) yang mendekati tanggal expired kurang dari 30 hari.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {nearExpiryProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Semua produk sembako masih aman!</p>
                <p className="text-xs">Tidak ada produk yang mendekati tanggal kadaluwarsa H-30.</p>
              </div>
            ) : (
              nearExpiryProducts.map(p => {
                const exp = getDaysUntilExpired(p.expiredDate);
                return (
                  <div key={p.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>Kategori: {p.category}</span>
                        <span>Sisa Stok: <strong className="text-slate-800">{p.stock} {p.baseUnit}</strong></span>
                        {p.batchNumber && <span>Batch: {p.batchNumber}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-700 block">
                          Tgl Expired: {formatDateIndo(p.expiredDate || '')}
                        </span>
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                          {exp?.label}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDamageTargetProduct(p);
                          setDamageReason('kadaluwarsa');
                          setDamageQty(p.stock.toString());
                        }}
                        className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
                      >
                        Retur / Buang
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STOCK OPNAME RECORDS */}
      {activeTab === 'opname' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Riwayat Penyesuaian Stok (Stock Opname)</h3>
              <p className="text-xs text-slate-500">Log sinkronisasi stok fisik riil vs stok sistem</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Nama Barang</th>
                  <th className="py-3 px-4 text-right">Stok Sistem</th>
                  <th className="py-3 px-4 text-right">Stok Fisik</th>
                  <th className="py-3 px-4 text-right">Selisih</th>
                  <th className="py-3 px-4">Alasan Penyesuaian</th>
                  <th className="py-3 px-4">Pemeriksa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockOpnames.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Belum ada penyesuaian stock opname yang dicatat.
                    </td>
                  </tr>
                ) : (
                  stockOpnames.map(op => (
                    <tr key={op.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">{op.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{op.productName}</td>
                      <td className="py-3 px-4 text-right font-mono">{op.systemStock} {op.unit}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-teal-800">{op.physicalStock} {op.unit}</td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${
                        op.difference === 0 ? 'text-emerald-700' : op.difference > 0 ? 'text-blue-700' : 'text-rose-700'
                      }`}>
                        {op.difference > 0 ? `+${op.difference}` : op.difference} {op.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{op.reason}</td>
                      <td className="py-3 px-4 text-slate-500">{op.inspector}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DAMAGE & RETURN LOGS */}
      {activeTab === 'damage' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Catatan Barang Rusak, Kadaluwarsa, & Retur</h3>
            <p className="text-xs text-slate-500">Daftar barang yang ditarik dari stok aktif dengan nilai estimasi kerugian HPP</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Nama Barang</th>
                  <th className="py-3 px-4">Alasan</th>
                  <th className="py-3 px-4 text-right">Jumlah Ditarik</th>
                  <th className="py-3 px-4 text-right">Estimasi Kerugian (HPP)</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4">Pelapor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {damageLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Belum ada barang rusak atau kadaluwarsa yang dilaporkan.
                    </td>
                  </tr>
                ) : (
                  damageLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">{log.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{log.productName}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          log.reason === 'kadaluwarsa'
                            ? 'bg-rose-100 text-rose-800'
                            : log.reason === 'rusak'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {log.reason}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">{log.quantity} {log.unit}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">{formatRupiah(log.lossAmount)}</td>
                      <td className="py-3 px-4 text-slate-600">{log.notes || '-'}</td>
                      <td className="py-3 px-4 text-slate-500">{log.reportedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT PRODUCT */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-black text-lg text-slate-900">
                {editingProduct ? 'Edit Data Barang Sembako' : 'Tambah Barang Sembako Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Barang *
                  </label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={e => setPName(e.target.value)}
                    placeholder="Contoh: Beras Rojo Lele 5kg"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Barcode / Kode Barang *
                  </label>
                  <input
                    type="text"
                    required
                    value={pBarcode}
                    onChange={e => setPBarcode(e.target.value)}
                    placeholder="899..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori *
                  </label>
                  <select
                    value={pCategory}
                    onChange={e => setPCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {(storeCategories && storeCategories.length > 0
                      ? storeCategories
                      : ['Minyak Goreng', 'Beras & Biji-bijian', 'Gula & Pemanis', 'Telur & Unggas', 'Mi Instan & Pasta', 'Tepung & Bumbu', 'Susu & Olahan', 'Kopi & Teh', 'Sabun & Kebersihan', 'Minuman Kemasan', 'Tabung', 'Galon', 'Lain-lain']
                    ).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Satuan Dasar (Base Unit) *
                  </label>
                  <select
                    value={pBaseUnit}
                    onChange={e => setPBaseUnit(e.target.value as UnitType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="pcs">pcs (Buah/Bungkus)</option>
                    <option value="pouch">pouch (Kemasan Pouch)</option>
                    <option value="renceng">renceng (Renteng)</option>
                    <option value="butir">butir (Telur/Kelapa)</option>
                    <option value="pack">pack (Kemasan Pack)</option>
                    <option value="dus">dus (Karton)</option>
                    <option value="tabung">tabung (Gas LPG dll)</option>
                    <option value="galon">galon (Air Mineral dll)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Barang Timbang (Desimal)?
                  </label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pAllowDecimal}
                      onChange={e => setPAllowDecimal(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span className="text-xs text-slate-700 font-semibold">
                      Bisa beli 0.5 atau 0.25 kg
                    </span>
                  </label>
                </div>
              </div>

              {/* Multi-unit box conversion section */}
              <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pHasMultiUnit}
                    onChange={e => setPHasMultiUnit(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <span className="text-xs font-bold text-teal-900">
                    Aktifkan Konversi Satuan Bertingkat (Contoh: 1 Dus = 12 Pouch)
                  </span>
                </label>

                {pHasMultiUnit && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-teal-900 mb-1">
                        Nama Satuan Besar (Contoh: Dus / Karton / Sak)
                      </label>
                      <input
                        type="text"
                        value={pBoxUnitName}
                        onChange={e => setPBoxUnitName(e.target.value)}
                        placeholder="Dus"
                        className="w-full px-3 py-1.5 bg-white border border-teal-300 rounded-xl text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-teal-900 mb-1">
                        1 Satuan Besar = Berapa Satuan Dasar?
                      </label>
                      <input
                        type="number"
                        value={pBoxRatio}
                        onChange={e => setPBoxRatio(e.target.value)}
                        placeholder="12"
                        className="w-full px-3 py-1.5 bg-white border border-teal-300 rounded-xl text-xs text-slate-900 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stock & Prices */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Stok Awal
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={pStock}
                    onChange={e => setPStock(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Batas Minimum Stok
                  </label>
                  <input
                    type="number"
                    value={pMinStock}
                    onChange={e => setPMinStock(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    HPP (Harga Beli)
                  </label>
                  <input
                    type="number"
                    value={pCostPrice}
                    onChange={e => setPCostPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Harga Jual Eceran
                  </label>
                  <input
                    type="number"
                    value={pRetailPrice}
                    onChange={e => setPRetailPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Harga Jual Grosir (Partai)
                  </label>
                  <input
                    type="number"
                    value={pWholesalePrice}
                    onChange={e => setPWholesalePrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-teal-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Min Qty untuk Harga Grosir
                  </label>
                  <input
                    type="number"
                    value={pMinWholesaleQty}
                    onChange={e => setPMinWholesaleQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Expired (Kadaluwarsa)
                  </label>
                  <input
                    type="date"
                    value={pExpiredDate}
                    onChange={e => setPExpiredDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20"
                >
                  Simpan Barang Sembako
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK OPNAME */}
      {opnameTargetProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-900 text-base">Stock Opname Fisik</h3>
              <button
                type="button"
                onClick={() => setOpnameTargetProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Barang: <strong className="text-slate-900">{opnameTargetProduct.name}</strong>
              <br />
              Stok di Sistem: <strong className="font-mono text-teal-800">{opnameTargetProduct.stock} {opnameTargetProduct.baseUnit}</strong>
            </p>

            <form onSubmit={handleConfirmOpname} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah Hitungan Fisik di Toko/Gudang ({opnameTargetProduct.baseUnit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={opnamePhysicalStock}
                  onChange={e => setOpnamePhysicalStock(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan / Alasan Selisih
                </label>
                <input
                  type="text"
                  required
                  value={opnameReason}
                  onChange={e => setOpnameReason(e.target.value)}
                  placeholder="Contoh: Selisih timbangan beras tercecer"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpnameTargetProduct(null)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold"
                >
                  Terapkan Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DAMAGE / RETURN */}
      {damageTargetProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-900 text-base">Catat Barang Rusak / Kadaluwarsa</h3>
              <button
                type="button"
                onClick={() => setDamageTargetProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Barang: <strong className="text-slate-900">{damageTargetProduct.name}</strong>
              <br />
              Stok Aktif: <span className="font-mono">{damageTargetProduct.stock} {damageTargetProduct.baseUnit}</span>
            </p>

            <form onSubmit={handleConfirmDamage} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Penarikan Barang *
                </label>
                <select
                  value={damageReason}
                  onChange={e => setDamageReason(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                >
                  <option value="rusak">Barang Rusak / Kemasan Bocor</option>
                  <option value="kadaluwarsa">Sudah Kadaluwarsa (Expired)</option>
                  <option value="retur">Retur Kembali ke Supplier</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah yang Ditarik ({damageTargetProduct.baseUnit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={damageQty}
                  onChange={e => setDamageQty(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Detail
                </label>
                <input
                  type="text"
                  value={damageNotes}
                  onChange={e => setDamageNotes(e.target.value)}
                  placeholder="Contoh: Bocor tertindih di gudang"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDamageTargetProduct(null)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Kurangi dari Stok Aktif
                </button>
              </div>
            </form>
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
                Apakah Anda yakin ingin menghapus barang <strong className="text-slate-800">{productToDelete.name}</strong> dari sistem inventaris gudang toko?
              </p>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-left space-y-1 text-xs text-slate-600">
                <div>Kategori: <span className="font-semibold text-slate-800">{productToDelete.category}</span></div>
                <div>Satuan Dasar: <span className="font-semibold text-slate-800">{productToDelete.baseUnit}</span></div>
                <div>Sisa Stok Fisik: <span className="font-mono font-bold text-slate-800">{productToDelete.stock} {productToDelete.baseUnit}</span></div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                id="btn-cancel-gudang-delete"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-gudang-delete"
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
