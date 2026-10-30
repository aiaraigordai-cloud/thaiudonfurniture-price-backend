'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Edit,
  ExternalLink,
  Layers,
  AlertCircle,
  Share2,
  Eye,
  X,
  Copy,
  Check,
  Coins,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckSquare,
  Square,
  Sparkles,
  Download,
  Camera,
} from 'lucide-react';

export default function ProductsPage() {
  const downloadFile = (url: string, filename?: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || url.split('/').pop() || 'furniture-image';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [priceTiers, setPriceTiers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  // 1. Image Preview Modal state
  const [previewProduct, setPreviewProduct] = useState<any | null>(null);
  const [previewActiveImgIdx, setPreviewActiveImgIdx] = useState(0);

  // 2. Single Share Modal state
  const [shareProduct, setShareProduct] = useState<any | null>(null);
  const [shareTierId, setShareTierId] = useState('');
  const [shareCustomerName, setShareCustomerName] = useState('');
  const [shareExpiresDays, setShareExpiresDays] = useState('30');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareError, setShareError] = useState('');

  // 3. Multi-Product Share State (NEW FEATURE)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [multiShareModalOpen, setMultiShareModalOpen] = useState(false);
  const [multiShareTierId, setMultiShareTierId] = useState('');
  const [multiShareCustomerName, setMultiShareCustomerName] = useState('');
  const [multiShareExpiresDays, setMultiShareExpiresDays] = useState('30');
  const [multiGeneratingLink, setMultiGeneratingLink] = useState(false);
  const [multiGeneratedShareUrl, setMultiGeneratedShareUrl] = useState('');
  const [multiCopiedLink, setMultiCopiedLink] = useState(false);
  const [multiShareError, setMultiShareError] = useState('');

  // 4. Catalog Type Filter (all, tuulo, knockdown)
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<'all' | 'tuulo' | 'knockdown'>('all');

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedStatus) params.append('status', selectedStatus);
      if (catalogTypeFilter !== 'all') params.append('catalog_type', catalogTypeFilter);

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        if (data.priceTiers) {
          setPriceTiers(data.priceTiers);
          if (!shareTierId && data.priceTiers.length > 0) {
            setShareTierId(data.priceTiers[0].id);
          }
          if (!multiShareTierId && data.priceTiers.length > 0) {
            setMultiShareTierId(data.priceTiers[0].id);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, selectedCategory, selectedStatus, catalogTypeFilter]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.categories || []);
      });
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('ลบสินค้าสำเร็จ');
        setDeleteConfirmId(null);
        setSelectedProductIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        loadProducts();
      } else {
        alert(data.error || 'ลบไม่สำเร็จ');
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการลบสินค้า');
    }
  };

  // Open Preview Modal
  const openImagePreview = (prod: any, imgIdx = 0) => {
    setPreviewProduct(prod);
    setPreviewActiveImgIdx(imgIdx);
  };

  // Open Quick Share Modal (Single)
  const openQuickShare = (prod: any) => {
    setShareProduct(prod);
    setGeneratedShareUrl('');
    setShareError('');
    setCopiedLink(false);
    setShareCustomerName('');
    if (priceTiers.length > 0 && !shareTierId) {
      setShareTierId(priceTiers[0].id);
    }
  };

  // Handle Single Product Share Link
  const handleGenerateSingleShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareProduct || !shareTierId) return;

    setGeneratingLink(true);
    setShareError('');

    try {
      const res = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharing_mode: 'SINGLE_PRODUCT',
          price_tier_id: shareTierId,
          product_ids: [shareProduct.id],
          customer_name: shareCustomerName || `ลูกค้าสำหรับ ${shareProduct.sku}`,
          expires_days: shareExpiresDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setShareError(data.error || 'ไม่สามารถสร้างลิงก์ได้');
      } else {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const fullUrl = `${origin}${data.url}`;
        setGeneratedShareUrl(fullUrl);
      }
    } catch {
      setShareError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyShareLink = () => {
    if (!generatedShareUrl) return;
    navigator.clipboard.writeText(generatedShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Toggle selection for multiple products
  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.size === products.length && products.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      const allIds = new Set(products.map((p) => p.id));
      setSelectedProductIds(allIds);
    }
  };

  // Open Multi-Product Share Modal
  const openMultiShareModal = () => {
    if (selectedProductIds.size === 0) return;
    setMultiGeneratedShareUrl('');
    setMultiShareError('');
    setMultiCopiedLink(false);
    setMultiShareCustomerName('');
    if (priceTiers.length > 0 && !multiShareTierId) {
      setMultiShareTierId(priceTiers[0].id);
    }
    setMultiShareModalOpen(true);
  };

  // Handle Generate Multi-Product Share Link
  const handleGenerateMultiShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductIds.size === 0 || !multiShareTierId) return;

    setMultiGeneratingLink(true);
    setMultiShareError('');

    try {
      const res = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharing_mode: 'MULTIPLE_PRODUCTS',
          price_tier_id: multiShareTierId,
          product_ids: Array.from(selectedProductIds),
          customer_name: multiShareCustomerName || `ชุดสินค้าที่เลือก (${selectedProductIds.size} รายการ)`,
          expires_days: multiShareExpiresDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMultiShareError(data.error || 'ไม่สามารถสร้างลิงก์ได้');
      } else {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const fullUrl = `${origin}${data.url}`;
        setMultiGeneratedShareUrl(fullUrl);
      }
    } catch {
      setMultiShareError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setMultiGeneratingLink(false);
    }
  };

  const copyMultiShareLink = () => {
    if (!multiGeneratedShareUrl) return;
    navigator.clipboard.writeText(multiGeneratedShareUrl);
    setMultiCopiedLink(true);
    setTimeout(() => setMultiCopiedLink(false), 2000);
  };

  const selectedProductsList = products.filter((p) => selectedProductIds.has(p.id));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#402E20] tracking-tight">ระบบจัดการสินค้า (Product Catalog)</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#C5A059]/20 text-[#805216] text-[10px] font-bold border border-[#D2B681]">
              Multi-Product Sharing
            </span>
          </div>
          <p className="text-xs text-[#705E4F] mt-0.5">
            เลือกสินค้าหลายรายการเพื่อสร้างลิงก์แชร์ชุดสินค้า เลือกระดับราคาที่ต้องการส่งให้ลูกค้า พร้อมพรีวิวรูปภาพ
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Trigger Button for Multi Share */}
          {selectedProductIds.size > 0 && (
            <button
              onClick={openMultiShareModal}
              className="px-4 py-2 bg-gradient-to-r from-[#C5A059] to-[#BB9251] hover:from-[#BB9251] hover:to-[#A67D3D] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition animate-in fade-in"
            >
              <Share2 className="w-4 h-4" />
              <span>แชร์ {selectedProductIds.size} รายการที่เลือก</span>
            </button>
          )}

          <Link
            href="/admin/categories"
            className="px-3.5 py-2 bg-white hover:bg-[#FFFAF3] text-[#402E20] border border-[#D2B681] rounded-xl text-xs font-semibold flex items-center gap-2 transition"
          >
            <Layers className="w-4 h-4 text-[#805216]" />
            จัดการหมวดหมู่
          </Link>
          <Link
            href="/admin/products/new"
            className="px-4 py-2 bg-[#402E20] hover:bg-[#2E2015] text-[#FFFAF3] rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            เพิ่มสินค้าใหม่
          </Link>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-emerald-900 font-bold text-xs">✕</button>
        </div>
      )}

      {/* Catalog Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => { setCatalogTypeFilter('all'); setSelectedCategory(''); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs whitespace-nowrap ${
            catalogTypeFilter === 'all'
              ? 'bg-[#161B40] text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>สินค้าทั้งหมด (310 รายการ)</span>
        </button>

        <button
          onClick={() => { setCatalogTypeFilter('tuulo'); setSelectedCategory(''); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs whitespace-nowrap ${
            catalogTypeFilter === 'tuulo'
              ? 'bg-[#DE1B23] text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <span>แคตตาล็อกตู้โล (121 รายการ)</span>
        </button>

        <button
          onClick={() => { setCatalogTypeFilter('knockdown'); setSelectedCategory(''); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs whitespace-nowrap ${
            catalogTypeFilter === 'knockdown'
              ? 'bg-[#DE1B23] text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <span>แคตตาล็อกน็อคดาวน์ (189 รายการ)</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-[#D2B681] shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาด้วย SKU, ชื่อสินค้า หรือคำอธิบาย..."
            className="w-full pl-10 pr-4 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059] transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
          >
            <option value="">ทุกหมวดหมู่ ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
          >
            <option value="">ทุกสถานะ</option>
            <option value="Published">Published (เผยแพร่)</option>
            <option value="Draft">Draft (ร่าง)</option>
            <option value="Archived">Archived (เก็บถาวร)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#D2B681] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FFFAF3] text-[#705E4F] uppercase font-bold border-b border-[#D2B681]">
              <tr>
                {/* SELECT ALL CHECKBOX */}
                <th className="px-4 py-3.5 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-[#805216] focus:ring-[#C5A059] border-[#D2B681] rounded cursor-pointer"
                    title="เลือกทั้งหมด"
                  />
                </th>
                <th className="px-4 py-3.5">SKU & รูปภาพ (คลิกพรีวิว)</th>
                <th className="px-4 py-3.5">ชื่อสินค้า & ขนาด</th>
                <th className="px-4 py-3.5">หมวดหมู่</th>
                <th className="px-3 py-3.5 text-right text-red-700">ราคาเซลล์</th>
                <th className="px-3 py-3.5 text-right text-blue-700">ราคาปลีก</th>
                <th className="px-3 py-3.5 text-right text-purple-700">ราคา VIP</th>
                <th className="px-3 py-3.5 text-right text-slate-800">ราคาทั่วไป</th>
                <th className="px-3 py-3.5 text-center">สถานะ</th>
                <th className="px-5 py-3.5 text-right">แชร์ & จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D2B681]/30">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#705E4F]">
                    <span className="inline-block w-5 h-5 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin mb-2"></span>
                    <div>กำลังโหลดข้อมูลสินค้า...</div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#705E4F]">
                    ไม่พบรายการสินค้าที่ค้นหา
                  </td>
                </tr>
              ) : (
                products.map((prod) => {
                  const isChecked = selectedProductIds.has(prod.id);
                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-[#FFFAF3]/80 transition group ${
                        isChecked ? 'bg-[#FFFAF3] font-medium' : ''
                      }`}
                    >
                      {/* ROW CHECKBOX */}
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectProduct(prod.id)}
                          className="w-4 h-4 text-[#805216] focus:ring-[#C5A059] border-[#D2B681] rounded cursor-pointer"
                        />
                      </td>

                      {/* Thumbnail with Click to Preview Image */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => openImagePreview(prod, 0)}
                            className="relative w-12 h-12 rounded-xl bg-white border border-[#D2B681] overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#C5A059]/60 transition flex-shrink-0 group/img shadow-2xs"
                            title="คลิกเพื่อดูรูปภาพแบบ Preview"
                          >
                            {prod.images && prod.images[0] ? (
                              <img
                                src={prod.images[0]}
                                alt={prod.name}
                                className="w-full h-full object-cover group-hover/img:scale-110 transition duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#705E4F]">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-[#402E20]/50 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>

                          <div>
                            <div className="font-mono font-bold text-[#161B40] flex items-center gap-1.5">
                              <span>{prod.sku}</span>
                              {prod.catalog_type === 'tuulo' ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  ตู้โล
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                  น็อคดาวน์
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => openImagePreview(prod, 0)}
                              className="text-[10px] text-red-600 hover:text-red-700 font-bold flex items-center gap-1 mt-0.5"
                            >
                              <Eye className="w-3 h-3 text-red-600" />
                              ดูรูปภาพ
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-semibold text-[#161B40] truncate">{prod.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {prod.size_text ? (
                            <span>ขนาด: {prod.size_text}</span>
                          ) : prod.width || prod.height || prod.depth ? (
                            <span>ขนาด: {prod.width || '-'} x {prod.height || '-'} x {prod.depth || '-'} ซม.</span>
                          ) : null}
                          {prod.color && <span> | สี: {prod.color}</span>}
                          {prod.page_num && <span> | แคตตาล็อกหน้า {prod.page_num}</span>}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium">
                          {prod.category_name || 'ทั่วไป'}
                        </span>
                      </td>

                      <td className="px-3 py-3.5 text-right font-mono font-bold text-red-700">
                        {prod.prices?.SALE_PRICE && prod.prices.SALE_PRICE > 0
                          ? `฿${prod.prices.SALE_PRICE.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-blue-700">
                        {prod.prices?.RETAIL_PRICE && prod.prices.RETAIL_PRICE > 0
                          ? `฿${prod.prices.RETAIL_PRICE.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-purple-700">
                        {prod.prices?.VIP_PRICE && prod.prices.VIP_PRICE > 0
                          ? `฿${prod.prices.VIP_PRICE.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-800">
                        {prod.prices?.GENERAL_PRICE && prod.prices.GENERAL_PRICE > 0
                          ? `฿${prod.prices.GENERAL_PRICE.toLocaleString()}`
                          : '-'}
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            prod.status === 'Published'
                              ? 'bg-emerald-100 text-emerald-800'
                              : prod.status === 'Draft'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {prod.status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* QUICK SHARE BUTTON FOR EVERY SINGLE PRODUCT */}
                          <button
                            onClick={() => openQuickShare(prod)}
                            className="px-2.5 py-1.5 bg-[#FFFAF3] hover:bg-[#F7F0E6] text-[#805216] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-[#D2B681] shadow-2xs"
                            title="สร้างลิงก์แชร์สินค้านี้"
                          >
                            <Share2 className="w-3.5 h-3.5 text-[#C5A059]" />
                            <span>แชร์</span>
                          </button>

                          <Link
                            href={`/admin/products/${prod.id}`}
                            className="p-1.5 text-[#705E4F] hover:text-[#402E20] hover:bg-[#FFFAF3] rounded-lg transition"
                            title="แก้ไขสินค้า"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => setDeleteConfirmId(prod.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="ลบสินค้า"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FLOATING ACTION BAR FOR MULTI-SELECTION (Sticky Bottom Bar) */}
      {selectedProductIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-in slide-in-from-bottom-6 duration-200">
          <div className="bg-[#402E20] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-[#D2B681] flex flex-wrap items-center justify-between gap-4 max-w-2xl w-full">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-[#C5A059] text-[#402E20] font-black text-xs flex items-center justify-center">
                {selectedProductIds.size}
              </span>
              <div>
                <div className="text-xs font-bold text-[#FFFAF3]">
                  เลือกสินค้าแล้ว {selectedProductIds.size} รายการ
                </div>
                <div className="text-[10px] text-[#D2B681]">
                  พร้อมสร้างลิงก์แชร์เฉพาะกลุ่มสินค้านี้
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedProductIds(new Set())}
                className="px-3 py-1.5 bg-[#2E2015] hover:bg-[#1F160E] text-[#D2B681] rounded-xl text-xs font-medium transition"
              >
                ยกเลิกการเลือก
              </button>

              <button
                onClick={openMultiShareModal}
                className="px-4 py-2 bg-gradient-to-r from-[#C5A059] to-[#BB9251] hover:from-[#BB9251] hover:to-[#A67D3D] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
              >
                <Share2 className="w-4 h-4" />
                <span>แชร์สินค้าที่เลือก ({selectedProductIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. ADMIN IMAGE PREVIEW MODAL (LIGHTBOX) */}
      {previewProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200 border border-[#D2B681]">
            {/* Header */}
            <div className="p-4 px-6 border-b border-[#D2B681]/40 flex items-center justify-between bg-[#FFFAF3]">
              <div className="flex items-center gap-2.5">
                <div className="font-mono font-bold text-xs bg-[#402E20] text-[#FFFAF3] px-2.5 py-1 rounded-lg">
                  {previewProduct.sku}
                </div>
                <h3 className="font-bold text-sm text-[#402E20] truncate max-w-md">
                  {previewProduct.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                className="p-2 rounded-full text-[#705E4F] hover:text-[#402E20] hover:bg-[#F7F0E6] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
              {/* Big High-Res Image View with Navigation */}
              <div className="relative aspect-[16/10] bg-[#1A130C] rounded-2xl overflow-hidden flex items-center justify-center border border-[#D2B681]">
                {previewProduct.images && previewProduct.images[previewActiveImgIdx] ? (
                  <img
                    src={previewProduct.images[previewActiveImgIdx]}
                    alt={previewProduct.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-slate-500 flex flex-col items-center gap-2">
                    <Package className="w-16 h-16 stroke-1" />
                    <span className="text-xs">ไม่มีรูปภาพ</span>
                  </div>
                )}

                {/* Left/Right controls if multiple */}
                {previewProduct.images && previewProduct.images.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setPreviewActiveImgIdx((prev) =>
                          prev === 0 ? previewProduct.images.length - 1 : prev - 1
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() =>
                        setPreviewActiveImgIdx((prev) =>
                          prev === previewProduct.images.length - 1 ? 0 : prev + 1
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails row */}
              {previewProduct.images && previewProduct.images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {previewProduct.images.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setPreviewActiveImgIdx(idx)}
                      className={`w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition ${
                        previewActiveImgIdx === idx
                          ? 'border-[#C5A059] ring-2 ring-[#C5A059]/40'
                          : 'border-[#D2B681]/50 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Action: Download / Save Original File */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-600 font-medium">
                  {previewProduct.images && previewProduct.images[previewActiveImgIdx]?.includes('/ref/')
                    ? '📸 ภาพอ้างอิงจริง (Reference / Dicut)'
                    : 'ภาพกราฟิกสินค้าหลัก (Graphic Presentation)'}
                </div>
                <button
                  onClick={() => {
                    const currentImg = previewProduct.images?.[previewActiveImgIdx];
                    const isRef = currentImg?.includes('/ref/');
                    const filename = isRef ? previewProduct.ref_filename : previewProduct.graphic_filename;
                    downloadFile(currentImg, filename);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>บันทึกไฟล์ภาพนี้ (Save File)</span>
                </button>
              </div>

              {/* Specs & Dimensions */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[#FFFAF3] rounded-xl border border-[#D2B681]/40">
                  <div className="text-[10px] text-[#705E4F]">ขนาด (ก x ส x ล)</div>
                  <div className="font-semibold text-[#402E20] mt-0.5">
                    {previewProduct.width || '-'} x {previewProduct.height || '-'} x {previewProduct.depth || '-'} ซม.
                  </div>
                </div>

                <div className="p-3 bg-[#FFFAF3] rounded-xl border border-[#D2B681]/40">
                  <div className="text-[10px] text-[#705E4F]">สีสินค้า</div>
                  <div className="font-semibold text-[#402E20] mt-0.5">{previewProduct.color || '-'}</div>
                </div>

                <div className="p-3 bg-[#FFFAF3] rounded-xl border border-[#D2B681]/40">
                  <div className="text-[10px] text-[#705E4F]">หมวดหมู่</div>
                  <div className="font-semibold text-[#402E20] mt-0.5">{previewProduct.category_name || '-'}</div>
                </div>

                <div className="p-3 bg-[#FFFAF3] rounded-xl border border-[#D2B681]/40">
                  <div className="text-[10px] text-[#705E4F]">สถานะ</div>
                  <div className="font-semibold text-emerald-700 mt-0.5">{previewProduct.status}</div>
                </div>
              </div>

              {/* 4 Prices Summary for Admin */}
              <div className="p-4 bg-[#FFFAF3] rounded-2xl border border-[#D2B681]/60 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#402E20]">
                  <Coins className="w-4 h-4 text-[#C5A059]" />
                  <span>ราคาทั้ง 4 ระดับ (มุมมองแอดมินหลังบ้าน)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-red-50/60 border border-red-200 rounded-xl">
                    <span className="text-[10px] text-red-700 block font-semibold">1. ราคาเซลล์</span>
                    <span className="font-mono font-bold text-red-800 text-sm">
                      ฿{previewProduct.prices?.SALE_PRICE?.toLocaleString() ?? '-'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl">
                    <span className="text-[10px] text-blue-700 block font-semibold">2. ราคาปลีก</span>
                    <span className="font-mono font-bold text-blue-800 text-sm">
                      ฿{previewProduct.prices?.RETAIL_PRICE?.toLocaleString() ?? '-'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-purple-50/60 border border-purple-200 rounded-xl">
                    <span className="text-[10px] text-purple-700 block font-semibold">3. ราคา VIP</span>
                    <span className="font-mono font-bold text-purple-800 text-sm">
                      ฿{previewProduct.prices?.VIP_PRICE?.toLocaleString() ?? '-'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-700 block font-semibold">4. ราคาทั่วไป</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      ฿{previewProduct.prices?.GENERAL_PRICE?.toLocaleString() ?? '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-[#D2B681]/40 flex items-center justify-between bg-[#FFFAF3]">
              <button
                onClick={() => {
                  const p = previewProduct;
                  setPreviewProduct(null);
                  openQuickShare(p);
                }}
                className="px-4 py-2 bg-gradient-to-r from-[#C5A059] to-[#BB9251] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                แชร์ลิงก์สินค้านี้
              </button>
              <button
                onClick={() => setPreviewProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-[#705E4F] hover:bg-[#F7F0E6] rounded-xl transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MULTI-PRODUCT SHARE MODAL (NEW FEATURE) */}
      {multiShareModalOpen && (
        <div className="fixed inset-0 bg-[#402E20]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 custom-scrollbar relative animate-in fade-in zoom-in-95 duration-200 border border-[#D2B681]">
            <button
              onClick={() => setMultiShareModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#FFFAF3] text-[#705E4F] hover:bg-[#F7F0E6] border border-[#D2B681] transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C5A059]/15 text-[#805216] text-[10px] font-bold border border-[#D2B681] mb-2">
                <Sparkles className="w-3 h-3 text-[#C5A059]" />
                แชร์สินค้าหลายรายการพร้อมกัน (Multiple Products Share)
              </div>
              <h2 className="text-base font-bold text-[#402E20] tracking-tight">
                สร้างลิงก์แชร์เฉพาะกลุ่มสินค้า ({selectedProductIds.size} รายการ)
              </h2>
              <p className="text-xs text-[#705E4F] mt-0.5">
                เลือกระดับราคาที่ต้องการเสนอให้ลูกค้า ลูกค้าจะเห็นเฉพาะกลุ่มสินค้านี้และแสดงคำว่า <strong>"ราคา"</strong> เท่านั้น
              </p>
            </div>

            {/* Selected Products Preview Row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#402E20]">
                <span>รายการสินค้าที่เลือกไว้ ({selectedProductsList.length}):</span>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-[#D2B681]/30 border border-[#D2B681] rounded-2xl bg-[#FFFAF3] p-1 custom-scrollbar">
                {selectedProductsList.map((prod) => (
                  <div key={prod.id} className="p-2 flex items-center justify-between gap-3 hover:bg-white/60 rounded-xl transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {prod.images && prod.images[0] ? (
                        <img
                          src={prod.images[0]}
                          alt={prod.name}
                          className="w-10 h-10 object-cover rounded-lg border border-[#D2B681] flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-bold text-[#805216]">{prod.sku}</div>
                        <div className="text-xs text-[#402E20] truncate">{prod.name}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSelectProduct(prod.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition"
                      title="นำรายการนี้ออก"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {multiShareError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{multiShareError}</span>
              </div>
            )}

            {/* Success View */}
            {multiGeneratedShareUrl ? (
              <div className="bg-[#FFFAF3] border-2 border-[#D2B681] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#805216] font-bold text-xs">
                  <Check className="w-4 h-4 text-[#C5A059]" />
                  <span>สร้างลิงก์แชร์ {selectedProductIds.size} รายการสำเร็จแล้ว!</span>
                </div>

                <div className="p-3 bg-white border border-[#D2B681] rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                  <span className="font-mono text-xs text-[#402E20] truncate select-all">
                    {multiGeneratedShareUrl}
                  </span>
                  <button
                    onClick={copyMultiShareLink}
                    className="px-3.5 py-1.5 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-lg text-xs font-bold flex items-center gap-1 flex-shrink-0 shadow-xs transition"
                  >
                    {multiCopiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {multiCopiedLink ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={multiGeneratedShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 bg-[#402E20] hover:bg-[#2E2015] text-[#FFFAF3] rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#C5A059]" />
                    เปิดดูหน้าแคตตาล็อกลูกค้า
                  </a>
                  <button
                    onClick={() => {
                      setMultiShareModalOpen(false);
                      setSelectedProductIds(new Set());
                    }}
                    className="px-4 py-2.5 bg-white border border-[#D2B681] text-[#705E4F] rounded-xl text-xs font-semibold hover:bg-[#FFFAF3] transition"
                  >
                    เสร็จสิ้น
                  </button>
                </div>
              </div>
            ) : (
              /* Configuration Form */
              <form onSubmit={handleGenerateMultiShareLink} className="space-y-4">
                {/* 4 Price Tier Cards */}
                <div>
                  <label className="block text-xs font-bold text-[#402E20] mb-2">
                    เลือกระดับราคาที่ต้องการเสนอให้ลูกค้า:
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {priceTiers.map((t) => {
                      const isSelected = multiShareTierId === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setMultiShareTierId(t.id)}
                          className={`p-3 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#C5A059] bg-[#FFFAF3] shadow-xs ring-1 ring-[#C5A059]'
                              : 'border-[#D2B681]/60 hover:border-[#D2B681] bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-[#402E20]">{t.name_th}</span>
                            <input
                              type="radio"
                              name="multi_tier"
                              checked={isSelected}
                              onChange={() => setMultiShareTierId(t.id)}
                              className="text-[#805216] focus:ring-[#C5A059]"
                            />
                          </div>
                          <div className="text-[10px] font-mono text-[#805216] font-bold uppercase">
                            {t.code}
                          </div>
                          <div className="text-[10px] text-[#705E4F] mt-1">
                            {t.description || '-'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Customer Name / Reference */}
                <div>
                  <label className="block text-xs font-semibold text-[#402E20] mb-1">
                    ชื่อลูกค้า / บันทึกอ้างอิง (แสดงในหลังบ้านและหัวหน้าเว็บลูกค้า)
                  </label>
                  <input
                    type="text"
                    value={multiShareCustomerName}
                    onChange={(e) => setMultiShareCustomerName(e.target.value)}
                    placeholder="เช่น คุณสมศักดิ์ (ชุดห้องนอน + ตู้เสื้อผ้า)"
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                {/* Expiry */}
                <div>
                  <label className="block text-xs font-semibold text-[#402E20] mb-1">
                    อายุของลิงก์แชร์
                  </label>
                  <select
                    value={multiShareExpiresDays}
                    onChange={(e) => setMultiShareExpiresDays(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                  >
                    <option value="7">7 วัน</option>
                    <option value="14">14 วัน</option>
                    <option value="30">30 วัน (แนะนำ)</option>
                    <option value="90">90 วัน</option>
                    <option value="0">ไม่มีวันหมดอายุ (ใช้ได้ตลอดไป)</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#D2B681]/30">
                  <button
                    type="button"
                    onClick={() => setMultiShareModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-[#705E4F] hover:bg-[#F7F0E6] rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={multiGeneratingLink || selectedProductIds.size === 0 || !multiShareTierId}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#C5A059] to-[#BB9251] hover:from-[#BB9251] hover:to-[#A67D3D] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {multiGeneratingLink ? (
                      'กำลังสร้างลิงก์...'
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        สร้างลิงก์แชร์ ({selectedProductIds.size} รายการ)
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. SINGLE PRODUCT QUICK SHARE MODAL */}
      {shareProduct && (
        <div className="fixed inset-0 bg-[#402E20]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 custom-scrollbar relative animate-in fade-in zoom-in-95 duration-200 border border-[#D2B681]">
            <button
              onClick={() => setShareProduct(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#FFFAF3] text-[#705E4F] hover:bg-[#F7F0E6] border border-[#D2B681] transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C5A059]/15 text-[#805216] text-[10px] font-bold border border-[#D2B681] mb-2">
                <Share2 className="w-3 h-3 text-[#C5A059]" />
                แชร์สินค้าเฉพาะตัว (Single Product Share)
              </div>
              <h2 className="text-base font-bold text-[#402E20] tracking-tight">
                เลือกระดับราคาที่จะแชร์ให้ลูกค้าดู
              </h2>
              <p className="text-xs text-[#705E4F] mt-0.5">
                ลิงก์นี้จะแสดงเฉพาะสินค้าชิ้นนี้ และระบุเพียงคำว่า <strong>"ราคา"</strong> ตามประเภทที่คุณเลือก
              </p>
            </div>

            {/* Product Summary Mini Card */}
            <div className="p-3 bg-[#FFFAF3] rounded-2xl border border-[#D2B681] flex items-center gap-3">
              {shareProduct.images && shareProduct.images[0] ? (
                <img
                  src={shareProduct.images[0]}
                  alt={shareProduct.name}
                  className="w-14 h-14 object-cover rounded-xl border border-[#D2B681] flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                  <Package className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <span className="font-mono text-xs font-bold text-[#805216]">{shareProduct.sku}</span>
                <h4 className="text-xs font-semibold text-[#402E20] truncate">{shareProduct.name}</h4>
                <div className="text-[11px] text-[#705E4F] mt-0.5">{shareProduct.category_name || 'ทั่วไป'}</div>
              </div>
            </div>

            {shareError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{shareError}</span>
              </div>
            )}

            {/* Success state: Link Created! */}
            {generatedShareUrl ? (
              <div className="bg-[#FFFAF3] border-2 border-[#D2B681] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#805216] font-bold text-xs">
                  <Check className="w-4 h-4 text-[#C5A059]" />
                  <span>สร้างลิงก์แชร์สินค้านี้สำเร็จแล้ว!</span>
                </div>

                <div className="p-3 bg-white border border-[#D2B681] rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                  <span className="font-mono text-xs text-[#402E20] truncate select-all">
                    {generatedShareUrl}
                  </span>
                  <button
                    onClick={copyShareLink}
                    className="px-3.5 py-1.5 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-lg text-xs font-bold flex items-center gap-1 flex-shrink-0 shadow-xs transition"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'คัดลอกแล้ว' : 'คัดลอก'}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={generatedShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 bg-[#402E20] hover:bg-[#2E2015] text-[#FFFAF3] rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#C5A059]" />
                    เปิดดูหน้าลูกค้าที่แชร์
                  </a>
                  <button
                    onClick={() => setShareProduct(null)}
                    className="px-4 py-2.5 bg-white border border-[#D2B681] text-[#705E4F] rounded-xl text-xs font-semibold hover:bg-[#FFFAF3] transition"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            ) : (
              /* Selection Form */
              <form onSubmit={handleGenerateSingleShareLink} className="space-y-4">
                {/* 4 Price Tiers Cards */}
                <div>
                  <label className="block text-xs font-bold text-[#402E20] mb-2">
                    เลือกระดับราคาที่ต้องการเสนอให้ลูกค้า:
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {priceTiers.map((t) => {
                      const tierPrice = shareProduct.prices?.[t.code];
                      const isSelected = shareTierId === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setShareTierId(t.id)}
                          className={`p-3 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#C5A059] bg-[#FFFAF3] shadow-xs ring-1 ring-[#C5A059]'
                              : 'border-[#D2B681]/60 hover:border-[#D2B681] bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-[#402E20]">{t.name_th}</span>
                            <input
                              type="radio"
                              name="quick_tier"
                              checked={isSelected}
                              onChange={() => setShareTierId(t.id)}
                              className="text-[#805216] focus:ring-[#C5A059]"
                            />
                          </div>
                          <div className="text-base font-black font-mono text-[#C5A059] mt-1">
                            {tierPrice !== undefined ? `฿${tierPrice.toLocaleString()}` : '-'}
                          </div>
                          <div className="text-[10px] text-[#705E4F] mt-0.5">
                            ลูกค้าจะเห็นเป็น: "ราคา ฿{tierPrice?.toLocaleString() || '0'}"
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Customer Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#402E20] mb-1">
                    ชื่อลูกค้า / บันทึกอ้างอิง (แสดงในหลังบ้านเท่านั้น)
                  </label>
                  <input
                    type="text"
                    value={shareCustomerName}
                    onChange={(e) => setShareCustomerName(e.target.value)}
                    placeholder="เช่น คุณกฤษดา (สนใจชุดนี้)"
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                {/* Expiry */}
                <div>
                  <label className="block text-xs font-semibold text-[#402E20] mb-1">
                    อายุของลิงก์แชร์
                  </label>
                  <select
                    value={shareExpiresDays}
                    onChange={(e) => setShareExpiresDays(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                  >
                    <option value="7">7 วัน</option>
                    <option value="14">14 วัน</option>
                    <option value="30">30 วัน (แนะนำ)</option>
                    <option value="90">90 วัน</option>
                    <option value="0">ไม่มีวันหมดอายุ (ใช้ได้ตลอดไป)</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#D2B681]/30">
                  <button
                    type="button"
                    onClick={() => setShareProduct(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-[#705E4F] hover:bg-[#F7F0E6] rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={generatingLink || !shareTierId}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#C5A059] to-[#BB9251] hover:from-[#BB9251] hover:to-[#A67D3D] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {generatingLink ? (
                      'กำลังสร้างลิงก์...'
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        สร้างลิงก์แชร์สินค้านี้ทันที
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-[#402E20]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#D2B681]">
            <h3 className="text-base font-bold text-[#402E20] mb-2">ยืนยันการลบสินค้า</h3>
            <p className="text-xs text-[#705E4F] mb-4 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบสินค้ารายการนี้? ประวัติราคาและความเชื่อมโยงกับลิงก์จะถูกนำออกอย่างถาวร
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-[#705E4F] hover:bg-[#F7F0E6] rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
