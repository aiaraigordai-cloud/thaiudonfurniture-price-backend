'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Coins, Layers, FileSpreadsheet, Share2, Zap, RefreshCw, CheckCircle2 } from 'lucide-react';

interface QuickToolNavProps {
  activeTab: 'products' | 'prices' | 'categories' | 'bulk-update' | 'share-links';
  subtitle?: string;
  onRefresh?: () => void;
}

export default function QuickToolNav({ activeTab, subtitle, onRefresh }: QuickToolNavProps) {
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState<boolean>(false);

  useEffect(() => {
    setLastSyncTime(new Date().toLocaleTimeString('th-TH'));

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('thaiudon_sync_channel');
      bc.onmessage = () => {
        setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
        setShowSyncSuccess(true);
        setTimeout(() => setShowSyncSuccess(false), 2500);
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'thaiudon_last_sync') {
        setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
        setShowSyncSuccess(true);
        setTimeout(() => setShowSyncSuccess(false), 2500);
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleCustomSync = () => {
      setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 2500);
    };
    window.addEventListener('thaiudon_catalog_sync', handleCustomSync);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('thaiudon_catalog_sync', handleCustomSync);
    };
  }, []);

  const triggerRealtimeBroadcast = () => {
    setIsSyncing(true);
    try {
      if (typeof window !== 'undefined') {
        const bc = new BroadcastChannel('thaiudon_sync_channel');
        bc.postMessage({ type: 'MANUAL_SYNC', timestamp: Date.now() });
        localStorage.setItem('thaiudon_last_sync', Date.now().toString());
        window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
      }
      if (onRefresh) {
        onRefresh();
      }
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 2500);
    } catch (e) {
      console.warn('Realtime sync broadcast error:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 400);
    }
  };

  const tools = [
    {
      id: 'products',
      name: 'จัดการสินค้า',
      desc: 'แคตตาล็อก & รูปภาพ & ขนาด',
      href: '/admin/products',
      icon: Package,
      color: 'from-blue-600 to-indigo-700',
      activeColor: 'bg-blue-600 text-white shadow-blue-500/20 shadow-md',
      inactiveColor: 'hover:bg-blue-50 hover:text-blue-700 text-slate-700 bg-white border-slate-200',
    },
    {
      id: 'prices',
      name: 'แก้ไขราคา 4 ระดับ',
      desc: 'ปลีก / ส่ง / VIP / ช่าง',
      href: '/admin/prices',
      icon: Coins,
      color: 'from-emerald-600 to-teal-700',
      activeColor: 'bg-emerald-600 text-white shadow-emerald-500/20 shadow-md',
      inactiveColor: 'hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 bg-white border-slate-200',
    },
    {
      id: 'categories',
      name: 'นำเข้าสินค้า/แคตตาล็อก',
      desc: 'นำเข้ารายการจากรูปภาพแคตตาล็อก',
      href: '/admin/categories',
      icon: Layers,
      color: 'from-amber-600 to-orange-700',
      activeColor: 'bg-amber-600 text-white shadow-amber-500/20 shadow-md',
      inactiveColor: 'hover:bg-amber-50 hover:text-amber-700 text-slate-700 bg-white border-slate-200',
    },
    {
      id: 'bulk-update',
      name: 'อัปเดทด้วยไฟล์ Excel',
      desc: 'นำเข้า & อัปเดตข้อมูลด้วย Excel',
      href: '/admin/prices/bulk-update',
      icon: FileSpreadsheet,
      color: 'from-purple-600 to-pink-700',
      activeColor: 'bg-purple-600 text-white shadow-purple-500/20 shadow-md',
      inactiveColor: 'hover:bg-purple-50 hover:text-purple-700 text-slate-700 bg-white border-slate-200',
    },
    {
      id: 'share-links',
      name: 'ระบบแชร์ลิงก์ลูกค้า',
      desc: 'ส่งแคตตาล็อก Real-time ให้ลูกค้า',
      href: '/admin/share-links',
      icon: Share2,
      color: 'from-red-600 to-rose-700',
      activeColor: 'bg-red-600 text-white shadow-red-500/20 shadow-md',
      inactiveColor: 'hover:bg-red-50 hover:text-red-700 text-slate-700 bg-white border-slate-200',
    },
  ];

  return (
    <div className="bg-gradient-to-r from-slate-900 via-[#161B40] to-slate-900 border border-slate-800 rounded-2xl p-3 md:p-4 mb-6 shadow-xl text-white">
      {/* Top Bar: Title & Real-time Live Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-md">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">
                ระบบจัดการไทยอุดรเฟอร์นิเจอร์ (เชื่อมต่อทุกเครื่องมือ Real-time)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE CONNECTED
              </span>
            </div>
            {subtitle && <p className="text-[11px] text-slate-300 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Sync Status & Action */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {lastSyncTime && (
            <div className="text-[11px] text-slate-300 hidden md:block">
              ซิงค์ล่าสุด: <span className="font-mono text-emerald-400 font-semibold">{lastSyncTime}</span>
            </div>
          )}
          <button
            onClick={triggerRealtimeBroadcast}
            disabled={isSyncing}
            title="กดเพื่อสั่งซิงค์ข้อมูลให้ทุกหน้าและทุกแท็บอัปเดตตรงกันทันที"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              showSyncSuccess
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
            }`}
          >
            {showSyncSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>ซิงค์สดแล้ว!</span>
              </>
            ) : (
              <>
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : 'text-slate-300'}`} />
                <span>ซิงค์สดทันที</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tool Navigation Switcher Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-3">
        {tools.map((t) => {
          const isActive = activeTab === t.id;
          const Icon = t.icon;
          return (
            <Link
              key={t.id}
              href={t.href}
              prefetch={false}
              className={`flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl border text-left transition-all ${
                isActive
                  ? `${t.activeColor} border-transparent ring-2 ring-white/30 scale-[1.02]`
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
              }`}
            >
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs truncate leading-tight">{t.name}</div>
                <div
                  className={`text-[10px] truncate leading-tight mt-0.5 ${
                    isActive ? 'text-white/80' : 'text-slate-400'
                  }`}
                >
                  {t.desc}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
