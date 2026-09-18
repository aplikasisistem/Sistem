import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Product,
  UserAccount,
  Transaction,
  HeldTransaction,
  CashierShift,
  Supplier,
  SupplierPurchase,
  DamageLog,
  OperationalExpense,
  StockOpnameRecord,
  StockLog,
  CartItem,
  PaymentMethod,
  UserRole,
  UnitType,
  isWarehouseAdmin
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_PRODUCTS,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIER_PURCHASES,
  INITIAL_TRANSACTIONS,
  INITIAL_EXPENSES,
  INITIAL_CURRENT_SHIFT,
  INITIAL_SHIFT_HISTORY,
  INITIAL_CATEGORIES
} from '../data/initialData';
import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, safeSetDoc, cleanForFirestore } from '../services/firebase';
import {
  isSupabaseConfigured,
  fetchTransactionsQuery,
  insertTransactionQuery,
  updateTransactionQuery,
  deleteTransactionQuery,
  payKasbonInSupabase,
  subscribeToTransactionsChanges,
} from '../services/supabase';

interface StoreContextType {
  // Cloud Sync
  isCloudConnected: boolean;

  // Supabase Transactions Sync & Status
  isSupabaseConfigured: boolean;
  isSupabaseConnected: boolean;
  isTransactionsLoading: boolean;
  transactionsError: string | null;
  clearTransactionsError: () => void;
  refreshTransactions: () => Promise<void>;

  // Auth
  currentUser: UserAccount | null;
  login: (username: string, pass: string) => boolean;
  logout: () => void;
  switchRoleQuick: (role: UserRole) => void;
  users: UserAccount[];
  addUser: (user: Omit<UserAccount, 'id'>) => void;
  updateUser: (user: UserAccount) => void;
  deleteUser: (id: string) => void;

  // Products & Stock
  products: Product[];
  addProduct: (p: Omit<Product, 'id'>) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  updateMasterPrices: (id: string, costPrice: number, retailPrice: number, wholesalePrice: number, minWholesaleQty: number, boxWholesalePrice?: number) => void;
  addOrIncreaseStock: (params: {
    name: string;
    retailPrice: number;
    qty: number;
    category?: string;
    baseUnit?: string;
  }) => Promise<{ product: Product; isNew: boolean }>;
  recordQuickSale: (params: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    paymentMethod?: PaymentMethod;
  }) => Promise<Transaction>;

  // Categories
  categories: string[];
  addCategory: (name: string) => boolean;
  updateCategory: (oldName: string, newName: string) => void;
  deleteCategory: (name: string) => void;

  // POS Cart
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, priceType?: 'retail' | 'wholesale', unitUsed?: string) => void;
  updateCartQuantity: (index: number, quantity: number) => void;
  toggleCartPriceType: (index: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;

  // Hold Transaction
  heldTransactions: HeldTransaction[];
  holdTransaction: (customerNote: string) => boolean;
  restoreHeldTransaction: (id: string) => void;
  deleteHeldTransaction: (id: string) => void;

  // Shift & Shift Reconciliation
  currentShift: CashierShift | null;
  shiftHistory: CashierShift[];
  openShift: (startingCash: number, notes?: string) => void;
  closeShift: (
    actualCash: number,
    notes?: string,
    denominationCounts?: Record<string, number>
  ) => CashierShift | null;
  reconcileShift: (
    shiftId: string,
    actualCash: number,
    denominationCounts?: Record<string, number>,
    notes?: string
  ) => void;

  // Checkout & Transactions (Supabase Database)
  transactions: Transaction[];
  checkout: (
    paymentMethod: PaymentMethod,
    amountPaid: number,
    kasbonDetails?: { customerName: string; customerPhone?: string; dueDate?: string; notes?: string }
  ) => Promise<Transaction | null>;
  payKasbon: (transactionId: string) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;

  // Gudang & Supplier
  suppliers: Supplier[];
  addSupplier: (s: Omit<Supplier, 'id'>) => void;
  updateSupplier: (s: Supplier) => void;
  deleteSupplier: (supplierId: string) => void;
  supplierPurchases: SupplierPurchase[];
  addSupplierPurchase: (purchase: Omit<SupplierPurchase, 'id' | 'invoiceNumber'>) => void;
  updateSupplierPurchase: (purchase: SupplierPurchase) => void;
  deleteSupplierPurchase: (purchaseId: string) => void;
  paySupplierDebt: (purchaseId: string) => void;
  damageLogs: DamageLog[];
  recordDamageOrReturn: (productId: string, quantity: number, reason: 'rusak' | 'kadaluwarsa' | 'retur', notes?: string) => void;
  stockOpnames: StockOpnameRecord[];
  performStockOpname: (productId: string, physicalStock: number, reason: string) => void;
  
  // Warehouse Automated Stock Scanner & Inbound Logs
  stockLogs: StockLog[];
  autoInboundStockByBarcode: (params: {
    barcode: string;
    addedQty?: number;
    batchNumber?: string;
    source?: 'camera_auto_scan' | 'manual_barcode' | 'batch_inbound';
  }) => Promise<{
    success: boolean;
    status: 'updated' | 'not_found' | 'denied';
    product?: Product;
    previousStock?: number;
    currentStock?: number;
    addedQty?: number;
    message?: string;
    stockLog?: StockLog;
  }>;

  // Expenses
  expenses: OperationalExpense[];
  addExpense: (expense: Omit<OperationalExpense, 'id'>) => void;
  deleteExpense: (id: string) => void;

  // System
  resetAllDataToDefault: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USERS: 'alunk_users',
  PRODUCTS: 'alunk_products',
  HELD_TRX: 'alunk_held_trx',
  CURRENT_SHIFT: 'alunk_current_shift',
  SHIFT_HISTORY: 'alunk_shift_history',
  SUPPLIERS: 'alunk_suppliers',
  PURCHASES: 'alunk_purchases',
  DAMAGE_LOGS: 'alunk_damage_logs',
  STOCK_OPNAMES: 'alunk_stock_opnames',
  STOCK_LOGS: 'alunk_stock_logs',
  EXPENSES: 'alunk_expenses',
  AUTH_USER: 'alunk_auth_user',
  CATEGORIES: 'alunk_categories',
  DB_RESET_V2: 'alunk_cleaned_flag_v2',
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load initial state from local storage or defaults
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null; // start at login screen as required: "Yang di awali menu login"
  });

  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  // Supabase Transactions state (No localStorage fallback)
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState<boolean>(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(isSupabaseConfigured);

  const [heldTransactions, setHeldTransactions] = useState<HeldTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HELD_TRX);
    return saved ? JSON.parse(saved) : [];
  });

  const [currentShift, setCurrentShift] = useState<CashierShift | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_SHIFT);
    return saved ? JSON.parse(saved) : INITIAL_CURRENT_SHIFT;
  });

  const [shiftHistory, setShiftHistory] = useState<CashierShift[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SHIFT_HISTORY);
    return saved ? JSON.parse(saved) : INITIAL_SHIFT_HISTORY;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });

  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchase[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PURCHASES);
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIER_PURCHASES;
  });

  const [damageLogs, setDamageLogs] = useState<DamageLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DAMAGE_LOGS);
    return saved ? JSON.parse(saved) : [];
  });

  const [stockOpnames, setStockOpnames] = useState<StockOpnameRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STOCK_OPNAMES);
    return saved ? JSON.parse(saved) : [];
  });

  const [stockLogs, setStockLogs] = useState<StockLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STOCK_LOGS);
    return saved ? JSON.parse(saved) : [];
  });

  const [expenses, setExpenses] = useState<OperationalExpense[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!saved) return INITIAL_CATEGORIES;
    try {
      const parsed: string[] = JSON.parse(saved);
      return Array.from(new Set([...parsed, ...INITIAL_CATEGORIES]));
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  // Active Cart State in POS
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);

  // Real-time Firestore Cloud Synchronization for Products, Transactions, and Categories
  useEffect(() => {
    // 1. Real-time Products Sync
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        if (snapshot.empty) {
          // If Firestore is empty upon first connection, seed initial products
          try {
            const batch = writeBatch(db);
            INITIAL_PRODUCTS.forEach(p => {
              const docRef = doc(db, 'products', p.id);
              batch.set(docRef, cleanForFirestore(p));
            });
            batch.commit().catch(err => {
              handleFirestoreError(err, OperationType.WRITE, 'products');
            });
          } catch (e) {
            console.error('Initial product seed failed:', e);
          }
          setProducts(INITIAL_PRODUCTS);
        } else {
          const loadedProds: Product[] = [];
          snapshot.forEach(docSnap => {
            loadedProds.push(docSnap.data() as Product);
          });
          setProducts(loadedProds);
          try {
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(loadedProds));
          } catch (e) {}
        }
        setIsCloudConnected(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
        setIsCloudConnected(false);
      }
    );

    // 2. Real-time Categories Sync
    const unsubCategories = onSnapshot(
      doc(db, 'settings', 'categories'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && Array.isArray(data.list) && data.list.length > 0) {
            const merged = Array.from(new Set([...data.list, ...INITIAL_CATEGORIES]));
            setCategories(merged);
            try {
              localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(merged));
            } catch (e) {}
          }
        } else {
          // Initialize categories document in Firestore
          safeSetDoc(doc(db, 'settings', 'categories'), { list: INITIAL_CATEGORIES }).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, 'settings/categories');
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/categories');
      }
    );

    // 3. Real-time Expenses Sync (Cloud persistent across all devices)
    const unsubExpenses = onSnapshot(
      collection(db, 'expenses'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: OperationalExpense[] = [];
          snapshot.forEach(docSnap => {
            loaded.push(docSnap.data() as OperationalExpense);
          });
          setExpenses(loaded);
          try {
            localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(loaded));
          } catch (e) {}
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'expenses');
      }
    );

    // 4. Real-time Stock Logs Inbound Sync (Cloud persistent)
    const unsubStockLogs = onSnapshot(
      collection(db, 'stock_logs'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedLogs: StockLog[] = [];
          snapshot.forEach(docSnap => {
            loadedLogs.push(docSnap.data() as StockLog);
          });
          loadedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setStockLogs(loadedLogs);
          try {
            localStorage.setItem(STORAGE_KEYS.STOCK_LOGS, JSON.stringify(loadedLogs));
          } catch (e) {}
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'stock_logs');
      }
    );

    // 5. Real-time Shifts & Shift History Sync
    const unsubShifts = onSnapshot(
      collection(db, 'shifts'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedShifts: CashierShift[] = [];
          let openShiftFound: CashierShift | null = null;
          snapshot.forEach(docSnap => {
            const shift = docSnap.data() as CashierShift;
            if (shift.status === 'open') {
              openShiftFound = shift;
            } else {
              loadedShifts.push(shift);
            }
          });
          loadedShifts.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          setShiftHistory(loadedShifts);
          if (openShiftFound) {
            setCurrentShift(openShiftFound);
          }
          try {
            localStorage.setItem(STORAGE_KEYS.SHIFT_HISTORY, JSON.stringify(loadedShifts));
          } catch (e) {}
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'shifts');
      }
    );

    return () => {
      unsubProducts();
      unsubCategories();
      unsubExpenses();
      unsubStockLogs();
      unsubShifts();
    };
  }, []);

  // Supabase Transactions Integration: Query & Realtime Subscription
  const loadTransactionsFromSupabase = async () => {
    if (!isSupabaseConfigured) {
      setIsTransactionsLoading(false);
      setIsSupabaseConnected(false);
      // Jika Supabase belum dihubungkan dengan env key, gunakan initial transactions agar UI tetap responsif
      setTransactions(prev => (prev.length > 0 ? prev : INITIAL_TRANSACTIONS));
      return;
    }

    setIsTransactionsLoading(true);
    try {
      const { data, error } = await fetchTransactionsQuery();
      if (error) {
        console.error('Supabase fetch transactions error:', error);
        setTransactionsError(`Supabase DB: ${error.message}`);
        setIsSupabaseConnected(false);
        // Pertahankan transaksi yang sudah ada di state
        setTransactions(prev => (prev.length > 0 ? prev : INITIAL_TRANSACTIONS));
      } else if (data) {
        setTransactions(data);
        setIsSupabaseConnected(true);
        setTransactionsError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to load transactions from Supabase:', message);
      setTransactionsError(`Gagal membaca Supabase: ${message}`);
      setIsSupabaseConnected(false);
    } finally {
      setIsTransactionsLoading(false);
    }
  };

  const clearTransactionsError = () => {
    setTransactionsError(null);
  };

  const refreshTransactions = async () => {
    await loadTransactionsFromSupabase();
  };

  useEffect(() => {
    loadTransactionsFromSupabase();

    // Pasang Supabase Realtime changes listener jika dikonfigurasi
    const unsubscribe = subscribeToTransactionsChanges(() => {
      loadTransactionsFromSupabase();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // One-time clean reset migration for ALUNK STORE
  useEffect(() => {
    const isCleaned = localStorage.getItem(STORAGE_KEYS.DB_RESET_V2);
    if (!isCleaned) {
      // Clear legacy storage keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('pandir_')) {
          localStorage.removeItem(key);
        }
      });
      // Force clean states
      setProducts(INITIAL_PRODUCTS);
      setSuppliers(INITIAL_SUPPLIERS);
      setSupplierPurchases(INITIAL_SUPPLIER_PURCHASES);
      setTransactions(INITIAL_TRANSACTIONS);
      setExpenses(INITIAL_EXPENSES);
      setCurrentShift(INITIAL_CURRENT_SHIFT);
      setCategories(INITIAL_CATEGORIES);
      setUsers(INITIAL_USERS);
      setHeldTransactions([]);
      setDamageLogs([]);
      setStockOpnames([]);
      setCart([]);
      localStorage.setItem(STORAGE_KEYS.DB_RESET_V2, 'true');
    }
  }, []);

  // Sync credentials for admin (ALUNK), kasir, and gudang to Pamarayan123 if still using legacy credentials
  useEffect(() => {
    setUsers(prev => {
      let changed = false;
      const updated = prev.map(u => {
        if (u.role === 'admin' && (u.username !== 'ALUNK' || u.password !== 'Pamarayan123')) {
          changed = true;
          return {
            ...u,
            username: 'ALUNK',
            password: 'Pamarayan123',
            isActive: true,
          };
        }
        if ((u.username.toLowerCase() === 'kasir' || u.role === 'kasir') && (u.password !== 'Pamarayan123' || u.phone !== '0857-1704-6895')) {
          changed = true;
          return {
            ...u,
            password: 'Pamarayan123',
            phone: '0857-1704-6895',
            isActive: true,
          };
        }
        if ((u.username.toLowerCase() === 'gudang' || u.role === 'gudang') && (u.password !== 'Pamarayan123' || u.phone !== '0857-1704-6895')) {
          changed = true;
          return {
            ...u,
            password: 'Pamarayan123',
            phone: '0857-1704-6895',
            isActive: true,
          };
        }
        return u;
      });
      if (changed) {
        try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated)); } catch (e) {}
        return updated;
      }
      return prev;
    });
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    }
  }, [currentUser]);

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.HELD_TRX, JSON.stringify(heldTransactions)); }, [heldTransactions]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(currentShift)); }, [currentShift]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(supplierPurchases)); }, [supplierPurchases]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.DAMAGE_LOGS, JSON.stringify(damageLogs)); }, [damageLogs]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.STOCK_OPNAMES, JSON.stringify(stockOpnames)); }, [stockOpnames]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories)); }, [categories]);

  // Auth Functions
  const login = (username: string, pass: string): boolean => {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = pass.trim();

    // Direct check for admin credentials: ALUNK / Pamarayan123 (or admin fallback)
    if ((cleanUser === 'alunk' || cleanUser === 'admin') && cleanPass === 'Pamarayan123') {
      const adminUser = users.find(u => u.role === 'admin') || INITIAL_USERS[0];
      const syncedAdmin: UserAccount = {
        ...adminUser,
        username: 'ALUNK',
        password: 'Pamarayan123',
        isActive: true,
      };
      updateUser(syncedAdmin);
      setCurrentUser(syncedAdmin);
      return true;
    }

    // Direct check for kasir / gudang with Pamarayan123
    if ((cleanUser === 'kasir' || cleanUser === 'gudang') && cleanPass === 'Pamarayan123') {
      const targetRole = cleanUser;
      const matchedUser = users.find(u => u.role === targetRole || u.username.toLowerCase() === cleanUser) ||
        INITIAL_USERS.find(u => u.username.toLowerCase() === cleanUser);
      if (matchedUser) {
        const syncedUser: UserAccount = {
          ...matchedUser,
          password: 'Pamarayan123',
          phone: '0857-1704-6895',
          isActive: true,
        };
        updateUser(syncedUser);
        setCurrentUser(syncedUser);
        return true;
      }
    }

    // 1. Check in state
    const found = users.find(
      u => u.username.trim().toLowerCase() === cleanUser && u.isActive !== false
    );

    // 2. Check INITIAL_USERS in case developer changed initialData.ts in source code
    const initMatch = INITIAL_USERS.find(
      u => u.username.trim().toLowerCase() === cleanUser
    );

    if (found) {
      const dbPass = (found.password || '').trim();
      if (!dbPass || dbPass === cleanPass) {
        setCurrentUser(found);
        return true;
      }
      // If stored password did not match, but initialData.ts has the updated password:
      if (initMatch && (initMatch.password || '').trim() === cleanPass) {
        const syncedUser: UserAccount = { ...found, password: cleanPass, isActive: true };
        updateUser(syncedUser);
        setCurrentUser(syncedUser);
        return true;
      }
    } else if (initMatch && (initMatch.password || '').trim() === cleanPass) {
      // User exists in initialData.ts with new credentials
      const newUser: UserAccount = { ...initMatch, isActive: true };
      addUser(newUser);
      setCurrentUser(newUser);
      return true;
    }

    return false;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const switchRoleQuick = (role: UserRole) => {
    const found = users.find(u => u.role === role && u.isActive !== false);
    if (found) {
      setCurrentUser(found);
    }
  };

  const addUser = (userData: Omit<UserAccount, 'id'>) => {
    const newUser: UserAccount = {
      isActive: true,
      ...userData,
      id: `usr_${Date.now()}`,
      username: userData.username.trim(),
      password: userData.password ? userData.password.trim() : userData.password,
    };
    setUsers(prev => {
      const next = [...prev, newUser];
      try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const updateUser = (updated: UserAccount) => {
    const sanitizedUser: UserAccount = {
      isActive: true,
      ...updated,
      username: updated.username.trim(),
      password: updated.password ? updated.password.trim() : updated.password,
    };
    setUsers(prev => {
      const next = prev.map(u => (u.id === sanitizedUser.id ? sanitizedUser : u));
      try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next)); } catch (e) {}
      return next;
    });
    if (currentUser && currentUser.id === sanitizedUser.id) {
      setCurrentUser(sanitizedUser);
      try { localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(sanitizedUser)); } catch (e) {}
    }
  };

  const deleteUser = (id: string) => {
    setUsers(prev => {
      const next = prev.filter(u => u.id !== id);
      try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  // Products
  const addProduct = (pData: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...pData,
      id: `prod_${Date.now()}`,
      name: pData.name.trim(),
      barcode: (pData.barcode || '').trim(),
      category: pData.category ? pData.category.trim() : 'Lainnya',
      baseUnit: pData.baseUnit || 'pcs',
      stock: Number(pData.stock) || 0,
      minStock: Number(pData.minStock) || 0,
      costPrice: Number(pData.costPrice) || 0,
      retailPrice: Number(pData.retailPrice) || 0,
      wholesalePrice: Number(pData.wholesalePrice) || 0,
      minWholesaleQty: Number(pData.minWholesaleQty) || 1,
    };
    setProducts(prev => {
      const next = [newProd, ...prev.filter(p => p.id !== newProd.id)];
      try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next)); } catch (e) {}
      return next;
    });
    // Cloud Sync
    safeSetDoc(doc(db, 'products', newProd.id), newProd).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `products/${newProd.id}`);
    });
  };

  const updateProduct = (p: Product) => {
    const sanitizedProd: Product = {
      ...p,
      name: p.name.trim(),
      barcode: (p.barcode || '').trim(),
      category: p.category ? p.category.trim() : 'Lainnya',
      baseUnit: p.baseUnit || 'pcs',
      stock: Number(p.stock) || 0,
      minStock: Number(p.minStock) || 0,
      costPrice: Number(p.costPrice) || 0,
      retailPrice: Number(p.retailPrice) || 0,
      wholesalePrice: Number(p.wholesalePrice) || 0,
      minWholesaleQty: Number(p.minWholesaleQty) || 1,
    };
    setProducts(prev => {
      const next = prev.map(item => (item.id === sanitizedProd.id ? sanitizedProd : item));
      try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next)); } catch (e) {}
      return next;
    });
    // Cloud Sync
    safeSetDoc(doc(db, 'products', sanitizedProd.id), sanitizedProd).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `products/${sanitizedProd.id}`);
    });
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => {
      const next = prev.filter(p => p.id !== id);
      try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next)); } catch (e) {}
      return next;
    });
    // Cloud Sync
    deleteDoc(doc(db, 'products', id)).catch(err => {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    });
  };

  const updateMasterPrices = (
    id: string,
    costPrice: number,
    retailPrice: number,
    wholesalePrice: number,
    minWholesaleQty: number,
    boxWholesalePrice?: number
  ) => {
    let updatedProduct: Product | null = null;
    setProducts(prev => {
      const next = prev.map(p => {
        if (p.id !== id) return p;
        updatedProduct = {
          ...p,
          costPrice: Number(costPrice) || 0,
          retailPrice: Number(retailPrice) || 0,
          wholesalePrice: Number(wholesalePrice) || 0,
          minWholesaleQty: Number(minWholesaleQty) || 1,
          boxWholesalePrice: boxWholesalePrice !== undefined ? Number(boxWholesalePrice) : p.boxWholesalePrice,
        };
        return updatedProduct;
      });
      try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next)); } catch (e) {}
      return next;
    });
    if (updatedProduct) {
      safeSetDoc(doc(db, 'products', id), updatedProduct).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `products/${id}`);
      });
    }
  };

  // Quick Stock In: Tambah Stok atau input barang baru dengan sinkronisasi Cloud Firestore
  const addOrIncreaseStock = async (params: {
    name: string;
    retailPrice: number;
    qty: number;
    category?: string;
    baseUnit?: string;
  }): Promise<{ product: Product; isNew: boolean }> => {
    const cleanName = (params.name || '').trim();
    const qtyToAdd = Math.max(1, Number(params.qty) || 1);
    const price = Math.max(0, Number(params.retailPrice) || 0);

    // Cari apakah barang dengan nama yang sama persis atau sangat mirip sudah ada
    const existingIndex = products.findIndex(
      p => p.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (existingIndex >= 0) {
      const existing = products[existingIndex];
      const updatedProduct: Product = {
        ...existing,
        stock: (Number(existing.stock) || 0) + qtyToAdd,
        retailPrice: price > 0 ? price : (Number(existing.retailPrice) || 0),
        category: params.category || existing.category || 'Sembako',
        baseUnit: (params.baseUnit as UnitType) || existing.baseUnit || 'pcs',
      };

      setProducts(prev => prev.map(p => (p.id === existing.id ? updatedProduct : p)));
      try {
        localStorage.setItem(
          STORAGE_KEYS.PRODUCTS,
          JSON.stringify(products.map(p => (p.id === existing.id ? updatedProduct : p)))
        );
      } catch (e) {}

      // Cloud Sync Firestore (bisa diakses di semua device)
      await safeSetDoc(doc(db, 'products', existing.id), updatedProduct).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `products/${existing.id}`);
      });

      return { product: updatedProduct, isNew: false };
    } else {
      const newProd: Product = {
        id: `prod_${Date.now()}`,
        name: cleanName || 'Produk Baru',
        barcode: '',
        category: params.category || 'Sembako',
        baseUnit: (params.baseUnit as UnitType) || 'pcs',
        allowDecimal: false,
        hasMultiUnit: false,
        stock: qtyToAdd,
        minStock: 5,
        costPrice: 0, // modal tidak dicatat
        retailPrice: price,
        wholesalePrice: price,
        minWholesaleQty: 1,
      };

      setProducts(prev => [newProd, ...prev]);
      try {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([newProd, ...products]));
      } catch (e) {}

      // Cloud Sync Firestore (bisa diakses di semua device)
      await safeSetDoc(doc(db, 'products', newProd.id), newProd).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, `products/${newProd.id}`);
      });

      return { product: newProd, isNew: true };
    }
  };

  // Quick Sales / Scan Penjualan: Kurangi stok dan catat transaksi
  const recordQuickSale = async (params: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    paymentMethod?: PaymentMethod;
  }): Promise<Transaction> => {
    const qtySold = Math.max(1, Number(params.quantity) || 1);
    const salePrice = Math.max(0, Number(params.price) || 0);
    const totalAmount = qtySold * salePrice;

    // 1. Kurangi stok barang
    const prod = products.find(p => p.id === params.productId);
    if (prod) {
      const updatedProduct: Product = {
        ...prod,
        stock: Math.max(0, (Number(prod.stock) || 0) - qtySold),
      };
      setProducts(prev => prev.map(p => (p.id === prod.id ? updatedProduct : p)));
      try {
        localStorage.setItem(
          STORAGE_KEYS.PRODUCTS,
          JSON.stringify(products.map(p => (p.id === prod.id ? updatedProduct : p)))
        );
      } catch (e) {}

      // Sinkronisasi pemotongan stok ke Firestore
      safeSetDoc(doc(db, 'products', prod.id), updatedProduct).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `products/${prod.id}`);
      });
    }

    // 2. Buat objek Transaksi
    const newTransaction: Transaction = {
      id: `trx_${Date.now()}`,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      cashierId: currentUser?.id || 'usr_quick',
      cashierName: currentUser?.name || 'Kasir',
      totalAmount,
      totalCost: (prod?.costPrice || 0) * qtySold,
      paymentMethod: params.paymentMethod || 'tunai',
      amountPaid: totalAmount,
      change: 0,
      status: 'completed',
      items: [
        {
          productId: params.productId,
          productName: params.productName,
          quantity: qtySold,
          unit: prod?.baseUnit || 'pcs',
          unitPrice: salePrice,
          costPrice: prod?.costPrice || 0,
          subtotal: totalAmount,
          priceType: 'retail',
        },
      ],
    };

    // 3. Update state transaksi aplikasi
    setTransactions(prev => [newTransaction, ...prev]);

    // 4. Catat transaksi ke Supabase
    if (isSupabaseConfigured) {
      insertTransactionQuery(newTransaction).catch(err => {
        console.error('Failed to insert quick sale transaction into Supabase:', err);
      });
    }

    // 5. Catat transaksi ke Firestore agar dapat diakses real-time oleh siapa saja
    safeSetDoc(doc(db, 'transactions', newTransaction.id), newTransaction).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `transactions/${newTransaction.id}`);
    });

    // 6. Update laci kas shift jika shift aktif
    if (currentShift && (params.paymentMethod === 'tunai' || !params.paymentMethod)) {
      setCurrentShift(prev => {
        if (!prev) return null;
        return {
          ...prev,
          totalSales: prev.totalSales + totalAmount,
          totalTransactions: prev.totalTransactions + 1,
          cashSales: prev.cashSales + totalAmount,
          expectedDrawerCash: prev.expectedDrawerCash + totalAmount,
        };
      });
    }

    return newTransaction;
  };

  // Automated Warehouse Inbound Stock Update (Restricted to warehouse_admin / manage_inventory)
  const autoInboundStockByBarcode = async (params: {
    barcode: string;
    addedQty?: number;
    batchNumber?: string;
    source?: 'camera_auto_scan' | 'manual_barcode' | 'batch_inbound';
  }): Promise<{
    success: boolean;
    status: 'updated' | 'not_found' | 'denied';
    product?: Product;
    previousStock?: number;
    currentStock?: number;
    addedQty?: number;
    message?: string;
    stockLog?: StockLog;
  }> => {
    const cleanBarcode = String(params.barcode || '').replace(/[\r\n\t]/g, '').trim();
    const qtyToAdd = Math.max(1, Number(params.addedQty) || 1);
    const source = params.source || 'camera_auto_scan';

    // RBAC Security Check: Must be warehouse_admin or have manage_inventory: true
    if (!isWarehouseAdmin(currentUser)) {
      return {
        success: false,
        status: 'denied',
        message: 'Akses Ditolak: Fitur Input Stok Otomatis HANYA boleh diakses oleh user dengan role warehouse_admin (Admin Gudang) yang memiliki hak akses manage_inventory: true.',
      };
    }

    if (!cleanBarcode) {
      return {
        success: false,
        status: 'not_found',
        message: 'Kode barcode tidak boleh kosong.',
      };
    }

    // First, check local products list
    const existingIndex = products.findIndex(
      p => p.barcode && p.barcode.trim() === cleanBarcode
    );

    if (existingIndex >= 0) {
      const existing = products[existingIndex];
      const previousStock = Number(existing.stock) || 0;
      const currentStock = previousStock + qtyToAdd;

      const updatedProduct: Product = {
        ...existing,
        stock: currentStock,
        batchNumber: params.batchNumber || existing.batchNumber,
      };

      // 1. Update state & localStorage
      const updatedList = [...products];
      updatedList[existingIndex] = updatedProduct;
      setProducts(updatedList);
      try {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updatedList));
      } catch (e) {}

      // 2. Sync to Firestore
      safeSetDoc(doc(db, 'products', updatedProduct.id), updatedProduct).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `products/${updatedProduct.id}`);
      });

      // 3. Create Stock Log
      const logRecord: StockLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        productId: updatedProduct.id,
        barcode: cleanBarcode,
        productName: updatedProduct.name,
        category: updatedProduct.category,
        previousStock,
        addedQty: qtyToAdd,
        currentStock,
        unit: updatedProduct.baseUnit,
        source,
        userId: currentUser?.id || 'usr_warehouse',
        userName: currentUser?.name || 'Admin Gudang',
        userRole: currentUser?.role || 'warehouse_admin',
        timestamp: new Date().toISOString(),
        batchNumber: params.batchNumber,
      };

      setStockLogs(prev => [logRecord, ...prev]);
      try {
        localStorage.setItem(STORAGE_KEYS.STOCK_LOGS, JSON.stringify([logRecord, ...stockLogs]));
      } catch (e) {}

      safeSetDoc(doc(db, 'stock_logs', logRecord.id), logRecord).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, `stock_logs/${logRecord.id}`);
      });

      return {
        success: true,
        status: 'updated',
        product: updatedProduct,
        previousStock,
        currentStock,
        addedQty: qtyToAdd,
        stockLog: logRecord,
        message: `Stok ${updatedProduct.name} berhasil bertambah +${qtyToAdd} ${updatedProduct.baseUnit}. Sisa stok terkini: ${currentStock} ${updatedProduct.baseUnit}.`,
      };
    }

    // If not in local products, try the server warehouse API endpoint
    try {
      const response = await fetch('/api/warehouse/scan-and-update-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || 'warehouse_admin',
          'x-manage-inventory': String(Boolean(currentUser?.manage_inventory ?? true)),
        },
        body: JSON.stringify({
          barcode: cleanBarcode,
          qty: qtyToAdd,
          batchNumber: params.batchNumber,
          source,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userRole: currentUser?.role,
        }),
      });

      if (response.status === 403) {
        return {
          success: false,
          status: 'denied',
          message: 'Akses Ditolak: Server menolak akses karena role bukan warehouse_admin.',
        };
      }

      const data = await response.json();

      if (data.success && data.status === 'updated' && data.product) {
        const newProd: Product = {
          id: data.product.id || `prod_${Date.now()}`,
          barcode: cleanBarcode,
          name: data.product.name,
          category: data.product.category || 'Sembako',
          baseUnit: (data.product.baseUnit as UnitType) || 'pcs',
          allowDecimal: false,
          stock: data.currentStock,
          minStock: data.product.minStock || 5,
          costPrice: data.product.costPrice || 0,
          retailPrice: data.product.retailPrice || 0,
          wholesalePrice: data.product.wholesalePrice || 0,
          minWholesaleQty: 1,
          hasMultiUnit: false,
        };

        setProducts(prev => [newProd, ...prev]);
        try {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([newProd, ...products]));
        } catch (e) {}

        // Sync product to Firestore
        safeSetDoc(doc(db, 'products', newProd.id), newProd).catch(err => {
          handleFirestoreError(err, OperationType.CREATE, `products/${newProd.id}`);
        });

        if (data.stockLog) {
          setStockLogs(prev => [data.stockLog, ...prev]);
          safeSetDoc(doc(db, 'stock_logs', data.stockLog.id), data.stockLog).catch(() => {});
        }

        return {
          success: true,
          status: 'updated',
          product: newProd,
          previousStock: data.previousStock,
          currentStock: data.currentStock,
          addedQty: qtyToAdd,
          stockLog: data.stockLog,
          message: data.message,
        };
      }
    } catch (apiErr) {
      console.warn('API warehouse scan error:', apiErr);
    }

    return {
      success: false,
      status: 'not_found',
      message: `Barcode "${cleanBarcode}" belum terdaftar di sistem inventaris. Buka form produk baru untuk melengkapi detail produk.`,
    };
  };

  // Cart Handlers
  const addToCart = (
    product: Product,
    quantity: number = 1,
    priceType: 'retail' | 'wholesale' = 'retail',
    unitUsed: string = product.baseUnit
  ) => {
    setCart(prev => {
      // Check if item already exists in cart with same unit
      const existingIndex = prev.findIndex(
        item => item.product.id === product.id && item.unitUsed === unitUsed
      );

      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        const newQty = existing.quantity + quantity;
        
        // Auto apply wholesale if quantity reaches threshold
        let determinedPriceType = existing.selectedPriceType;
        if (newQty >= product.minWholesaleQty) {
          determinedPriceType = 'wholesale';
        }

        const unitPrice = determinedPriceType === 'wholesale' ? product.wholesalePrice : product.retailPrice;
        const subtotal = newQty * unitPrice;

        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          selectedPriceType: determinedPriceType,
          subtotal,
        };
        return updated;
      } else {
        // New item
        let determinedPriceType = priceType;
        if (quantity >= product.minWholesaleQty) {
          determinedPriceType = 'wholesale';
        }
        const unitPrice = determinedPriceType === 'wholesale' ? product.wholesalePrice : product.retailPrice;
        const subtotal = quantity * unitPrice;

        return [
          ...prev,
          {
            product,
            quantity,
            selectedPriceType: determinedPriceType,
            unitUsed,
            subtotal,
          },
        ];
      }
    });
  };

  const updateCartQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }

    setCart(prev => {
      const item = prev[index];
      if (!item) return prev;

      // Auto adjust price type if reaches wholesale threshold
      let determinedPriceType = item.selectedPriceType;
      if (newQty >= item.product.minWholesaleQty) {
        determinedPriceType = 'wholesale';
      }

      const unitPrice = determinedPriceType === 'wholesale' ? item.product.wholesalePrice : item.product.retailPrice;
      const subtotal = newQty * unitPrice;

      const updated = [...prev];
      updated[index] = {
        ...item,
        quantity: newQty,
        selectedPriceType: determinedPriceType,
        subtotal,
      };
      return updated;
    });
  };

  const toggleCartPriceType = (index: number) => {
    setCart(prev => {
      const item = prev[index];
      if (!item) return prev;

      const newType = item.selectedPriceType === 'retail' ? 'wholesale' : 'retail';
      const unitPrice = newType === 'wholesale' ? item.product.wholesalePrice : item.product.retailPrice;
      const subtotal = item.quantity * unitPrice;

      const updated = [...prev];
      updated[index] = {
        ...item,
        selectedPriceType: newType,
        subtotal,
      };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Hold Transaction
  const holdTransaction = (customerNote: string): boolean => {
    if (cart.length === 0) return false;
    const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);

    const heldItem: HeldTransaction = {
      id: `hold_${Date.now()}`,
      holdTime: new Date().toISOString(),
      customerNote: customerNote || `Pelanggan #${heldTransactions.length + 1}`,
      items: [...cart],
      totalAmount,
      cashierName: currentUser?.name || 'Kasir',
    };

    setHeldTransactions(prev => [heldItem, ...prev]);
    setCart([]);
    return true;
  };

  const restoreHeldTransaction = (id: string) => {
    const found = heldTransactions.find(h => h.id === id);
    if (!found) return;
    setCart(found.items);
    setHeldTransactions(prev => prev.filter(h => h.id !== id));
  };

  const deleteHeldTransaction = (id: string) => {
    setHeldTransactions(prev => prev.filter(h => h.id !== id));
  };

  // Cashier Shifts & Reconciliation
  const openShift = (startingCash: number, notes?: string) => {
    const startAmount = Math.max(0, Number(startingCash) || 0);
    const newShift: CashierShift = {
      id: `shift_${Date.now()}`,
      cashierId: currentUser?.id || 'usr_kasir_1',
      cashierName: currentUser?.name || 'Kasir',
      startTime: new Date().toISOString(),
      startingCash: startAmount,
      totalCashSales: 0,
      totalCashIntake: 0,
      totalExpensesPaid: 0,
      totalQrisSales: 0,
      totalKasbonSales: 0,
      expectedDrawerCash: startAmount,
      status: 'open',
      notes,
    };
    setCurrentShift(newShift);
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(newShift));
    } catch (e) {}
    safeSetDoc(doc(db, 'shifts', newShift.id), newShift).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `shifts/${newShift.id}`);
    });
  };

  const closeShift = (
    actualCash: number,
    notes?: string,
    denominationCounts?: Record<string, number>
  ): CashierShift | null => {
    if (!currentShift) return null;
    const intake = currentShift.totalCashIntake ?? currentShift.totalCashSales ?? 0;
    const expensesPaid = currentShift.totalExpensesPaid ?? 0;
    const expected = currentShift.startingCash + intake - expensesPaid;
    const discrepancy = actualCash - expected;

    const closed: CashierShift = {
      ...currentShift,
      endTime: new Date().toISOString(),
      totalCashIntake: intake,
      totalExpensesPaid: expensesPaid,
      expectedDrawerCash: expected,
      actualDrawerCash: actualCash,
      discrepancy,
      status: 'closed',
      notes: notes ? `${currentShift.notes || ''} | ${notes}`.trim().replace(/^\|\s*/, '') : currentShift.notes,
      denominationCounts,
      reconciledAt: new Date().toISOString(),
      reconciledBy: currentUser?.name || 'Kasir',
    };

    setShiftHistory(prev => {
      const next = [closed, ...prev.filter(s => s.id !== closed.id)];
      try {
        localStorage.setItem(STORAGE_KEYS.SHIFT_HISTORY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    setCurrentShift(null);

    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_SHIFT);
    } catch (e) {}

    safeSetDoc(doc(db, 'shifts', closed.id), closed).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `shifts/${closed.id}`);
    });

    return closed;
  };

  const reconcileShift = (
    shiftId: string,
    actualCash: number,
    denominationCounts?: Record<string, number>,
    notes?: string
  ) => {
    setShiftHistory(prev => {
      const target = prev.find(s => s.id === shiftId);
      if (!target) return prev;
      const expected = target.expectedDrawerCash;
      const discrepancy = actualCash - expected;
      const updated: CashierShift = {
        ...target,
        actualDrawerCash: actualCash,
        discrepancy,
        denominationCounts: denominationCounts || target.denominationCounts,
        notes: notes !== undefined ? notes : target.notes,
        reconciledAt: new Date().toISOString(),
        reconciledBy: currentUser?.name || target.cashierName,
      };
      const next = prev.map(s => (s.id === shiftId ? updated : s));
      try {
        localStorage.setItem(STORAGE_KEYS.SHIFT_HISTORY, JSON.stringify(next));
      } catch (e) {}
      safeSetDoc(doc(db, 'shifts', updated.id), updated).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `shifts/${updated.id}`);
      });
      return next;
    });
  };

  // Checkout Execution (Async dengan Database Supabase)
  const checkout = async (
    paymentMethod: PaymentMethod,
    amountPaid: number,
    kasbonDetails?: { customerName: string; customerPhone?: string; dueDate?: string; notes?: string }
  ): Promise<Transaction | null> => {
    if (cart.length === 0) return null;

    const now = new Date();
    const invoiceNumber = `PND-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const totalCost = cart.reduce((sum, item) => sum + item.quantity * item.product.costPrice, 0);

    const change = paymentMethod === 'tunai' ? Math.max(0, amountPaid - totalAmount) : 0;

    const newTransaction: Transaction = {
      id: `trx_${Date.now()}`,
      invoiceNumber,
      timestamp: now.toISOString(),
      cashierId: currentUser?.id || 'kasir',
      cashierName: currentUser?.name || 'Kasir Pandir',
      items: cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unit: item.unitUsed,
        unitPrice: item.selectedPriceType === 'wholesale' ? item.product.wholesalePrice : item.product.retailPrice,
        costPrice: item.product.costPrice,
        subtotal: item.subtotal,
        priceType: item.selectedPriceType,
      })),
      totalAmount,
      totalCost,
      paymentMethod,
      amountPaid: paymentMethod === 'kasbon' ? 0 : amountPaid,
      change,
      customerName: kasbonDetails?.customerName,
      customerPhone: kasbonDetails?.customerPhone,
      dueDate: kasbonDetails?.dueDate,
      isKasbonPaid: false,
      kasbonNotes: kasbonDetails?.notes,
      status: 'completed',
    };

    // 1. Deduct Product Stocks
    setProducts(prev => {
      const copy = [...prev];
      cart.forEach(cartItem => {
        const prodIndex = copy.findIndex(p => p.id === cartItem.product.id);
        if (prodIndex > -1) {
          const updated = {
            ...copy[prodIndex],
            stock: Math.max(0, copy[prodIndex].stock - cartItem.quantity),
          };
          copy[prodIndex] = updated;
          // Cloud Sync Product Stock
          safeSetDoc(doc(db, 'products', updated.id), updated).catch(err => {
            handleFirestoreError(err, OperationType.UPDATE, `products/${updated.id}`);
          });
        }
      });
      return copy;
    });

    // 2. Update Current Shift Cash Drawer
    if (currentShift && currentShift.status === 'open') {
      setCurrentShift(prev => {
        if (!prev) return null;
        let addCash = 0;
        let addQris = 0;
        let addKasbon = 0;

        if (paymentMethod === 'tunai') addCash = totalAmount;
        else if (paymentMethod === 'qris') addQris = totalAmount;
        else if (paymentMethod === 'kasbon') addKasbon = totalAmount;

        const newCashSales = prev.totalCashSales + addCash;
        const newIntake = (prev.totalCashIntake ?? prev.totalCashSales) + addCash;
        const expenses = prev.totalExpensesPaid ?? 0;

        return {
          ...prev,
          totalCashSales: newCashSales,
          totalCashIntake: newIntake,
          totalQrisSales: prev.totalQrisSales + addQris,
          totalKasbonSales: prev.totalKasbonSales + addKasbon,
          expectedDrawerCash: Math.max(0, prev.startingCash + newIntake - expenses),
        };
      });
    }

    // 3. Update state secara optimistik
    setTransactions(prev => [newTransaction, ...prev]);

    // 4. Simpan ke Database Supabase External
    if (isSupabaseConfigured) {
      try {
        const { error } = await insertTransactionQuery(newTransaction);
        if (error) {
          console.error('Gagal menyimpan transaksi ke Supabase:', error);
          setTransactionsError(`Supabase Insert Gagal: ${error.message}`);
        } else {
          setTransactionsError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Error saat insert transaksi ke Supabase:', msg);
        setTransactionsError(`Gagal kirim ke Supabase: ${msg}`);
      }
    }

    // 5. Reset Cart
    setCart([]);

    return newTransaction;
  };

  // Kasbon Settlement (Pelunasan Hutang Pelanggan - Async ke Supabase)
  const payKasbon = async (transactionId: string): Promise<void> => {
    const targetTrx = transactions.find(t => t.id === transactionId);
    if (!targetTrx) return;

    const updated: Transaction = {
      ...targetTrx,
      isKasbonPaid: true,
      kasbonPaidDate: new Date().toISOString(),
      amountPaid: targetTrx.totalAmount,
    };

    // Update state secara optimistik
    setTransactions(prev => prev.map(t => (t.id === transactionId ? updated : t)));

    // Perbarui di Database Supabase
    if (isSupabaseConfigured) {
      try {
        const { error } = await payKasbonInSupabase(transactionId, targetTrx.totalAmount);
        if (error) {
          console.error('Gagal update pelunasan kasbon ke Supabase:', error);
          setTransactionsError(`Supabase Pelunasan Gagal: ${error.message}`);
        } else {
          setTransactionsError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Error saat update pelunasan kasbon ke Supabase:', msg);
        setTransactionsError(`Gagal kirim pelunasan ke Supabase: ${msg}`);
      }
    }

    // Increase drawer cash if shift is open
    if (currentShift && currentShift.status === 'open') {
      setCurrentShift(prev => {
        if (!prev) return null;
        const addCash = targetTrx.totalAmount;
        const newIntake = (prev.totalCashIntake ?? prev.totalCashSales) + addCash;
        const expenses = prev.totalExpensesPaid ?? 0;
        return {
          ...prev,
          totalCashSales: prev.totalCashSales + addCash,
          totalCashIntake: newIntake,
          expectedDrawerCash: Math.max(0, prev.startingCash + newIntake - expenses),
        };
      });
    }
  };

  // Update Transaction (Async ke Supabase)
  const updateTransaction = async (updatedTrx: Transaction): Promise<void> => {
    // Check if items quantity changed to adjust product stock
    const oldTrx = transactions.find(t => t.id === updatedTrx.id);
    if (oldTrx) {
      setProducts(prev => {
        const copy = [...prev];
        // 1. Revert old items stock
        oldTrx.items.forEach(oldItem => {
          const idx = copy.findIndex(p => p.id === oldItem.productId);
          if (idx > -1) {
            copy[idx] = {
              ...copy[idx],
              stock: copy[idx].stock + oldItem.quantity,
            };
          }
        });
        // 2. Apply new items stock deduction
        updatedTrx.items.forEach(newItem => {
          const idx = copy.findIndex(p => p.id === newItem.productId);
          if (idx > -1) {
            copy[idx] = {
              ...copy[idx],
              stock: Math.max(0, copy[idx].stock - newItem.quantity),
            };
          }
        });
        // Save affected products to Firestore
        copy.forEach(p => {
          const oldProduct = prev.find(oldP => oldP.id === p.id);
          if (oldProduct && oldProduct.stock !== p.stock) {
            safeSetDoc(doc(db, 'products', p.id), p).catch(err => {
              handleFirestoreError(err, OperationType.UPDATE, `products/${p.id}`);
            });
          }
        });
        return copy;
      });

      // Also adjust shift sales if during open shift
      if (currentShift && currentShift.status === 'open') {
        setCurrentShift(prev => {
          if (!prev) return null;
          let cashDelta = 0;
          let qrisDelta = 0;
          let kasbonDelta = 0;

          // Revert old method
          if (oldTrx.paymentMethod === 'tunai') cashDelta -= oldTrx.totalAmount;
          else if (oldTrx.paymentMethod === 'qris') qrisDelta -= oldTrx.totalAmount;
          else if (oldTrx.paymentMethod === 'kasbon') kasbonDelta -= oldTrx.totalAmount;

          // Add new method
          if (updatedTrx.paymentMethod === 'tunai') cashDelta += updatedTrx.totalAmount;
          else if (updatedTrx.paymentMethod === 'qris') qrisDelta += updatedTrx.totalAmount;
          else if (updatedTrx.paymentMethod === 'kasbon') kasbonDelta += updatedTrx.totalAmount;

          return {
            ...prev,
            totalCashSales: Math.max(0, prev.totalCashSales + cashDelta),
            totalQrisSales: Math.max(0, prev.totalQrisSales + qrisDelta),
            totalKasbonSales: Math.max(0, prev.totalKasbonSales + kasbonDelta),
            expectedDrawerCash: Math.max(0, prev.expectedDrawerCash + cashDelta),
          };
        });
      }
    }

    setTransactions(prev => prev.map(t => (t.id === updatedTrx.id ? updatedTrx : t)));

    // Perbarui di Database Supabase
    if (isSupabaseConfigured) {
      try {
        const { error } = await updateTransactionQuery(updatedTrx);
        if (error) {
          console.error('Gagal update transaksi ke Supabase:', error);
          setTransactionsError(`Supabase Update Gagal: ${error.message}`);
        } else {
          setTransactionsError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Error saat update transaksi ke Supabase:', msg);
        setTransactionsError(`Gagal kirim update ke Supabase: ${msg}`);
      }
    }
  };

  // Delete Transaction (Async ke Supabase)
  const deleteTransaction = async (transactionId: string): Promise<void> => {
    const targetTrx = transactions.find(t => t.id === transactionId);
    if (!targetTrx) return;

    // 1. Restore product stocks
    setProducts(prev => {
      const copy = [...prev];
      targetTrx.items.forEach(item => {
        const prodIndex = copy.findIndex(p => p.id === item.productId);
        if (prodIndex > -1) {
          const updated = {
            ...copy[prodIndex],
            stock: copy[prodIndex].stock + item.quantity,
          };
          copy[prodIndex] = updated;
          safeSetDoc(doc(db, 'products', updated.id), updated).catch(err => {
            handleFirestoreError(err, OperationType.UPDATE, `products/${updated.id}`);
          });
        }
      });
      return copy;
    });

    // 2. Adjust shift if open
    if (currentShift && currentShift.status === 'open') {
      setCurrentShift(prev => {
        if (!prev) return null;
        let subCash = 0;
        let subQris = 0;
        let subKasbon = 0;
        if (targetTrx.paymentMethod === 'tunai') subCash = targetTrx.totalAmount;
        else if (targetTrx.paymentMethod === 'qris') subQris = targetTrx.totalAmount;
        else if (targetTrx.paymentMethod === 'kasbon') subKasbon = targetTrx.totalAmount;

        return {
          ...prev,
          totalCashSales: Math.max(0, prev.totalCashSales - subCash),
          totalQrisSales: Math.max(0, prev.totalQrisSales - subQris),
          totalKasbonSales: Math.max(0, prev.totalKasbonSales - subKasbon),
          expectedDrawerCash: Math.max(0, prev.expectedDrawerCash - subCash),
        };
      });
    }

    // 3. Remove transaction from state
    setTransactions(prev => prev.filter(t => t.id !== transactionId));

    // 4. Hapus dari Database Supabase
    if (isSupabaseConfigured) {
      try {
        const { error } = await deleteTransactionQuery(transactionId);
        if (error) {
          console.error('Gagal menghapus transaksi dari Supabase:', error);
          setTransactionsError(`Supabase Delete Gagal: ${error.message}`);
        } else {
          setTransactionsError(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Error saat delete transaksi dari Supabase:', msg);
        setTransactionsError(`Gagal kirim hapus ke Supabase: ${msg}`);
      }
    }
  };

  // Supplier Purchasing & Unit Conversion
  const addSupplier = (sData: Omit<Supplier, 'id'>) => {
    const newSup: Supplier = {
      ...sData,
      id: `sup_${Date.now()}`,
    };
    setSuppliers(prev => [...prev, newSup]);
  };

  const addSupplierPurchase = (purchaseData: Omit<SupplierPurchase, 'id' | 'invoiceNumber'>) => {
    const now = new Date();
    const invoiceNumber = `SUP-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

    const newPurchase: SupplierPurchase = {
      ...purchaseData,
      id: `pur_${Date.now()}`,
      invoiceNumber,
    };

    // Increase Product Stock automatically applying unit conversion!
    setProducts(prev => {
      const copy = [...prev];
      newPurchase.items.forEach(item => {
        const prodIndex = copy.findIndex(p => p.id === item.productId);
        if (prodIndex > -1) {
          const currentProd = copy[prodIndex];
          const updated = {
            ...currentProd,
            stock: currentProd.stock + item.baseQtyAdded,
            expiredDate: item.expiredDate || currentProd.expiredDate,
          };
          copy[prodIndex] = updated;
          // Cloud sync product stock
          safeSetDoc(doc(db, 'products', updated.id), updated).catch(err => {
            handleFirestoreError(err, OperationType.UPDATE, `products/${updated.id}`);
          });
        }
      });
      return copy;
    });

    setSupplierPurchases(prev => [newPurchase, ...prev]);
  };

  const paySupplierDebt = (purchaseId: string) => {
    setSupplierPurchases(prev =>
      prev.map(p => {
        if (p.id !== purchaseId) return p;
        return {
          ...p,
          isPaid: true,
          paidDate: new Date().toISOString(),
        };
      })
    );
  };

  const updateSupplier = (updated: Supplier) => {
    setSuppliers(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  };

  const deleteSupplier = (supplierId: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== supplierId));
  };

  const updateSupplierPurchase = (updated: SupplierPurchase) => {
    setSupplierPurchases(prev => prev.map(p => (p.id === updated.id ? updated : p)));
  };

  const deleteSupplierPurchase = (purchaseId: string) => {
    setSupplierPurchases(prev => prev.filter(p => p.id !== purchaseId));
  };

  // Category Management
  const addCategory = (name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const exists = categories.some(c => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) return false;
    const next = [...categories, trimmed];
    setCategories(next);
    safeSetDoc(doc(db, 'settings', 'categories'), { list: next }).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, 'settings/categories');
    });
    return true;
  };

  const updateCategory = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.toLowerCase() === oldName.toLowerCase()) return;
    const next = categories.map(c => (c === oldName ? trimmed : c));
    setCategories(next);
    safeSetDoc(doc(db, 'settings', 'categories'), { list: next }).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, 'settings/categories');
    });
    // Update category in products
    setProducts(prev =>
      prev.map(p => {
        if (p.category === oldName) {
          const updated = { ...p, category: trimmed };
          safeSetDoc(doc(db, 'products', updated.id), updated).catch(err => {
            handleFirestoreError(err, OperationType.UPDATE, `products/${updated.id}`);
          });
          return updated;
        }
        return p;
      })
    );
  };

  const deleteCategory = (name: string) => {
    const filtered = categories.filter(c => c !== name);
    const next = filtered.length === 0 ? ['Lainnya'] : filtered;
    setCategories(next);
    safeSetDoc(doc(db, 'settings', 'categories'), { list: next }).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, 'settings/categories');
    });
    // Reassign products with this category to another valid category
    setProducts(prev =>
      prev.map(p => {
        if (p.category === name) {
          const updated = { ...p, category: 'Lainnya' };
          safeSetDoc(doc(db, 'products', updated.id), updated).catch(err => {
            handleFirestoreError(err, OperationType.UPDATE, `products/${updated.id}`);
          });
          return updated;
        }
        return p;
      })
    );
  };

  // Damage & Expiration Logging
  const recordDamageOrReturn = (
    productId: string,
    quantity: number,
    reason: 'rusak' | 'kadaluwarsa' | 'retur',
    notes?: string
  ) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const lossAmount = quantity * prod.costPrice;

    const newLog: DamageLog = {
      id: `dmg_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      productId,
      productName: prod.name,
      quantity,
      unit: prod.baseUnit,
      reason,
      lossAmount,
      reportedBy: currentUser?.name || 'Petugas Gudang',
      notes,
    };

    // Deduct stock & sync to cloud
    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const updated = { ...p, stock: Math.max(0, p.stock - quantity) };
          safeSetDoc(doc(db, 'products', updated.id), updated).catch(err => {
            handleFirestoreError(err, OperationType.UPDATE, `products/${updated.id}`);
          });
          return updated;
        }
        return p;
      })
    );

    setDamageLogs(prev => [newLog, ...prev]);
  };

  // Stock Opname
  const performStockOpname = (productId: string, physicalStock: number, reason: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const systemStock = prod.stock;
    const difference = physicalStock - systemStock;

    const opnameRecord: StockOpnameRecord = {
      id: `opn_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      productId,
      productName: prod.name,
      systemStock,
      physicalStock,
      difference,
      unit: prod.baseUnit,
      reason: reason || (difference === 0 ? 'Stok Sesuai' : 'Penyesuaian Fisik'),
      inspector: currentUser?.name || 'Petugas Gudang',
    };

    // Update product stock to match physical stock & sync to cloud
    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const updated = { ...p, stock: physicalStock };
          safeSetDoc(doc(db, 'products', updated.id), updated).catch(err => {
            handleFirestoreError(err, OperationType.UPDATE, `products/${updated.id}`);
          });
          return updated;
        }
        return p;
      })
    );

    setStockOpnames(prev => [opnameRecord, ...prev]);
  };

  // Expenses
  const addExpense = (expenseData: Omit<OperationalExpense, 'id'>) => {
    const newExpense: OperationalExpense = {
      ...expenseData,
      id: `exp_${Date.now()}`,
    };
    setExpenses(prev => [newExpense, ...prev]);
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([newExpense, ...expenses]));
    } catch (e) {}

    // Deduct from active shift drawer
    if (currentShift && currentShift.status === 'open') {
      setCurrentShift(prev => {
        if (!prev) return null;
        const newExpenses = (prev.totalExpensesPaid || 0) + newExpense.amount;
        const intake = prev.totalCashIntake ?? prev.totalCashSales ?? 0;
        return {
          ...prev,
          totalExpensesPaid: newExpenses,
          expectedDrawerCash: Math.max(0, prev.startingCash + intake - newExpenses),
        };
      });
    }

    // Cloud Firestore Sync
    safeSetDoc(doc(db, 'expenses', newExpense.id), newExpense).catch(err => {
      handleFirestoreError(err, OperationType.CREATE, `expenses/${newExpense.id}`);
    });
  };

  const deleteExpense = (id: string) => {
    const target = expenses.find(e => e.id === id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses.filter(e => e.id !== id)));
    } catch (e) {}

    if (target && currentShift && currentShift.status === 'open') {
      setCurrentShift(prev => {
        if (!prev) return null;
        const newExpenses = Math.max(0, (prev.totalExpensesPaid || 0) - target.amount);
        const intake = prev.totalCashIntake ?? prev.totalCashSales ?? 0;
        return {
          ...prev,
          totalExpensesPaid: newExpenses,
          expectedDrawerCash: Math.max(0, prev.startingCash + intake - newExpenses),
        };
      });
    }

    // Cloud Firestore Delete
    deleteDoc(doc(db, 'expenses', id)).catch(err => {
      handleFirestoreError(err, OperationType.DELETE, `expenses/${id}`);
    });
  };

  // Reset to default
  const resetAllDataToDefault = () => {
    localStorage.clear();
    setUsers(INITIAL_USERS);
    setProducts(INITIAL_PRODUCTS);
    setSuppliers(INITIAL_SUPPLIERS);
    setSupplierPurchases(INITIAL_SUPPLIER_PURCHASES);
    setTransactions(INITIAL_TRANSACTIONS);
    setExpenses(INITIAL_EXPENSES);
    setCurrentShift(INITIAL_CURRENT_SHIFT);
    setShiftHistory(INITIAL_SHIFT_HISTORY);
    setCategories(INITIAL_CATEGORIES);
    setHeldTransactions([]);
    setDamageLogs([]);
    setStockOpnames([]);
    setCart([]);
    localStorage.setItem(STORAGE_KEYS.DB_RESET_V2, 'true');
  };

  return (
    <StoreContext.Provider
      value={{
        isCloudConnected,

        // Supabase Status & Controls
        isSupabaseConfigured,
        isSupabaseConnected,
        isTransactionsLoading,
        transactionsError,
        clearTransactionsError,
        refreshTransactions,

        currentUser,
        login,
        logout,
        switchRoleQuick,
        users,
        addUser,
        updateUser,
        deleteUser,

        products,
        addProduct,
        updateProduct,
        deleteProduct,
        updateMasterPrices,
        addOrIncreaseStock,
        recordQuickSale,

        categories,
        addCategory,
        updateCategory,
        deleteCategory,

        cart,
        addToCart,
        updateCartQuantity,
        toggleCartPriceType,
        removeFromCart,
        clearCart,

        heldTransactions,
        holdTransaction,
        restoreHeldTransaction,
        deleteHeldTransaction,

        currentShift,
        shiftHistory,
        openShift,
        closeShift,
        reconcileShift,

        transactions,
        checkout,
        payKasbon,
        updateTransaction,
        deleteTransaction,

        suppliers,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        supplierPurchases,
        addSupplierPurchase,
        updateSupplierPurchase,
        deleteSupplierPurchase,
        paySupplierDebt,
        damageLogs,
        recordDamageOrReturn,
        stockOpnames,
        performStockOpname,
        stockLogs,
        autoInboundStockByBarcode,

        expenses,
        addExpense,
        deleteExpense,

        resetAllDataToDefault,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
