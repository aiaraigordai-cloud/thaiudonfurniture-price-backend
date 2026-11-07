'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Package,
  Coins,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Camera,
  UploadCloud,
  Eye,
  Layers,
} from 'lucide-react';

export default function EditProductPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingRef, setDeletingRef] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [remoteUpdated, setRemoteUpdated] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

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

  // Images states: Distinct Primary & Reference Images
  const [primaryImageUrl, setPrimaryImageUrl] = useState('');
  const [refImageUrl, setRefImageUrl] = useState('');
  const [refFilename, setRefFilename] = useState('');
  const [secondaryImageUrl, setSecondaryImageUrl] = useState('');

  // 4 Prices
  const [salePrice, setSalePrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [vipPrice, setVipPrice] = useState('');
  const [generalPrice, setGeneralPrice] = useState('');

  const compressImageToDataUrl = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxWidth || h > maxHeight) {
            if (w > h) {
              h = Math.round((h * maxWidth) / w);
              w = maxWidth;
            } else {
              w = Math.round((w * maxHeight) / h);
              h = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const loadProductData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [catRes, prodRes] = await Promise.all([
        fetch('/api/categories'),
        fetch(`/api/products/${params.id}?t=${Date.now()}`),
      ]);

      const catData = await catRes.json();
      const prodData = await prodRes.json();

      if (catData.success) setCategories(catData.categories || []);
      if (prodData.success) {
        const p = prodData.product;
        // If silent and user is currently typing, alert them without overwriting their form
        if (silent && isDirty) {
          setRemoteUpdated(true);
          return;
        }

        setSku(p.sku || '');
        setName(p.name || '');
        setDescription(p.description || '');
        setCategoryId(p.category_id || '');
        setWidth(p.width ? String(p.width) : '');
        setHeight(p.height ? String(p.height) : '');
        setDepth(p.depth ? String(p.depth) : '');
        setColor(p.color || '');
        setStatus(p.status || 'Published');

        // Reference Image
        setRefImageUrl(p.ref_image_url || '');
        setRefFilename(p.ref_filename || '');

        // Primary and Additional Images
        const mainImg = p.primary_image_url || (p.images && p.images[0]) || '';
        setPrimaryImageUrl(mainImg);

        if (p.images && p.images.length > 1) {
          const second = p.images.find((img: string) => img !== mainImg && img !== p.ref_image_url);
          setSecondaryImageUrl(second || '');
        }

        if (p.prices) {
          setSalePrice(p.prices.SALE_PRICE !== undefined ? String(p.prices.SALE_PRICE) : '');
          setRetailPrice(p.prices.RETAIL_PRICE !== undefined ? String(p.prices.RETAIL_PRICE) : '');
          setVipPrice(p.prices.VIP_PRICE !== undefined ? String(p.prices.VIP_PRICE) : '');
          setGeneralPrice(p.prices.GENERAL_PRICE !== undefined ? String(p.prices.GENERAL_PRICE) : '');
        }

        setRemoteUpdated(false);
        setIsDirty(false);
        setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
      } else {
        setError(prodData.error || 'ไม่พบสินค้า');
      }
    } catch (e) {
      if (!silent) setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadProductData(false);

    // Multi-channel Real-time Broadcast Listener
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('thaiudon_sync_channel');
      bc.onmessage = (e) => {
        if (!e.data || e.data.productId === params.id || !e.data.productId) {
          loadProductData(true);
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'thaiudon_product_sync' || e.key === 'thaiudon_last_sync') {
        loadProductData(true);
      }
    };
    const handleSyncEvent = () => loadProductData(true);
    const handleFocus = () => loadProductData(true);

    window.addEventListener('storage', handleStorage);
    window.addEventListener('thaiudon_catalog_sync', handleSyncEvent);
    window.addEventListener('focus', handleFocus);

    // Fallback Polling every 4 seconds to guarantee zero-delay sync
    const interval = setInterval(() => {
      loadProductData(true);
    }, 4000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('thaiudon_catalog_sync', handleSyncEvent);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [params.id]);

  // Handle immediate deletion of Reference Image
  const handleDeleteRefImage = async () => {
    if (!confirm('ยืนยันการลบภาพอ้างอิงจริงของสินค้านี้?')) return;
    setDeletingRef(true);
    try {
      const res = await fetch(`/api/products/${params.id}/ref-image`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setRefImageUrl('');
        setRefFilename('');
        setSuccess('ลบภาพอ้างอิงเรียบร้อยแล้ว (Real-time)');
        // Multi-channel Real-time broadcast
        if (typeof window !== 'undefined') {
          try {
            const channel = new BroadcastChannel('thaiudon_sync_channel');
            channel.postMessage({ type: 'PRODUCTS_UPDATED', productId: params.id, timestamp: Date.now() });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
          } catch {}
        }
      } else {
        setError(data.error || 'ไม่สามารถลบภาพอ้างอิงได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setDeletingRef(false);
    }
  };

  // Handle immediate deletion of Primary Image
  const handleDeletePrimaryImage = () => {
    if (!confirm('ยืนยันการลบรูปภาพสินค้าหลักนี้ออกจากรายการ?')) return;
    setPrimaryImageUrl('');
    setSuccess('ลบรูปภาพสินค้าหลักออกจากฟอร์มแล้ว (กดบันทึกเพื่ออัปเดตระบบ)');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const images = [primaryImageUrl, secondaryImageUrl].filter((url) => url && url.trim().length > 0);
    const prices = {
      SALE_PRICE: salePrice ? parseFloat(salePrice) : 0,
      RETAIL_PRICE: retailPrice ? parseFloat(retailPrice) : 0,
      VIP_PRICE: vipPrice ? parseFloat(vipPrice) : 0,
      GENERAL_PRICE: generalPrice ? parseFloat(generalPrice) : 0,
    };

    try {
      const res = await fetch(`/api/products/${params.id}`, {
        method: 'PUT',
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
          ref_image_url: refImageUrl ? refImageUrl.trim() : null,
          ref_filename: refFilename ? refFilename.trim() : null,
          prices,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'แก้ไขสินค้าไม่สำเร็จ');
      } else {
        setSuccess('✅ บันทึกและอัปเดตข้อมูลสินค้าเป็นปัจจุบันแบบ Real-time เรียบร้อยแล้ว (อัปเดตทันทีทั้งในระบบและลิงก์แชร์ลูกค้า)');
        setIsDirty(false);
        setRemoteUpdated(false);
        setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
        // Multi-channel Real-time broadcast across all tabs and views
        if (typeof window !== 'undefined') {
          try {
            const channel = new BroadcastChannel('thaiudon_sync_channel');
            channel.postMessage({ type: 'PRODUCTS_UPDATED', productId: params.id, timestamp: Date.now() });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            localStorage.setItem('thaiudon_product_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
          } catch {}
        }
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400">
        <span className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></span>
        <p className="text-xs">กำลังโหลดข้อมูลสินค้า...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-950 transition shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">แก้ไขข้อมูลสินค้า: {sku}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                status === 'Published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
              }`}>
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">จัดการรายละเอียด สเปก รูปภาพสินค้าหลัก ภาพอ้างอิง และราคากลาง 4 ระดับ (Real-time)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Real-time Active {lastSyncTime ? `(${lastSyncTime})` : ''}</span>
          </div>
          <button
            type="button"
            onClick={() => loadProductData(false)}
            className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-semibold shadow-2xs transition"
          >
            รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      {remoteUpdated && isDirty && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>มีข้อมูลสินค้านี้อัปเดตล่าสุดจากระบบภายนอก (คุณกำลังแก้ไขฟอร์มอยู่)</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm('ต้องการโหลดข้อมูลล่าสุดจากระบบและแทนที่ข้อมูลที่กำลังพิมพ์หรือไม่?')) {
                setIsDirty(false);
                loadProductData(false);
              }
            }}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition whitespace-nowrap"
          >
            โหลดข้อมูลล่าสุดทันที
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="font-bold text-xs text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="font-bold text-xs text-emerald-600 hover:text-emerald-800">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} onChange={() => setIsDirty(true)} className="space-y-6">
        {/* CARD 1: Basic Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Package className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">ข้อมูลพื้นฐานสินค้า</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">รหัส SKU *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อสินค้าทางการ *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* CARD 2: Specifications & Dimensions */}
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">สี / โทนสี</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* CARD 3: IMAGE MANAGEMENT (Primary Image + Reference Image with Delete & Upload) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">จัดการรูปภาพสินค้า (แสดงทั้งสินค้าหลัก & ภาพอ้างอิง)</h2>
                <p className="text-[11px] text-slate-500">สามารถดูตัวอย่าง อัปโหลดใหม่ หรือกดลบรูปภาพได้ทันทีแบบ Real-time</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. PRIMARY PRODUCT IMAGE */}
            <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/50 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  <span>รูปภาพสินค้าหลัก (Primary)</span>
                </span>
                {primaryImageUrl && (
                  <button
                    type="button"
                    onClick={handleDeletePrimaryImage}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                    title="ลบรูปภาพสินค้าหลัก"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>ลบภาพหลัก</span>
                  </button>
                )}
              </div>

              {/* Preview Box */}
              <div className="relative w-full h-52 bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner group">
                {primaryImageUrl ? (
                  <>
                    <img
                      src={primaryImageUrl}
                      alt="Primary Product"
                      className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded-full">
                      ภาพหลัก
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4 text-slate-400 space-y-1">
                    <ImageIcon className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
                    <div className="text-xs font-semibold text-slate-500">ยังไม่มีรูปภาพสินค้าหลัก</div>
                    <div className="text-[10px] text-slate-400">เลือกไฟล์จากเครื่องหรือวาง URL</div>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700">อัปโหลดภาพหลักใหม่:</label>
                  <label className="text-[11px] font-bold text-blue-700 hover:text-blue-800 cursor-pointer flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์จากเครื่อง (Real-time)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const dataUrl = await compressImageToDataUrl(file);
                          setPrimaryImageUrl(dataUrl);
                          setSuccess('โหลดรูปภาพหลักเข้าสู่แบบฟอร์มแล้ว');
                        }
                      }}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={primaryImageUrl}
                  onChange={(e) => setPrimaryImageUrl(e.target.value)}
                  placeholder="https://... หรือคลิกเลือกไฟล์ภาพจากเครื่อง"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* 2. REFERENCE IMAGE (ภาพอ้างอิงจริง) */}
            <div className="p-4 rounded-2xl border-2 border-amber-200 bg-[#FFFAF3] space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-amber-700" />
                  <span>ภาพอ้างอิงจริง (Reference / Dicut)</span>
                </span>
                {refImageUrl && (
                  <button
                    type="button"
                    disabled={deletingRef}
                    onClick={handleDeleteRefImage}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs disabled:opacity-50"
                    title="ลบภาพอ้างอิง"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>{deletingRef ? 'กำลังลบ...' : 'ลบภาพอ้างอิง'}</span>
                  </button>
                )}
              </div>

              {/* Preview Box */}
              <div className="relative w-full h-52 bg-white rounded-xl border border-amber-200/80 overflow-hidden flex items-center justify-center shadow-inner group">
                {refImageUrl ? (
                  <>
                    <img
                      src={refImageUrl}
                      alt="Reference Product"
                      className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute top-2 right-2 bg-amber-800/80 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded-full">
                      ภาพอ้างอิง
                    </div>
                    {refFilename && (
                      <div className="absolute bottom-2 inset-x-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-1 rounded-lg truncate text-center">
                        {refFilename}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-4 text-amber-600/60 space-y-1">
                    <Camera className="w-10 h-10 mx-auto text-amber-400 stroke-[1.5]" />
                    <div className="text-xs font-semibold text-amber-800">ยังไม่มีภาพอ้างอิง</div>
                    <div className="text-[10px] text-amber-600">อัปโหลดภาพถ่ายจริงเพื่อใช้แสดงผลคู่กับภาพกราฟิก</div>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-amber-900">อัปโหลดภาพอ้างอิงใหม่:</label>
                  <label className="text-[11px] font-bold text-amber-800 hover:text-amber-950 cursor-pointer flex items-center gap-1">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์ภาพถ่ายจริง (Real-time)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const dataUrl = await compressImageToDataUrl(file);
                          setRefImageUrl(dataUrl);
                          setRefFilename(file.name || `ref_${sku}_${Date.now()}.jpg`);
                          setSuccess('โหลดภาพอ้างอิงเข้าสู่แบบฟอร์มแล้ว');
                        }
                      }}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={refImageUrl}
                  onChange={(e) => setRefImageUrl(e.target.value)}
                  placeholder="https://... หรือคลิกเลือกไฟล์ภาพถ่ายจริง"
                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:border-amber-600"
                />
              </div>
            </div>
          </div>

          {/* 3. OPTIONAL SECONDARY IMAGE */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">รูปภาพเพิ่มเติม (Secondary / Additional Image)</label>
              {secondaryImageUrl && (
                <button
                  type="button"
                  onClick={() => setSecondaryImageUrl('')}
                  className="text-[11px] text-red-600 hover:text-red-700 font-semibold"
                >
                  ลบรูปภาพเพิ่มเติม
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={secondaryImageUrl}
                onChange={(e) => setSecondaryImageUrl(e.target.value)}
                placeholder="https://... หรือเลือกไฟล์ภาพเพิ่มเติม"
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
              />
              <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" />
                <span>เลือกไฟล์</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const dataUrl = await compressImageToDataUrl(file);
                      setSecondaryImageUrl(dataUrl);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* CARD 4: 4 Price Tiers */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Coins className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">ราคาทั้ง 4 ระดับ (Four Price Tiers)</h2>
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
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/products"
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            ย้อนกลับ
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm shadow-emerald-600/30 transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                บันทึกการแก้ไขสินค้า & รูปภาพ
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
