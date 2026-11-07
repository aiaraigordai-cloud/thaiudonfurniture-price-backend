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
  Edit,
  Play,
  RotateCcw,
  Calendar,
  User,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  RefreshCw,
} from 'lucide-react';

export default function ShareLinksPage() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Edit Modal States
  const [editLink, setEditLink] = useState<any | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editIsRevoked, setEditIsRevoked] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Catalog Category Tab for Full Catalog Share
  const [catalogCategoryTab, setCatalogCategoryTab] = useState<'tuulo' | 'knockdown' | 'all'>('tuulo');

  const loadLinks = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch('/api/share-links');
      const data = await res.json();
      if (data.success) {
        setLinks(data.links || []);
        setLastSyncTime(new Date());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadLinks();

    // 1. Real-time background polling every 12 seconds when tab is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadLinks(true);
      }
    }, 12000);

    // 2. BroadcastChannel for instant cross-tab real-time sync
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('share_links_channel');
      bc.onmessage = () => {
        loadLinks(true);
      };
    }

    return () => {
      clearInterval(interval);
      bc?.close();
    };
  }, []);

  const handleCopy = (rawToken: string, id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}/s/${rawToken}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle Suspend (ระงับ) vs Activate (เปิดใช้งาน)
  const handleToggleRevoke = async (link: any) => {
    const newRevoked = link.is_revoked === 1 ? 0 : 1;
    const confirmText = newRevoked === 1
      ? `ยืนยันการระงับลิงก์ของ "${link.customer_name || 'ลูกค้ารายนี้'}"?\nลูกค้าจะไม่สามารถเปิดดูแคตตาล็อกผ่านลิงก์นี้ได้ชั่วคราว`
      : `ยืนยันการเปิดใช้งานลิงก์ของ "${link.customer_name || 'ลูกค้ารายนี้'}" อีกครั้ง?\nลูกค้าจะสามารถเข้าใช้งานได้ตามปกติทันที`;

    if (!confirm(confirmText)) return;

    // Optimistic UI update
    setLinks((prev) =>
      prev.map((l) => (l.id === link.id ? { ...l, is_revoked: newRevoked } : l))
    );

    try {
      const res = await fetch(`/api/share-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_revoked: newRevoked }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg(data.message || (newRevoked === 1 ? 'ระงับลิงก์เรียบร้อยแล้ว' : 'เปิดใช้งานลิงก์เรียบร้อยแล้ว'));
        // Broadcast to other tabs
        if (typeof window !== 'undefined') {
          const bc = new BroadcastChannel('share_links_channel');
          bc.postMessage({ type: 'LINK_STATUS_CHANGED', linkId: link.id, is_revoked: newRevoked });
        }
      } else {
        // Rollback on error
        setLinks((prev) =>
          prev.map((l) => (l.id === link.id ? { ...l, is_revoked: link.is_revoked } : l))
        );
        alert(data.error || 'เปลี่ยนสถานะลิงก์ไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      loadLinks(true);
    }
  };

  // Open Edit Modal
  const openEditModal = (link: any) => {
    setEditLink(link);
    setEditCustomerName(link.customer_name || '');
    setEditIsRevoked(link.is_revoked === 1);

    if (link.expires_at) {
      try {
        const d = new Date(link.expires_at);
        // Format to local YYYY-MM-DDTHH:mm
        const pad = (n: number) => String(n).padStart(2, '0');
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setEditExpiresAt(formatted);
      } catch {
        setEditExpiresAt('');
      }
    } else {
      setEditExpiresAt('');
    }
  };

  // Quick preset helper
  const setQuickExpiryDays = (days: number | null) => {
    if (days === null) {
      setEditExpiresAt('');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setEditExpiresAt(formatted);
  };

  // Save Modal
  const handleSaveEdit = async () => {
    if (!editLink) return;
    setIsSavingEdit(true);

    try {
      const payload: any = {
        customer_name: editCustomerName,
        is_revoked: editIsRevoked ? 1 : 0,
        expires_at: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
      };

      const res = await fetch(`/api/share-links/${editLink.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setActionMsg(data.message || 'บันทึกการแก้ไขระยะเวลาและข้อมูลลิงก์สำเร็จ (Real-time)');
        setEditLink(null);

        // Optimistic update
        setLinks((prev) =>
          prev.map((l) =>
            l.id === editLink.id
              ? {
                  ...l,
                  customer_name: editCustomerName,
                  is_revoked: editIsRevoked ? 1 : 0,
                  expires_at: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
                }
              : l
          )
        );

        if (typeof window !== 'undefined') {
          const bc = new BroadcastChannel('share_links_channel');
          bc.postMessage({ type: 'LINK_EDITED', linkId: editLink.id });
        }
      } else {
        alert(data.error || 'แก้ไขลิงก์ไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Full Catalog Links grouped by Catalog Type & Price Tier
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
      {
        code: 'NO_PRICE',
        name_th: 'ไม่มีราคา (-)',
        token: 'catalog-tuulo-noprice',
        badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
        textColor: 'text-amber-800',
        desc: 'แชร์แคตตาล็อกตู้โล (121 รายการ) แสดงเฉพาะสินค้าโดยไม่มีราคา (-)',
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
      {
        code: 'NO_PRICE',
        name_th: 'ไม่มีราคา (-)',
        token: 'catalog-knockdown-noprice',
        badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
        textColor: 'text-amber-800',
        desc: 'แชร์แคตตาล็อกน็อคดาวน์ (189 รายการ) แสดงเฉพาะสินค้าโดยไม่มีราคา (-)',
      },
    ],
    all: [
      {
        code: 'SALE_PRICE',
        name_th: 'ราคาเซลล์',
        token: 'catalog-sale-2026',
        badgeColor: 'bg-red-50 text-red-700 border-red-200',
        textColor: 'text-red-700',
        desc: 'แชร์แคตตาล็อกรวมสินค้าทั้งหมด (310 รายการ) แสดงเรทราคาเซลล์',
      },
      {
        code: 'RETAIL_PRICE',
        name_th: 'ราคาปลีก',
        token: 'catalog-retail-2026',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        textColor: 'text-blue-700',
        desc: 'แชร์แคตตาล็อกรวมสินค้าทั้งหมด (310 รายการ) แสดงเรทราคาปลีก',
      },
      {
        code: 'VIP_PRICE',
        name_th: 'ราคา VIP',
        token: 'catalog-vip-2026',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        textColor: 'text-purple-700',
        desc: 'แชร์แคตตาล็อกรวมสินค้าทั้งหมด (310 รายการ) แสดงเรทราคา VIP',
      },
      {
        code: 'GENERAL_PRICE',
        name_th: 'ราคาทั่วไป',
        token: 'catalog-general-2026',
        badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
        textColor: 'text-slate-800',
        desc: 'แชร์แคตตาล็อกรวมสินค้าทั้งหมด (310 รายการ) แสดงเรทราคาทั่วไป',
      },
      {
        code: 'NO_PRICE',
        name_th: 'ไม่มีราคา (-)',
        token: 'catalog-noprice-2026',
        badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
        textColor: 'text-amber-800',
        desc: 'แชร์แคตตาล็อกรวมสินค้าทั้งหมด (310 รายการ) แสดงเฉพาะสินค้าโดยไม่มีราคา (-)',
      },
    ],
  };

  const currentFullLinks = allCatalogGroups[catalogCategoryTab];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              ระบบสร้างและจัดการลิงก์แชร์ลูกค้า (Customer Share Links)
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Real-time Active</span>
              {isRefreshing && <RefreshCw className="w-3 h-3 animate-spin text-emerald-600 ml-1" />}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            แชร์สินค้าทั้งแคตตาล็อกหรือสร้างลิงก์เฉพาะบุคคล พร้อมปรับเปลี่ยนระยะเวลาและระงับ/เปิดใช้งานได้แบบ Real-time
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadLinks(false)}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition shadow-2xs flex items-center gap-1.5 text-xs font-semibold"
            title="รีเฟรชข้อมูลทันที"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>รีเฟรช</span>
          </button>
          <Link
            href="/admin/share-links/new"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm shadow-emerald-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            สร้างลิงก์แชร์แบบกำหนดเอง
          </Link>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionMsg}</span>
          </div>
          <button onClick={() => setActionMsg('')} className="font-bold text-xs text-emerald-700 hover:text-emerald-950">✕</button>
        </div>
      )}

      {/* SECTION 1: FULL CATALOG SHARE LINKS */}
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

        {/* Catalog Type Switcher Tabs (3 แบบ: ตู้โล / น็อคดาวน์ / รวมทั้งหมด) */}
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
          <button
            onClick={() => setCatalogCategoryTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              catalogCategoryTab === 'all'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <span>รวมสินค้าทั้งหมด (310 รายการ)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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

      {/* SECTION 2: CUSTOM SHARE LINKS TABLE (Real-time, Expiry Editing, Suspend / Activate) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              ประวัติลิงก์แชร์ทั้งหมดในระบบ ({links.length})
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">
              อัปเดตล่าสุด: {lastSyncTime.toLocaleTimeString('th-TH')}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">ลูกค้า / วัตถุประสงค์</th>
                  <th className="px-4 py-3.5">รูปแบบการแชร์</th>
                  <th className="px-4 py-3.5">Price Tier ที่ผูกไว้</th>
                  <th className="px-4 py-3.5">ระยะเวลา / วันหมดอายุ</th>
                  <th className="px-3 py-3.5 text-center">สถานะใช้งาน</th>
                  <th className="px-5 py-3.5 text-right">การจัดการลิงก์ (Real-time)</th>
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
                    const isRevoked = link.is_revoked === 1;

                    return (
                      <tr key={link.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{link.customer_name || 'ลูกค้าทั่วไป (General)'}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            สร้างโดย {link.creator_name || 'Admin'} • /s/{link.token_raw?.substring(0, 10)}...
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[11px] font-medium">
                            {link.sharing_mode === 'FULL_CATALOG'
                              ? `ทั้งแคตตาล็อก (${link.productCount || 0} รายการ)`
                              : link.sharing_mode === 'MULTIPLE_PRODUCTS'
                              ? `เลือกสินค้า (${link.productCount || 0} รายการ)`
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
                            <div>
                              <div className={isExpired ? 'text-red-600 font-bold flex items-center gap-1' : 'font-semibold text-slate-800 flex items-center gap-1'}>
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{new Date(link.expires_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {isExpired && (
                                <span className="text-[10px] text-red-500 font-medium">หมดอายุแล้ว</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span>ไม่มีวันหมดอายุ (ถาวร)</span>
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3.5 text-center">
                          {isRevoked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Ban className="w-3 h-3 text-amber-600" />
                              <span>ระงับการใช้งาน</span>
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>หมดอายุ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>พร้อมใช้งาน</span>
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Copy Link Button */}
                            <button
                              onClick={() => handleCopy(link.token_raw, link.id)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
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
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            {/* View Live */}
                            <Link
                              href={`/s/${link.token_raw}`}
                              target="_blank"
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                              title="เปิดดูหน้าลูกค้า"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>

                            {/* Edit Duration & Info Modal Trigger */}
                            <button
                              onClick={() => openEditModal(link)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
                              title="แก้ไขระยะเวลาแชร์และข้อมูลลิงก์"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>แก้ไข</span>
                            </button>

                            {/* Toggle Suspend / Activate Button */}
                            {isRevoked ? (
                              <button
                                onClick={() => handleToggleRevoke(link)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                                title="เปิดใช้งานลิงก์นี้อีกครั้ง"
                              >
                                <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                                <span>เปิดใช้งาน</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleRevoke(link)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                                title="ระงับลิงก์ชั่วคราว"
                              >
                                <Ban className="w-3.5 h-3.5 text-amber-600" />
                                <span>ระงับลิงก์</span>
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

      {/* EDIT MODAL: Expiration Duration & Status (Real-time) */}
      {editLink && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">แก้ไขระยะเวลาและสถานะลิงก์แชร์</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {editLink.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditLink(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition"
              >
                ✕
              </button>
            </div>

            {/* Link Info Summary */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">ประเภทราคา:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {editLink.price_tier_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">รูปแบบการแชร์:</span>
                <span className="font-semibold text-slate-800">
                  {editLink.sharing_mode === 'FULL_CATALOG' ? 'ทั้งแคตตาล็อก' : 'เลือกสินค้า'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">URL ปัจจุบัน:</span>
                <span className="font-mono text-slate-600 truncate max-w-[200px]">/s/{editLink.token_raw}</span>
              </div>
            </div>

            {/* Editable Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อลูกค้า / วัตถุประสงค์ (Customer Name)
              </label>
              <input
                type="text"
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                placeholder="เช่น คุณสมชาย (ร้านเฟอร์นิเจอร์อุดร)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Expiration Duration Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  ระยะเวลาการแชร์ (Expiration Duration)
                </label>
                <span className="text-[11px] text-slate-400">เลือกด่วนหรือระบุวันเวลา</span>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setQuickExpiryDays(1)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  +1 วัน
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpiryDays(3)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  +3 วัน
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpiryDays(7)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  +7 วัน
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpiryDays(15)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  +15 วัน
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpiryDays(30)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  +30 วัน
                </button>
                <button
                  type="button"
                  onClick={() => setQuickExpiryDays(null)}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition"
                >
                  ไม่มีวันหมดอายุ
                </button>
              </div>

              {/* Exact Datetime Input */}
              <div className="pt-1">
                <input
                  type="datetime-local"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  {editExpiresAt ? `จะหมดอายุในวันที่: ${new Date(editExpiresAt).toLocaleString('th-TH')}` : 'สถานะ: ใช้งานได้ตลอดเวลา (ไม่มีวันหมดอายุ)'}
                </div>
              </div>
            </div>

            {/* Suspend / Activate Toggle */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">สถานะการใช้งานของลิงก์</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditIsRevoked(false)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
                    !editIsRevoked
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>เปิดใช้งาน (Active)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditIsRevoked(true)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
                    editIsRevoked
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Ban className="w-4 h-4" />
                  <span>ระงับลิงก์ (Suspended)</span>
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditLink(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-600/30 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingEdit ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>บันทึกการแก้ไข (Real-time)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
