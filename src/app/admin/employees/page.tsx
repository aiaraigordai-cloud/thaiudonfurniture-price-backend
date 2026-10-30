'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, Plus, ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft, Mail, User } from 'lucide-react';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/employees');
      if (res.status === 403) {
        alert('เข้าถึงไม่ได้: คุณไม่ใช่ SYSTEM_OWNER');
        router.push('/admin');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setEmployees(data.employees || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_name: name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'เพิ่มไม่สำเร็จ' });
      } else {
        setMessage({ type: 'success', text: data.message || 'เพิ่มรายชื่อพนักงานสำเร็จ' });
        setName('');
        loadEmployees();
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setAdding(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: number) => {
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: currentStatus ? 0 : 1 }),
      });
      if (res.ok) {
        loadEmployees();
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
                รายชื่อพนักงานที่อนุญาต (Employee Allowlist)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 text-[10px] font-bold border border-amber-500/30">
                เฉพาะ SYSTEM OWNER
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              พนักงานจะสามารถสมัครบัญชีได้ทันทีเมื่อ System Owner เพิ่มชื่อลงในระบบ โดยไม่ต้องแก้ไขโค้ดหรือ Deploy เว็บใหม่
            </p>
          </div>
        </div>
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
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="font-bold text-xs">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Add */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs h-fit space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Plus className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">เพิ่มพนักงานใหม่ใน Allowlist</h2>
          </div>

          <form onSubmit={handleAddEmployee} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อ-นามสกุล พนักงาน *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น สมศักดิ์ มั่งคั่ง"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                เมื่อกดเพิ่มแล้ว พนักงานสามารถนำชื่อนี้ไปสมัครที่หน้าแรกได้ทันที
              </p>
            </div>

            <button
              type="submit"
              disabled={adding}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              {adding ? 'กำลังบันทึก...' : 'เพิ่มลงใน Allowlist'}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">รายชื่อพนักงานในระบบ ({employees.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">ชื่อพนักงาน</th>
                  <th className="px-3 py-3 text-center">สถานะการสมัคร</th>
                  <th className="px-3 py-3 text-center">อนุญาต</th>
                  <th className="px-4 py-3 text-right">สิทธิ์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{emp.employee_name}</td>
                    <td className="px-3 py-3.5 text-center">
                      {emp.is_claimed ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          สมัครแล้ว (@{emp.claimed_username || 'claimed'})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          ยังไม่ใช้งาน (พร้อมให้สมัคร)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          emp.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {emp.is_active ? 'เปิดรับสมัคร' : 'ระงับ'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleToggleStatus(emp.id, emp.is_active)}
                        className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                      >
                        {emp.is_active ? 'ระงับชั่วคราว' : 'เปิดใช้งาน'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
