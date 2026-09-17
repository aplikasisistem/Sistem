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
  CartItem,
  PaymentMethod,
  UserRole
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_PRODUCTS,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIER_PURCHASES,
  INITIAL_TRANSACTIONS,
  INITIAL_EXPENSES,
  INITIAL_CURRENT_SHIFT,
  INITIAL_CATEGORIES
} from '../data/initialData';

interface StoreContextType {
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

  // Shift
  currentShift: CashierShift | null;
  openShift: (startingCash: number, notes?: string) => void;
  closeShift: (actualCash: number, notes?: string) => CashierShift | null;

  // Checkout & Transactions
  transactions: Transaction[];
  checkout: (
    paymentMethod: PaymentMethod,
    amountPaid: number,
    kasbonDetails?: { customerName: string; customerPhone?: string; dueDate?: string; notes?: string }
  ) => Transaction | null;
  payKasbon: (transactionId: string) => void;

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
  TRANSACTIONS: 'alunk_transactions',
  HELD_TRX: 'alunk_held_trx',
  CURRENT_SHIFT: 'alunk_current_shift',
  SUPPLIERS: 'alunk_suppliers',
  PURCHASES: 'alunk_purchases',
  DAMAGE_LOGS: 'alunk_damage_logs',
  STOCK_OPNAMES: 'alunk_stock_opnames',
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

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [heldTransactions, setHeldTransactions] = useState<HeldTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HELD_TRX);
    return saved ? JSON.parse(saved) : [];
  });

  const [currentShift, setCurrentShift] = useState<CashierShift | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_SHIFT);
    return saved ? JSON.parse(saved) : INITIAL_CURRENT_SHIFT;
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

  const [expenses, setExpenses] = useState<OperationalExpense[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  // Active Cart State in POS
  const [cart, setCart] = useState<CartItem[]>([]);

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

  // Sync admin credentials to ALUNK / Pamarayan123 if still using legacy credentials
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
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions)); }, [transactions]);
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
      const next = [newProd, ...prev];
      try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next)); } catch (e) {}
      return next;
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
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => {
      const next = prev.filter(p => p.id !== id);
      try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next)); } catch (e) {}
      return next;
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
    setProducts(prev => {
      const next = prev.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          costPrice: Number(costPrice) || 0,
          retailPrice: Number(retailPrice) || 0,
          wholesalePrice: Number(wholesalePrice) || 0,
          minWholesaleQty: Number(minWholesaleQty) || 1,
          boxWholesalePrice: boxWholesalePrice !== undefined ? Number(boxWholesalePrice) : p.boxWholesalePrice,
        };
      });
      try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next)); } catch (e) {}
      return next;
    });
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

  // Cashier Shifts
  const openShift = (startingCash: number, notes?: string) => {
    const newShift: CashierShift = {
      id: `shift_${Date.now()}`,
      cashierId: currentUser?.id || 'usr_kasir_1',
      cashierName: currentUser?.name || 'Kasir',
      startTime: new Date().toISOString(),
      startingCash,
      totalCashSales: 0,
      totalQrisSales: 0,
      totalKasbonSales: 0,
      expectedDrawerCash: startingCash,
      status: 'open',
      notes,
    };
    setCurrentShift(newShift);
  };

  const closeShift = (actualCash: number, notes?: string): CashierShift | null => {
    if (!currentShift) return null;
    const discrepancy = actualCash - currentShift.expectedDrawerCash;
    const closed: CashierShift = {
      ...currentShift,
      endTime: new Date().toISOString(),
      actualDrawerCash: actualCash,
      discrepancy,
      status: 'closed',
      notes: notes ? `${currentShift.notes || ''} | ${notes}` : currentShift.notes,
    };
    setCurrentShift(null);
    return closed;
  };

  // Checkout Execution
  const checkout = (
    paymentMethod: PaymentMethod,
    amountPaid: number,
    kasbonDetails?: { customerName: string; customerPhone?: string; dueDate?: string; notes?: string }
  ): Transaction | null => {
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
          copy[prodIndex] = {
            ...copy[prodIndex],
            stock: Math.max(0, copy[prodIndex].stock - cartItem.quantity),
          };
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

        return {
          ...prev,
          totalCashSales: prev.totalCashSales + addCash,
          totalQrisSales: prev.totalQrisSales + addQris,
          totalKasbonSales: prev.totalKasbonSales + addKasbon,
          expectedDrawerCash: prev.expectedDrawerCash + addCash,
        };
      });
    }

    // 3. Save Transaction
    setTransactions(prev => [newTransaction, ...prev]);

    // 4. Reset Cart
    setCart([]);

    return newTransaction;
  };

  // Kasbon Settlement (Pelunasan Hutang Pelanggan)
  const payKasbon = (transactionId: string) => {
    setTransactions(prev =>
      prev.map(t => {
        if (t.id !== transactionId) return t;
        return {
          ...t,
          isKasbonPaid: true,
          kasbonPaidDate: new Date().toISOString(),
          amountPaid: t.totalAmount,
        };
      })
    );

    // Increase drawer cash if shift is open
    const targetTrx = transactions.find(t => t.id === transactionId);
    if (targetTrx && currentShift && currentShift.status === 'open') {
      setCurrentShift(prev => {
        if (!prev) return null;
        return {
          ...prev,
          totalCashSales: prev.totalCashSales + targetTrx.totalAmount,
          expectedDrawerCash: prev.expectedDrawerCash + targetTrx.totalAmount,
        };
      });
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
          copy[prodIndex] = {
            ...currentProd,
            stock: currentProd.stock + item.baseQtyAdded,
            expiredDate: item.expiredDate || currentProd.expiredDate,
          };
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
    setCategories(prev => [...prev, trimmed]);
    return true;
  };

  const updateCategory = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.toLowerCase() === oldName.toLowerCase()) return;
    setCategories(prev => prev.map(c => (c === oldName ? trimmed : c)));
    // Update category in products
    setProducts(prev =>
      prev.map(p => (p.category === oldName ? { ...p, category: trimmed } : p))
    );
  };

  const deleteCategory = (name: string) => {
    setCategories(prev => {
      const filtered = prev.filter(c => c !== name);
      if (filtered.length === 0) {
        return ['Lainnya'];
      }
      return filtered;
    });
    // Reassign products with this category to another valid category
    setProducts(prev =>
      prev.map(p => {
        if (p.category === name) {
          return { ...p, category: 'Lainnya' };
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

    // Deduct stock
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, stock: Math.max(0, p.stock - quantity) } : p))
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

    // Update product stock to match physical stock
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, stock: physicalStock } : p))
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
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
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
        openShift,
        closeShift,

        transactions,
        checkout,
        payKasbon,

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
