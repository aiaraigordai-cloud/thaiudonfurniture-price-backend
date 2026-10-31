'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Boxes, ChevronRight, CircleHelp, FileSpreadsheet, LayoutDashboard, Link2, Package, Search, Settings2, TrendingUp } from 'lucide-react';

const products = [
  { code: 'TU-101', name: 'ตู้เสื้อผ้าบานเปิด 3 บาน', category: 'ตู้เสื้อผ้า', price: 12900, stock: 'พร้อมขาย' },
  { code: 'TU-204', name: 'เตียงนอน 6 ฟุต รุ่นโมเดิร์น', category: 'ห้องนอน', price: 15900, stock: 'พร้อมขาย' },
  { code: 'KD-031', name: 'ชั้นวางทีวีไม้ลายโอ๊ค', category: 'ห้องนั่งเล่น', price: 4900, stock: 'พร้อมขาย' },
  { code: 'KD-078', name: 'โต๊ะทำงานพร้อมลิ้นชัก', category: 'โต๊ะทำงาน', price: 6900, stock: 'ใกล้หมด' },
];

const nav = [
  { label: 'ภาพรวม', icon: LayoutDashboard },
  { label: 'สินค้า', icon: Package },
  { label: 'จัดการราคา', icon: BarChart3 },
  { label: 'นำเข้าข้อมูล', icon: FileSpreadsheet },
  { label: 'ลิงก์แคตตาล็อก', icon: Link2 },
];

export default function DemoPage() {
  const [section, setSection] = useState('ภาพรวม');
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState('ราคาปลีก');
  const filtered = useMemo(() => products.filter(p => `${p.code} ${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const factor = tier === 'ราคาเซลล์' ? .85 : tier === 'ราคา VIP' ? .92 : tier === 'ราคาทั่วไป' ? 1.12 : 1;

  return <div className="min-h-screen bg-[#f5f6f8] text-[#17213b] md:flex">
    <aside className="w-full md:w-64 bg-[#151b3c] text-white md:min-h-screen flex flex-col">
      <div className="p-6 border-b border-white/10 flex items-center gap-3"><img src="/images/logo-red.png" alt="โลโก้ไทยอุดรเฟอร์นิเจอร์" className="w-11 h-11 rounded-full bg-white p-1" /><div><strong className="text-sm block">ไทยอุดรเฟอร์นิเจอร์</strong><span className="text-xs text-slate-300">ตัวอย่างระบบหลังบ้าน</span></div></div>
      <div className="px-4 pt-6 pb-2 text-[11px] uppercase tracking-widest text-slate-400">เมนูหลัก</div>
      <nav className="px-3 pb-4 grid grid-cols-2 md:block gap-1">{nav.map(({label, icon: Icon}) => <button key={label} onClick={() => setSection(label)} className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-left ${section === label ? 'bg-[#df242b] text-white' : 'text-slate-300 hover:bg-white/10'}`}><Icon size={17}/>{label}</button>)}</nav>
      <div className="mt-auto p-4 border-t border-white/10 hidden md:block"><div className="rounded-xl bg-white/10 p-4 text-xs leading-6"><CircleHelp size={18} className="mb-2"/>หน้านี้ใช้ข้อมูลตัวอย่างสำหรับดูหน้าตาและการใช้งานเท่านั้น</div></div>
    </aside>
    <main className="flex-1 min-w-0">
      <header className="bg-white border-b border-slate-200 px-5 md:px-9 py-4 flex flex-wrap justify-between items-center gap-3"><div className="text-xs text-slate-500">ระบบจัดการแคตตาล็อก <ChevronRight size={13} className="inline"/> <span className="text-[#17213b] font-semibold">{section}</span></div><Link href="/" className="rounded-lg bg-[#151b3c] px-4 py-2 text-white text-xs font-semibold hover:bg-[#df242b]">เข้าสู่ระบบจริง</Link></header>
      <div className="max-w-7xl mx-auto p-5 md:p-9 space-y-7">
        <div className="rounded-3xl bg-[#151b3c] text-white px-7 py-8 md:px-10 md:py-10 relative overflow-hidden"><div className="absolute -right-10 -top-16 h-64 w-64 rounded-full border-[35px] border-white/5"/><div className="relative"><span className="inline-block rounded-full bg-red-500/20 border border-red-400/30 text-red-200 px-3 py-1 text-xs mb-4">DEMO · ข้อมูลตัวอย่าง</span><h1 className="text-2xl md:text-3xl font-bold mb-2">{section === 'ภาพรวม' ? 'ภาพรวมระบบจัดการสินค้า' : section}</h1><p className="text-slate-300 text-sm max-w-xl">จัดการสินค้า ตรวจสอบราคา 4 ระดับ และเตรียมแคตตาล็อกสำหรับแชร์ให้ลูกค้าในที่เดียว</p></div></div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[
          {label:'สินค้าทั้งหมด', value:'310', unit:'รายการ', icon:Boxes, color:'text-blue-600 bg-blue-50'},
          {label:'สินค้าที่เผยแพร่', value:'284', unit:'รายการ', icon:Package, color:'text-emerald-600 bg-emerald-50'},
          {label:'ราคาที่ดูแล', value:'4', unit:'ระดับ', icon:Settings2, color:'text-violet-600 bg-violet-50'},
          {label:'ลิงก์แคตตาล็อก', value:'12', unit:'ลิงก์', icon:TrendingUp, color:'text-orange-600 bg-orange-50'},
        ].map(({label,value,unit,icon:Icon,color}) => <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"><div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}><Icon size={20}/></div><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-bold mt-1">{value} <span className="text-sm font-normal text-slate-500">{unit}</span></div></div>)}</div>
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-5 md:p-6 border-b border-slate-100 flex flex-wrap justify-between gap-4 items-center"><div><h2 className="font-bold text-lg">รายการสินค้า</h2><p className="text-xs text-slate-500 mt-1">ลองค้นหาสินค้าและเปลี่ยนระดับราคาได้</p></div><div className="flex flex-wrap gap-2"><label className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาสินค้า..." className="border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-red-200"/></label><select aria-label="ระดับราคา" value={tier} onChange={e=>setTier(e.target.value)} className="border border-slate-200 rounded-lg px-3 text-sm bg-white">{['ราคาปลีก','ราคาเซลล์','ราคา VIP','ราคาทั่วไป'].map(t=><option key={t}>{t}</option>)}</select></div></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-6 py-4">รหัสสินค้า</th><th className="px-6 py-4">ชื่อสินค้า</th><th className="px-6 py-4">หมวดหมู่</th><th className="px-6 py-4">ราคา</th><th className="px-6 py-4">สถานะ</th></tr></thead><tbody>{filtered.map(p=><tr key={p.code} className="border-t border-slate-100"><td className="px-6 py-4 font-semibold text-[#df242b]">{p.code}</td><td className="px-6 py-4 font-medium">{p.name}</td><td className="px-6 py-4 text-slate-500">{p.category}</td><td className="px-6 py-4 font-bold">฿{Math.round(p.price*factor).toLocaleString('th-TH')}</td><td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${p.stock === 'พร้อมขาย' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{p.stock}</span></td></tr>)}</tbody></table>{filtered.length===0 && <p className="p-8 text-center text-sm text-slate-500">ไม่พบสินค้าที่ค้นหา</p>}</div></section>
        <p className="text-center text-xs text-slate-500">ข้อมูลและตัวเลขในหน้านี้เป็นตัวอย่าง · <Link href="/" className="text-[#df242b] underline">ไปยังระบบจริง</Link></p>
      </div>
    </main>
  </div>;
}
