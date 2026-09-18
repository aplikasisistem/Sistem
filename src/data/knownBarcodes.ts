import { UnitType } from '../types';

export interface KnownProductDetail {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  packageCategory: string; // for QrInventoryInboundView dropdown ('Botol', 'Pouch', 'Dus', 'Pcs', etc.)
  baseUnit: UnitType;
  specifications: string;
  netto: string;
  storageInstructions: string;
  defaultQty: number;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  minWholesaleQty: number;
  defaultRackLocation: string;
  badge?: string;
}

export const KNOWN_BARCODES: Record<string, KnownProductDetail> = {
  // Barcode from user photo (Danone AQUA Air Mineral Pegunungan 600ml)
  '8886008101053': {
    barcode: '8886008101053',
    name: 'AQUA Air Mineral Pegunungan 600ml',
    brand: 'AQUA (Danone / PT Tirta Investama)',
    category: 'Minuman Kemasan',
    packageCategory: 'Botol',
    baseUnit: 'botol',
    specifications: 'Air Mineral Pegunungan, Botol PET 600ml (Dapat Didaur Ulang, Bangga Buatan Indonesia)',
    netto: '600 ml',
    storageInstructions: 'Simpan di tempat bersih, sejuk, terhindar dari sinar matahari langsung dan benda-benda berbau tajam.',
    defaultQty: 24, // 1 karton/dus isi 24 botol
    costPrice: 2800,
    retailPrice: 3500,
    wholesalePrice: 3200,
    minWholesaleQty: 24,
    defaultRackLocation: 'Rak Minuman A-01 / Karton 24 Botol',
    badge: 'Produk Terverifikasi dari Foto Scan',
  },
  '8994557315125': {
    barcode: '8994557315125',
    name: 'Minyak Goreng Sania Royale 2L Pouch',
    brand: 'Sania (Wilmar)',
    category: 'Minyak Goreng',
    packageCategory: 'Pouch',
    baseUnit: 'pouch',
    specifications: 'Minyak Kelapa Sawit Refill Pouch 2 Liter',
    netto: '2 Liter',
    storageInstructions: 'Simpan di suhu ruang, tutup rapat setelah dibuka.',
    defaultQty: 6,
    costPrice: 32000,
    retailPrice: 36500,
    wholesalePrice: 35000,
    minWholesaleQty: 6,
    defaultRackLocation: 'Rak Sembako B-03',
  },
  '8999999123456': {
    barcode: '8999999123456',
    name: 'Indomie Goreng Spesial 85g',
    brand: 'Indomie (Indofood)',
    category: 'Mi Instan & Pasta',
    packageCategory: 'Dus',
    baseUnit: 'pcs',
    specifications: 'Mi Instan Goreng Perisa Spesial 85 gram',
    netto: '85 gram',
    storageInstructions: 'Simpan di tempat kering dan sejuk.',
    defaultQty: 40,
    costPrice: 2800,
    retailPrice: 3500,
    wholesalePrice: 3100,
    minWholesaleQty: 40,
    defaultRackLocation: 'Rak Mi Instan C-01',
  },
};

export const getKnownProductByBarcode = (rawBarcode: string): KnownProductDetail | null => {
  const clean = String(rawBarcode || '').replace(/[\r\n\t\s]/g, '').trim();
  if (!clean) return null;
  return KNOWN_BARCODES[clean] || null;
};
