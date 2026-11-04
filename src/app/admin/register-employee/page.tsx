'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  ArrowLeft,
  User,
  Mail,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Dices,
  Eye,
  EyeOff,
  Sparkles,
  Users,
  Shield,
  Layers,
  Coins,
  FileSpreadsheet,
  Share2,
  BarChart3,
} from 'lucide-react';

export default function RegisterEmployeePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Form Fields
  const [employeeName, setEmployeeName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Permissions checkboxes
  const [permissions, setPermissions] = useState({
    product_manage: true,
    price_edit: true,
    price_bulk_import: true,
    share_link_manage: true,
    reports_view: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Recent Employees list
  const [recentAdmins, setRecentAdmins] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();
        if (!meData.authenticated || meData.user?.role !== 'SYSTEM_OWNER') {
          alert('เข้าถึงไม่ได้: เฉพาะ SYSTEM OWNER เท่านั้น');
          router.push('/admin');
          return;
        }
        setCurrentUser(meData.user);
        await loadRecentAdmins();
      } catch {
        router.push('/admin');
      } finally {
        setPageLoading(false);
      }
    }
    init();
  }, [router]);

  const loadRecentAdmins = async () => {
    try {
      const res = await fetch('/api/admin/permissions');
      const data = await res.json();
      if (data.success && data.admins) {
        setRecentAdmins(data.admins);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Generate safe random password
  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*';
    let result = '';
    // ensure at least 1 uppercase, 1 lowercase, 1 number, 1 special
    const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*';
    result += upper[Math.floor(Math.random() * upper.length)];
    result += lower[Math.floor(Math.random() * lower.length)];
    result += numbers[Math.floor(Math.random() * numbers.length)];
    result += symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 4; i < 10; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    // Shuffle
    const shuffled = result.split('').sort(() => 0.5 - Math.random()).join('');
    setPassword(shuffled);
    setShowPassword(true);
  };

  // Auto-generate username from employee name or email
  const handleNameChange = (val: string) => {
    setEmployeeName(val);
    if (!username || username.startsWith('staff_')) {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setUsername(`staff_${randomSuffix}`);
    }
  };

  const handleTogglePerm = (key: keyof typeof permissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setCreatedEmployee(null);

    try {
      const res = await fetch('/api/admin/register-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_name: employeeName,
          email,
          username,
          password,
          permissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการสร้างบัญชี');
      } else {
        setCreatedEmployee(data.employee);
        // Reset form
        setEmployeeName('');
        setEmail('');
        setUsername('');
        setPassword('');
        loadRecentAdmins();
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdEmployee) return;
    const text = `แจ้งข้อมูลเข้าสู่ระบบหลังบ้าน ไทยอุดรเฟอร์นิเจอร์\n------------------------------------\nชื่อพนักงาน: ${createdEmployee.employee_name}\nลิงก์เข้าสู่ระบบ: https://thai-udon-price-backend.netlify.app/\nชื่อผู้ใช้ (Username): ${createdEmployee.username}\nรหัสผ่าน (Password): ${createdEmployee.password}\nสถานะบัญชี: Active (พร้อมใช้งานทันที)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (pageLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs">กำลังตรวจสอบสิทธิ์ SYSTEM OWNER...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2.5 rounded-xl bg-white border border-[#D2B681] text-[#705E4F] hover:text-[#402E20] transition shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#402E20] tracking-tight">
                สมัครและสร้างบัญชีพนักงานใหม่
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DE1B23]/10 text-[#DE1B23] border border-[#DE1B23]/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                เฉพาะ SYSTEM OWNER
              </span>
            </div>
            <p className="text-xs text-[#705E4F] mt-0.5">
              สร้างบัญชีผู้ใช้งานสำหรับพนักงานโดยตรง ปลอดภัย ไม่เปิดรับสมัครจากภายนอก พร้อมกำหนดสิทธิ์ใช้งานได้ทันที
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/permissions"
            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>จัดการสิทธิ์พนักงานทั้งหมด</span>
          </Link>
          <Link
            href="/admin/employees"
            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>รายชื่อ Allowlist</span>
          </Link>
        </div>
      </div>

      {/* Success Notification Card (Shown when an employee account is created) */}
      {createdEmployee && (
        <div className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-2 border-emerald-500 rounded-2xl shadow-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  สร้างบัญชีพนักงานเรียบร้อยแล้ว!
                </h3>
                <p className="text-xs text-emerald-700">
                  พนักงานสามารถนำข้อมูลเข้าสู่ระบบนี้ไปล็อกอินที่หน้าแรกได้ทันที
                </p>
              </div>
            </div>

            <button
              onClick={handleCopyCredentials}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                copied
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'คัดลอกข้อความสำเร็จ!' : 'คัดลอกข้อมูลส่งให้พนักงาน'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-emerald-200">
            <div>
              <span className="text-[10px] text-slate-500 block">ชื่อพนักงาน</span>
              <span className="font-bold text-xs text-[#161B40]">{createdEmployee.employee_name}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">ชื่อผู้ใช้ (Username)</span>
              <span className="font-mono font-bold text-xs text-red-600">@{createdEmployee.username}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">รหัสผ่าน (Password)</span>
              <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                {createdEmployee.password}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">อีเมล</span>
              <span className="font-mono text-xs text-slate-700 truncate block">{createdEmployee.email}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Form on Left, Guidelines & List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-[#D2B681] p-6 shadow-xs space-y-5">
            <div className="pb-3 border-b border-[#F7F0E6]">
              <h2 className="text-sm font-bold text-[#402E20] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#DE1B23]" />
                กรอกข้อมูลพนักงานเพื่อเปิดบัญชี
              </h2>
              <p className="text-xs text-[#705E4F] mt-0.5">
                กำหนดชื่อ-นามสกุล ข้อมูลเข้าสู่ระบบ และสิทธิ์การเข้าถึงข้อมูลของพนักงานคนนี้
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Employee Name */}
                <div>
                  <label className="block text-xs font-bold text-[#402E20] mb-1">
                    1. ชื่อ-นามสกุลพนักงาน *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={employeeName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="เช่น สมชาย ใจดี"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059]"
                    />
                  </div>
                </div>

                {/* 2. Email */}
                <div>
                  <label className="block text-xs font-bold text-[#402E20] mb-1">
                    2. อีเมลพนักงาน *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="somchai@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 3. Username */}
                <div>
                  <label className="block text-xs font-bold text-[#402E20] mb-1">
                    3. กำหนดชื่อผู้ใช้ (Username) *
                  </label>
                  <div className="relative">
                    <span className="text-[#805216] font-mono text-xs font-bold absolute left-3.5 top-3">@</span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="เช่น somchai_sales"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] font-mono focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059]"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">ใช้สำหรับล็อกอินเข้าหน้าแรก</span>
                </div>

                {/* 4. Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#402E20]">
                      4. กำหนดรหัสผ่าน *
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] font-bold text-[#DE1B23] hover:underline flex items-center gap-1"
                    >
                      <Dices className="w-3.5 h-3.5" />
                      สุ่มรหัสผ่าน
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="รหัสผ่านอย่างน้อย 8 ตัวอักษร"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] font-mono focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">ขั้นต่ำ 8 ตัวอักษร</span>
                </div>
              </div>

              {/* 5. Permission Toggles */}
              <div className="pt-3 border-t border-[#F7F0E6] space-y-3">
                <label className="block text-xs font-bold text-[#402E20]">
                  5. กำหนดสิทธิ์การเข้าถึงเมนูสำหรับพนักงานคนนี้:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={permissions.product_manage}
                      onChange={() => handleTogglePerm('product_manage')}
                      className="rounded text-[#DE1B23] focus:ring-[#DE1B23] w-4 h-4"
                    />
                    <div className="flex items-center gap-1.5 font-semibold text-[#161B40]">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>จัดการและเพิ่มสินค้า</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={permissions.price_edit}
                      onChange={() => handleTogglePerm('price_edit')}
                      className="rounded text-[#DE1B23] focus:ring-[#DE1B23] w-4 h-4"
                    />
                    <div className="flex items-center gap-1.5 font-semibold text-[#161B40]">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      <span>แก้ไขราคา 4 ระดับ</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={permissions.price_bulk_import}
                      onChange={() => handleTogglePerm('price_bulk_import')}
                      className="rounded text-[#DE1B23] focus:ring-[#DE1B23] w-4 h-4"
                    />
                    <div className="flex items-center gap-1.5 font-semibold text-[#161B40]">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>อัปเดตราคาด้วยไฟล์ Excel/CSV</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={permissions.share_link_manage}
                      onChange={() => handleTogglePerm('share_link_manage')}
                      className="rounded text-[#DE1B23] focus:ring-[#DE1B23] w-4 h-4"
                    />
                    <div className="flex items-center gap-1.5 font-semibold text-[#161B40]">
                      <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>จัดการลิงก์แชร์ลูกค้า</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-[#F7F0E6] flex items-center justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-[#DE1B23] to-[#B91218] hover:from-[#C4161D] hover:to-[#9F0F14] text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-md"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>ยืนยันสร้างบัญชีพนักงาน</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Information & Recent Accounts */}
        <div className="space-y-6">
          {/* Security Policy Card */}
          <div className="bg-[#161B40] text-white p-5 rounded-2xl border border-red-500/30 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-red-300">
              <ShieldCheck className="w-4 h-4 text-red-400" />
              <span>นโยบายความปลอดภัยของระบบ</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              • หน้าแรกของเว็บไซต์ถูกปิดการสมัคร เพื่อป้องกันบุคคลภายนอกสมัครเข้ามา
              <br />• เฉพาะบัญชี <strong>SYSTEM OWNER</strong> เท่านั้นที่สามารถสร้างและเปิดสิทธิ์ให้พนักงาน
              <br />• พนักงานทุกคนจะได้รับบทบาท <strong>ADMIN</strong> และสิทธิ์ตามที่คุณกำหนดไว้
              <br />• สามารถระงับสิทธิ์หรือเปลี่ยนรหัสผ่านได้ตลอดเวลาในหน้า <em>จัดการสิทธิ์บัญชี</em>
            </p>
          </div>

          {/* Recent Accounts List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-[#161B40] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                บัญชีพนักงานในระบบ ({recentAdmins.length})
              </h3>
              <Link
                href="/admin/permissions"
                className="text-[11px] text-red-600 font-bold hover:underline"
              >
                ดูทั้งหมด
              </Link>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {recentAdmins.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">ยังไม่มีบัญชีพนักงานทั่วไปในระบบ</p>
              ) : (
                recentAdmins.slice(0, 5).map((adm) => (
                  <div
                    key={adm.id}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#161B40] text-xs">{adm.employee_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">@{adm.username}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        adm.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {adm.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
