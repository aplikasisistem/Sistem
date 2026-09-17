import { Product, UserAccount, Supplier, SupplierPurchase, Transaction, OperationalExpense, CashierShift } from '../types';

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr_admin_1',
    username: 'ALUNK',
    name: 'Pemilik Toko (Alunk)',
    role: 'admin',
    password: 'Pamarayan123',
    isActive: true,
    phone: '+62821-2584-5237',
  },
  {
    id: 'usr_kasir_1',
    username: 'kasir',
    name: 'Kasir Utama',
    role: 'kasir',
    password: 'Pamarayan123',
    isActive: true,
    phone: '081234567890',
  },
  {
    id: 'usr_gudang_1',
    username: 'gudang',
    name: 'Petugas Gudang',
    role: 'gudang',
    password: 'Pamarayan123',
    isActive: true,
    phone: '082345678901',
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

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_SUPPLIER_PURCHASES: SupplierPurchase[] = [];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_EXPENSES: OperationalExpense[] = [];

export const INITIAL_CURRENT_SHIFT: CashierShift | null = null;
