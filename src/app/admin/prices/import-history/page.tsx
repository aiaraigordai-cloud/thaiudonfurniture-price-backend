'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  History,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';

export default function ImportHistoryPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/prices/import-history');
      const data = await res.json();
      if (data.success) {
        setBatches(data.batches || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleRollback = async (batchId: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการ Rollback ย้อนคืนราคาของ Batch นี้? ข้อมูลราคาจะถูกคืนค่าเดิมก่อนการนำเข้า')) {
      return;
    }

    setRollingBackId(batchId);
    setMessage(null);

    try {
      const res = await fetch('/api/prices/import-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Rollback ไม่สำเร็จ' });
      } else {
        setMessage({ type: 'success', text: data.message || 'Rollback สำเร็จ' });
        loadBatches();
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setRollingBackId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/prices"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-950 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              ประวัติการนำเข้าราคา & การย้อนกลับ (Import History & Rollback)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              ตรวจสอบประวัติการอัปเดตราคาแบบกลุ่ม และสามารถ Rollback ย้อนคืนราคาก่อนหน้าได้แบบปลอดภัย
            </p>
          </div>
        </div>

        <Link
          href="/admin/prices/bulk-update"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          นำเข้าไฟล์ใหม่
        </Link>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="font-bold text-xs">✕</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">วันที่ & เวลา</th>
                <th className="px-4 py-3.5">ชื่อไฟล์ & ประเภท</th>
                <th className="px-4 py-3.5">Price Tier เป้าหมาย</th>
                <th className="px-3 py-3.5 text-center">ทั้งหมด</th>
                <th className="px-3 py-3.5 text-center text-emerald-700">ผ่าน (PASS)</th>
                <th className="px-3 py-3.5 text-center text-amber-700">รอตรวจ</th>
                <th className="px-3 py-3.5 text-center text-red-700">ล้มเหลว</th>
                <th className="px-3 py-3.5 text-center font-bold">อัปเดตจริง</th>
                <th className="px-4 py-3.5 text-center">สถานะ</th>
                <th className="px-5 py-3.5 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                    <div>กำลังโหลดประวัติ...</div>
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    ยังไม่มีประวัติการนำเข้าไฟล์ราคา
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {b.created_at}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{b.filename}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-mono">
                        .{b.file_type} | โดย {b.uploader_name || b.uploader_username || 'Admin'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-semibold">
                        {b.tier_name}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono">{b.total_rows}</td>
                    <td className="px-3 py-3.5 text-center font-mono font-bold text-emerald-700">{b.passed_rows}</td>
                    <td className="px-3 py-3.5 text-center font-mono text-amber-700">{b.review_rows}</td>
                    <td className="px-3 py-3.5 text-center font-mono text-red-700">{b.failed_rows}</td>
                    <td className="px-3 py-3.5 text-center font-mono font-bold text-slate-900">{b.updated_rows}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'COMMITTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'ROLLED_BACK'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {b.status === 'COMMITTED' && b.updated_rows > 0 ? (
                        <button
                          onClick={() => handleRollback(b.id)}
                          disabled={rollingBackId === b.id}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ml-auto disabled:opacity-50 border border-slate-200"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Rollback
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
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
