'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, User, ShieldCheck, Mail, KeyRound, CheckCircle2 } from 'lucide-react';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) setUser(d.user);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">กำลังโหลดโปรไฟล์...</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-950 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">ข้อมูลบัญชีผู้ใช้งาน</h1>
          <p className="text-xs text-slate-500 mt-0.5">รายละเอียดบัญชีและสิทธิ์การเข้าถึงในระบบ Catalog ไทยอุดรเฟอร์นิเจอร์</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xl border border-emerald-200">
            {user?.employee_name?.charAt(0) || 'U'}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{user?.employee_name}</h2>
            <div className="text-xs text-slate-500 font-mono">@{user?.username}</div>
            <div className="mt-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              อีเมล
            </span>
            <span className="font-semibold text-slate-800 font-mono">{user?.email}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              สถานะบัญชี
            </span>
            <span className="font-semibold text-emerald-700">{user?.status || 'Active'}</span>
          </div>
        </div>

        {user?.role === 'ADMIN' && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="text-xs font-bold text-slate-800">สิทธิ์ที่ได้รับมอบหมาย:</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {Object.entries(user?.permissions || {}).map(([key, val]) => (
                <div
                  key={key}
                  className={`p-2 rounded-lg border font-mono ${
                    val ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                >
                  {val ? '✓' : '✕'} {key}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
