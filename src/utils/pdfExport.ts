import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, OperationalExpense, SupplierPurchase, Product } from '../types';
import { formatRupiah, formatNumber, formatDateTimeIndo } from './formatters';

const STORE_NAME = 'ALUNK STORE';
const STORE_SUBTITLE = 'Sistem Manajemen Sembako Terintegrasi';
const STORE_ADDRESS = 'Jl. Tambak Pamarayan. Kp. Kedung Sapi Masjid RT. 009 / RW 003. Desa Kp. Baru. Kec. Pamarayan Serang - Banten';
const STORE_PHONE = 'Tel/Wa : +62821-2584-5237';

// Helper to draw standard header
function drawHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 76, 58); // deep emerald
  doc.text(STORE_NAME, 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(STORE_SUBTITLE, 14, 21);
  doc.text(`${STORE_ADDRESS} | ${STORE_PHONE}`, 14, 26);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, 29, 196, 29);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(title, 14, 37);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 42);
  }
}

// 1. CASH FLOW PDF
export function generateCashFlowPDF(
  transactions: Transaction[],
  purchases: SupplierPurchase[],
  expenses: OperationalExpense[],
  dateRangeLabel: string
) {
  const doc = new jsPDF();
  drawHeader(doc, 'LAPORAN ARUS KAS (CASH FLOW STATEMENT)', `Periode: ${dateRangeLabel} | Dicetak: ${formatDateTimeIndo(new Date().toISOString())}`);

  // Calculate Inflows
  const cashSales = transactions.filter(t => t.status === 'completed' && t.paymentMethod === 'tunai')
    .reduce((acc, t) => acc + t.totalAmount, 0);
  const qrisSales = transactions.filter(t => t.status === 'completed' && t.paymentMethod === 'qris')
    .reduce((acc, t) => acc + t.totalAmount, 0);
  const paidKasbon = transactions.filter(t => t.status === 'completed' && t.paymentMethod === 'kasbon' && t.isKasbonPaid)
    .reduce((acc, t) => acc + t.totalAmount, 0);
  const totalInflow = cashSales + qrisSales + paidKasbon;

  // Calculate Outflows
  const supplierCashPurchases = purchases.filter(p => p.isPaid)
    .reduce((acc, p) => acc + p.totalAmount, 0);
  const operationalExpensesTotal = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalOutflow = supplierCashPurchases + operationalExpensesTotal;

  const netCashBalance = totalInflow - totalOutflow;

  const tableData = [
    // Inflow section
    [{ content: 'A. ARUS KAS MASUK (INFLOW)', colSpan: 2, styles: { fontStyle: 'bold' as const, fillColor: [240, 253, 244] as [number, number, number] } }, ''],
    ['1. Penjualan Tunai Kasir', formatRupiah(cashSales)],
    ['2. Penjualan Non-Tunai / QRIS', formatRupiah(qrisSales)],
    ['3. Pelunasan Kasbon / Piutang Pelanggan', formatRupiah(paidKasbon)],
    [{ content: 'Total Arus Kas Masuk', styles: { fontStyle: 'bold' as const } }, { content: formatRupiah(totalInflow), styles: { fontStyle: 'bold' as const, textColor: [16, 120, 60] as [number, number, number] } }],
    
    // Outflow section
    [{ content: 'B. ARUS KAS KELUAR (OUTFLOW)', colSpan: 2, styles: { fontStyle: 'bold' as const, fillColor: [254, 242, 242] as [number, number, number] } }, ''],
    ['1. Pembelian Stok Supplier (Tunai & Tempo Lunas)', formatRupiah(supplierCashPurchases)],
    ['2. Beban Operasional (Gaji, Listrik, Sewa, dll)', formatRupiah(operationalExpensesTotal)],
    [{ content: 'Total Arus Kas Keluar', styles: { fontStyle: 'bold' as const } }, { content: formatRupiah(totalOutflow), styles: { fontStyle: 'bold' as const, textColor: [180, 40, 40] as [number, number, number] } }],

    // Net Summary
    [{ content: 'C. SALDO AKHIR KAS BERSIH (NET CASH BALANCE)', styles: { fontStyle: 'bold' as const, fontSize: 10 } }, 
     { content: formatRupiah(netCashBalance), styles: { fontStyle: 'bold' as const, fontSize: 10, textColor: netCashBalance >= 0 ? [16, 120, 60] as [number, number, number] : [180, 40, 40] as [number, number, number] } }]
  ];

  autoTable(doc, {
    startY: 48,
    head: [['Deskripsi Arus Kas', 'Jumlah Nominal (Rp)']],
    body: tableData as any,
    theme: 'grid',
    headStyles: { fillColor: [15, 76, 58], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: 'right' }
    }
  });

  // Detailed Expense breakdown table
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Rincian Beban Operasional Non-Stok:', 14, finalY);

  const expenseRows = expenses.map((e, idx) => [
    idx + 1,
    e.date,
    e.categoryLabel,
    e.description,
    formatRupiah(e.amount)
  ]);

  autoTable(doc, {
    startY: finalY + 4,
    head: [['No', 'Tanggal', 'Kategori', 'Keterangan Pengeluaran', 'Nominal']],
    body: expenseRows.length > 0 ? expenseRows : [['-', '-', 'Belum ada pengeluaran', '-', 'Rp 0']],
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 35 },
      3: { cellWidth: 70 },
      4: { cellWidth: 37, halign: 'right' }
    }
  });

  // Footer signature
  const signY = Math.min((doc as any).lastAutoTable.finalY + 20, 260);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Dibuat & Diverifikasi oleh:', 140, signY);
  doc.text('Pemilik Toko (ALUNK STORE)', 140, signY + 18);
  doc.line(140, signY + 19, 190, signY + 19);

  doc.save(`Laporan_Arus_Kas_AlunkStore_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// 2. PROFIT & LOSS PDF
export function generateProfitLossPDF(
  transactions: Transaction[],
  expenses: OperationalExpense[],
  dateRangeLabel: string
) {
  const doc = new jsPDF();
  drawHeader(doc, 'LAPORAN LABA RUGI (PROFIT & LOSS STATEMENT)', `Periode: ${dateRangeLabel} | Dicetak: ${formatDateTimeIndo(new Date().toISOString())}`);

  const completedTrx = transactions.filter(t => t.status === 'completed');
  const totalOmset = completedTrx.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalHPP = completedTrx.reduce((acc, t) => acc + t.totalCost, 0);
  const labaKotor = totalOmset - totalHPP;
  const marginKotor = totalOmset > 0 ? ((labaKotor / totalOmset) * 100).toFixed(1) : '0';

  const totalOperasional = expenses.reduce((acc, e) => acc + e.amount, 0);
  const labaBersih = labaKotor - totalOperasional;
  const marginBersih = totalOmset > 0 ? ((labaBersih / totalOmset) * 100).toFixed(1) : '0';

  const summaryData = [
    [{ content: '1. PENDAPATAN PENJUALAN (OMSET)', colSpan: 2, styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number] } }, ''],
    ['Total Penjualan Barang Sembako (Eceran & Grosir)', formatRupiah(totalOmset)],
    ['Total Harga Pokok Penjualan (HPP)', `(${formatRupiah(totalHPP)})`],
    [{ content: 'LABA KOTOR (GROSS PROFIT)', styles: { fontStyle: 'bold' as const } }, { content: `${formatRupiah(labaKotor)} (${marginKotor}%)`, styles: { fontStyle: 'bold' as const, textColor: [16, 120, 60] as [number, number, number] } }],
    
    [{ content: '2. BEBAN OPERASIONAL TOKO', colSpan: 2, styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number] } }, ''],
    ['Beban Operasional (Gaji, Listrik, Sewa, Konsumsi, dll)', `(${formatRupiah(totalOperasional)})`],
    
    [{ content: '3. LABA BERSIH OPERASIONAL (NET PROFIT)', styles: { fontStyle: 'bold' as const, fontSize: 10 } }, 
     { content: `${formatRupiah(labaBersih)} (${marginBersih}%)`, styles: { fontStyle: 'bold' as const, fontSize: 10, textColor: labaBersih >= 0 ? [16, 120, 60] as [number, number, number] : [180, 40, 40] as [number, number, number] } }]
  ];

  autoTable(doc, {
    startY: 48,
    head: [['Komponen Laba Rugi', 'Nilai / Persentase']],
    body: summaryData as any,
    theme: 'grid',
    headStyles: { fillColor: [15, 76, 58], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: 'right' }
    }
  });

  // Recent Sales summary table
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Daftar Transaksi Penjualan Terkini:', 14, finalY);

  const trxRows = completedTrx.map(t => [
    t.invoiceNumber,
    formatDateTimeIndo(t.timestamp),
    t.cashierName,
    t.paymentMethod.toUpperCase(),
    formatRupiah(t.totalAmount),
    formatRupiah(t.totalAmount - t.totalCost)
  ]);

  autoTable(doc, {
    startY: finalY + 4,
    head: [['No. Invoice', 'Waktu', 'Kasir', 'Metode', 'Total Penjualan', 'Laba']],
    body: trxRows.length > 0 ? trxRows : [['-', '-', '-', '-', 'Rp 0', 'Rp 0']],
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' }
    }
  });

  // Signature
  const signY = Math.min((doc as any).lastAutoTable.finalY + 18, 260);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Mengetahui,', 140, signY);
  doc.text('Pemilik Toko (ALUNK STORE)', 140, signY + 18);
  doc.line(140, signY + 19, 190, signY + 19);

  doc.save(`Laporan_Laba_Rugi_AlunkStore_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// 3. INVENTORY PDF
export function generateInventoryPDF(products: Product[]) {
  const doc = new jsPDF('landscape');
  
  // Custom landscape header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 76, 58);
  doc.text(STORE_NAME, 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(STORE_SUBTITLE, 14, 21);
  doc.text(`${STORE_ADDRESS} | ${STORE_PHONE}`, 14, 26);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, 29, 282, 29);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text('LAPORAN STOK & NILAI ASET INVENTARIS TOKO', 14, 37);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Dicetak pada: ${formatDateTimeIndo(new Date().toISOString())} | Total Jenis Barang: ${products.length}`, 14, 42);

  let totalAssetCost = 0;
  let totalAssetRetail = 0;
  let lowStockCount = 0;

  const rows = products.map((p, idx) => {
    const assetCost = p.stock * p.costPrice;
    const assetRetail = p.stock * p.retailPrice;
    totalAssetCost += assetCost;
    totalAssetRetail += assetRetail;

    const isLow = p.stock <= p.minStock;
    if (isLow) lowStockCount++;

    return [
      idx + 1,
      p.barcode,
      p.name,
      p.category,
      `${formatNumber(p.stock)} ${p.baseUnit}${isLow ? ' (Menipis!)' : ''}`,
      formatRupiah(p.costPrice),
      formatRupiah(p.retailPrice),
      formatRupiah(p.wholesalePrice),
      formatRupiah(assetCost),
      p.expiredDate || '-'
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [['No', 'Barcode', 'Nama Barang', 'Kategori', 'Sisa Stok', 'HPP (Beli)', 'Eceran', 'Grosir', 'Total Aset HPP', 'Kadaluwarsa']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [15, 76, 58], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 55 },
      3: { cellWidth: 30 },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 28, halign: 'right' },
      9: { cellWidth: 22, halign: 'center' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  
  // Summary boxes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(`Ringkasan Inventaris:`, 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Nilai Modal Stok (HPP): ${formatRupiah(totalAssetCost)}`, 14, finalY + 6);
  doc.text(`Potensi Omset Nilai Eceran: ${formatRupiah(totalAssetRetail)}`, 14, finalY + 11);
  doc.text(`Jumlah Barang Stok Menipis: ${lowStockCount} item`, 14, finalY + 16);

  // Signature
  doc.text('Petugas Gudang / Pemeriksa:', 210, finalY + 6);
  doc.text('( Petugas Gudang / ALUNK STORE )', 210, finalY + 24);
  doc.line(210, finalY + 25, 270, finalY + 25);

  doc.save(`Laporan_Stok_Inventaris_AlunkStore_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// 4. THERMAL RECEIPT PDF (80mm width format: 80mm = ~226pt)
export function generateThermalReceiptPDF(transaction: Transaction) {
  // 80mm width, dynamic height
  const receiptHeight = 160 + (transaction.items.length * 10);
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, receiptHeight]
  });

  let y = 10;
  
  // Center aligned Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(STORE_NAME, 40, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(STORE_SUBTITLE, 40, y, { align: 'center' });
  y += 4;
  doc.setFontSize(6.8);
  doc.text('Jl. Tambak Pamarayan. Kp. Kedung Sapi Masjid', 40, y, { align: 'center' });
  y += 3.5;
  doc.text('RT. 009 / RW 003. Desa Kp. Baru. Kec. Pamarayan Serang - Banten', 40, y, { align: 'center' });
  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(STORE_PHONE, 40, y, { align: 'center' });
  y += 5;

  // Divider
  doc.setLineDashPattern([1, 1], 0);
  doc.setDrawColor(120, 120, 120);
  doc.line(5, y, 75, y);
  y += 4;

  // Metadata
  doc.setFontSize(7.5);
  doc.text(`No: ${transaction.invoiceNumber}`, 5, y);
  y += 4;
  doc.text(`Waktu: ${formatDateTimeIndo(transaction.timestamp)}`, 5, y);
  y += 4;
  doc.text(`Kasir: ${transaction.cashierName}`, 5, y);
  if (transaction.customerName) {
    y += 4;
    doc.text(`Pelanggan: ${transaction.customerName}`, 5, y);
  }
  y += 4;

  // Divider
  doc.line(5, y, 75, y);
  y += 4;

  // Items
  doc.setFont('helvetica', 'bold');
  doc.text('Daftar Belanja:', 5, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  transaction.items.forEach(item => {
    doc.text(item.productName.substring(0, 32), 5, y);
    y += 3.5;
    const qtyText = `${item.quantity} ${item.unit} x ${formatRupiah(item.unitPrice)} (${item.priceType === 'wholesale' ? 'Grosir' : 'Eceran'})`;
    const subtotalText = formatRupiah(item.subtotal);
    doc.text(qtyText, 5, y);
    doc.text(subtotalText, 75, y, { align: 'right' });
    y += 4.5;
  });

  // Divider
  doc.line(5, y, 75, y);
  y += 4;

  // Summary
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 5, y);
  doc.text(formatRupiah(transaction.totalAmount), 75, y, { align: 'right' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.text(`Metode: ${transaction.paymentMethod.toUpperCase()}`, 5, y);
  y += 4;

  if (transaction.paymentMethod === 'tunai') {
    doc.text('Tunai:', 5, y);
    doc.text(formatRupiah(transaction.amountPaid), 75, y, { align: 'right' });
    y += 4;
    doc.text('Kembalian:', 5, y);
    doc.text(formatRupiah(transaction.change), 75, y, { align: 'right' });
    y += 4;
  } else if (transaction.paymentMethod === 'kasbon') {
    doc.text('Status: KASBON / HUTANG', 5, y);
    y += 4;
    if (transaction.dueDate) {
      doc.text(`Jatuh Tempo: ${transaction.dueDate}`, 5, y);
      y += 4;
    }
  }

  // Footer message
  y += 4;
  doc.line(5, y, 75, y);
  y += 5;

  doc.setFontSize(7);
  doc.text('Barang yang sudah dibeli tidak dapat ditukar/dikembalikan', 40, y, { align: 'center' });
  y += 3.5;
  doc.text('kecuali dengan perjanjian sebelumnya.', 40, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('*** TERIMA KASIH TELAH BERBELANJA ***', 40, y, { align: 'center' });

  doc.save(`Struk_${transaction.invoiceNumber}.pdf`);
}
