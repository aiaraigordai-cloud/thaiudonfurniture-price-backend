'use client';

import { useState, useEffect } from 'react';
import {
  Package,
  Search,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Eye,
  X,
  Truck,
  Phone,
  MessageCircle,
  Sparkles,
  MapPin,
  Clock,
  Download,
  Image as ImageIcon,
  Camera,
  ChevronLeft,
} from 'lucide-react';

export default function CustomerCatalogPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalogData, setCatalogData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [catalogTab, setCatalogTab] = useState<'all' | 'tuulo' | 'knockdown'>('all');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductModal, setSelectedProductModal] = useState<any | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'graphic' | 'ref'>('graphic');

  const fetchCustomerCatalog = async () => {
    try {
      const res = await fetch(`/api/customer/${params.token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'ไม่สามารถเปิดแคตตาล็อกได้');
      } else {
        setCatalogData(data);
        if (data.catalogFilter && data.catalogFilter !== 'all') {
          setCatalogTab(data.catalogFilter);
        }
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการโหลดแคตตาล็อกสินค้า');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerCatalog();

    // LIVE PRICING POLLING: Poll every 15 seconds to ensure live price updates
    const interval = setInterval(() => {
      fetchCustomerCatalog();
    }, 15000);

    return () => clearInterval(interval);
  }, [params.token]);

  // Helper to trigger file download with original filename & extension
  const downloadFile = (url: string, filename?: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || url.split('/').pop() || 'furniture-image';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Pre-filled LINE OA inquiry URL
  const getLineInquiryUrl = (prod: any) => {
    const text = `สวัสดีครับ/ค่ะ สนใจสอบถามสินค้า\nรหัส: ${prod.sku}\nชื่อ: ${prod.name}\n${prod.sizeText ? 'ขนาด: ' + prod.sizeText + '\n' : ''}(จากแคตตาล็อกออนไลน์ ไทยอุดรเฟอร์นิเจอร์)`;
    return `https://line.me/ti/p/~0930494178?text=${encodeURIComponent(text)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-3 border-[#DE1B23] border-t-transparent rounded-full animate-spin mb-3"></div>
        <div className="text-base font-bold text-[#161B40]">กำลังเปิดแคตตาล็อกทางการ ไทยอุดรเฟอร์นิเจอร์...</div>
        <div className="text-xs text-slate-500 mt-1">อัปเดตราคาล่าสุดตรงจากระบบโรงงาน (Live Pricing)</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-red-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-lg font-bold text-[#161B40]">ไม่สามารถเปิดแคตตาล็อกได้</h1>
          <p className="text-xs text-slate-600 leading-relaxed">{error}</p>
          <div className="pt-2 text-[11px] text-slate-500">
            หากท่านเป็นเจ้าหน้าที่ กรุณาตรวจสอบสถานะลิงก์หรือวันหมดอายุในระบบหลังบ้าน
          </div>
        </div>
      </div>
    );
  }

  const products: any[] = catalogData?.products || [];
  const isSingleProductMode = catalogData?.sharingMode === 'SINGLE_PRODUCT' && products.length === 1;
  const singleProduct = isSingleProductMode ? products[0] : null;

  // Filter products by search, catalogTab (tuulo/knockdown/all), and category
  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.sizeText?.toLowerCase().includes(search.toLowerCase());

    const matchCatalog =
      catalogTab === 'all' ||
      (catalogTab === 'tuulo' && p.catalogType === 'tuulo') ||
      (catalogTab === 'knockdown' && p.catalogType === 'knockdown');

    const matchCat = !selectedCategory || p.category_name === selectedCategory;

    return matchSearch && matchCatalog && matchCat;
  });

  // Calculate available categories based on current catalog tab
  const tabProducts = products.filter((p) => {
    if (catalogTab === 'tuulo') return p.catalogType === 'tuulo';
    if (catalogTab === 'knockdown') return p.catalogType === 'knockdown';
    return true;
  });

  const categoryCounts: Record<string, number> = {};
  tabProducts.forEach((p) => {
    if (p.category_name) {
      categoryCounts[p.category_name] = (categoryCounts[p.category_name] || 0) + 1;
    }
  });

  const availableCategories = Object.keys(categoryCounts);

  // Modal navigation
  const currentModalIndex = selectedProductModal
    ? filtered.findIndex((p) => p.id === selectedProductModal.id)
    : -1;

  const handlePrevProduct = () => {
    if (currentModalIndex > 0) {
      setSelectedProductModal(filtered[currentModalIndex - 1]);
      setModalActiveTab('graphic');
    }
  };

  const handleNextProduct = () => {
    if (currentModalIndex >= 0 && currentModalIndex < filtered.length - 1) {
      setSelectedProductModal(filtered[currentModalIndex + 1]);
      setModalActiveTab('graphic');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-[#161B40]">
      {/* 1. TOP BAR — Factory Hotline & LINE info */}
      <aside className="bg-[#161B40] text-slate-200 text-[11px] py-2 px-4 border-b border-red-600/40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-y-1 gap-x-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold flex items-center gap-1 text-white">
              <Phone className="w-3 h-3 text-[#DE1B23]" />
              สายด่วนโรงงาน:
            </span>
            <a href="tel:0930494178" className="hover:text-red-400 font-bold transition">093-049-4178</a>
            <span>,</span>
            <a href="tel:0617891164" className="hover:text-red-400 font-bold transition">061-789-1164</a>
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="hidden sm:inline">💬 Line ID: <strong className="text-white">0930494178</strong></span>
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="hidden sm:inline">⏰ เปิดทุกวัน 8:00 - 17:30 น.</span>
          </div>

          <div className="text-[10px] text-red-300 font-medium">
            โชว์รูมใหญ่: ถนนมิตรภาพ อุดรธานี
          </div>
        </div>
      </aside>

      {/* 2. SITE HEADER — Official Logo & Brand */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Brand Info with Red Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/images/logo-red.png"
              alt="ไทยอุดรเฟอร์นิเจอร์"
              className="w-12 h-12 object-contain rounded-full shadow-sm p-0.5 bg-white border border-slate-200"
            />
            <div>
              <div className="text-base sm:text-lg font-extrabold text-[#161B40] tracking-tight leading-tight flex items-center gap-2">
                <span>ไทยอุดรเฟอร์นิเจอร์</span>
                <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
                  Official
                </span>
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">
                {(catalogData?.customerName || 'แคตตาล็อกสินค้าทางการ').replace(/\s*\(?\bVIP\b\)?/gi, '').trim() || 'แคตตาล็อกสินค้าทางการ'}
              </div>
            </div>
          </div>

          {/* Contact Button */}
          <div className="flex items-center gap-2">
            <a
              href="https://line.me/ti/p/~0930494178"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#06C755] hover:bg-[#05b54c] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">สั่งซื้อ/สอบถาม LINE</span>
            </a>
          </div>
        </div>
      </header>

      {/* 3. MAIN CATALOG CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {/* SINGLE PRODUCT MODE VIEW */}
        {isSingleProductMode && singleProduct ? (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-2">
            {/* Left: Product Images with Tabs */}
            <div className="p-6 bg-slate-50 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200">
              <div className="space-y-4">
                <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs flex items-center justify-center">
                  <img
                    src={singleProduct.images?.[0] || singleProduct.refImageUrl}
                    alt={singleProduct.name}
                    className="w-full h-full object-contain"
                  />
                  {singleProduct.category_name && (
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#161B40] text-white text-xs font-semibold">
                      {singleProduct.category_name}
                    </div>
                  )}
                </div>

                {/* Download Actions */}
                <div className="flex items-center gap-2">
                  {singleProduct.images?.[0] && (
                    <button
                      onClick={() => downloadFile(singleProduct.images[0], singleProduct.graphicFilename)}
                      className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-red-600" />
                      <span>ดาวน์โหลดภาพกราฟิก</span>
                    </button>
                  )}
                  {singleProduct.refImageUrl && (
                    <button
                      onClick={() => downloadFile(singleProduct.refImageUrl, singleProduct.refFilename)}
                      className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>ดาวน์โหลดภาพอ้างอิง</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-[#161B40]">
                  <ShieldCheck className="w-4 h-4 text-red-600" />
                  <span>รับประกันโครงสร้างแข็งแรง มาตรฐานไทยอุดรเฟอร์นิเจอร์</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <Truck className="w-3.5 h-3.5 text-[#06C755]" />
                  <span>ส่งฟรีพร้อมทีมช่างยกติดตั้งถึงห้อง (อุดรธานี ขอนแก่น หนองคาย หนองบัวลำภู)</span>
                </div>
              </div>
            </div>

            {/* Right: Details & Strict Price */}
            <div className="p-6 md:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="font-mono text-xs font-bold text-red-600 tracking-wider uppercase">
                    รหัสสินค้า: {singleProduct.sku}
                  </div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#161B40] tracking-tight mt-1 leading-snug">
                    {singleProduct.name}
                  </h1>
                </div>

                {singleProduct.description && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    {singleProduct.description}
                  </p>
                )}

                {/* Specs Box */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#161B40]">สเปกและขนาดสินค้า</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">ขนาด</span>
                      <span className="font-bold text-[#161B40]">
                        {singleProduct.sizeText || `${singleProduct.width || '-'} x ${singleProduct.height || '-'} x ${singleProduct.depth || '-'} ซม.`}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">สี / วัสดุ</span>
                      <span className="font-bold text-[#161B40]">
                        {singleProduct.color || 'ตามภาพมาตรฐาน'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strict Price Box — Rule 11: Display '-' if no price */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      ราคา
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-[#DE1B23] font-mono tracking-tight mt-0.5">
                      {singleProduct.price && singleProduct.price > 0
                        ? `฿${singleProduct.price.toLocaleString()}`
                        : '-'}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <div>รวมภาษีมูลค่าเพิ่ม</div>
                    <div className="text-[#06C755] font-semibold flex items-center gap-1 justify-end">
                      <Truck className="w-3 h-3" />
                      <span>ส่งฟรี 4 จังหวัด</span>
                    </div>
                  </div>
                </div>

                <a
                  href={getLineInquiryUrl(singleProduct)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>สอบถาม/สั่งซื้อสินค้านี้ทาง LINE</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* MULTIPLE PRODUCTS / FULL CATALOG VIEW */
          <div className="space-y-6">
            {/* Catalog Switcher Tabs (ทั้งหมด / ตู้โล / น็อคดาวน์) */}
            {catalogData?.catalogFilter === 'all' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => { setCatalogTab('all'); setSelectedCategory(''); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
                    catalogTab === 'all'
                      ? 'bg-[#161B40] text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>ทั้งหมด ({products.length})</span>
                </button>
                <button
                  onClick={() => { setCatalogTab('tuulo'); setSelectedCategory(''); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
                    catalogTab === 'tuulo'
                      ? 'bg-red-600 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>แคตตาล็อกตู้โล ({products.filter(p => p.catalogType === 'tuulo').length})</span>
                </button>
                <button
                  onClick={() => { setCatalogTab('knockdown'); setSelectedCategory(''); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
                    catalogTab === 'knockdown'
                      ? 'bg-red-600 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>แคตตาล็อกน็อคดาวน์ ({products.filter(p => p.catalogType === 'knockdown').length})</span>
                </button>
              </div>
            )}

            {/* Search & Category Filter Section */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหารหัสสินค้า, ชื่อรุ่น, ขนาด..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-[#161B40] focus:outline-none focus:border-red-500 focus:bg-white transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              {availableCategories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                      selectedCategory === ''
                        ? 'bg-[#161B40] text-white font-bold'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    ทุกหมวดหมู่ ({tabProducts.length})
                  </button>
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                        selectedCategory === cat
                          ? 'bg-[#DE1B23] text-white font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {cat} ({categoryCounts[cat] || 0})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results Count Header */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <div>
                แสดงรายการสินค้า <strong className="text-[#161B40]">{filtered.length}</strong> รายการ
              </div>
              <div className="text-xs text-red-600 font-semibold flex items-center gap-1">
                <span>ข้อมูลราคาแบบ Realtime</span>
              </div>
            </div>

            {/* Product Grid — Designed like https://thaiudon-knockdown.pages.dev/knockdown */}
            {filtered.length === 0 ? (
              <div className="py-20 text-center text-slate-500 space-y-2 bg-white rounded-3xl border border-slate-200">
                <Package className="w-12 h-12 mx-auto text-slate-300" />
                <div className="text-base font-bold text-[#161B40]">ไม่พบรายการสินค้าที่ค้นหา</div>
                <p className="text-xs">ลองพิมพ์คำค้นหาหรือเลือกหมวดหมู่อื่น</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((prod) => {
                  const displayImg = prod.images?.[0] || prod.refImageUrl;
                  const hasRef = Boolean(prod.refImageUrl);

                  return (
                    <article
                      key={prod.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col group"
                    >
                      {/* Image Click to Modal */}
                      <div
                        onClick={() => { setSelectedProductModal(prod); setModalActiveTab('graphic'); }}
                        className="relative aspect-square bg-slate-50 overflow-hidden cursor-pointer flex items-center justify-center"
                      >
                        {displayImg ? (
                          <img
                            src={displayImg}
                            alt={`${prod.sku} ${prod.name}`}
                            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <Package className="w-16 h-16 text-slate-300" />
                        )}

                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="px-3 py-1.5 rounded-full bg-white/95 text-slate-800 text-xs font-bold shadow-md flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5 text-red-600" />
                            ดูภาพขยาย
                          </span>
                        </div>

                        {prod.category_name && (
                          <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#161B40]/90 text-white text-[10px] font-semibold backdrop-blur-xs">
                            {prod.category_name}
                          </div>
                        )}
                      </div>

                      {/* Card Body */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="font-mono text-xs font-bold text-red-600 tracking-wider">
                            {prod.sku}
                          </div>
                          <h2
                            onClick={() => { setSelectedProductModal(prod); setModalActiveTab('graphic'); }}
                            className="font-bold text-sm text-[#161B40] mt-0.5 line-clamp-2 hover:text-red-600 transition cursor-pointer"
                          >
                            {prod.name}
                          </h2>

                          {/* Price — Rule 11: Display '-' if no price */}
                          <p className="text-sm font-semibold text-slate-700 mt-2">
                            ราคา{' '}
                            <strong className="text-lg font-black text-[#DE1B23] font-mono">
                              {prod.price && prod.price > 0 ? `฿${prod.price.toLocaleString()}` : '-'}
                            </strong>
                          </p>

                          {/* Size & Page */}
                          <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                            <div>ขนาด: {prod.sizeText || `${prod.width || '-'} x ${prod.height || '-'} x ${prod.depth || '-'} ซม.`}</div>
                            <small className="text-[10px] text-slate-400 block">แคตตาล็อกหน้า {prod.pageNum || 1}</small>
                          </div>
                        </div>

                        {/* Action Nav Links */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex items-center gap-2">
                            {/* Download Graphic Button */}
                            <button
                              onClick={() => downloadFile(prod.images?.[0] || displayImg, prod.graphicFilename)}
                              className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition flex items-center justify-center gap-1"
                              title="ดาวน์โหลดภาพกราฟิกไฟล์เดิม"
                            >
                              <Download className="w-3 h-3 text-red-600" />
                              <span>ดาวน์โหลดภาพ</span>
                            </button>

                            {/* Reference Image Button */}
                            {hasRef && (
                              <button
                                onClick={() => { setSelectedProductModal(prod); setModalActiveTab('ref'); }}
                                className="flex-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold transition flex items-center justify-center gap-1"
                                title="ดูภาพอ้างอิงจริง"
                              >
                                <Camera className="w-3 h-3 text-blue-600" />
                                <span>📸 ภาพอ้างอิง</span>
                              </button>
                            )}
                          </div>

                          {/* LINE Order Button */}
                          <a
                            href={getLineInquiryUrl(prod)}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-2 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>สั่งซื้อ Line : 0930494178</span>
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. PREVIEW MODAL — Full feature parity with https://thaiudon-knockdown.pages.dev/knockdown */}
      {selectedProductModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-300 relative">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-lg">
                  {selectedProductModal.sku}
                </span>
                <h3 className="font-bold text-sm text-[#161B40] truncate max-w-[280px] sm:max-w-md">
                  {selectedProductModal.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProductModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Image Viewer with Tabs */}
              <div className="space-y-3">
                {/* Tabs */}
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    onClick={() => setModalActiveTab('graphic')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      modalActiveTab === 'graphic'
                        ? 'bg-white text-red-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>ภาพสินค้า (Graphic)</span>
                  </button>

                  {selectedProductModal.refImageUrl && (
                    <button
                      onClick={() => setModalActiveTab('ref')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        modalActiveTab === 'ref'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>📸 ภาพอ้างอิงจริง</span>
                    </button>
                  )}
                </div>

                {/* Displayed Image */}
                <div className="relative aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                  <img
                    src={
                      modalActiveTab === 'ref' && selectedProductModal.refImageUrl
                        ? selectedProductModal.refImageUrl
                        : (selectedProductModal.images?.[0] || selectedProductModal.refImageUrl)
                    }
                    alt={selectedProductModal.name}
                    className="w-full h-full object-contain p-2"
                  />
                </div>

                {/* Download Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadFile(
                      selectedProductModal.images?.[0] || selectedProductModal.refImageUrl,
                      selectedProductModal.graphicFilename
                    )}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-red-600" />
                    <span>เซฟภาพกราฟิก</span>
                  </button>

                  {selectedProductModal.refImageUrl && (
                    <button
                      onClick={() => downloadFile(selectedProductModal.refImageUrl, selectedProductModal.refFilename)}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-semibold text-blue-700 flex items-center justify-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>เซฟภาพอ้างอิง</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Specifications & Strict Pricing */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-red-600 tracking-wider uppercase">
                      รหัสสินค้า: {selectedProductModal.sku}
                    </span>
                    <h2 className="text-xl font-bold text-[#161B40] mt-0.5">
                      {selectedProductModal.name}
                    </h2>
                  </div>

                  {/* Specs Table */}
                  <div className="space-y-2 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500">หมวดหมู่</div>
                      <div className="font-semibold text-[#161B40]">{selectedProductModal.category_name || '-'}</div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500">ขนาดสินค้า</div>
                      <div className="font-semibold text-[#161B40]">
                        {selectedProductModal.sizeText || `${selectedProductModal.width || '-'} x ${selectedProductModal.height || '-'} x ${selectedProductModal.depth || '-'} ซม.`}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500">สี / ลวดลาย</div>
                      <div className="font-semibold text-[#161B40]">{selectedProductModal.color || 'ตามภาพมาตรฐาน'}</div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500">ตำแหน่งในแคตตาล็อก</div>
                      <div className="font-semibold text-[#161B40]">หน้า {selectedProductModal.pageNum || 1}</div>
                    </div>
                  </div>
                </div>

                {/* Strict Price Box — Rule 11 */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        ราคา
                      </div>
                      <div className="text-2xl font-black text-[#DE1B23] font-mono mt-0.5">
                        {selectedProductModal.price && selectedProductModal.price > 0
                          ? `฿${selectedProductModal.price.toLocaleString()}`
                          : '-'}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      <div>พร้อมบริการจัดส่ง</div>
                      <div className="text-[#06C755] font-semibold">รับประกันความพึงพอใจ</div>
                    </div>
                  </div>

                  <a
                    href={getLineInquiryUrl(selectedProductModal)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>สั่งซื้อทาง LINE : 0930494178</span>
                  </a>

                  {/* Prev / Next navigation inside modal */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={handlePrevProduct}
                      disabled={currentModalIndex <= 0}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>รุ่นก่อนหน้า</span>
                    </button>
                    <span className="text-[11px] text-slate-400">
                      {currentModalIndex + 1} จาก {filtered.length}
                    </span>
                    <button
                      onClick={handleNextProduct}
                      disabled={currentModalIndex >= filtered.length - 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <span>รุ่นถัดไป</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SITE FOOTER */}
      <footer className="bg-[#161B40] text-slate-300 py-10 px-4 mt-12 border-t-2 border-red-600">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img src="/images/logo-red.png" alt="ไทยอุดรเฟอร์นิเจอร์" className="w-10 h-10 object-contain rounded-full bg-white p-0.5" />
              <div>
                <div className="font-bold text-white text-sm">ไทยอุดรเฟอร์นิเจอร์</div>
                <div className="text-[10px] text-red-300">โรงงานและโชว์รูมเฟอร์นิเจอร์ครบวงจร</div>
              </div>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              ผู้ผลิตและจัดจำหน่ายเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury และตู้กับข้าว ตู้ครัวอลูมิเนียมคุณภาพสูง จัดส่งฟรีพร้อมทีมช่างยกติดตั้งถึงห้อง
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-white text-xs uppercase tracking-wider text-red-400">พื้นที่จัดส่งและบริการ</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              📍 จัดส่งฟรีพร้อมทีมช่างยกติดตั้งถึงห้องในเขต:
              <br />• อุดรธานี
              <br />• ขอนแก่น
              <br />• หนองคาย
              <br />• หนองบัวลำภู
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-white text-xs uppercase tracking-wider text-red-400">ติดต่อฝ่ายขายและโรงงาน</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              📞 สายด่วน: 093-049-4178, 061-789-1164
              <br />💬 Line ID: 0930494178
              <br />⏰ เวลาทำการ: ทุกวัน 8:00 - 17:30 น.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-slate-700/60 text-center text-[10px] text-slate-500">
          © {new Date().getFullYear()} ไทยอุดรเฟอร์นิเจอร์. สงวนลิขสิทธิ์ทั้งหมด. ระบบแคตตาล็อกทางการ Master Control.
        </div>
      </footer>
    </div>
  );
}
