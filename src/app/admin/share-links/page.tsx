'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Share2,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Ban,
  Clock,
  Eye,
  ShieldCheck,
  Coins,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function ShareLinksPage() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const loadLinks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/share-links');
      const data = await res.json();
      if (data.success) {
        setLinks(data.links || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const handleCopy = (rawToken: string, id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}/s/${rawToken}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('ยืนยันการยกเลิกลิงก์นี้? ลูกค้าจะไม่สามารถเปิดดูแคตตาล็อกผ่านลิงก์นี้ได้อีก')) return;

    try {
      const res = await fetch(`/api/share-links/${id}/revoke`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('ยกเลิกลิงก์แชร์เรียบร้อยแล้ว');
        loadLinks();
      } else {
        alert(data.error || 'ยกเลิกลิงก์ไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const [catalogCategoryTab, setCatalogCategoryTab] = useState<'tuulo' | 'knockdown'>('tuulo');

  // Full Catalog Links grouped by Catalog Type & Price Tier (Requirement 4 & 10)
  const allCatalogGroups = {
    tuulo: [
      {
        code: 'SALE_PRICE',
        name_th: 'ราคาเซลล์',
        token: 'catalog-tuulo-sale',
        badgeColor: 'bg-red-50 text-red-700 border-red-200',
        textColor: 'text-red-700',
        desc: 'แชร์แคตตาล็อกตู้โล (121 รายการ) แสดงเรทราคาเซลล์',
      },
      {
        code: 'RETAIL_PRICE',
        name_th: 'ราคาปลีก',
        token: 'catalog-tuulo-retail',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        textColor: 'text-blue-700',
        desc: 'แชร์แคตตาล็อกตู้โล (121 รายการ) แสดงเรทราคาปลีก',
      },
      {
        code: 'VIP_PRICE',
        name_th: 'ราคา VIP',
        token: 'catalog-tuulo-vip',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        textColor: 'text-purple-700',
        desc: 'แชร์แคตตาล็อกตู้โล (121 รายการ) แสดงเรทราคา VIP',
      },
      {
        code: 'GENERAL_PRICE',
        name_th: 'ราคาทั่วไป',
        token: 'catalog-tuulo-general',
        badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
        textColor: 'text-slate-800',
        desc: 'แชร์แคตตาล็อกตู้โล (121 รายการ) แสดงเรทราคาทั่วไป',
      },
    ],
    knockdown: [
      {
        code: 'SALE_PRICE',
        name_th: 'ราคาเซลล์',
        token: 'catalog-knockdown-sale',
        badgeColor: 'bg-red-50 text-red-700 border-red-200',
        textColor: 'text-red-700',
        desc: 'แชร์แคตตาล็อกน็อคดาวน์ (189 รายการ) แสดงเรทราคาเซลล์',
      },
      {
        code: 'RETAIL_PRICE',
        name_th: 'ราคาปลีก',
        token: 'catalog-knockdown-retail',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        textColor: 'text-blue-700',
        desc: 'แชร์แคตตาล็อกน็อคดาวน์ (189 รายการ) แสดงเรทราคาปลีก',
      },
      {
        code: 'VIP_PRICE',
        name_th: 'ราคา VIP',
        token: 'catalog-knockdown-vip',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        textColor: 'text-purple-700',
        desc: 'แชร์แคตตาล็อกน็อคดาวน์ (189 รายการ) แสดงเรทราคา VIP',
      },
      {
        code: 'GENERAL_PRICE',
        name_th: 'ราคาทั่วไป',
        token: 'catalog-knockdown-general',
        badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
        textColor: 'text-slate-800',
        desc: 'แชร์แคตตาล็อกน็อคดาวน์ (189 รายการ) แสดงเรทราคาทั่วไป',
      },
    ],
  };

  const currentFullLinks = allCatalogGroups[catalogCategoryTab];
  const customLinks = links.filter((l) => !l.token_raw?.startsWith('catalog-'));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            ระบบสร้างและจัดการลิงก์แชร์ลูกค้า (Customer Share Links)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            แชร์สินค้าทั้งแคตตาล็อกแบ่งตามประเภทราคา หรือสร้างลิงก์เฉพาะรายบุคคลแบบ Live Pricing
          </p>
        </div>

        <Link
          href="/admin/share-links/new"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm shadow-emerald-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          สร้างลิงก์แชร์แบบกำหนดเอง
        </Link>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="font-bold text-xs">✕</button>
        </div>
      )}

      {/* SECTION 1: FULL CATALOG SHARE LINKS BY PRICE TIER & CATALOG TYPE (Requirement 4 & 10) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              แชร์แคตตาล็อกสินค้าทั้งหมดแยกตามประเภทราคา (Full Catalog Share)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            แสดงเฉพาะ "ราคา" แก่ลูกค้า (Zero Price-Tier Leakage)
          </span>
        </div>

        {/* Catalog Type Switcher Tabs (2 แบบ: ตู้โล / น็อคดาวน์) */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setCatalogCategoryTab('tuulo')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              catalogCategoryTab === 'tuulo'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <span>แคตตาล็อกตู้โล (121 รายการ)</span>
          </button>
          <button
            onClick={() => setCatalogCategoryTab('knockdown')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              catalogCategoryTab === 'knockdown'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <span>แคตตาล็อกน็อคดาวน์ (189 รายการ)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentFullLinks.map((catTier) => {
            const isCopied = copiedId === catTier.token;
            return (
              <div
                key={catTier.code}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border ${catTier.badgeColor}`}
                    >
                      {catTier.name_th}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 uppercase">
                      {catTier.code}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 pt-1">
                    {catTier.name_th}
                  </h3>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {catTier.desc}
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-600 truncate max-w-[170px]">
                      /s/{catTier.token}
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                      Live
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(catTier.token, catTier.token)}
                      className="flex-1 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</span>
                    </button>

                    <Link
                      href={`/s/${catTier.token}`}
                      target="_blank"
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                      title="เปิดดูหน้าลูกค้า"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security Note */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl text-xs flex items-start gap-3 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-emerald-300">กฎความปลอดภัยด้านราคา (Price Isolation Guarantee)</div>
          <div className="text-slate-300 text-[11px] leading-relaxed">
            ไม่ว่าจะแชร์แคตตาล็อกประเภทราคาใด ลูกค้าที่เปิดลิงก์จะเห็นเฉพาะคำว่า <strong>"ราคา"</strong> พร้อมตัวเลขราคาปัจจุบันเท่านั้น
            ระบบจะไม่เปิดเผยชื่อ Price Tier หรือราคาระดับอื่นใดใน HTML, URL, JSON Response หรือ Metadata โดยเด็ดขาด
          </div>
        </div>
      </div>

      {/* SECTION 2: CUSTOM SHARE LINKS TABLE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            ประวัติลิงก์แชร์ทั้งหมดในระบบ ({links.length})
          </h2>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">ลูกค้า / วัตถุประสงค์</th>
                  <th className="px-4 py-3.5">รูปแบบการแชร์</th>
                  <th className="px-4 py-3.5">Price Tier ที่ผูกไว้</th>
                  <th className="px-4 py-3.5">วันหมดอายุ</th>
                  <th className="px-3 py-3.5 text-center">สถานะ</th>
                  <th className="px-5 py-3.5 text-right">การจัดการลิงก์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <span className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                      <div>กำลังโหลดข้อมูลลิงก์...</div>
                    </td>
                  </tr>
                ) : links.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      ยังไม่มีลิงก์แชร์ในระบบ
                    </td>
                  </tr>
                ) : (
                  links.map((link) => {
                    const isExpired = link.expires_at && new Date() > new Date(link.expires_at);
                    const isCopied = copiedId === link.id;
                    return (
                      <tr key={link.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">
                            {link.customer_name || 'ลูกค้าทั่วไป (General)'}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            สร้างโดย {link.creator_name || 'Admin'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[11px] font-medium">
                            {link.sharing_mode === 'FULL_CATALOG'
                              ? `ทั้งแคตตาล็อก (${link.productCount} รายการ)`
                              : link.sharing_mode === 'MULTIPLE_PRODUCTS'
                              ? `เลือกสินค้า (${link.productCount} รายการ)`
                              : `สินค้าเดี่ยว (1 รายการ)`}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold">
                            {link.price_tier_name}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                          {link.expires_at ? (
                            <span className={isExpired ? 'text-red-600 font-semibold' : ''}>
                              {new Date(link.expires_at).toLocaleDateString('th-TH')}
                            </span>
                          ) : (
                            <span className="text-slate-400">ไม่มีวันหมดอายุ</span>
                          )}
                        </td>

                        <td className="px-3 py-3.5 text-center">
                          {link.is_revoked ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              ถูกยกเลิก (Revoked)
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                              หมดอายุ
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              พร้อมใช้งาน
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleCopy(link.token_raw, link.id)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                              title="คัดลอกลิงก์"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700">คัดลอกแล้ว</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>

                            <Link
                              href={`/s/${link.token_raw}`}
                              target="_blank"
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                              title="เปิดดูในแท็บใหม่"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>

                            {!link.is_revoked && !link.token_raw?.startsWith('catalog-') && (
                              <button
                                onClick={() => handleRevoke(link.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="ยกเลิกลิงก์ (Revoke)"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
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
      </div>
    </div>
  );
}
