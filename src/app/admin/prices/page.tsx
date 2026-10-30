'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Coins,
  Search,
  Save,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  History,
  Package,
} from 'lucide-react';

export default function PricesPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingPrices, setEditingPrices] = useState<Record<string, any>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products?q=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        // Initialize editing state
        const initialPrices: Record<string, any> = {};
        data.products.forEach((p: any) => {
          initialPrices[p.id] = {
            SALE_PRICE: p.prices?.SALE_PRICE ?? '',
            RETAIL_PRICE: p.prices?.RETAIL_PRICE ?? '',
            VIP_PRICE: p.prices?.VIP_PRICE ?? '',
            GENERAL_PRICE: p.prices?.GENERAL_PRICE ?? '',
          };
        });
        setEditingPrices(initialPrices);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search]);

  const handlePriceChange = (prodId: string, tier: string, val: string) => {
    setEditingPrices((prev) => ({
      ...prev,
      [prodId]: {
        ...prev[prodId],
        [tier]: val,
      },
    }));
  };

  const handleSavePrice = async (prodId: string) => {
    setSavingId(prodId);
    setMessage(null);
    try {
      const pricesToSave = editingPrices[prodId];
      const res = await fetch('/api/prices/update-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: prodId,
          prices: pricesToSave,
          reason: 'แก้ไขราคาผ่านหน้าจัดการราคา 4 ระดับ',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'บันทึกราคาไม่สำเร็จ' });
      } else {
        setMessage({ type: 'success', text: data.message || 'บันทึกราคาสำเร็จ' });
        loadProducts();
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            จัดการราคาสินค้า 4 ระดับ (Individual Price Update)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            แก้ไขราคารายตัว ปรับเปลี่ยนราคาได้ทันที พร้อมบันทึกประวัติการเปลี่ยนแปลงและกระจายไปยังระบบ Live Pricing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/prices/import-history"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
          >
            <History className="w-4 h-4 text-slate-500" />
            ประวัตินำเข้า / Rollback
          </Link>
          <Link
            href="/admin/prices/bulk-update"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm shadow-emerald-600/30 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            นำเข้าไฟล์ราคาจำนวนมาก (AI)
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="font-bold text-xs">✕</button>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา SKU หรือชื่อสินค้าเพื่อปรับราคา..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
          />
        </div>
      </div>

      {/* Prices Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 w-72">SKU & สินค้า</th>
                <th className="px-3 py-3.5 text-center text-red-700">1. ราคาเซลล์ (฿)</th>
                <th className="px-3 py-3.5 text-center text-blue-700">2. ราคาปลีก (฿)</th>
                <th className="px-3 py-3.5 text-center text-purple-700">3. ราคา VIP (฿)</th>
                <th className="px-3 py-3.5 text-center text-slate-700">4. ราคาทั่วไป (฿)</th>
                <th className="px-5 py-3.5 text-right">บันทึก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                    <div>กำลังโหลดข้อมูล...</div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    ไม่พบรายการสินค้า
                  </td>
                </tr>
              ) : (
                products.map((prod) => {
                  const pPrices = editingPrices[prod.id] || {};
                  const isSaving = savingId === prod.id;
                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {prod.images && prod.images[0] ? (
                            <img
                              src={prod.images[0]}
                              alt={prod.name}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-slate-900">{prod.sku}</div>
                            <div className="text-[11px] text-slate-500 truncate">{prod.name}</div>
                          </div>
                        </div>
                      </td>

                      {/* SALE_PRICE */}
                      <td className="px-3 py-3.5">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={pPrices.SALE_PRICE ?? ''}
                            onChange={(e) => handlePriceChange(prod.id, 'SALE_PRICE', e.target.value)}
                            className="w-32 mx-auto block text-right px-2.5 py-1.5 bg-red-50/40 border border-red-200 rounded-lg font-mono font-bold text-red-700 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
                          />
                        </div>
                      </td>

                      {/* RETAIL_PRICE */}
                      <td className="px-3 py-3.5">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={pPrices.RETAIL_PRICE ?? ''}
                            onChange={(e) => handlePriceChange(prod.id, 'RETAIL_PRICE', e.target.value)}
                            className="w-32 mx-auto block text-right px-2.5 py-1.5 bg-blue-50/40 border border-blue-200 rounded-lg font-mono font-bold text-blue-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>
                      </td>

                      {/* VIP_PRICE */}
                      <td className="px-3 py-3.5">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={pPrices.VIP_PRICE ?? ''}
                            onChange={(e) => handlePriceChange(prod.id, 'VIP_PRICE', e.target.value)}
                            className="w-32 mx-auto block text-right px-2.5 py-1.5 bg-purple-50/40 border border-purple-200 rounded-lg font-mono font-bold text-purple-700 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                      </td>

                      {/* GENERAL_PRICE */}
                      <td className="px-3 py-3.5">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={pPrices.GENERAL_PRICE ?? ''}
                            onChange={(e) => handlePriceChange(prod.id, 'GENERAL_PRICE', e.target.value)}
                            className="w-32 mx-auto block text-right px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleSavePrice(prod.id)}
                          disabled={isSaving}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          {isSaving ? (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5" />
                              บันทึก
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
