'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  RefreshCw,
  Check,
  Sparkles,
} from 'lucide-react';

export default function PricesPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [editingPrices, setEditingPrices] = useState<Record<string, any>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingTierKey, setSavingTierKey] = useState<string | null>(null);
  const [justSavedKeys, setJustSavedKeys] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Catalog and category filters
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<'all' | 'tuulo' | 'knockdown'>('all');
  const [catalogCounts, setCatalogCounts] = useState<{ all: number; tuulo: number; knockdown: number }>({
    all: 310,
    tuulo: 121,
    knockdown: 189,
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const syncTokenRef = useRef<string>('');

  const loadProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsSyncing(true);

    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (catalogTypeFilter !== 'all') params.append('catalog_type', catalogTypeFilter);
      if (selectedCategory) params.append('category', selectedCategory);

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        if (data.counts) {
          setCatalogCounts(data.counts);
        }
        // Initialize editing state
        setEditingPrices((prev) => {
          const next = { ...prev };
          data.products.forEach((p: any) => {
            // Keep existing edited input if user is actively typing, otherwise take latest
            next[p.id] = {
              SALE_PRICE: prev[p.id]?.SALE_PRICE ?? p.prices?.SALE_PRICE ?? '',
              RETAIL_PRICE: prev[p.id]?.RETAIL_PRICE ?? p.prices?.RETAIL_PRICE ?? '',
              VIP_PRICE: prev[p.id]?.VIP_PRICE ?? p.prices?.VIP_PRICE ?? '',
              GENERAL_PRICE: prev[p.id]?.GENERAL_PRICE ?? p.prices?.GENERAL_PRICE ?? '',
            };
          });
          return next;
        });
        setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
      setIsSyncing(false);
    }
  }, [search, catalogTypeFilter, selectedCategory]);

  useEffect(() => {
    loadProducts(false);
  }, [loadProducts]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.categories || []);
      });
  }, []);

  // Multi-layer Real-time Sync Listeners: BroadcastChannel, Storage, CustomEvent, Focus, Polling
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('thaiudon_sync_channel');
      bc.onmessage = (event) => {
        if (
          event.data?.type === 'PRICES_UPDATED' ||
          event.data?.type === 'PRICE_BATCH_UPDATED' ||
          event.data?.type === 'CATALOG_UPDATED'
        ) {
          loadProducts(true);
        }
      };
    } catch {}

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'thaiudon_last_sync' || e.key === 'thaiudon_batch_sync') {
        loadProducts(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleCustomSync = () => {
      loadProducts(true);
    };
    window.addEventListener('thaiudon_catalog_sync', handleCustomSync);
    window.addEventListener('thaiudon_price_sync', handleCustomSync);

    const handleFocus = () => {
      loadProducts(true);
    };
    window.addEventListener('focus', handleFocus);

    // Heartbeat Polling every 3.5 seconds
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch('/api/products/sync-status');
        const data = await res.json();
        if (data.success && data.syncToken) {
          if (!syncTokenRef.current) {
            syncTokenRef.current = data.syncToken;
          } else if (syncTokenRef.current !== data.syncToken) {
            syncTokenRef.current = data.syncToken;
            loadProducts(true);
          }
        }
      } catch {}
    }, 3500);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('thaiudon_catalog_sync', handleCustomSync);
      window.removeEventListener('thaiudon_price_sync', handleCustomSync);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, [loadProducts]);

  const handlePriceChange = (prodId: string, tier: string, val: string) => {
    setEditingPrices((prev) => ({
      ...prev,
      [prodId]: {
        ...prev[prodId],
        [tier]: val,
      },
    }));
  };

  // Helper to broadcast real-time price update
  const broadcastPriceSync = (productId: string) => {
    if (typeof window !== 'undefined') {
      try {
        const bc = new BroadcastChannel('thaiudon_sync_channel');
        bc.postMessage({ type: 'PRICES_UPDATED', productId, timestamp: Date.now() });
        localStorage.setItem('thaiudon_last_sync', Date.now().toString());
        window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
        window.dispatchEvent(new CustomEvent('thaiudon_price_sync'));
      } catch {}
    }
  };

  // 1. Instant Save for a SPECIFIC individual price tier
  const handleSaveIndividualPrice = async (prodId: string, tier: string) => {
    const key = `${prodId}_${tier}`;
    setSavingTierKey(key);
    setMessage(null);

    const currentVal = editingPrices[prodId]?.[tier];
    const pricesToSave: Record<string, any> = {
      [tier]: currentVal ?? '',
    };

    try {
      const res = await fetch('/api/prices/update-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: prodId,
          prices: pricesToSave,
          reason: `อัปเดตราคา ${tier} แบบ Real-time`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'บันทึกราคาไม่สำเร็จ' });
      } else {
        // Flash saved indicator
        setJustSavedKeys((prev) => new Set(prev).add(key));
        setTimeout(() => {
          setJustSavedKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 3000);

        broadcastPriceSync(prodId);
        loadProducts(true);
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setSavingTierKey(null);
    }
  };

  // 2. Save all 4 prices for the row
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
        // Mark all 4 tiers as saved
        const keys = ['SALE_PRICE', 'RETAIL_PRICE', 'VIP_PRICE', 'GENERAL_PRICE'].map((t) => `${prodId}_${t}`);
        setJustSavedKeys((prev) => {
          const next = new Set(prev);
          keys.forEach((k) => next.add(k));
          return next;
        });
        setTimeout(() => {
          setJustSavedKeys((prev) => {
            const next = new Set(prev);
            keys.forEach((k) => next.delete(k));
            return next;
          });
        }, 3000);

        broadcastPriceSync(prodId);
        loadProducts(true);
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
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              จัดการราคาสินค้า 4 ระดับ (Individual Price Update)
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ⚡ Real-time Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            แก้ไขราคารายตัวแบบ Real-time กด Enter หรือไอคอนถูกเพื่อบันทึกเฉพาะราคาได้ทันที พร้อมกระจายราคาล่าสุดสู่เว็บไซต์และลิงก์ลูกค้าอัตโนมัติ
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-time Indicator & Manual Refresh */}
          <button
            onClick={() => loadProducts(true)}
            disabled={isSyncing}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            title="รีเฟรชข้อมูล Real-time ทันที"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'กำลังซิงค์...' : 'รีเฟรช'}</span>
            {lastSyncTime && <span className="text-[10px] text-slate-400 font-mono">({lastSyncTime})</span>}
          </button>

          <Link
            href="/admin/prices/import-history"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-xs"
          >
            <History className="w-4 h-4 text-slate-500" />
            ประวัตินำเข้า / Rollback
          </Link>
          <Link
            href="/admin/prices/bulk-update"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            อัปเดตราคาด้วยไฟล์
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="font-bold text-xs p-1 hover:opacity-70">
            ✕
          </button>
        </div>
      )}

      {/* Catalog Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setCatalogTypeFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            catalogTypeFilter === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>สินค้าทั้งหมด ({catalogCounts.all})</span>
        </button>
        <button
          onClick={() => setCatalogTypeFilter('tuulo')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            catalogTypeFilter === 'tuulo'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-amber-900 hover:bg-amber-50 border border-amber-200'
          }`}
        >
          <span>🚪 แคตตาล็อกตู้โล ({catalogCounts.tuulo})</span>
        </button>
        <button
          onClick={() => setCatalogTypeFilter('knockdown')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            catalogTypeFilter === 'knockdown'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-indigo-900 hover:bg-indigo-50 border border-indigo-200'
          }`}
        >
          <span>🛏️ แคตตาล็อกน็อคดาวน์ ({catalogCounts.knockdown})</span>
        </button>
      </div>

      {/* Search and Category Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="ค้นหาด้วยรหัสสินค้า (SKU) หรือชื่อสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition w-full sm:w-56"
          >
            <option value="">ทุกหมวดหมู่ ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
                <th className="px-5 py-3.5 text-right">บันทึกทั้งแถว</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && products.length === 0 ? (
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
                  const isSavingRow = savingId === prod.id;

                  const renderPriceCell = (
                    tierKey: string,
                    value: any,
                    bgColor: string,
                    borderColor: string,
                    textColor: string,
                    ringColor: string
                  ) => {
                    const cellKey = `${prod.id}_${tierKey}`;
                    const isSavingThis = savingTierKey === cellKey;
                    const isJustSaved = justSavedKeys.has(cellKey);

                    return (
                      <td className="px-3 py-3.5">
                        <div className="relative w-36 mx-auto">
                          <input
                            type="number"
                            step="0.01"
                            value={value ?? ''}
                            onChange={(e) => handlePriceChange(prod.id, tierKey, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveIndividualPrice(prod.id, tierKey);
                              }
                            }}
                            className={`w-full text-right pl-7 pr-7 py-1.5 rounded-lg font-mono font-bold text-xs focus:outline-none focus:ring-2 transition ${bgColor} ${borderColor} ${textColor} ${ringColor} ${
                              isJustSaved ? 'ring-2 ring-emerald-500 bg-emerald-50' : ''
                            }`}
                            placeholder="0.00"
                          />
                          {/* Left: Quick Save Button / Spinner / Checkmark */}
                          <button
                            type="button"
                            onClick={() => handleSaveIndividualPrice(prod.id, tierKey)}
                            disabled={isSavingThis}
                            className="absolute left-1.5 top-2 text-slate-400 hover:text-emerald-600 transition"
                            title="กดบันทึกราคานี้ทันที (หรือกด Enter)"
                          >
                            {isSavingThis ? (
                              <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                            ) : isJustSaved ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                            ) : (
                              <Save className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                            )}
                          </button>

                          {/* Right: Real-time badge if saved */}
                          {isJustSaved && (
                            <span className="absolute right-1.5 top-2.5 text-[9px] text-emerald-700 font-bold pointer-events-none">
                              ✓
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  };

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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-slate-900">{prod.sku}</span>
                              {prod.catalog_type === 'tuulo' ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  ตู้โล
                                </span>
                              ) : prod.catalog_type === 'knockdown' ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                  น็อคดาวน์
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate font-medium">{prod.name}</div>
                            {prod.category_name && (
                              <div className="text-[10px] text-slate-400 mt-0.5">{prod.category_name}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 1. SALE_PRICE */}
                      {renderPriceCell(
                        'SALE_PRICE',
                        pPrices.SALE_PRICE,
                        'bg-red-50/40',
                        'border-red-200',
                        'text-red-700',
                        'focus:ring-red-400'
                      )}

                      {/* 2. RETAIL_PRICE */}
                      {renderPriceCell(
                        'RETAIL_PRICE',
                        pPrices.RETAIL_PRICE,
                        'bg-blue-50/40',
                        'border-blue-200',
                        'text-blue-700',
                        'focus:ring-blue-400'
                      )}

                      {/* 3. VIP_PRICE */}
                      {renderPriceCell(
                        'VIP_PRICE',
                        pPrices.VIP_PRICE,
                        'bg-purple-50/40',
                        'border-purple-200',
                        'text-purple-700',
                        'focus:ring-purple-400'
                      )}

                      {/* 4. GENERAL_PRICE */}
                      {renderPriceCell(
                        'GENERAL_PRICE',
                        pPrices.GENERAL_PRICE,
                        'bg-slate-50',
                        'border-slate-300',
                        'text-slate-800',
                        'focus:ring-slate-400'
                      )}

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleSavePrice(prod.id)}
                          disabled={isSavingRow}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
                          title="บันทึกราคาทั้ง 4 ระดับของสินค้านี้"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSavingRow ? 'กำลังบันทึก...' : 'บันทึก'}</span>
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
