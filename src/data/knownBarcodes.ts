import { UnitType } from '../types';

export interface KnownProductDetail {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  packageCategory: string; // for QrInventoryInboundView dropdown ('Botol', 'Pouch', 'Dus', 'Pcs', 'Kg', etc.)
  baseUnit: UnitType;
  allowDecimal?: boolean; // True jika barang timbangan desimal (misal beras/telur/gula kg)
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
    allowDecimal: false,
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
    allowDecimal: false,
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
    allowDecimal: false,
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
  // Contoh Barang Timbangan Desimal (Kg)
  '8991007': {
    barcode: '8991007',
    name: 'Telur Ayam Negeri Fresh Curah',
    brand: 'Peternakan Lokal Pamarayan',
    category: 'Telur & Unggas',
    packageCategory: 'Kg',
    baseUnit: 'kg',
    allowDecimal: true, // Barang timbangan desimal
    specifications: 'Telur Ayam Ras Segar Berkualitas, Dijual Berdasarkan Timbangan Kg (Bisa Desimal)',
    netto: '1 kg (Timbangan)',
    storageInstructions: 'Simpan pada rak sejuk atau lemari pendingin.',
    defaultQty: 25.5,
    costPrice: 24500,
    retailPrice: 28000,
    wholesalePrice: 26500,
    minWholesaleQty: 10,
    defaultRackLocation: 'Rak Telur Segar D-01',
    badge: 'Barang Timbangan Desimal (Kg)',
  },
  '8991001': {
    barcode: '8991001',
    name: 'Beras Rojolele Super Pulen (Curah Timbangan)',
    brand: 'Rojolele Delanggu',
    category: 'Beras & Biji-bijian',
    packageCategory: 'Kg',
    baseUnit: 'kg',
    allowDecimal: true, // Barang timbangan desimal
    specifications: 'Beras Putih Pulen Wangi Kualitas Super, Penjualan & Input Berdasarkan Berat Kg',
    netto: '1 kg (Timbangan)',
    storageInstructions: 'Simpan di tempat kering bebas hama kutu.',
    defaultQty: 50,
    costPrice: 12800,
    retailPrice: 15000,
    wholesalePrice: 14200,
    minWholesaleQty: 25,
    defaultRackLocation: 'Lumbung Beras Gudang B-01',
    badge: 'Barang Timbangan Desimal (Kg)',
  },
  '8991004': {
    barcode: '8991004',
    name: 'Gula Pasir Kristal Putih Curah Timbangan',
    brand: 'GMP / Kebun Tebu',
    category: 'Gula & Pemanis',
    packageCategory: 'Kg',
    baseUnit: 'kg',
    allowDecimal: true, // Barang timbangan desimal
    specifications: 'Gula Pasir Kristal Putih Kualitas Prima, Ditimbang Sesuai Berat Masuk',
    netto: '1 kg (Timbangan)',
    storageInstructions: 'Simpan rapat di tempat kering terlindung dari semut.',
    defaultQty: 50,
    costPrice: 15500,
    retailPrice: 17500,
    wholesalePrice: 16800,
    minWholesaleQty: 20,
    defaultRackLocation: 'Palet Gula Gudang G-02',
    badge: 'Barang Timbangan Desimal (Kg)',
  },
};

export const getKnownProductByBarcode = (rawBarcode: string): KnownProductDetail | null => {
  const clean = String(rawBarcode || '').replace(/[\r\n\t\s]/g, '').trim();
  if (!clean) return null;
  return KNOWN_BARCODES[clean] || null;
};
