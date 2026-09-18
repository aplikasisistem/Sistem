import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (typeof __filename !== 'undefined' && __filename.endsWith('.cjs')) ||
    Boolean(process.argv[1]?.endsWith('.cjs'));

  // Support base64 image uploads from camera frames
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // API Route: Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // API Route: Gemini Product Recognition from Camera Frame
  app.post('/api/recognize-product', async (req, res) => {
    try {
      const { image, existingProducts = [] } = req.body;

      if (!image || typeof image !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Gambar dari kamera tidak ditemukan atau format tidak sesuai.'
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('[Gemini API] GEMINI_API_KEY belum dikonfigurasi di Settings > Secrets. Menggunakan mode fallback inventaris toko.');
        return res.json({
          success: true,
          ai_available: false,
          data: {
            nama_barang: '',
            kategori: 'Sembako',
            satuan: 'pcs',
            estimasi_harga_jual: 0,
            confidence: 0,
            matched_existing: false,
            fallback: true,
            message: 'GEMINI_API_KEY belum diatur di Settings > Secrets. Silakan pilih barang dari stok toko.'
          }
        });
      }

      // Clean base64 string
      let base64Data = image;
      let mimeType = 'image/jpeg';
      if (image.includes(';base64,')) {
        const parts = image.split(';base64,');
        base64Data = parts[1];
        const mimeMatch = parts[0].match(/data:(.*?)$/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      }

      // Provide existing products context for smart fuzzy matching
      const knownItemsText = Array.isArray(existingProducts) && existingProducts.length > 0
        ? `\nDaftar barang yang terdaftar di stok toko saat ini:\n${existingProducts.slice(0, 80).map((p: any) => `- ${p.name} (Kategori: ${p.category || 'Sembako'}, Harga Jual: Rp ${p.retailPrice || 0})`).join('\n')}`
        : '';

      const prompt = `Anda adalah asisten AI kasir dan inventaris toko sembako/kelontong di Indonesia.
Analisis frame foto dari kamera ini dengan teliti. Foto ini diambil oleh kamera smartphone kasir/gudang untuk mendeteksi barang toko sembako.
${knownItemsText}

TUGAS UTAMA:
1. Kenali produk/barang yang ada pada gambar (nama barang lengkap beserta merk, varian, atau netto/ukuran jika terlihat, contoh: "AQUA Air Mineral Pegunungan 600ml", "Minyak Goreng Bimoli 1L", "Beras Rojolele 5kg", "Indomie Goreng Spesial 85g").
2. Jika terdapat angka barcode / EAN-13 yang tercetak di bawah garis barcode (misal: "8886008101053" untuk Aqua 600ml), ekstrak nomor barcode tersebut secara akurat.
3. Tuliskan spesifikasi produk lengkap (misal: "Air Mineral Pegunungan, Botol PET 600ml, Danone AQUA").
4. Jika produk ini cocok atau merupakan varian dari daftar barang yang ada di toko di atas, utamakan mencocokkan namanya dengan nama yang ada di daftar stok.
5. Tentukan kategori sembako yang tepat (misal: "Minuman Kemasan", "Beras & Biji-bijian", "Minyak Goreng", "Gula & Pemanis", "Mi Instan & Pasta", dll).
6. Tentukan estimasi harga jual wajar dalam Rupiah (integer angka tanpa titik/koma).
7. Tentukan satuan barang (misal: "botol", "pcs", "kg", "pouch", "liter", "dus").

KEMBALIKAN HANYA OBJEK JSON MURNI (tanpa format markdown/code block):
{
  "nama_barang": "AQUA Air Mineral Pegunungan 600ml",
  "barcode": "8886008101053",
  "spesifikasi": "Air Mineral Pegunungan, Botol PET 600ml (Danone AQUA)",
  "kategori": "Minuman Kemasan",
  "satuan": "botol",
  "estimasi_harga_jual": 3500,
  "confidence": 0.98,
  "matched_existing": true
}`;

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const rawText = response.text?.trim() || '{}';
        let parsedResult: any = {};
        try {
          parsedResult = JSON.parse(rawText);
        } catch {
          const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          parsedResult = JSON.parse(cleanJson);
        }

        return res.json({
          success: true,
          ai_available: true,
          data: {
            nama_barang: parsedResult.nama_barang || '',
            barcode: parsedResult.barcode || '',
            spesifikasi: parsedResult.spesifikasi || '',
            kategori: parsedResult.kategori || 'Sembako',
            satuan: parsedResult.satuan || 'pcs',
            estimasi_harga_jual: Number(parsedResult.estimasi_harga_jual) || 0,
            confidence: Number(parsedResult.confidence) || 0.9,
            matched_existing: Boolean(parsedResult.matched_existing),
            fallback: false,
          }
        });
      } catch (geminiError: any) {
        // Gracefully handle unauthenticated or unreachable Gemini API and fall back to local inventory selection
        const isAuthError =
          typeof geminiError?.message === 'string' &&
          (geminiError.message.includes('401') ||
           geminiError.message.includes('UNAUTHENTICATED') ||
           geminiError.message.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED'));

        if (isAuthError) {
          console.log('[Gemini AI] Mode inventaris toko aktif (kredensial Gemini belum tervalidasi).');
        } else {
          console.log('[Gemini AI] Mode inventaris toko aktif.');
        }

        return res.json({
          success: true,
          ai_available: false,
          data: {
            nama_barang: '',
            kategori: 'Sembako',
            satuan: 'pcs',
            estimasi_harga_jual: 0,
            confidence: 0,
            matched_existing: false,
            fallback: true,
            message: 'Mode inventaris lokal toko aktif. Silakan pilih atau sesuaikan data produk.'
          }
        });
      }
    } catch (_error: any) {
      console.log('[Scanner API] Menggunakan mode fallback inventaris lokal toko.');
      return res.json({
        success: true,
        ai_available: false,
        data: {
          nama_barang: '',
          kategori: 'Sembako',
          satuan: 'pcs',
          estimasi_harga_jual: 0,
          confidence: 0,
          matched_existing: false,
          fallback: true,
          message: 'Silakan pilih barang langsung dari daftar stok.'
        }
      });
    }
  });

  // API Route: Scan Barcode POS Fast Detection
  const POS_DATABASE: Record<string, { sku: string; nama_produk: string; kategori: string; harga_satuan: number }> = {
    '8999999123456': { sku: 'MIE-001', nama_produk: 'Indomie Goreng Spesial 85g', kategori: 'Makanan Instan', harga_satuan: 3500 },
    '8886008101053': { sku: 'AQUA-600', nama_produk: 'AQUA Air Mineral Pegunungan 600ml', kategori: 'Minuman Kemasan', harga_satuan: 3500 },
    '8991001100123': { sku: 'MNM-001', nama_produk: 'Aqua Air Mineral 600ml', kategori: 'Minuman', harga_satuan: 4000 },
    '8886008101050': { sku: 'MNM-002', nama_produk: 'Teh Botol Sosro Kotak 250ml', kategori: 'Minuman', harga_satuan: 4500 },
    '8991001': { sku: 'BRS-001', nama_produk: 'Beras Rojolele Super 5kg', kategori: 'Beras', harga_satuan: 72000 },
    '8991002': { sku: 'MYK-001', nama_produk: 'Minyak Goreng Bimoli 1L', kategori: 'Minyak Goreng', harga_satuan: 18500 },
    '8991003': { sku: 'MYK-002', nama_produk: 'Minyak Goreng Bimoli 2L', kategori: 'Minyak Goreng', harga_satuan: 36000 },
    '8991004': { sku: 'GLA-001', nama_produk: 'Gula Pasir Gulaku Kuning 1kg', kategori: 'Gula & Pemanis', harga_satuan: 17500 },
    '8991005': { sku: 'MIE-002', nama_produk: 'Indomie Goreng Spesial 85g', kategori: 'Makanan Instan', harga_satuan: 3100 },
    '8991006': { sku: 'MIE-003', nama_produk: 'Indomie Kuah Ayam Bawang 69g', kategori: 'Makanan Instan', harga_satuan: 3000 },
    '8991007': { sku: 'TLR-001', nama_produk: 'Telur Ayam Negeri 1kg', kategori: 'Sembako', harga_satuan: 28000 },
    '8991008': { sku: 'KPI-001', nama_produk: 'Kopi Kapal Api Special Mix 10s', kategori: 'Kopi & Teh', harga_satuan: 14000 },
    '8991009': { sku: 'BMB-001', nama_produk: 'Kecap Manis Bango 520ml', kategori: 'Bumbu Dapur', harga_satuan: 24000 },
    '8991010': { sku: 'TPG-001', nama_produk: 'Tepung Terigu Segitiga Biru 1kg', kategori: 'Tepung', harga_satuan: 12500 }
  };

  app.post('/api/scan-barcode', (req, res) => {
    try {
      const rawInput = req.body.barcode || req.body.code || req.query.code || '';
      // Clean whitespace, carriage returns, and newlines from hardware enter
      const cleanedBarcode = String(rawInput).replace(/[\r\n\t]/g, '').trim();

      if (!cleanedBarcode) {
        return res.json({
          status: 'not_found',
          barcode: '',
          message: 'Kode barcode kosong.'
        });
      }

      const item = POS_DATABASE[cleanedBarcode];

      if (item) {
        return res.json({
          status: 'success',
          barcode: cleanedBarcode,
          product: {
            sku: item.sku,
            nama_produk: item.nama_produk,
            kategori: item.kategori,
            harga_satuan: item.harga_satuan,
            qty: 1
          }
        });
      }

      return res.json({
        status: 'not_found',
        barcode: cleanedBarcode,
        message: `Produk dengan barcode ${cleanedBarcode} belum terdaftar di sistem POS.`
      });
    } catch (_err) {
      return res.status(500).json({
        status: 'not_found',
        message: 'Terjadi kesalahan pemrosesan barcode.'
      });
    }
  });

  // =========================================================================
  // RBAC MIDDLEWARE & GUARD: WAREHOUSE ADMIN INVENTORY ACCESS
  // =========================================================================
  const requireWarehouseAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const roleHeader = String(req.headers['x-user-role'] || req.body?.userRole || req.query?.role || '').toLowerCase();
    const manageInventoryHeader =
      req.headers['x-manage-inventory'] === 'true' ||
      req.body?.manageInventory === true ||
      req.body?.manage_inventory === true ||
      req.query?.manage_inventory === 'true';

    const isAuthorized =
      roleHeader === 'warehouse_admin' ||
      roleHeader === 'admin' ||
      roleHeader === 'petugas_gudang' ||
      roleHeader === 'gudang' ||
      (roleHeader === 'gudang' && manageInventoryHeader);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Akses Ditolak: Fitur Inventaris & Stok Gudang HANYA boleh diakses oleh user dengan role Admin atau Petugas Gudang.'
      });
    }

    next();
  };

  // Warehouse inventory in-memory store for server endpoints
  interface WarehouseProductItem {
    id: string;
    barcode: string;
    name: string;
    category: string;
    baseUnit: string;
    stock: number;
    minStock: number;
    costPrice: number;
    retailPrice: number;
    wholesalePrice: number;
  }

  interface ServerStockLogItem {
    id: string;
    productId: string;
    barcode: string;
    productName: string;
    previousStock: number;
    addedQty: number;
    currentStock: number;
    unit: string;
    source: 'camera_auto_scan' | 'manual_barcode' | 'batch_inbound';
    userId: string;
    userName: string;
    userRole: string;
    timestamp: string;
    batchNumber?: string;
  }

  const WAREHOUSE_DB: Record<string, WarehouseProductItem> = {
    '8886008101053': {
      id: 'prod_aqua_600_danone',
      barcode: '8886008101053',
      name: 'AQUA Air Mineral Pegunungan 600ml',
      category: 'Minuman Kemasan',
      baseUnit: 'botol',
      stock: 24,
      minStock: 12,
      costPrice: 2800,
      retailPrice: 3500,
      wholesalePrice: 3200,
    },
    '8994557315125': {
      id: 'prod_sania_2l',
      barcode: '8994557315125',
      name: 'Minyak Goreng Sania Royale 2L Pouch',
      category: 'Minyak Goreng',
      baseUnit: 'pouch',
      stock: 45,
      minStock: 10,
      costPrice: 32000,
      retailPrice: 36500,
      wholesalePrice: 35000,
    },
    '8999999123456': {
      id: 'prod_indomie_grg',
      barcode: '8999999123456',
      name: 'Indomie Goreng Spesial 85g',
      category: 'Mi Instan & Pasta',
      baseUnit: 'pcs',
      stock: 120,
      minStock: 20,
      costPrice: 2800,
      retailPrice: 3500,
      wholesalePrice: 3100,
    },
    '8991001100123': {
      id: 'prod_aqua_600',
      barcode: '8991001100123',
      name: 'Aqua Air Mineral 600ml Botol',
      category: 'Minuman Kemasan',
      baseUnit: 'pcs',
      stock: 75,
      minStock: 15,
      costPrice: 3200,
      retailPrice: 4000,
      wholesalePrice: 3600,
    },
    '8991004': {
      id: 'prod_gulaku_1k',
      barcode: '8991004',
      name: 'Gula Pasir Gulaku Kuning 1kg',
      category: 'Gula & Pemanis',
      baseUnit: 'pcs',
      stock: 60,
      minStock: 10,
      costPrice: 15500,
      retailPrice: 17500,
      wholesalePrice: 16800,
    },
    '8991007': {
      id: 'prod_telur_1k',
      barcode: '8991007',
      name: 'Telur Ayam Negeri Fresh 1kg',
      category: 'Telur & Unggas',
      baseUnit: 'kg',
      stock: 50,
      minStock: 10,
      costPrice: 24500,
      retailPrice: 28000,
      wholesalePrice: 26500,
    },
  };

  const STOCK_LOGS_HISTORY: ServerStockLogItem[] = [];

  // API Route: Verify Warehouse Role Access
  app.get('/api/warehouse/check-access', requireWarehouseAdmin, (_req, res) => {
    res.json({
      success: true,
      message: 'Otoritas warehouse_admin / manage_inventory terverifikasi.',
      timestamp: new Date().toISOString()
    });
  });

  // API Route: Scan and Automatically Update Stock (Warehouse Inbound)
  app.post('/api/warehouse/scan-and-update-stock', requireWarehouseAdmin, (req, res) => {
    try {
      const rawBarcode = req.body.barcode || req.body.code || '';
      const cleanedBarcode = String(rawBarcode).replace(/[\r\n\t]/g, '').trim();
      const addedQty = Math.max(1, Number(req.body.qty || req.body.quantity || 1));
      const source = (req.body.source || 'camera_auto_scan') as 'camera_auto_scan' | 'manual_barcode' | 'batch_inbound';
      const userId = String(req.body.userId || 'usr_warehouse_admin');
      const userName = String(req.body.userName || 'Admin Gudang');
      const userRole = String(req.body.userRole || 'warehouse_admin');
      const batchNumber = req.body.batchNumber ? String(req.body.batchNumber).trim() : undefined;

      if (!cleanedBarcode) {
        return res.status(400).json({
          success: false,
          error: 'Barcode produk tidak boleh kosong.'
        });
      }

      // Check if item exists in warehouse inventory
      const existingItem = WAREHOUSE_DB[cleanedBarcode];

      if (existingItem) {
        const previousStock = existingItem.stock;
        existingItem.stock += addedQty;
        const currentStock = existingItem.stock;

        // Create stock log
        const logItem: ServerStockLogItem = {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          productId: existingItem.id,
          barcode: cleanedBarcode,
          productName: existingItem.name,
          previousStock,
          addedQty,
          currentStock,
          unit: existingItem.baseUnit,
          source,
          userId,
          userName,
          userRole,
          timestamp: new Date().toISOString(),
          batchNumber,
        };

        STOCK_LOGS_HISTORY.unshift(logItem);
        if (STOCK_LOGS_HISTORY.length > 200) {
          STOCK_LOGS_HISTORY.pop();
        }

        return res.json({
          success: true,
          status: 'updated',
          isNew: false,
          barcode: cleanedBarcode,
          product: { ...existingItem },
          previousStock,
          addedQty,
          currentStock,
          stockLog: logItem,
          message: `Stok ${existingItem.name} berhasil bertambah +${addedQty} ${existingItem.baseUnit}. Sisa stok terkini: ${currentStock} ${existingItem.baseUnit}.`
        });
      }

      // If barcode not found in database: return unregistered status so client opens quick registration modal
      return res.json({
        success: true,
        status: 'unregistered',
        isNew: true,
        barcode: cleanedBarcode,
        message: `Barcode ${cleanedBarcode} belum terdaftar di sistem inventaris gudang.`
      });
    } catch (err: any) {
      console.error('[Warehouse Stock Update Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Terjadi kegagalan saat memperbarui stok gudang: ' + (err.message || String(err))
      });
    }
  });

  // API Route: Register new product with initial stock
  app.post('/api/warehouse/register-and-add-stock', requireWarehouseAdmin, (req, res) => {
    try {
      const {
        barcode,
        name,
        category = 'Lain-lain',
        baseUnit = 'pcs',
        stock = 1,
        minStock = 5,
        costPrice = 0,
        retailPrice = 0,
        wholesalePrice = 0,
        userId = 'usr_warehouse_admin',
        userName = 'Admin Gudang',
        userRole = 'warehouse_admin',
        source = 'camera_auto_scan',
      } = req.body;

      const cleanedBarcode = String(barcode || '').replace(/[\r\n\t]/g, '').trim();
      const cleanName = String(name || '').trim();

      if (!cleanedBarcode || !cleanName) {
        return res.status(400).json({
          success: false,
          error: 'Barcode dan Nama Produk wajib diisi.'
        });
      }

      const newProduct: WarehouseProductItem = {
        id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        barcode: cleanedBarcode,
        name: cleanName,
        category: String(category).trim(),
        baseUnit: String(baseUnit).trim(),
        stock: Math.max(1, Number(stock) || 1),
        minStock: Number(minStock) || 5,
        costPrice: Number(costPrice) || 0,
        retailPrice: Number(retailPrice) || 0,
        wholesalePrice: Number(wholesalePrice) || Number(retailPrice) || 0,
      };

      WAREHOUSE_DB[cleanedBarcode] = newProduct;

      const logItem: ServerStockLogItem = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        productId: newProduct.id,
        barcode: cleanedBarcode,
        productName: newProduct.name,
        previousStock: 0,
        addedQty: newProduct.stock,
        currentStock: newProduct.stock,
        unit: newProduct.baseUnit,
        source: (source || 'manual_barcode') as any,
        userId: String(userId),
        userName: String(userName),
        userRole: String(userRole),
        timestamp: new Date().toISOString(),
      };

      STOCK_LOGS_HISTORY.unshift(logItem);

      return res.json({
        success: true,
        status: 'created',
        product: newProduct,
        previousStock: 0,
        addedQty: newProduct.stock,
        currentStock: newProduct.stock,
        stockLog: logItem,
        message: `Produk baru "${newProduct.name}" berhasil didaftarkan dengan stok awal ${newProduct.stock} ${newProduct.baseUnit}.`
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Gagal meregistrasi produk baru: ' + (err.message || String(err))
      });
    }
  });

  // API Route: Get Stock Inbound Movement Logs
  app.get('/api/warehouse/stock-logs', requireWarehouseAdmin, (_req, res) => {
    res.json({
      success: true,
      logs: STOCK_LOGS_HISTORY.slice(0, 50)
    });
  });

  // API Route: QR Code Inbound with Manual Fields (Admin & Petugas Gudang RBAC)
  app.post('/api/warehouse/qr-inbound', requireWarehouseAdmin, (req, res) => {
    try {
      const {
        qrCode,
        sku,
        productName,
        packageCategory = 'Pcs',
        quantity = 1,
        userId,
        userName,
        userRole,
        notes
      } = req.body;

      const code = String(qrCode || sku || '').trim();
      const name = String(productName || '').trim();
      const unitCategory = String(packageCategory || 'Pcs').trim();
      const qty = Math.max(1, Number(quantity) || 1);

      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Kode QR / SKU unik tidak boleh kosong.'
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Nama produk wajib diisi manual oleh petugas gudang.'
        });
      }

      // Check if product exists in WAREHOUSE_DB
      let existingItem = WAREHOUSE_DB[code];
      let previousStock = 0;
      let currentStock = qty;
      let isNew = false;

      if (existingItem) {
        previousStock = existingItem.stock;
        existingItem.stock += qty;
        existingItem.name = name;
        existingItem.baseUnit = unitCategory;
        currentStock = existingItem.stock;
      } else {
        isNew = true;
        existingItem = {
          id: `prod_qr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          barcode: code,
          name,
          category: unitCategory === 'Tabung' ? 'Tabung' : (unitCategory === 'Biji-bijian' ? 'Beras & Biji' : 'Sembako'),
          baseUnit: unitCategory,
          stock: qty,
          minStock: 5,
          costPrice: 0,
          retailPrice: 0,
          wholesalePrice: 0,
        };
        WAREHOUSE_DB[code] = existingItem;
      }

      const logItem: ServerStockLogItem = {
        id: `log_qr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        productId: existingItem.id,
        barcode: code,
        productName: name,
        previousStock,
        addedQty: qty,
        currentStock,
        unit: unitCategory,
        source: 'camera_auto_scan',
        userId: String(userId || 'usr_staff'),
        userName: String(userName || 'Petugas Gudang'),
        userRole: String(userRole || 'petugas_gudang'),
        timestamp: new Date().toISOString(),
        batchNumber: notes || undefined,
      };

      STOCK_LOGS_HISTORY.unshift(logItem);

      return res.json({
        success: true,
        status: isNew ? 'created' : 'updated',
        product: existingItem,
        previousStock,
        addedQty: qty,
        currentStock,
        stockLog: logItem,
        message: isNew
          ? `Barang baru "${name}" [${code}] berhasil didaftarkan ke inventaris (${qty} ${unitCategory}).`
          : `Stok "${name}" [${code}] bertambah +${qty} ${unitCategory}. Total stok sekarang: ${currentStock} ${unitCategory}.`
      });
    } catch (err: any) {
      console.error('[QR Inbound Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal memproses QR Inbound: ' + (err.message || String(err))
      });
    }
  });

  // Vite middleware for development (only loaded when not running in production)
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express + Vite Server running on port ${PORT}`);
  });
}

startServer();
