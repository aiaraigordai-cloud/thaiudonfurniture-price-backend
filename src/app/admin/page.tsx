'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Coins,
  Share2,
  FileSpreadsheet,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    publishedProducts: 0,
    categoriesCount: 0,
    shareLinksCount: 0,
    totalBatches: 0,
  });
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [priceTiers, setPriceTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewCatalogTab, setOverviewCatalogTab] = useState<'tuulo' | 'knockdown'>('tuulo');

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, catRes, linkRes, batchRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories'),
          fetch('/api/share-links'),
          fetch('/api/prices/import-history'),
        ]);

        const prodData = await prodRes.json();
        const catData = await catRes.json();
        const linkData = await linkRes.json();
        const batchData = await batchRes.json();

        if (prodData.success) {
          setRecentProducts(prodData.products || []);
          setPriceTiers(prodData.priceTiers || []);
          setStats({
            totalProducts: prodData.products?.length || 0,
            publishedProducts: prodData.products?.filter((p: any) => p.status === 'Published').length || 0,
            categoriesCount: catData.categories?.length || 0,
            shareLinksCount: linkData.links?.length || 0,
            totalBatches: batchData.batches?.length || 0,
          });
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-semibold border border-red-500/30">
                Catalog ไทยอุดรเฟอร์นิเจอร์ Control Center
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">ยินดีต้อนรับสู่ระบบจัดการ Catalog ไทยอุดรเฟอร์นิเจอร์</h1>
            <p className="text-slate-300 text-xs mt-1 max-w-2xl leading-relaxed">
              จัดการฐานข้อมูลสินค้ากลาง ควบคุมระบบราคาทั้ง 4 ระดับ อัปเดตราคาจำนวนมากด้วย AI Document Parser
              และสร้างลิงก์แชร์ลูกค้าแบบ Real-time Live Pricing ที่มีความปลอดภัยสูงสุด
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/products/new"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-600/30 transition"
            >
              <PlusCircle className="w-4 h-4" />
              เพิ่มสินค้าใหม่
            </Link>
            <Link
              href="/admin/prices/bulk-update"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2 border border-emerald-500/20 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              อัปเดตไฟล์ราคา
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">สินค้าทั้งหมดในระบบ</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalProducts} รายการ</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              เผยแพร่แล้ว {stats.publishedProducts} รายการ
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">ระบบราคา 4 ระดับ</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">4 ประเภทราคา</div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              เซลล์ / ปลีก / VIP / ทั่วไป
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">ลิงก์แชร์ลูกค้าที่ใช้งาน</div>
            <div className="text-lg font-bold text-slate-900 mt-1">ระบบลิงก์ปลอดภัย</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              พร้อมใช้งานตลอด 24 ชม.
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Batch นำเข้าไฟล์ราคา</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalBatches} ครั้ง</div>
            <div className="text-[11px] text-amber-600 font-medium mt-0.5">
              พร้อมระบบ Rollback อัตโนมัติ
            </div>
          </div>
        </div>
      </div>

      {/* 4 Price Tiers Architecture Explain Card & Quick Full Catalog Share Links */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-sm">แชร์แคตตาล็อกสินค้าทั้งหมดแยกตามประเภทราคา (Full Catalog Share)</h2>
          </div>
          <Link
            href="/admin/share-links"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>ดูระบบแชร์ลิงก์ทั้งหมด</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Catalog Selector Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <button
            onClick={() => setOverviewCatalogTab('tuulo')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              overviewCatalogTab === 'tuulo'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>แคตตาล็อกตู้โล (121 รายการ)</span>
          </button>
          <button
            onClick={() => setOverviewCatalogTab('knockdown')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              overviewCatalogTab === 'knockdown'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>แคตตาล็อกน็อคดาวน์ (189 รายการ)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-red-200 bg-red-50/40 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-800">1. ราคาเซลล์</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">SALE_PRICE</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-2">
                แชร์สินค้า {overviewCatalogTab === 'tuulo' ? 'ตู้โล' : 'น็อคดาวน์'} ด้วยราคาโปรโมชั่น
              </p>
            </div>
            <Link
              href={`/s/catalog-${overviewCatalogTab}-sale`}
              target="_blank"
              className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิดแคตตาล็อกเซลล์</span>
            </Link>
          </div>

          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-800">2. ราคาปลีก</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">RETAIL_PRICE</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-2">
                แชร์สินค้า {overviewCatalogTab === 'tuulo' ? 'ตู้โล' : 'น็อคดาวน์'} ด้วยราคามาตรฐานหน้าร้าน
              </p>
            </div>
            <Link
              href={`/s/catalog-${overviewCatalogTab}-retail`}
              target="_blank"
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิดแคตตาล็อกราคาปลีก</span>
            </Link>
          </div>

          <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-800">3. ราคา VIP</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold">VIP_PRICE</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-2">
                แชร์สินค้า {overviewCatalogTab === 'tuulo' ? 'ตู้โล' : 'น็อคดาวน์'} ด้วยราคาลูกค้า VIP
              </p>
            </div>
            <Link
              href={`/s/catalog-${overviewCatalogTab}-vip`}
              target="_blank"
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิดแคตตาล็อกราคา VIP</span>
            </Link>
          </div>

          <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">4. ราคาทั่วไป</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">GENERAL_PRICE</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-2">
                แชร์สินค้า {overviewCatalogTab === 'tuulo' ? 'ตู้โล' : 'น็อคดาวน์'} ด้วยราคาโครงการ
              </p>
            </div>
            <Link
              href={`/s/catalog-${overviewCatalogTab}-general`}
              target="_blank"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>เปิดแคตตาล็อกราคาทั่วไป</span>
            </Link>
          </div>
        </div>

        <div className="mt-3 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <span>
            <strong>กฎความปลอดภัยฝั่งลูกค้า (Customer Isolation Rule):</strong> เมื่อลูกค้าเปิดลิงก์แชร์
            ระบบจะแสดงเฉพาะคำว่า <strong>"ราคา"</strong> เท่านั้น และส่งเฉพาะตัวเลขราคาของ Price Tier ที่ได้รับอนุญาต
            ห้ามเปิดเผยชื่อหรือราคาประเภทอื่นใดไปยังเบราว์เซอร์ลูกค้าเด็ดขาด
          </span>
        </div>
      </div>

      {/* Recent Products Overview Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">รายการสินค้าล่าสุดในแคตตาล็อก</h2>
            <p className="text-xs text-slate-500 mt-0.5">แสดงข้อมูลสินค้าพร้อมราคาทั้ง 4 ระดับในระบบหลังบ้าน</p>
          </div>
          <Link
            href="/admin/products"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>ดูสินค้าทั้งหมด ({stats.totalProducts})</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">SKU & สินค้า</th>
                <th className="px-4 py-3.5">หมวดหมู่</th>
                <th className="px-3 py-3.5 text-right text-red-700">ราคาเซลล์</th>
                <th className="px-3 py-3.5 text-right text-blue-700">ราคาปลีก</th>
                <th className="px-3 py-3.5 text-right text-purple-700">ราคา VIP</th>
                <th className="px-3 py-3.5 text-right text-slate-700">ราคาทั่วไป</th>
                <th className="px-4 py-3.5 text-center">สถานะ</th>
                <th className="px-4 py-3.5 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentProducts.slice(0, 5).map((prod) => (
                <tr key={prod.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {prod.images && prod.images[0] ? (
                        <img
                          src={prod.images[0]}
                          alt={prod.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="font-mono font-bold text-slate-900">{prod.sku}</div>
                        <div className="text-slate-600 truncate max-w-xs">{prod.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{prod.category_name || '-'}</td>
                  <td className="px-3 py-3.5 text-right font-mono font-bold text-red-600">
                    ฿{prod.prices?.SALE_PRICE?.toLocaleString() ?? '-'}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono font-bold text-blue-600">
                    ฿{prod.prices?.RETAIL_PRICE?.toLocaleString() ?? '-'}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono font-bold text-purple-600">
                    ฿{prod.prices?.VIP_PRICE?.toLocaleString() ?? '-'}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-800">
                    ฿{prod.prices?.GENERAL_PRICE?.toLocaleString() ?? '-'}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        prod.status === 'Published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {prod.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/admin/products/${prod.id}`}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                    >
                      แก้ไข
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
