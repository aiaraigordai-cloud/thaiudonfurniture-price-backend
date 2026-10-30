'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserCheck, Lock, Mail, User, AlertCircle, CheckCircle2, KeyRound, Sparkles } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  // Login form
  const [loginUsername, setLoginUsername] = useState('davidsuksomboriboon');
  const [loginPassword, setLoginPassword] = useState('davidesther090722');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Signup form
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupEmployeeName, setSignupEmployeeName] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');

  // Forgot Modals
  const [forgotUserModal, setForgotUserModal] = useState(false);
  const [forgotUserEmail, setForgotUserEmail] = useState('');
  const [forgotUserMsg, setForgotUserMsg] = useState('');

  const [forgotPassModal, setForgotPassModal] = useState(false);
  const [forgotPassEmail, setForgotPassEmail] = useState('');
  const [forgotPassMsg, setForgotPassMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
      } else {
        router.push('/admin');
      }
    } catch {
      setLoginError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupLoading(true);
    setSignupError('');
    setSignupSuccess('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signupUsername,
          password: signupPassword,
          email: signupEmail,
          employee_name: signupEmployeeName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSignupError(data.error || 'ลงทะเบียนไม่สำเร็จ');
      } else {
        setSignupSuccess(data.message || 'ลงทะเบียนสำเร็จ! กำลังนำคุณเข้าสู่ระบบ...');
        setTimeout(() => {
          router.push('/admin');
        }, 1500);
      }
    } catch {
      setSignupError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleForgotUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/forgot-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotUserEmail }),
    });
    const data = await res.json();
    setForgotUserMsg(data.message);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotPassEmail }),
    });
    const data = await res.json();
    setForgotPassMsg(data.message);
  };

  return (
    <div className="min-h-screen bg-[#F7F0E6] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-[#FFFAF3] to-transparent pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#D2B681] overflow-hidden relative z-10">
        {/* Header (Thai Udon Red & Navy CI) */}
        <div className="bg-[#161B40] p-6 text-center text-white relative border-b border-red-600">
          <div className="mb-3">
            <img
              src="/images/logo-red.png"
              alt="ไทยอุดรเฟอร์นิเจอร์"
              className="w-16 h-16 rounded-full bg-white p-1 object-contain mx-auto shadow-lg border-2 border-red-500"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            ไทยอุดรเฟอร์นิเจอร์
          </h1>
          <p className="text-red-300 text-xs mt-1">เว็บไซต์ทางการหลังบ้าน (Master Control)</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-slate-200 text-xs font-semibold border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#06C755] animate-pulse"></span>
            ระบบจัดการแคตตาล็อกสินค้าไทยอุดรเฟอร์นิเจอร์
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-3.5 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'login'
                ? 'border-[#DE1B23] text-[#DE1B23] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4 text-[#DE1B23]" />
            เข้าสู่ระบบ (Log In)
          </button>
          <button
            onClick={() => setActiveTab('signup')}
            className={`flex-1 py-3.5 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'signup'
                ? 'border-[#DE1B23] text-[#DE1B23] bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4 text-[#DE1B23]" />
            สมัครพนักงาน (Sign Up)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">
                  ชื่อผู้ใช้ (Username)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059] transition"
                    placeholder="กรอก Username ของคุณ"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059] transition"
                    placeholder="กรอกรหัสผ่าน"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#705E4F] pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setForgotUserModal(true);
                    setForgotUserMsg('');
                  }}
                  className="hover:text-[#805216] transition"
                >
                  ลืมชื่อผู้ใช้?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPassModal(true);
                    setForgotPassMsg('');
                  }}
                  className="hover:text-[#805216] transition"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-gradient-to-r from-[#DE1B23] to-[#B91218] hover:from-[#C4161D] hover:to-[#9F0F14] text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
              >
                {loginLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    เข้าสู่ระบบหลังบ้าน
                  </>
                )}
              </button>

              {/* System Owner Credentials Hint */}
              <div className="mt-4 p-3.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#705E4F] space-y-1">
                <div className="font-bold text-[#805216] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                  System Owner Pre-configured:
                </div>
                <div>Username: <code className="text-[#402E20] font-mono font-bold">davidsuksomboriboon</code></div>
                <div>Password: <code className="text-[#402E20] font-mono font-bold">********</code></div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3.5">
              {signupError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{signupError}</span>
                </div>
              )}
              {signupSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{signupSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">
                  1. ชื่อพนักงาน (ตามที่ System Owner เพิ่มไว้) *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={signupEmployeeName}
                    onChange={(e) => setSignupEmployeeName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                    placeholder="กรอกชื่อ-นามสกุลพนักงาน"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">
                  2. อีเมลพนักงาน (Email) *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">
                  3. กำหนดชื่อผู้ใช้ (Username) *
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                    placeholder="ตั้ง Username สำหรับเข้าสู่ระบบ"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">
                  4. กำหนดรหัสผ่าน (Password &gt;= 8 ตัวอักษร) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                    placeholder="ตั้งรหัสผ่านความปลอดภัยสูง"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={signupLoading}
                className="w-full py-3 bg-gradient-to-r from-[#DE1B23] to-[#B91218] hover:from-[#C4161D] hover:to-[#9F0F14] text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2 shadow-md"
              >
                {signupLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    ลงทะเบียนบัญชีพนักงาน (Admin)
                  </>
                )}
              </button>

              <div className="p-3 bg-[#FFFAF3] border border-[#D2B681] text-[#705E4F] text-[11px] rounded-xl leading-relaxed">
                <span className="font-bold text-[#402E20]">🔒 สะดวกและปลอดภัย:</span> เมื่อ System Owner เพิ่มชื่อพนักงานในระบบแล้ว พนักงานสามารถนำชื่อมากรอกและตั้ง Username/Password เพื่อเข้าใช้งานได้ทันที
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Forgot Username Modal */}
      {forgotUserModal && (
        <div className="fixed inset-0 bg-[#402E20]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#D2B681]">
            <h3 className="text-base font-bold text-[#402E20] mb-2">กู้คืนชื่อผู้ใช้ (Forgot Username)</h3>
            <p className="text-xs text-[#705E4F] mb-4">
              กรอกอีเมลที่ลงทะเบียนไว้ ระบบจะจัดส่ง Username ไปยังกล่องข้อความของคุณ
            </p>
            {forgotUserMsg ? (
              <div className="p-3 bg-[#FFFAF3] text-[#805216] text-xs rounded-xl mb-4 border border-[#D2B681]">
                {forgotUserMsg}
              </div>
            ) : (
              <form onSubmit={handleForgotUsername} className="space-y-4">
                <input
                  type="email"
                  required
                  value={forgotUserEmail}
                  onChange={(e) => setForgotUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs focus:outline-none focus:border-[#C5A059]"
                  placeholder="your-email@example.com"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 gold-gradient-btn text-white rounded-xl text-xs font-bold"
                >
                  ส่งชื่อผู้ใช้ไปยังอีเมล
                </button>
              </form>
            )}
            <button
              onClick={() => setForgotUserModal(false)}
              className="mt-3 w-full py-2 text-xs text-[#705E4F] hover:text-[#402E20]"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {forgotPassModal && (
        <div className="fixed inset-0 bg-[#402E20]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#D2B681]">
            <h3 className="text-base font-bold text-[#402E20] mb-2">รีเซ็ตรหัสผ่าน (Forgot Password)</h3>
            <p className="text-xs text-[#705E4F] mb-4">
              กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่านที่มีความปลอดภัย
            </p>
            {forgotPassMsg ? (
              <div className="p-3 bg-[#FFFAF3] text-[#805216] text-xs rounded-xl mb-4 border border-[#D2B681]">
                {forgotPassMsg}
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <input
                  type="email"
                  required
                  value={forgotPassEmail}
                  onChange={(e) => setForgotPassEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs focus:outline-none focus:border-[#C5A059]"
                  placeholder="your-email@example.com"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 gold-gradient-btn text-white rounded-xl text-xs font-bold"
                >
                  ส่งลิงก์ตั้งรหัสผ่านใหม่
                </button>
              </form>
            )}
            <button
              onClick={() => setForgotPassModal(false)}
              className="mt-3 w-full py-2 text-xs text-[#705E4F] hover:text-[#402E20]"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
