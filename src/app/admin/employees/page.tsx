'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Dices,
  Copy,
  Check,
  Sparkles,
  Search,
  RefreshCw,
  Trash2,
} from 'lucide-react';

export default function EmployeesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'register' | 'list'>('register');
  const [employees, setEmployees] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [permissions, setPermissions] = useState({
    product_manage: true,
    price_edit: true,
    price_bulk_import: true,
    share_link_manage: true,
    reports_view: true,
  });
  const [submittingReg, setSubmittingReg] = useState(false);
  const [regResult, setRegResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Quick Allowlist Name Only State
  const [allowName, setAllowName] = useState('');
  const [addingAllow, setAddingAllow] = useState(false);

  // Delete State & Modal
  const [employeeToDelete, setEmployeeToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Alert Message
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
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
        setProfiles(data.profiles || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Generate strong random password
  const generatePassword = () => {
    const uppers = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const lowers = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%&*';
    const all = uppers + lowers + numbers + specials;

    let pwd = '';
    pwd += uppers[Math.floor(Math.random() * uppers.length)];
    pwd += lowers[Math.floor(Math.random() * lowers.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += specials[Math.floor(Math.random() * specials.length)];

    for (let i = 0; i < 6; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle
    const shuffled = pwd.split('').sort(() => 0.5 - Math.random()).join('');
    setRegPassword(shuffled);
  };

  // Submit full employee registration
  const handleRegisterEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReg(true);
    setMessage(null);
    setRegResult(null);

    try {
      const res = await fetch('/api/admin/register-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_name: regName,
          email: regEmail,
          username: regUsername,
          password: regPassword,
          permissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'เกิดข้อผิดพลาดในการสร้างบัญชี' });
      } else {
        setRegResult({
          name: regName,
          username: regUsername,
          password: regPassword,
          email: regEmail,
          role: 'ADMIN',
        });
        setMessage({ type: 'success', text: `สร้างบัญชีสำหรับ "${regName}" (@${regUsername}) สำเร็จแล้ว!` });
        // Reset inputs
        setRegName('');
        setRegEmail('');
        setRegUsername('');
        setRegPassword('');
        loadData();
      }
    } catch {
      setMessage({ type: 'error', text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' });
    } finally {
      setSubmittingReg(false);
    }
  };

  // Add Allowlist Name Only
  const handleAddAllowlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingAllow(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_name: allowName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'เพิ่มไม่สำเร็จ' });
      } else {
        setMessage({ type: 'success', text: data.message || 'เพิ่มรายชื่อ Allowlist สำเร็จ' });
        setAllowName('');
        loadData();
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setAddingAllow(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (id: string, currentStatus: number) => {
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: currentStatus ? 0 : 1 }),
      });
      if (res.ok) {
        loadData();
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
    }
  };

  // Delete Employee Account
  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    setDeleting(true);
    setMessage(null);

    try {
      const targetId = employeeToDelete.id || employeeToDelete.profile_id;
      const res = await fetch(`/api/admin/employees?id=${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'ลบบัญชีพนักงานไม่สำเร็จ' });
      } else {
        setMessage({
          type: 'success',
          text: data.message || `ลบบัญชีของ "${employeeToDelete.employee_name}" เรียบร้อยแล้ว`,
        });
        setEmployeeToDelete(null);
        loadData();
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' });
    } finally {
      setDeleting(false);
    }
  };

  const copyLoginCredentials = () => {
    if (!regResult) return;
    const text = `🎉 บัญชีผู้ใช้งานระบบหลังบ้าน ไทยอุดรเฟอร์นิเจอร์\n` +
      `👤 พนักงาน: ${regResult.name}\n` +
      `🌐 เว็บไซต์: ${window.location.origin}\n` +
      `🔑 Username: ${regResult.username}\n` +
      `🔒 Password: ${regResult.password}\n` +
      `⚠️ กรุณาเก็บรหัสผ่านนี้ไว้เป็นความลับ`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    return (
      emp.employee_name?.toLowerCase().includes(q) ||
      emp.claimed_username?.toLowerCase().includes(q) ||
      emp.authorized_email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-950 transition shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                รายชื่อและสมัครบัญชีพนักงาน (Employee Accounts)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-red-600/10 text-red-700 text-[10px] font-bold border border-red-600/20">
                เฉพาะ SYSTEM OWNER
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ศูนย์กลางจัดการบัญชี ออกรหัสผ่าน กำหนดสิทธิ์ และลบบัญชีพนักงาน โดย System Owner เป็นผู้ดูแลเท่านั้น
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'register'
                ? 'bg-white text-red-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>สมัครพนักงานใหม่</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'list'
                ? 'bg-white text-red-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>รายชื่อทั้งหมด ({employees.length})</span>
          </button>
        </div>
      </div>

      {/* Global Alert */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="font-bold text-xs p-1">✕</button>
        </div>
      )}

      {/* Success Card when Employee Created */}
      {regResult && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-2 border-emerald-300 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  เปิดบัญชีพนักงานสำเร็จ: {regResult.name}
                </h3>
                <p className="text-[11px] text-emerald-700">
                  พนักงานสามารถนำ Username และ Password นี้ไปเข้าสู่ระบบที่หน้าแรกได้ทันที
                </p>
              </div>
            </div>
            <button
              onClick={copyLoginCredentials}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกเรียบร้อย!' : 'คัดลอกข้อมูลส่งให้พนักงาน'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-emerald-200/60 text-xs">
            <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
              <span className="text-[10px] text-slate-500 font-semibold block">ชื่อพนักงาน</span>
              <span className="font-bold text-slate-900">{regResult.name}</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
              <span className="text-[10px] text-slate-500 font-semibold block">Username</span>
              <span className="font-bold text-emerald-700">@{regResult.username}</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
              <span className="text-[10px] text-slate-500 font-semibold block">Password</span>
              <span className="font-mono font-bold text-slate-900">{regResult.password}</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
              <span className="text-[10px] text-slate-500 font-semibold block">อีเมล</span>
              <span className="font-medium text-slate-700 truncate block">{regResult.email}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: สมัครบัญชีพนักงานใหม่ (DIRECT REGISTER) */}
      {activeTab === 'register' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Registration Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-red-600" />
                  ฟอร์มสมัครและสร้างบัญชีพนักงานใหม่
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  กรอกข้อมูลพนักงานเพื่อสร้างบัญชีและรหัสผ่านเข้าสู่ระบบหลังบ้านทันที
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                Role: ADMIN
              </span>
            </div>

            <form onSubmit={handleRegisterEmployee} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อ-นามสกุล พนักงาน <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="เช่น วาสนา สมบูรณ์"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-red-600 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    อีเมลพนักงาน <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="เช่น wassana@thaiudon.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-red-600 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อผู้ใช้ (Username) สำหรับ Login <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">@</span>
                    <input
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="เช่น wassana"
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-red-600 focus:bg-white transition"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">ภาษาอังกฤษตัวพิมพ์เล็กและตัวเลขเท่านั้น</p>
                </div>

                {/* Password with generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      รหัสผ่าน (Password) <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-[10px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 hover:underline"
                    >
                      <Dices className="w-3 h-3" />
                      สุ่มรหัสผ่าน
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      minLength={4} placeholder="อย่างน้อย 4 ตัวอักษร"
                      className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-red-600 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">ความยาวอย่างน้อย 4 ตัวอักษร</p>
                </div>
              </div>

              {/* Permissions Checkboxes */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  กำหนดสิทธิ์การใช้งานในระบบ (System Permissions)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={permissions.product_manage}
                      onChange={(e) => setPermissions({ ...permissions, product_manage: e.target.checked })}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">จัดการสินค้าและแคตตาล็อก</span>
                      <span className="text-[10px] text-slate-400">เพิ่ม ลบ แก้ไข รายการสินค้าในระบบ</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={permissions.price_edit}
                      onChange={(e) => setPermissions({ ...permissions, price_edit: e.target.checked })}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">แก้ไขราคา 4 ระดับ</span>
                      <span className="text-[10px] text-slate-400">ปรับเปลี่ยนราคาเซลล์ ปลีก VIP ทั่วไป</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={permissions.price_bulk_import}
                      onChange={(e) => setPermissions({ ...permissions, price_bulk_import: e.target.checked })}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">อัปเดตราคาด้วยไฟล์ Excel/CSV</span>
                      <span className="text-[10px] text-slate-400">นำเข้าข้อมูลจำนวนมากพร้อม Rollback</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={permissions.share_link_manage}
                      onChange={(e) => setPermissions({ ...permissions, share_link_manage: e.target.checked })}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">ระบบแชร์ลิงก์ให้ลูกค้า</span>
                      <span className="text-[10px] text-slate-400">สร้างลิงก์แชร์แคตตาล็อกล็อกราคา</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submittingReg}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingReg ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังสร้างบัญชีพนักงาน...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>ยืนยันและเปิดบัญชีพนักงานทันที</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Side Info & Quick Allowlist */}
          <div className="space-y-4">
            {/* Quick Allowlist Box */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Plus className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-800">เพิ่มชื่อใน Allowlist ล่วงหน้า</h3>
              </div>
              <p className="text-[11px] text-slate-500">
                สำหรับบันทึกชื่อพนักงานไว้ในระบบล่วงหน้า ก่อนจะออก Username/Password ในภายหลัง
              </p>
              <form onSubmit={handleAddAllowlist} className="space-y-2.5">
                <input
                  type="text"
                  required
                  value={allowName}
                  onChange={(e) => setAllowName(e.target.value)}
                  placeholder="เช่น สมพร ดีเลิศ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
                />
                <button
                  type="submit"
                  disabled={addingAllow}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  {addingAllow ? 'กำลังบันทึก...' : 'บันทึกชื่อ Allowlist'}
                </button>
              </form>
            </div>

            {/* Security Note */}
            <div className="bg-[#161B40] text-white p-4 rounded-2xl text-xs space-y-2 border border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>มาตรการความปลอดภัย</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                หน้าแรกของเว็บไซต์ได้ปิดการลงทะเบียนสาธารณะแล้ว เพื่อป้องกันไม่ให้บุคคลภายนอกสมัครเข้ามาโดยไม่ได้รับอนุญาต บัญชีทั้งหมดจะออกและจัดการโดย System Owner เท่านั้น
              </p>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
                <span>สิทธิ์บัญชีพนักงาน: ADMIN</span>
                <Link href="/admin/permissions" className="text-red-400 hover:underline">
                  จัดการสิทธิ์ละเอียด →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: รายชื่อพนักงานทั้งหมด (ALL EMPLOYEES & ALLOWLIST TABLE) */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อพนักงาน, Username, อีเมล..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-red-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ สมัครพนักงานใหม่</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">ชื่อพนักงาน</th>
                  <th className="px-4 py-3">บัญชีผู้ใช้ (Username)</th>
                  <th className="px-4 py-3">อีเมล</th>
                  <th className="px-3 py-3 text-center">สถานะบัญชี</th>
                  <th className="px-3 py-3 text-center">สิทธิ์การใช้งาน</th>
                  <th className="px-4 py-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      ไม่พบข้อมูลพนักงาน
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSystemOwner =
                      emp.claimed_username === 'davidsuksomboriboon' ||
                      emp.account_role === 'SYSTEM_OWNER';

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{emp.employee_name}</span>
                            {isSystemOwner && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 text-[9px] font-bold border border-amber-500/20">
                                OWNER
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">ID: {emp.id}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          {emp.claimed_username ? (
                            <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                              @{emp.claimed_username}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">ยังไม่มีบัญชี (Allowlist)</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {emp.authorized_email || emp.account_email || '-'}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              emp.is_active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {emp.is_active ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          {isSystemOwner ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                              สิทธิ์เต็ม (Super Admin)
                            </span>
                          ) : (
                            <Link
                              href="/admin/permissions"
                              className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-red-600 font-medium hover:underline"
                            >
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>ดู/แก้ไขสิทธิ์</span>
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle Active/Suspended Button */}
                            <button
                              onClick={() => handleToggleStatus(emp.id, emp.is_active)}
                              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition ${
                                emp.is_active
                                  ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {emp.is_active ? 'ระงับชั่วคราว' : 'เปิดใช้งาน'}
                            </button>

                            {/* Delete Employee Account Button (Forbidden for System Owner) */}
                            {!isSystemOwner && (
                              <button
                                type="button"
                                onClick={() => setEmployeeToDelete(emp)}
                                className="p-1.5 text-red-600 hover:text-white hover:bg-red-600 rounded-lg transition border border-red-200"
                                title="ลบบัญชีพนักงานนี้ออกจากระบบ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* Delete Confirmation Modal */}
      {employeeToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 rounded-full bg-red-100">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการลบบัญชีพนักงาน</h3>
                <p className="text-xs text-slate-500">การดำเนินการนี้จะลบข้อมูลออกจากระบบอย่างถาวร</p>
              </div>
            </div>

            <div className="bg-red-50/70 border border-red-100 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
              <p>คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีพนักงานนี้?</p>
              <div className="font-semibold text-slate-900 pt-1">
                • พนักงาน: <span className="text-red-700 font-bold">{employeeToDelete.employee_name}</span>
              </div>
              {employeeToDelete.claimed_username && (
                <div className="font-semibold text-slate-900">
                  • บัญชีผู้ใช้: <span className="font-mono text-red-700 font-bold">@{employeeToDelete.claimed_username}</span>
                </div>
              )}
              {employeeToDelete.authorized_email && (
                <div className="text-slate-600 text-[11px]">
                  • อีเมล: {employeeToDelete.authorized_email}
                </div>
              )}
              <p className="text-[11px] text-red-600 pt-1 font-medium">
                ⚠️ เมื่อลบแล้ว บัญชีนี้จะไม่สามารถเข้าสู่ระบบหลังบ้านได้อีกต่อไป และสิทธิ์ทั้งหมดจะถูกยกเลิกทันที
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setEmployeeToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteEmployee}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ยืนยันลบบัญชีถาวร</span>
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
