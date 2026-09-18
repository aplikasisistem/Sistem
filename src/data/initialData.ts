import { Product, UserAccount, Supplier, SupplierPurchase, Transaction, OperationalExpense, CashierShift } from '../types';

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr_admin_1',
    username: 'ALUNK',
    name: 'Pemilik Toko (Alunk)',
    role: 'admin',
    manage_inventory: true,
    password: 'Pamarayan123',
    isActive: true,
    phone: '+62821-2584-5237',
  },
  {
    id: 'usr_warehouse_admin_1',
    username: 'admin_gudang',
    name: 'Admin Gudang (Warehouse Manager)',
    role: 'warehouse_admin',
    manage_inventory: true,
    password: 'Pamarayan123',
    isActive: true,
    phone: '0857-1704-6895',
  },
  {
    id: 'usr_gudang_1',
    username: 'gudang',
    name: 'Petugas Gudang',
    role: 'warehouse_admin',
    manage_inventory: true,
    password: 'Pamarayan123',
    isActive: true,
    phone: '0857-1704-6895',
  },
  {
    id: 'usr_kasir_1',
    username: 'kasir',
    name: 'Kasir Utama',
    role: 'kasir',
    manage_inventory: false,
    password: 'Pamarayan123',
    isActive: true,
    phone: '0857-1704-6895',
  },
];

export const INITIAL_CATEGORIES: string[] = [
  'Minyak Goreng',
  'Beras & Biji-bijian',
  'Gula & Pemanis',
  'Telur & Unggas',
  'Mi Instan & Pasta',
  'Tepung & Bumbu',
  'Susu & Olahan',
  'Kopi & Teh',
  'Sabun & Kebersihan',
  'Minuman Kemasan',
  'Tabung',
  'Galon',
  'Lain-lain',
];

// Clean Production Initial State (Dummy data cleared per specification)
export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_aqua_600',
    barcode: '8886008101053',
    name: 'AQUA Air Mineral Pegunungan 600ml',
    category: 'Minuman Kemasan',
    baseUnit: 'botol',
    allowDecimal: false,
    stock: 48,
    minStock: 12,
    costPrice: 2800,
    retailPrice: 3500,
    wholesalePrice: 3200,
    minWholesaleQty: 24,
    hasMultiUnit: true,
    boxUnitName: 'Dus (24 Botol)',
    boxConversionRatio: 24,
    boxWholesalePrice: 76800,
  },
  {
    id: 'prod_telur_curah',
    barcode: '8991007',
    name: 'Telur Ayam Negeri Fresh Curah',
    category: 'Telur & Unggas',
    baseUnit: 'kg',
    allowDecimal: true, // Barang timbangan desimal
    stock: 25.5,
    minStock: 5,
    costPrice: 24500,
    retailPrice: 28000,
    wholesalePrice: 26500,
    minWholesaleQty: 10,
    hasMultiUnit: false,
  },
  {
    id: 'prod_beras_rojolele',
    barcode: '8991001',
    name: 'Beras Rojolele Super Pulen Timbangan',
    category: 'Beras & Biji-bijian',
    baseUnit: 'kg',
    allowDecimal: true, // Barang timbangan desimal
    stock: 100,
    minStock: 20,
    costPrice: 12800,
    retailPrice: 15000,
    wholesalePrice: 14200,
    minWholesaleQty: 25,
    hasMultiUnit: false,
  },
  {
    id: 'prod_sania_2l',
    barcode: '8994557315125',
    name: 'Minyak Goreng Sania Royale 2L Pouch',
    category: 'Minyak Goreng',
    baseUnit: 'pouch',
    allowDecimal: false,
    stock: 36,
    minStock: 10,
    costPrice: 32000,
    retailPrice: 36500,
    wholesalePrice: 35000,
    minWholesaleQty: 6,
    hasMultiUnit: true,
    boxUnitName: 'Dus (6 Pouch)',
    boxConversionRatio: 6,
    boxWholesalePrice: 210000,
  },
  {
    id: 'prod_indomie_goreng',
    barcode: '8999999123456',
    name: 'Indomie Goreng Spesial 85g',
    category: 'Mi Instan & Pasta',
    baseUnit: 'pcs',
    allowDecimal: false,
    stock: 120,
    minStock: 20,
    costPrice: 2800,
    retailPrice: 3500,
    wholesalePrice: 3100,
    minWholesaleQty: 40,
    hasMultiUnit: true,
    boxUnitName: 'Dus (40 Pcs)',
    boxConversionRatio: 40,
    boxWholesalePrice: 124000,
  },
];

export const INITIAL_SUPPLIER_PURCHASES: SupplierPurchase[] = [];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_EXPENSES: OperationalExpense[] = [];

export const INITIAL_CURRENT_SHIFT: CashierShift | null = null;

export const INITIAL_SHIFT_HISTORY: CashierShift[] = [];
