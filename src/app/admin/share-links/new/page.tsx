'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Share2, Coins, Check, Copy, ExternalLink, AlertCircle, Package } from 'lucide-react';

export default function NewShareLinkPage() {
  const router = useRouter();
  const [priceTiers, setPriceTiers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [sharingMode, setSharingMode] = useState<'FULL_CATALOG' | 'MULTIPLE_PRODUCTS' | 'SINGLE_PRODUCT'>('FULL_CATALOG');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'tuulo' | 'knockdown'>('all');
  const [selectedTierId, setSelectedTierId] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [customerName, setCustomerName] = useState('');
  const [expiresDays, setExpiresDays] = useState('30');

  // Success state
  const [createdUrl, setCreatedUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setProducts(d.products || []);
          setPriceTiers(d.priceTiers || []);
          if (d.priceTiers && d.priceTiers.length > 0) {
            setSelectedTierId(d.priceTiers[0].id);
          }
        }
      });
  }, []);

  const toggleProductSelect = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (sharingMode === 'SINGLE_PRODUCT') {
        next.clear();
      }
      next.add(id);
    }
    setSelectedProductIds(next);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sharingMode !== 'FULL_CATALOG' && selectedProductIds.size === 0) {
      setError('กรุณาเลือกสินค้าอย่างน้อย 1 รายการสำหรับโหมดนี้');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharing_mode: sharingMode,
          catalog_filter: catalogFilter,
          price_tier_id: selectedTierId,
          product_ids: Array.from(selectedProductIds),
          customer_name: customerName,
          expires_days: expiresDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'สร้างลิงก์ไม่สำเร็จ');
      } else {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setCreatedUrl(`${origin}${data.url}`);
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(createdUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/share-links"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-950 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">สร้างลิงก์แชร์ลูกค้าใหม่</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              กำหนดขอบเขตสินค้าและเลือกระดับราคาที่ต้องการเสนอให้ลูกค้า
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {createdUrl ? (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <h2 className="text-base font-bold text-emerald-950">สร้างลิงก์แชร์สำเร็จแล้ว!</h2>
              <p className="text-xs text-emerald-800">
                ลิงก์นี้พร้อมให้ลูกค้าเปิดดูได้ทันทีโดยไม่ต้องเข้าสู่ระบบ
              </p>
            </div>
          </div>

          <div className="p-3 bg-white border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-slate-800 truncate select-all">{createdUrl}</span>
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 shadow-xs transition"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <a
              href={createdUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-800 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              เปิดดูหน้าแคตตาล็อกลูกค้า
            </a>
            <Link
              href="/admin/share-links"
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
            >
              กลับหน้ารายการลิงก์
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Step 1: Sharing Mode */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Share2 className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">1. รูปแบบการแชร์ (Sharing Mode)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                  sharingMode === 'FULL_CATALOG'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  checked={sharingMode === 'FULL_CATALOG'}
                  onChange={() => setSharingMode('FULL_CATALOG')}
                  className="hidden"
                />
                <div className="font-bold text-xs text-slate-900">แชร์ทั้งแคตตาล็อก (FULL_CATALOG)</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  ลูกค้าเห็นสินค้าทั้งหมดที่เผยแพร่ หากมีสินค้าใหม่เข้ามา จะปรากฏในลิงก์นี้โดยอัตโนมัติ
                </p>
              </label>

              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                  sharingMode === 'MULTIPLE_PRODUCTS'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  checked={sharingMode === 'MULTIPLE_PRODUCTS'}
                  onChange={() => setSharingMode('MULTIPLE_PRODUCTS')}
                  className="hidden"
                />
                <div className="font-bold text-xs text-slate-900">แชร์เฉพาะสินค้าที่เลือก (MULTIPLE)</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  เลือกสินค้าหลายรายการที่ต้องการนำเสนอเฉพาะเจาะจง
                </p>
              </label>

              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                  sharingMode === 'SINGLE_PRODUCT'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  checked={sharingMode === 'SINGLE_PRODUCT'}
                  onChange={() => setSharingMode('SINGLE_PRODUCT')}
                  className="hidden"
                />
                <div className="font-bold text-xs text-slate-900">แชร์สินค้าเดี่ยว 1 รายการ (SINGLE)</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  ส่งหน้าสินค้ารายการเดียวให้ลูกค้าโดยตรง
                </p>
              </label>
            </div>

            {/* Requirement 10: Catalog Type Selector for Full Catalog Mode */}
            {sharingMode === 'FULL_CATALOG' && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  เลือกแคตตาล็อกประเภทสินค้าที่ต้องการแชร์:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCatalogFilter('all')}
                    className={`p-3 rounded-xl border text-left transition ${
                      catalogFilter === 'all'
                        ? 'border-red-600 bg-red-50/50 text-red-950 font-bold ring-1 ring-red-500'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs">ทั้งหมด (All Products)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">รวมทั้งตู้โลและน็อคดาวน์ (310 รายการ)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCatalogFilter('tuulo')}
                    className={`p-3 rounded-xl border text-left transition ${
                      catalogFilter === 'tuulo'
                        ? 'border-red-600 bg-red-50/50 text-red-950 font-bold ring-1 ring-red-500'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs">แคตตาล็อกตู้โล</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">ตู้กับข้าวและครัวอลูมิเนียม (121 รายการ)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCatalogFilter('knockdown')}
                    className={`p-3 rounded-xl border text-left transition ${
                      catalogFilter === 'knockdown'
                        ? 'border-red-600 bg-red-50/50 text-red-950 font-bold ring-1 ring-red-500'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs">แคตตาล็อกน็อคดาวน์</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Modern Luxury ชุดห้องนอน, ตู้โชว์ (189 รายการ)</div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Price Tier Selection */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Coins className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">
                2. เลือกระดับราคาที่ให้ลูกค้าเห็น (Price Tier)
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              ลูกค้าจะเห็นเฉพาะคำว่า <strong>"ราคา"</strong> พร้อมจำนวนเงินของ Price Tier นี้เท่านั้น
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {priceTiers.map((t) => (
                <label
                  key={t.id}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition ${
                    selectedTierId === t.id
                      ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    checked={selectedTierId === t.id}
                    onChange={() => setSelectedTierId(t.id)}
                    className="hidden"
                  />
                  <div className="font-bold text-xs text-slate-900">{t.name_th}</div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase mt-0.5">{t.code}</div>
                </label>
              ))}
            </div>
          </div>

          {/* Product Picker if NOT FULL_CATALOG */}
          {sharingMode !== 'FULL_CATALOG' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-800">
                    เลือกสินค้า ({selectedProductIds.size} รายการที่เลือก)
                  </h2>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 custom-scrollbar border border-slate-200 rounded-xl">
                {products.map((p) => {
                  const isChecked = selectedProductIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleProductSelect(p.id)}
                      className={`p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition ${
                        isChecked ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type={sharingMode === 'SINGLE_PRODUCT' ? 'radio' : 'checkbox'}
                          checked={isChecked}
                          onChange={() => {}}
                          className="text-emerald-600 focus:ring-emerald-500 rounded"
                        />
                        <div>
                          <span className="font-mono font-bold text-xs text-slate-900">{p.sku}</span>
                          <span className="text-xs text-slate-600 ml-2">{p.name}</span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">{p.category_name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer Name & Expiration */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
              3. ข้อมูลลูกค้าและวันหมดอายุ (Customer Info & Expiry)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อลูกค้า / องค์กร (แสดงในระบบหลังบ้าน)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="เช่น คุณวิชัย (บริษัท เอเจ้นท์ ดีไซน์)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  อายุของลิงก์แชร์
                </label>
                <select
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-600"
                >
                  <option value="7">7 วัน</option>
                  <option value="14">14 วัน</option>
                  <option value="30">30 วัน (แนะนำ)</option>
                  <option value="90">90 วัน</option>
                  <option value="0">ไม่มีวันหมดอายุ (ถาวรจนกว่าจะยกเลิก)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/admin/share-links"
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm shadow-emerald-600/30 transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  สร้างลิงก์แชร์
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
