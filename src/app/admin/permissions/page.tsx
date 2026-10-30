'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  UserCheck,
  UserX,
  Sparkles,
} from 'lucide-react';

export default function PermissionsPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/permissions');
      if (res.status === 403) {
        alert('เข้าถึงไม่ได้: คุณไม่ใช่ SYSTEM_OWNER');
        router.push('/admin');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setAdmins(data.admins || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleTogglePermission = (adminId: string, permKey: string) => {
    setAdmins((prev) =>
      prev.map((adm) => {
        if (adm.id === adminId) {
          return {
            ...adm,
            permissions: {
              ...adm.permissions,
              [permKey]: !adm.permissions[permKey],
            },
          };
        }
        return adm;
      })
    );
  };

  const handleToggleStatus = (adminId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    setAdmins((prev) =>
      prev.map((adm) => {
        if (adm.id === adminId) {
          return { ...adm, status: nextStatus };
        }
        return adm;
      })
    );
  };

  const handleSaveAdmin = async (admin: any) => {
    setSavingId(admin.id);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: admin.id,
          status: admin.status,
          permissions: admin.permissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'บันทึกไม่สำเร็จ' });
      } else {
        setMessage({ type: 'success', text: data.message || 'บันทึกสิทธิ์สำเร็จ' });
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              จัดการสิทธิ์บัญชี Admin (System Owner Privilege Control)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 text-[10px] font-bold border border-amber-500/30">
              เฉพาะ SYSTEM OWNER
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            กำหนด Feature Flags รายบัญชี เปิดใช้งาน หรือระงับบัญชีพนักงาน (Suspended Accounts)
          </p>
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

      {/* Permissions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">บัญชี Admin / พนักงาน</th>
                <th className="px-3 py-3.5 text-center">จัดการสินค้า<br/><span className="text-[10px] lowercase font-mono font-normal">product_manage</span></th>
                <th className="px-3 py-3.5 text-center">แก้ไขราคา<br/><span className="text-[10px] lowercase font-mono font-normal">price_edit</span></th>
                <th className="px-3 py-3.5 text-center">นำเข้าไฟล์ราคา<br/><span className="text-[10px] lowercase font-mono font-normal">price_bulk_import</span></th>
                <th className="px-3 py-3.5 text-center">จัดการลิงก์แชร์<br/><span className="text-[10px] lowercase font-mono font-normal">share_link_manage</span></th>
                <th className="px-3 py-3.5 text-center">ดูรายงาน<br/><span className="text-[10px] lowercase font-mono font-normal">reports_view</span></th>
                <th className="px-4 py-3.5 text-center">สถานะบัญชี</th>
                <th className="px-5 py-3.5 text-right">บันทึก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                    <div>กำลังโหลดข้อมูลสิทธิ์...</div>
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    ยังไม่มีบัญชี Admin ในระบบ (พนักงานสามารถลงทะเบียนได้ผ่านหน้าแรกตาม Employee Allowlist)
                  </td>
                </tr>
              ) : (
                admins.map((adm) => {
                  const isSaving = savingId === adm.id;
                  const isSuspended = adm.status === 'Suspended';
                  return (
                    <tr
                      key={adm.id}
                      className={`hover:bg-slate-50/70 transition ${
                        isSuspended ? 'bg-red-50/20 opacity-75' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{adm.employee_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">@{adm.username}</div>
                        <div className="text-[10px] text-slate-400">{adm.email}</div>
                      </td>

                      {/* product_manage */}
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(adm.permissions?.product_manage)}
                          onChange={() => handleTogglePermission(adm.id, 'product_manage')}
                          className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      {/* price_edit */}
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(adm.permissions?.price_edit)}
                          onChange={() => handleTogglePermission(adm.id, 'price_edit')}
                          className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      {/* price_bulk_import */}
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(adm.permissions?.price_bulk_import)}
                          onChange={() => handleTogglePermission(adm.id, 'price_bulk_import')}
                          className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      {/* share_link_manage */}
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(adm.permissions?.share_link_manage)}
                          onChange={() => handleTogglePermission(adm.id, 'share_link_manage')}
                          className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      {/* reports_view */}
                      <td className="px-3 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(adm.permissions?.reports_view)}
                          onChange={() => handleTogglePermission(adm.id, 'reports_view')}
                          className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      {/* Status Toggle */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(adm.id, adm.status)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1 mx-auto ${
                            adm.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-red-100 hover:text-red-800'
                              : 'bg-red-100 text-red-800 hover:bg-emerald-100 hover:text-emerald-800'
                          }`}
                        >
                          {adm.status === 'Active' ? (
                            <>
                              <UserCheck className="w-3 h-3" />
                              Active (ปกติ)
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3" />
                              Suspended (ระงับ)
                            </>
                          )}
                        </button>
                      </td>

                      {/* Save Button */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveAdmin(adm)}
                          disabled={isSaving}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
                        >
                          {isSaving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
                        </button>
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
  );
}
