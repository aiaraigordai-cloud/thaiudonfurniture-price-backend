'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Lock, Mail, User, AlertCircle, KeyRound, Sparkles } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();

  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

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
              src="https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/logo-red.png"
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
            เข้าสู่ระบบจัดการแคตตาล็อกสินค้า
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
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
          </form>

          {/* Security Notice */}
          <div className="mt-5 pt-4 border-t border-[#F0E6D8] text-center space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#805216]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#DE1B23]" />
              <span>ระบบจำกัดสิทธิ์เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาต</span>
            </div>
            <p className="text-[10px] text-[#705E4F] leading-relaxed">
              การเปิดบัญชีและสมัครพนักงานใหม่จะดำเนินการโดย <strong>SYSTEM OWNER</strong> ผ่านระบบควบคุมภายในเท่านั้น
            </p>
          </div>
        </div>
      </div>

      <Link href="/demo" className="relative z-10 mt-5 text-sm font-semibold text-[#161B40] underline underline-offset-4 hover:text-[#DE1B23]">
        ดูตัวอย่างระบบหลังบ้านโดยไม่ต้องเข้าสู่ระบบ
      </Link>

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
                  className="w-full py-2.5 bg-[#161B40] hover:bg-[#0F132C] text-white rounded-xl text-xs font-bold transition"
                >
                  ค้นหา Username
                </button>
              </form>
            )}
            <button
              onClick={() => setForgotUserModal(false)}
              className="w-full mt-3 py-2 text-xs text-[#705E4F] hover:text-[#402E20] font-bold"
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
              กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
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
                  className="w-full py-2.5 bg-[#DE1B23] hover:bg-[#B91218] text-white rounded-xl text-xs font-bold transition"
                >
                  ส่งลิงก์รีเซ็ตรหัสผ่าน
                </button>
              </form>
            )}
            <button
              onClick={() => setForgotPassModal(false)}
              className="w-full mt-3 py-2 text-xs text-[#705E4F] hover:text-[#402E20] font-bold"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
