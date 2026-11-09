'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Package, Coins, Image as ImageIcon, AlertCircle, Camera, UploadCloud, Trash2, Eye } from 'lucide-react';
import { uploadDirectToR2 } from '@/lib/client-upload';

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  // Form states
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [catalogType, setCatalogType] = useState('tuulo');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [depth, setDepth] = useState('');
  const [color, setColor] = useState('');
  const [status, setStatus] = useState('Published');
  
  // Images
  const [imageUrl1, setImageUrl1] = useState('');
  const [imageUrl2, setImageUrl2] = useState('');
  const [refImageUrl, setRefImageUrl] = useState('');
  const [refFilename, setRefFilename] = useState('');
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);

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

  const handleUploadPrimaryFile = async (file: File) => {
    try {
      setUploadingPrimary(true);
      setUploadStatus('กำลังอัปโหลดรูปภาพหลักขึ้น Cloudflare R2...');
      const r2Url = await uploadDirectToR2(file, 'primary');
      setImageUrl1(r2Url);
      setUploadStatus('✅ อัปโหลดรูปภาพหลักขึ้น Cloudflare R2 สำเร็จ');
      setTimeout(() => setUploadStatus(''), 4000);
    } catch {
      setError('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพหลัก');
    } finally {
      setUploadingPrimary(false);
    }
  };

  const handleUploadRefFile = async (file: File) => {
    try {
      setUploadingRef(true);
      setUploadStatus('กำลังอัปโหลดภาพอ้างอิงจริงขึ้น Cloudflare R2...');
      const r2Url = await uploadDirectToR2(file, 'ref');
      setRefImageUrl(r2Url);
      setRefFilename(file.name || `ref_${sku}_${Date.now()}.jpg`);
      setUploadStatus('✅ อัปโหลดภาพอ้างอิงจริงขึ้น Cloudflare R2 สำเร็จ');
      setTimeout(() => setUploadStatus(''), 4000);
    } catch {
      setError('เกิดข้อผิดพลาดในการอัปโหลดภาพอ้างอิง');
    } finally {
      setUploadingRef(false);
    }
  };

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
          catalog_type: catalogType,
          width,
          height,
          depth,
          color,
          status,
          images,
          ref_image_url: refImageUrl && refImageUrl.trim() ? refImageUrl.trim() : null,
          ref_filename: refFilename || null,
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
            <p className="text-xs text-slate-500 mt-0.5">ระบุข้อมูลสินค้า สเปก อัปโหลดรูปภาพตรงเข้า Cloudflare R2 และตั้งราคา 4 ระดับ</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {uploadStatus && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
          <span>{uploadStatus}</span>
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
                placeholder="เช่น TD-995 หรือ SOFA-NORDIC-01"
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
                placeholder="เช่น ตู้ครัวสูง 150 เรียบ+ชั้น+ชาผสม"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">ประเภทแคตตาล็อก</label>
              <select
                value={catalogType}
                onChange={(e) => setCatalogType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-600"
              >
                <option value="tuulo">แคตตาล็อกตู้โล</option>
                <option value="knockdown">แคตตาล็อกน็อคดาวน์ Modern Luxury</option>
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

        {/* Specifications Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Package className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">สเปก & ขนาดสินค้า (กว้าง x สูง x ลึก ซม.)</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ความกว้าง (ซม.)</label>
              <input
                type="number"
                step="0.1"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="เช่น 150"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ความสูง (ซม.)</label>
              <input
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="เช่น 185"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ความลึก (ซม.)</label>
              <input
                type="number"
                step="0.1"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                placeholder="เช่น 50"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">สี / ลาย</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="เช่น ตามภาพ หรือ เทาโมเดิร์น"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* 4 Prices */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Coins className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">ราคาสินค้า 4 ระดับ (บาท)</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100">
              <label className="block text-xs font-bold text-blue-900 mb-1">1. ราคาเซลล์ (SALE)</label>
              <input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs font-mono font-bold text-blue-950 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
              <label className="block text-xs font-bold text-amber-900 mb-1">2. ราคาปลีก (RETAIL)</label>
              <input
                type="number"
                value={retailPrice}
                onChange={(e) => setRetailPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs font-mono font-bold text-amber-950 focus:outline-none focus:border-amber-600"
              />
            </div>

            <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100">
              <label className="block text-xs font-bold text-purple-900 mb-1">3. ราคา VIP (VIP)</label>
              <input
                type="number"
                value={vipPrice}
                onChange={(e) => setVipPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-xs font-mono font-bold text-purple-950 focus:outline-none focus:border-purple-600"
              />
            </div>

            <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-800 mb-1">4. บุคคลทั่วไป (GENERAL)</label>
              <input
                type="number"
                value={generalPrice}
                onChange={(e) => setGeneralPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-600"
              />
            </div>
          </div>
        </div>

        {/* Images with Cloudflare R2 Direct Upload */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ImageIcon className="w-4 h-4 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-800">รูปภาพสินค้า (อัปโหลดเข้า Cloudflare R2 อัตโนมัติ)</h2>
              <p className="text-[11px] text-slate-500">เลือกไฟล์จากเครื่อง คอมพิวเตอร์จะส่งตรงเข้า Cloudflare R2 เพื่อโหลดเร็วและฟรี Bandwidth</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Primary Image */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>1. รูปภาพสินค้าหลัก (Primary Image)</span>
                </span>
                {imageUrl1 && (
                  <button
                    type="button"
                    onClick={() => setImageUrl1('')}
                    className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>ลบภาพ</span>
                  </button>
                )}
              </div>

              {/* Preview Box */}
              <div className="relative w-full h-44 bg-white rounded-lg border border-blue-200/80 overflow-hidden flex items-center justify-center">
                {imageUrl1 ? (
                  <img src={imageUrl1} alt="Primary Preview" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-center text-blue-400 text-xs">
                    <Camera className="w-8 h-8 mx-auto mb-1 opacity-60" />
                    <span>ยังไม่มีรูปภาพหลัก</span>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div className="flex items-center gap-2">
                <label className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs">
                  <UploadCloud className="w-4 h-4" />
                  <span>{uploadingPrimary ? 'กำลังอัปโหลด...' : 'เลือกไฟล์ภาพหลักจากเครื่อง'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingPrimary}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadPrimaryFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <input
                type="url"
                value={imageUrl1}
                onChange={(e) => setImageUrl1(e.target.value)}
                placeholder="https://... หรืออัปโหลดไฟล์จากปุ่มด้านบน"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* 2. Reference Image */}
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-amber-600" />
                  <span>2. ภาพอ้างอิงจริง (Reference / Dicut)</span>
                </span>
                {refImageUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setRefImageUrl('');
                      setRefFilename('');
                    }}
                    className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>ลบภาพ</span>
                  </button>
                )}
              </div>

              {/* Preview Box */}
              <div className="relative w-full h-44 bg-white rounded-lg border border-amber-200/80 overflow-hidden flex items-center justify-center">
                {refImageUrl ? (
                  <img src={refImageUrl} alt="Ref Preview" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-center text-amber-400 text-xs">
                    <Camera className="w-8 h-8 mx-auto mb-1 opacity-60" />
                    <span>ยังไม่มีภาพอ้างอิงจริง</span>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div className="flex items-center gap-2">
                <label className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs">
                  <UploadCloud className="w-4 h-4" />
                  <span>{uploadingRef ? 'กำลังอัปโหลด...' : 'เลือกไฟล์ภาพอ้างอิงจากเครื่อง'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingRef}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadRefFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <input
                type="url"
                value={refImageUrl}
                onChange={(e) => setRefImageUrl(e.target.value)}
                placeholder="https://... หรืออัปโหลดไฟล์จากปุ่มด้านบน"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700 focus:outline-none focus:border-amber-600"
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
