'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Package, Coins, Image as ImageIcon, AlertCircle } from 'lucide-react';

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [depth, setDepth] = useState('');
  const [color, setColor] = useState('');
  const [status, setStatus] = useState('Published');
  const [imageUrl1, setImageUrl1] = useState('');
  const [imageUrl2, setImageUrl2] = useState('');

  // 4 Prices
  const [salePrice, setSalePrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [vipPrice, setVipPrice] = useState('');
  const [generalPrice, setGeneralPrice] = useState('');

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.categories || []);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const images = [imageUrl1, imageUrl2].filter((url) => url.trim().length > 0);

    const prices = {
      SALE_PRICE: salePrice ? parseFloat(salePrice) : 0,
      RETAIL_PRICE: retailPrice ? parseFloat(retailPrice) : 0,
      VIP_PRICE: vipPrice ? parseFloat(vipPrice) : 0,
      GENERAL_PRICE: generalPrice ? parseFloat(generalPrice) : 0,
    };

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          name,
          description,
          category_id: categoryId || null,
          width,
          height,
          depth,
          color,
          status,
          images,
          prices,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'เพิ่มสินค้าไม่สำเร็จ');
      } else {
        router.push('/admin/products');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-950 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">เพิ่มสินค้าใหม่</h1>
            <p className="text-xs text-slate-500 mt-0.5">ระบุข้อมูลสินค้า สเปก และตั้งราคาทั้ง 4 ระดับ</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Package className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">ข้อมูลพื้นฐานสินค้า</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัส SKU สินค้า (ห้ามซ้ำ) *
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="เช่น SOFA-NORDIC-01"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อสินค้าทางการ *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น โซฟาผ้าแอลโมเดิร์น สไตล์นอร์ดิก"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">หมวดหมู่สินค้า</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-600"
              >
                <option value="">-- ไม่ระบุหมวดหมู่ --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">สถานะการแสดงผล</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-600"
              >
                <option value="Published">Published (เผยแพร่สู่ระบบ)</option>
                <option value="Draft">Draft (แบบร่างหลังบ้าน)</option>
                <option value="Archived">Archived (เก็บถาวร)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">รายละเอียดสินค้า</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุจุดเด่น วัสดุ โครงสร้าง การรับประกัน..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Specifications & Dimensions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
            ขนาดและสเปกสินค้า
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">กว้าง (ซม.)</label>
              <input
                type="number"
                step="0.1"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="เช่น 180"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">สูง (ซม.)</label>
              <input
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="เช่น 90"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">ลึก (ซม.)</label>
              <input
                type="number"
                step="0.1"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                placeholder="เช่น 95"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">สี / โทนสี</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="เช่น เทาเข้ม / ขาวมุก"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* 4 Price Tiers Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Coins className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">กำหนดราคา 4 ระดับ (Four Price Tiers)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/30">
              <label className="block text-xs font-bold text-red-800 mb-1">
                1. ราคาเซลล์ (SALE_PRICE)
              </label>
              <input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-xs font-mono font-bold text-red-700 focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>

            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/30">
              <label className="block text-xs font-bold text-blue-800 mb-1">
                2. ราคาปลีก (RETAIL_PRICE)
              </label>
              <input
                type="number"
                step="0.01"
                value={retailPrice}
                onChange={(e) => setRetailPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-mono font-bold text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/30">
              <label className="block text-xs font-bold text-purple-800 mb-1">
                3. ราคา VIP (VIP_PRICE)
              </label>
              <input
                type="number"
                step="0.01"
                value={vipPrice}
                onChange={(e) => setVipPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-mono font-bold text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>

            <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                4. ราคาทั่วไป (GENERAL_PRICE)
              </label>
              <input
                type="number"
                step="0.01"
                value={generalPrice}
                onChange={(e) => setGeneralPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">รูปภาพสินค้า (Image URLs)</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">รูปภาพหลัก (Primary Image)</label>
              <input
                type="url"
                value={imageUrl1}
                onChange={(e) => setImageUrl1(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">รูปภาพเพิ่มเติม (Secondary Image)</label>
              <input
                type="url"
                value={imageUrl2}
                onChange={(e) => setImageUrl2(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/products"
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
                <Save className="w-4 h-4" />
                บันทึกสินค้า
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
