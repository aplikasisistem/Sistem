export type UserRole = 'kasir' | 'gudang' | 'admin';

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  password?: string;
  isActive: boolean;
  phone?: string;
}

export type User = UserAccount;


export type UnitType = 'kg' | 'pcs' | 'pouch' | 'butir' | 'renceng' | 'dus' | 'sak' | 'liter' | 'pack';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  baseUnit: UnitType; // e.g., 'pouch', 'pcs', 'kg'
  allowDecimal: boolean; // true for Beras, Telur, Gula (timbang)
  
  // Stock in base units
  stock: number;
  minStock: number;
  
  // Pricing
  costPrice: number; // HPP (Harga Beli)
  retailPrice: number; // Harga Jual Eceran
  wholesalePrice: number; // Harga Jual Grosir
  minWholesaleQty: number; // Min quantity to trigger wholesale price
  
  // Multi-unit conversion (e.g. 1 Dus = 12 Pouch)
  hasMultiUnit: boolean;
  boxUnitName?: string; // e.g. "Dus"
  boxConversionRatio?: number; // e.g. 12 (1 Dus = 12 base units)
  boxWholesalePrice?: number; // Price per dus
  
  // Expired date tracking
  expiredDate?: string; // YYYY-MM-DD
  batchNumber?: string;
}

export interface CartItem {
  product: Product;
  quantity: number; // can be fractional e.g. 0.5 for kg
  selectedPriceType: 'retail' | 'wholesale';
  customPrice?: number;
  unitUsed: string; // 'kg', 'pcs', or 'dus'
  subtotal: number;
}

export type PaymentMethod = 'tunai' | 'qris' | 'kasbon';

export interface Transaction {
  id: string;
  invoiceNumber: string;
  timestamp: string; // ISO string
  cashierId: string;
  cashierName: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    costPrice: number;
    subtotal: number;
    priceType: 'retail' | 'wholesale';
  }[];
  totalAmount: number;
  totalCost: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  
  // Kasbon details (if paymentMethod === 'kasbon')
  customerName?: string;
  customerPhone?: string;
  dueDate?: string;
  isKasbonPaid?: boolean;
  kasbonPaidDate?: string;
  kasbonNotes?: string;
  
  status: 'completed' | 'cancelled';
}

export interface HeldTransaction {
  id: string;
  holdTime: string;
  customerNote: string;
  items: CartItem[];
  totalAmount: number;
  cashierName: string;
}

export interface CashierShift {
  id: string;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  startingCash: number; // Modal Awal
  totalCashSales: number;
  totalQrisSales: number;
  totalKasbonSales: number;
  expectedDrawerCash: number; // startingCash + totalCashSales + cash payments received
  actualDrawerCash?: number;
  discrepancy?: number; // actual - expected
  status: 'open' | 'closed';
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export interface SupplierPurchase {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  paymentType: 'tunai' | 'tempo';
  tempoDueDate?: string; // 7 - 14 days
  isPaid: boolean;
  paidDate?: string;
  items: {
    productId: string;
    productName: string;
    quantityEntered: number;
    unitEntered: string; // e.g. "Dus"
    baseQtyAdded: number; // e.g. 12 * quantityEntered
    unitPrice: number;
    subtotal: number;
    expiredDate?: string;
  }[];
  totalAmount: number;
  notes?: string;
}

export interface DamageLog {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  reason: 'rusak' | 'kadaluwarsa' | 'retur';
  lossAmount: number; // quantity * costPrice
  reportedBy: string;
  notes?: string;
}

export interface OperationalExpense {
  id: string;
  date: string;
  category: 'gaji' | 'listrik_air' | 'sewa' | 'konsumsi' | 'transport' | 'kebersihan' | 'lainnya';
  categoryLabel: string;
  amount: number;
  description: string;
  recordedBy: string;
}

export interface StockOpnameRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
  unit: string;
  reason: string;
  inspector: string;
}
