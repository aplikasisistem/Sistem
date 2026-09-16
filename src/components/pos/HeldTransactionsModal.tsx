import React from 'react';
import { useStore } from '../../context/StoreContext';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { PauseCircle, PlayCircle, Trash2, X, ShoppingBag } from 'lucide-react';

interface HeldTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HeldTransactionsModal: React.FC<HeldTransactionsModalProps> = ({ isOpen, onClose }) => {
  const { heldTransactions, restoreHeldTransaction, deleteHeldTransaction } = useStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Daftar Transaksi Ditahan (Hold)</h2>
              <p className="text-xs text-slate-500">Antrean transaksi pending yang dapat dipulihkan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {heldTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <ShoppingBag className="w-12 h-12 mx-auto stroke-1 text-slate-300" />
              <p className="text-sm font-semibold">Tidak ada transaksi yang sedang ditahan</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Gunakan tombol &quot;Tahan Transaksi&quot; di kasir jika pelanggan ingin mengambil barang tambahan.
              </p>
            </div>
          ) : (
            heldTransactions.map(held => (
              <div
                key={held.id}
                className="bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-200 rounded-2xl p-4 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{held.customerNote}</h3>
                    <p className="text-[11px] text-slate-500">
                      Ditahan: {formatDateTimeIndo(held.holdTime)} oleh {held.cashierName}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-lg text-xs">
                    {formatRupiah(held.totalAmount)}
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    {held.items.length} Item Belanjaan:
                  </span>
                  {held.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="truncate pr-2">{item.product.name}</span>
                      <span className="font-mono shrink-0">
                        {item.quantity} {item.unitUsed}
                      </span>
                    </div>
                  ))}
                  {held.items.length > 3 && (
                    <p className="text-[10px] text-slate-400 italic">
                      +{held.items.length - 3} item lainnya...
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => deleteHeldTransaction(held.id)}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold flex items-center gap-1 transition"
                    title="Hapus Antrean Ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      restoreHeldTransaction(held.id);
                      onClose();
                    }}
                    className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>Pulihkan ke Kasir</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 mt-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
