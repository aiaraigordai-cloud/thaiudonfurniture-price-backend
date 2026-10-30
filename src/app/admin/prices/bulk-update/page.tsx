'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Coins,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  History,
  Sparkles,
  RefreshCw,
  FileText,
} from 'lucide-react';

export default function BulkPriceUpdatePage() {
  const router = useRouter();
  const [priceTiers, setPriceTiers] = useState<any[]>([]);
  const [selectedTierId, setSelectedTierId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [commitResult, setCommitResult] = useState<any | null>(null);

  // Parsed Batch State
  const [batchData, setBatchData] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PASS' | 'NEEDS_REVIEW' | 'FAILED' | 'SELECTED'>('ALL');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => {
        if (d.priceTiers) {
          setPriceTiers(d.priceTiers);
          if (d.priceTiers.length > 0) {
            setSelectedTierId(d.priceTiers[0].id);
          }
        }
      });
  }, []);

  const handleFileUploadAndParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('กรุณาเลือกไฟล์ที่ต้องการนำเข้า');
      return;
    }
    if (!selectedTierId) {
      setError('กรุณาเลือกประเภทราคาเป้าหมาย');
      return;
    }

    setUploading(true);
    setError('');
    setBatchData(null);
    setCommitResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('price_tier_id', selectedTierId);

    try {
      const res = await fetch('/api/prices/bulk-parse', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์');
      } else {
        setBatchData(data);
        setRows(data.rows || []);

        // MANDATORY REQUIREMENT Part 8:
        // System automatically checks (selects) PASS rows ONLY!
        const autoSelected = new Set<string>();
        data.rows.forEach((r: any) => {
          if (r.validation_status === 'PASS') {
            autoSelected.add(r.id);
          }
        });
        setSelectedRowIds(autoSelected);
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setUploading(false);
    }
  };

  const toggleRowSelect = (id: string, status: string) => {
    if (status === 'FAILED') {
      alert('รายการสถานะ FAILED ไม่สามารถเลือกเพื่ออัปเดตได้จนกว่าจะแก้ไขข้อมูล SKU หรือราคาให้ถูกต้อง');
      return;
    }
    const next = new Set(selectedRowIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRowIds(next);
  };

  const selectAllPass = () => {
    const next = new Set<string>();
    rows.forEach((r) => {
      if (r.validation_status === 'PASS') {
        next.add(r.id);
      }
    });
    setSelectedRowIds(next);
  };

  const deselectAll = () => {
    setSelectedRowIds(new Set());
  };

  const handleSingleConfirm = async () => {
    if (selectedRowIds.size === 0) {
      alert('กรุณาเลือกอย่างน้อย 1 รายการเพื่ออัปเดตราคา');
      return;
    }

    setCommitting(true);
    setError('');

    try {
      const res = await fetch('/api/prices/bulk-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: batchData.batchId,
          selectedRowIds: Array.from(selectedRowIds),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการบันทึกราคา');
      } else {
        setCommitResult(data);
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการบันทึกราคา');
    } finally {
      setCommitting(false);
    }
  };

  // Filtered rows for UI
  const filteredRows = rows.filter((r) => {
    if (filterTab === 'ALL') return true;
    if (filterTab === 'PASS') return r.validation_status === 'PASS';
    if (filterTab === 'NEEDS_REVIEW') return r.validation_status === 'NEEDS_REVIEW';
    if (filterTab === 'FAILED') return r.validation_status === 'FAILED';
    if (filterTab === 'SELECTED') return selectedRowIds.has(r.id);
    return true;
  });

  const selectedTier = priceTiers.find((t) => t.id === selectedTierId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              อัปเดตราคาด้วยไฟล์
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
              ระบบนำเข้าไฟล์
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            รองรับไฟล์ Excel, PDF, Word, รูปภาพแคตตาล็อก JPG/PNG และไฟล์ Text พร้อมระบบ Auto-select และ Single Confirmation
          </p>
        </div>

        <Link
          href="/admin/prices/import-history"
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
        >
          <History className="w-4 h-4 text-slate-500" />
          ดูประวัติการนำเข้าและ Rollback
        </Link>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Commit Result Success Card */}
      {commitResult && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-600/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-2 flex-1">
              <h2 className="text-base font-bold text-emerald-950">
                {commitResult.message}
              </h2>
              <p className="text-xs text-emerald-800 leading-relaxed">
                ระบบได้บันทึกการเปลี่ยนแปลงราคาลงฐานข้อมูลกลางเรียบร้อยแล้วผ่าน Database Transaction ที่ปลอดภัย
                พร้อมบันทึกประวัติ Price History และ Audit Log ครบถ้วน ลิงก์ลูกค้าที่เกี่ยวข้องจะแสดงราคาล่าสุดทันที (Live Pricing)
              </p>
              <div className="flex items-center gap-3 pt-2">
                <Link
                  href="/admin/prices"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  ตรวจสอบหน้ารวมราคา
                </Link>
                <Link
                  href="/s/vip-showcase-2026"
                  target="_blank"
                  className="px-4 py-2 bg-white border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold hover:bg-emerald-100/50 transition"
                >
                  ดูผลลัพธ์ในหน้าลูกค้า
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1 & 2: Tier Selection & File Upload */}
      {!batchData && (
        <form onSubmit={handleFileUploadAndParse} className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Coins className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">
                ขั้นตอนที่ 1: เลือกประเภทราคาเป้าหมายที่จะอัปเดต (Mandatory Selection)
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              การอัปเดตหนึ่ง Batch จะเขียนข้อมูลเฉพาะ Price Tier ที่เลือกเท่านั้น เพื่อป้องกันการแก้ไขราคาประเภทอื่นโดยไม่ตั้งใจ
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
              {priceTiers.map((tier) => (
                <label
                  key={tier.id}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    selectedTierId === tier.id
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-slate-900">{tier.name_th}</span>
                    <input
                      type="radio"
                      name="tier_select"
                      checked={selectedTierId === tier.id}
                      onChange={() => setSelectedTierId(tier.id)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase">{tier.code}</div>
                  <div className="text-[11px] text-slate-600 mt-2">{tier.description || '-'}</div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">
                ขั้นตอนที่ 2: อัปโหลดไฟล์เอกสารหรือแคตตาล็อกภาพ
              </h2>
            </div>

            <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 text-center transition bg-slate-50/50">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="text-xs font-semibold text-slate-700">
                {file ? file.name : 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                รองรับ Excel (.xlsx, .xls), PDF (.pdf), Word (.docx), รูปภาพแคตตาล็อก (.jpg, .png) หรือไฟล์ Text (.txt, .csv)
              </p>
              <input
                type="file"
                id="file-upload"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
                className="hidden"
                accept=".xlsx,.xls,.pdf,.docx,.doc,.jpg,.jpeg,.png,.txt,.csv"
              />
              <label
                htmlFor="file-upload"
                className="mt-4 inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                {file ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์จากอุปกรณ์'}
              </label>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
              <span>
                💡 <strong>ทดสอบทันที:</strong> สามารถเลือกไฟล์ Excel หรือ Text ที่มี SKU เช่น{' '}
                <code>BED-LUX-6F, 19900</code> หรืออัปโหลดไฟล์รูปแคตตาล็อกเพื่อให้ AI ตรวจจับ
              </span>
            </div>

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  กำลังประมวลผล OCR & Visual AI Matching...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  เริ่มวิเคราะห์ไฟล์และตรวจสอบความถูกต้อง
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Review Table & Single Confirmation Button */}
      {batchData && !commitResult && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="text-[11px] text-slate-500">ข้อมูลทั้งหมดในไฟล์</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{batchData.totalRows} แถว</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{batchData.filename}</div>
            </div>

            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                PASS (ผ่านเกณฑ์)
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-1">{batchData.passedRows} รายการ</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                ✓ Auto-selected อัตโนมัติแล้ว
              </div>
            </div>

            <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 shadow-xs">
              <div className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                NEEDS_REVIEW
              </div>
              <div className="text-xl font-bold text-amber-700 mt-1">{batchData.reviewRows} รายการ</div>
              <div className="text-[10px] text-amber-600 mt-0.5">ไม่ถูกเลือก (ต้องตรวจก่อน)</div>
            </div>

            <div className="bg-red-50/60 p-4 rounded-2xl border border-red-200 shadow-xs">
              <div className="text-[11px] font-semibold text-red-800 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-600" />
                FAILED (ไม่ผ่าน)
              </div>
              <div className="text-xl font-bold text-red-700 mt-1">{batchData.failedRows} รายการ</div>
              <div className="text-[10px] text-red-600 mt-0.5">ไม่สามารถอัปเดตได้</div>
            </div>
          </div>

          {/* Action Confirmation Bar */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Target Price Tier:
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  {batchData.priceTier?.name_th} ({batchData.priceTier?.code})
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                ระบบเลือกรายการ PASS ทั้งหมดให้อัตโนมัติ คุณสามารถตรวจสอบหรือกดยืนยันอัปเดตได้ทันที
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBatchData(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold hover:bg-slate-800 transition"
              >
                ยกเลิก / อัปโหลดใหม่
              </button>

              {/* SINGLE CONFIRMATION BUTTON - MANDATORY REQUIREMENT Part 8.3 */}
              <button
                type="button"
                onClick={handleSingleConfirm}
                disabled={committing || selectedRowIds.size === 0}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 flex items-center gap-2"
              >
                {committing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                ยืนยันอัปเดตราคา ({selectedRowIds.size} รายการ)
              </button>
            </div>
          </div>

          {/* Review Filter Tabs & Batch Select Tools */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'PASS', 'NEEDS_REVIEW', 'FAILED', 'SELECTED'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    filterTab === tab
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab === 'ALL' && `ทั้งหมด (${rows.length})`}
                  {tab === 'PASS' && `ผ่านเกณฑ์ (${batchData.passedRows})`}
                  {tab === 'NEEDS_REVIEW' && `รอตรวจสอบ (${batchData.reviewRows})`}
                  {tab === 'FAILED' && `ไม่ผ่าน (${batchData.failedRows})`}
                  {tab === 'SELECTED' && `ที่เลือกไว้ (${selectedRowIds.size})`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllPass}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
              >
                เลือกรายการที่ผ่านทั้งหมด
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                ยกเลิกการเลือกทั้งหมด
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5 w-12 text-center">เลือก</th>
                    <th className="px-3 py-3.5 w-16">แถว</th>
                    <th className="px-4 py-3.5">SKU ในเอกสาร</th>
                    <th className="px-4 py-3.5">ชื่อสินค้าที่แมตช์ได้</th>
                    <th className="px-4 py-3.5 text-right">ราคาเดิม</th>
                    <th className="px-4 py-3.5 text-right font-bold text-emerald-700">ราคาใหม่</th>
                    <th className="px-4 py-3.5 text-right">ส่วนต่าง</th>
                    <th className="px-4 py-3.5 text-center">สถานะ AI</th>
                    <th className="px-4 py-3.5">หมายเหตุ / Warning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((r) => {
                    const isChecked = selectedRowIds.has(r.id);
                    const diff = r.old_price && r.new_price ? r.new_price - r.old_price : null;
                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isChecked ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRowSelect(r.id, r.validation_status)}
                            disabled={r.validation_status === 'FAILED'}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-30"
                          />
                        </td>
                        <td className="px-3 py-3.5 font-mono text-slate-400 text-center">{r.row_number}</td>
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-900">{r.detected_sku}</td>
                        <td className="px-4 py-3.5 text-slate-700 max-w-xs truncate">
                          {r.detected_product_name}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-500">
                          {r.old_price ? `฿${r.old_price.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-700">
                          {r.new_price ? `฿${r.new_price.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          {diff !== null ? (
                            <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                              {diff >= 0 ? `+฿${diff.toLocaleString()}` : `-฿${Math.abs(diff).toLocaleString()}`}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              r.validation_status === 'PASS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.validation_status === 'NEEDS_REVIEW'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {r.validation_status === 'PASS' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {r.validation_status === 'NEEDS_REVIEW' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                            {r.validation_status === 'FAILED' && <XCircle className="w-3 h-3 text-red-600" />}
                            {r.validation_status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                          {r.warning_reason || (
                            <span className="text-slate-400">ข้อมูลสมบูรณ์ ไม่พบข้อขัดแย้ง</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
