import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Transaction, PaymentMethod } from '../types';

/**
 * ============================================================================
 * SUPABASE CONFIGURATION & SERVICE FOR TRANSACTIONS
 * ============================================================================
 * 
 * Referensi Struktur SQL Tabel 'transactions' di Supabase:
 * ----------------------------------------------------------------------------
 * CREATE TABLE IF NOT EXISTS public.transactions (
 *   id TEXT PRIMARY KEY,
 *   invoice_number TEXT NOT NULL,
 *   timestamp TEXT NOT NULL,
 *   cashier_id TEXT NOT NULL,
 *   cashier_name TEXT NOT NULL,
 *   items JSONB NOT NULL DEFAULT '[]'::jsonb,
 *   total_amount NUMERIC NOT NULL DEFAULT 0,
 *   total_cost NUMERIC NOT NULL DEFAULT 0,
 *   payment_method TEXT NOT NULL DEFAULT 'tunai',
 *   amount_paid NUMERIC NOT NULL DEFAULT 0,
 *   change NUMERIC NOT NULL DEFAULT 0,
 *   customer_name TEXT,
 *   customer_phone TEXT,
 *   due_date TEXT,
 *   is_kasbon_paid BOOLEAN DEFAULT false,
 *   kasbon_paid_date TEXT,
 *   kasbon_notes TEXT,
 *   status TEXT NOT NULL DEFAULT 'completed',
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow all operations for anon" ON public.transactions 
 *   FOR ALL TO anon USING (true) WITH CHECK (true);
 * ----------------------------------------------------------------------------
 */

const metaEnv = ((import.meta as unknown as { env?: Record<string, string | undefined> })?.env) || {};
const envUrl = (metaEnv.VITE_SUPABASE_URL || '').trim();
const envAnonKey = (metaEnv.VITE_SUPABASE_ANON_KEY || '').trim();

// Periksa validitas konfigurasi Supabase
export const isSupabaseConfigured = Boolean(
  envUrl &&
  envAnonKey &&
  envUrl.startsWith('https://') &&
  !envUrl.includes('placeholder') &&
  !envUrl.includes('your-project')
);

// Fallback dummy client agar aplikasi tidak melempar uncaught error pada saat env belum diisi
const dummyUrl = 'https://placeholder-project.supabase.co';
const dummyAnonKey = 'placeholder-anon-key';

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? envUrl : dummyUrl,
  isSupabaseConfigured ? envAnonKey : dummyAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Normalisasi data baris dari tabel Supabase menjadi interface Transaction aplikasi
 */
export function mapSupabaseRowToTransaction(row: any): Transaction {
  let parsedItems = [];
  try {
    if (Array.isArray(row.items)) {
      parsedItems = row.items;
    } else if (typeof row.items === 'string') {
      parsedItems = JSON.parse(row.items);
    }
  } catch (e) {
    parsedItems = [];
  }

  return {
    id: String(row.id || `trx_${Date.now()}`),
    invoiceNumber: String(row.invoice_number ?? row.invoiceNumber ?? '-'),
    timestamp: String(row.timestamp ?? row.created_at ?? new Date().toISOString()),
    cashierId: String(row.cashier_id ?? row.cashierId ?? 'kasir'),
    cashierName: String(row.cashier_name ?? row.cashierName ?? 'Kasir'),
    items: parsedItems,
    totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
    totalCost: Number(row.total_cost ?? row.totalCost ?? 0),
    paymentMethod: (row.payment_method ?? row.paymentMethod ?? 'tunai') as PaymentMethod,
    amountPaid: Number(row.amount_paid ?? row.amountPaid ?? 0),
    change: Number(row.change ?? 0),
    customerName: row.customer_name ?? row.customerName ?? undefined,
    customerPhone: row.customer_phone ?? row.customerPhone ?? undefined,
    dueDate: row.due_date ?? row.dueDate ?? undefined,
    isKasbonPaid: Boolean(row.is_kasbon_paid ?? row.isKasbonPaid ?? false),
    kasbonPaidDate: row.kasbon_paid_date ?? row.kasbonPaidDate ?? undefined,
    kasbonNotes: row.kasbon_notes ?? row.kasbonNotes ?? undefined,
    status: (row.status || 'completed') as 'completed' | 'cancelled',
  };
}

/**
 * Format payload Transaction untuk disimpan ke Supabase
 * Mendukung schema snake_case standar Postgres
 */
export function mapTransactionToSupabaseRow(t: Transaction) {
  return {
    id: t.id,
    invoice_number: t.invoiceNumber,
    timestamp: t.timestamp,
    cashier_id: t.cashierId,
    cashier_name: t.cashierName,
    items: t.items,
    total_amount: t.totalAmount,
    total_cost: t.totalCost,
    payment_method: t.paymentMethod,
    amount_paid: t.amountPaid,
    change: t.change,
    customer_name: t.customerName || null,
    customer_phone: t.customerPhone || null,
    due_date: t.dueDate || null,
    is_kasbon_paid: Boolean(t.isKasbonPaid),
    kasbon_paid_date: t.kasbonPaidDate || null,
    kasbon_notes: t.kasbonNotes || null,
    status: t.status,
  };
}

/**
 * Payload cadangan dengan camelCase jika database Supabase pengguna dibuat menggunakan format camelCase
 */
export function mapTransactionToCamelCaseRow(t: Transaction) {
  return {
    id: t.id,
    invoiceNumber: t.invoiceNumber,
    timestamp: t.timestamp,
    cashierId: t.cashierId,
    cashierName: t.cashierName,
    items: t.items,
    totalAmount: t.totalAmount,
    totalCost: t.totalCost,
    paymentMethod: t.paymentMethod,
    amountPaid: t.amountPaid,
    change: t.change,
    customerName: t.customerName || null,
    customerPhone: t.customerPhone || null,
    dueDate: t.dueDate || null,
    isKasbonPaid: Boolean(t.isKasbonPaid),
    kasbonPaidDate: t.kasbonPaidDate || null,
    kasbonNotes: t.kasbonNotes || null,
    status: t.status,
  };
}

/**
 * READ: Ambil seluruh data transaksi dari tabel Supabase
 */
export async function fetchTransactionsQuery(): Promise<{ data: Transaction[] | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: new Error('Konfigurasi Supabase belum lengkap. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di environment.'),
    };
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const transactions: Transaction[] = (data || []).map(mapSupabaseRowToTransaction);
    return { data: transactions, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: new Error(message) };
  }
}

/**
 * CREATE: Masukkan transaksi baru ke tabel Supabase
 */
export async function insertTransactionQuery(t: Transaction): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return {
      error: new Error('Konfigurasi Supabase belum lengkap. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.'),
    };
  }

  try {
    const payload = mapTransactionToSupabaseRow(t);
    const { error } = await supabase.from('transactions').insert([payload]);

    if (error) {
      // Jika error karena kolom invoice_number tidak ditemukan, coba insert dengan camelCase
      if (error.message.includes('column "invoice_number"') || error.message.includes('column "cashier_id"')) {
        const camelPayload = mapTransactionToCamelCaseRow(t);
        const { error: retryErr } = await supabase.from('transactions').insert([camelPayload]);
        if (retryErr) {
          return { error: new Error(retryErr.message) };
        }
        return { error: null };
      }
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: new Error(message) };
  }
}

/**
 * UPDATE: Perbarui data transaksi di tabel Supabase berdasarkan ID
 */
export async function updateTransactionQuery(t: Transaction): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return {
      error: new Error('Konfigurasi Supabase belum lengkap. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.'),
    };
  }

  try {
    const payload = mapTransactionToSupabaseRow(t);
    const { error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', t.id);

    if (error) {
      // Fallback camelCase jika skema kolom berbeda
      if (error.message.includes('column "invoice_number"') || error.message.includes('column "cashier_id"')) {
        const camelPayload = mapTransactionToCamelCaseRow(t);
        const { error: retryErr } = await supabase
          .from('transactions')
          .update(camelPayload)
          .eq('id', t.id);
        if (retryErr) {
          return { error: new Error(retryErr.message) };
        }
        return { error: null };
      }
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: new Error(message) };
  }
}

/**
 * UPDATE KASBON: Perbarui status pelunasan kasbon transaksi secara spesifik
 */
export async function payKasbonInSupabase(transactionId: string, amountPaid: number): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return {
      error: new Error('Konfigurasi Supabase belum lengkap.'),
    };
  }

  try {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('transactions')
      .update({
        is_kasbon_paid: true,
        isKasbonPaid: true,
        kasbon_paid_date: nowIso,
        kasbonPaidDate: nowIso,
        amount_paid: amountPaid,
        amountPaid: amountPaid,
      })
      .eq('id', transactionId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: new Error(message) };
  }
}

/**
 * DELETE: Hapus data transaksi dari tabel Supabase berdasarkan ID
 */
export async function deleteTransactionQuery(transactionId: string): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return {
      error: new Error('Konfigurasi Supabase belum lengkap.'),
    };
  }

  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: new Error(message) };
  }
}

/**
 * REALTIME: Pasang listener subscription Supabase Realtime untuk perubahan data tabel transactions
 */
export function subscribeToTransactionsChanges(onChanged: () => void) {
  if (!isSupabaseConfigured) return () => {};

  try {
    const channel = supabase
      .channel('supabase-transactions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          onChanged();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Realtime subscription to Supabase failed:', err);
    return () => {};
  }
}
