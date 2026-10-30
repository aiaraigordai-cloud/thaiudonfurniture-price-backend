'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScrollText, ArrowLeft, Search, ShieldCheck } from 'lucide-react';

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-logs?action=${encodeURIComponent(search)}`);
      if (res.status === 403) {
        alert('เข้าถึงไม่ได้: คุณไม่ใช่ SYSTEM_OWNER');
        router.push('/admin');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-950 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                ประวัติการใช้งานและ Audit Logs
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 text-[10px] font-bold border border-amber-500/30">
                เฉพาะ SYSTEM OWNER
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              เก็บบันทึกประวัติกิจกรรมสำคัญทั้งหมด การล็อกอิน การเปลี่ยนราคา การนำเข้าไฟล์ และการสร้างลิงก์
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาตาม Action (เช่น UPDATE_PRICE, LOGIN, BULK)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-600 transition"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">วันและเวลา</th>
                <th className="px-4 py-3.5">การกระทำ (Action)</th>
                <th className="px-4 py-3.5">ผู้กระทำ (Actor)</th>
                <th className="px-4 py-3.5">Entity</th>
                <th className="px-5 py-3.5">รายละเอียด (Details)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                    <div>กำลังโหลด Audit Logs...</div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    ไม่พบรายการ Audit Logs
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {log.created_at}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      @{log.actor_username || 'SYSTEM'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <span className="font-mono text-[11px]">{log.entity_type}</span>
                    </td>
                    <td className="px-5 py-3.5 max-w-md truncate font-mono text-[11px] text-slate-500">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
