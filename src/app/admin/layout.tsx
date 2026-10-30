'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  Layers,
  Coins,
  FileSpreadsheet,
  History,
  Share2,
  ShieldAlert,
  Users,
  ScrollText,
  LogOut,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/');
          return;
        }
        const data = await res.json();
        if (!data.authenticated) {
          router.push('/');
          return;
        }
        setUser(data.user);
      } catch {
        router.push('/');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#161B40] flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-3 border-[#DE1B23] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium text-slate-200">กำลังตรวจสอบสิทธิ์การเข้าถึง...</p>
      </div>
    );
  }

  const isOwner = user?.role === 'SYSTEM_OWNER';

  const navLinks: { href: string; label: string; icon: any; badge?: string }[] = [
    { href: '/admin', label: 'ภาพรวมระบบ', icon: LayoutDashboard },
    { href: '/admin/products', label: 'จัดการสินค้า (310 รายการ)', icon: Package },
    { href: '/admin/categories', label: 'หมวดหมู่สินค้า', icon: Layers },
    { href: '/admin/prices', label: 'แก้ไขราคา 4 ระดับ', icon: Coins },
    { href: '/admin/prices/bulk-update', label: 'อัปเดตราคาด้วยไฟล์', icon: FileSpreadsheet },
    { href: '/admin/prices/import-history', label: 'ประวัตินำเข้า / Rollback', icon: History },
    { href: '/admin/share-links', label: 'ระบบแชร์ลิงก์ลูกค้า', icon: Share2 },
  ];

  const ownerLinks = [
    { href: '/admin/permissions', label: 'จัดการสิทธิ์บัญชี', icon: ShieldAlert },
    { href: '/admin/employees', label: 'รายชื่อพนักงาน Allowlist', icon: Users },
    { href: '/admin/audit-logs', label: 'ประวัติและ Audit Logs', icon: ScrollText },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-[#161B40] text-white px-4 py-3 flex items-center justify-between shadow border-b border-red-600">
        <div className="flex items-center gap-2">
          <img src="/images/logo-red.png" alt="ไทยอุดรเฟอร์นิเจอร์" className="w-8 h-8 rounded-full bg-white p-0.5 object-contain" />
          <span className="font-bold tracking-tight text-sm">ไทยอุดรเฟอร์นิเจอร์ (ระบบหลังบ้าน)</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-[#0F132C] text-red-400"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#161B40] text-white flex flex-col border-r border-slate-700/50 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/logo-red.png" alt="ไทยอุดรเฟอร์นิเจอร์" className="w-11 h-11 rounded-full bg-white p-0.5 object-contain shadow-md" />
            <div>
              <div className="font-bold text-white text-sm tracking-tight leading-tight">
                ไทยอุดรเฟอร์นิเจอร์
              </div>
              <div className="text-[10px] text-red-400 font-bold tracking-wider uppercase mt-0.5">
                เว็บไซต์ทางการหลังบ้าน
              </div>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="px-4 py-3 bg-[#0F132C] border border-white/10 mx-3 my-3 rounded-2xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-white truncate max-w-[140px]">{user?.employee_name}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase ${
                isOwner
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {user?.role}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">@{user?.username}</div>
        </div>

        {/* Navigation Menus */}
        <div className="flex-1 overflow-y-auto px-3 space-y-6 py-2 custom-scrollbar">
          {/* Main Links */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold text-[#A69385] uppercase tracking-wider">
              เมนูหลัก
            </div>
            {navLinks.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-r from-[#DE1B23] to-[#B91218] text-white shadow-sm font-bold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-300">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* System Owner Only Links */}
          {isOwner && (
            <div className="space-y-1 pt-2 border-t border-white/10">
              <div className="px-3 pb-1 flex items-center justify-between text-[10px] font-bold text-red-400 uppercase tracking-wider">
                <span>เฉพาะ SYSTEM OWNER</span>
                <Sparkles className="w-3 h-3 text-red-400" />
              </div>
              {ownerLinks.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      active
                        ? 'bg-gradient-to-r from-red-700 to-red-800 text-white font-bold'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Quick Links & Logout */}
        <div className="p-3 border-t border-white/10 space-y-2">
          <Link
            href="/s/catalog-sale-all"
            target="_blank"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium bg-[#0F132C] text-red-400 hover:bg-white/10 transition border border-white/10"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              ดูหน้าแคตตาล็อกลูกค้า
            </span>
            <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-bold">Live</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-300 hover:bg-red-900/30 hover:text-red-200 transition"
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 hidden md:flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-bold text-[#161B40]">ไทยอุดรเฟอร์นิเจอร์</span>
            <span>/</span>
            <span className="text-red-600 font-semibold">เว็บไซต์ทางการหลังบ้าน</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-white border border-[#D2B681] text-[#805216] rounded-full text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#06C755] animate-pulse"></span>
              Live Database Connected
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-1 bg-[#F7F0E6]">{children}</div>
      </main>
    </div>
  );
}
