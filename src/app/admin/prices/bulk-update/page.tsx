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
  Download,
  Edit3,
  Check,
  Layers,
} from 'lucide-react';

interface ParsedRow {
  id: string;
  batch_id: string;
  row_number: number;
  source_data: string;
  detected_sku: string;
  detected_product_name: string;
  old_price: number | null;
  new_price: number | null;
  validation_status: 'PASS' | 'NEEDS_REVIEW' | 'FAILED';
  warning_reason: string | null;
  is_selected: number;
}

export default function BulkPriceUpdatePage() {
  const router = useRouter();
  const [priceTiers, setPriceTiers] = useState<any[]>([]);
  const [selectedTierId, setSelectedTierId] = useState('');
  const [selectedCatalogType, setSelectedCatalogType] = useState<'all' | 'tuulo' | 'knockdown'>('all');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [commitResult, setCommitResult] = useState<any | null>(null);

  // Parsed Batch State
  const [batchData, setBatchData] = useState<any | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
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
    setUploadProgress(20);
    setError('');
    setBatchData(null);
    setCommitResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('price_tier_id', selectedTierId);
    formData.append('catalog_type', selectedCatalogType);

    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 200);

    try {
      const res = await fetch('/api/prices/bulk-parse', {
        method: 'POST',
        body: formData,
      });
      clearInterval(progressTimer);
      setUploadProgress(100);

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์');
      } else {
        setBatchData(data);
        setRows(data.rows || []);

        // Auto-select PASS rows
        const autoSelected = new Set<string>();
        data.rows.forEach((r: ParsedRow) => {
          if (r.validation_status === 'PASS') {
            autoSelected.add(r.id);
          }
        });
        setSelectedRowIds(autoSelected);

        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRICE_BATCH_UPDATED', batchId: data.batchId, timestamp: Date.now() });
            localStorage.setItem('thaiudon_batch_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_batch_sync'));
          } catch {}
        }
      }
    } catch {
      clearInterval(progressTimer);
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setUploading(false);
    }
  };

  const toggleRowSelect = (id: string, status: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row || row.new_price === null || row.new_price <= 0) {
      alert('กรุณากรอกราคาใหม่ที่ถูกต้องก่อนเลือกอนุมัติรายการนี้');
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

  const handleApproveSingleRow = (id: string) => {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    if (target.new_price === null || target.new_price <= 0) {
      alert('กรุณากรอกราคาใหม่ที่ถูกต้องก่อนอนุมัติ');
      return;
    }

    const nextRows = rows.map((r) => {
      if (r.id !== id) return r;
      return {
        ...r,
        validation_status: 'PASS' as const,
        warning_reason: 'อนุมัติโดยผู้ใช้งานแล้ว',
      };
    });

    setRows(nextRows);
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    if (batchData) {
      const passed = nextRows.filter((r) => r.validation_status === 'PASS').length;
      const review = nextRows.filter((r) => r.validation_status === 'NEEDS_REVIEW').length;
      const failed = nextRows.filter((r) => r.validation_status === 'FAILED').length;
      setBatchData({
        ...batchData,
        passedRows: passed,
        reviewRows: review,
        failedRows: failed,
      });
    }
  };

  const handleApproveAndSelectAll = () => {
    const nextSelected = new Set<string>();
    let approvedCount = 0;

    const nextRows = rows.map((r) => {
      if (r.new_price !== null && r.new_price > 0 && r.detected_sku) {
        nextSelected.add(r.id);
        approvedCount++;
        return {
          ...r,
          validation_status: 'PASS' as const,
          warning_reason: r.validation_status === 'PASS' ? r.warning_reason : 'อนุมัติทุกรายการโดยผู้ใช้งาน (Approve All)',
        };
      }
      return r;
    });

    setRows(nextRows);
    setSelectedRowIds(nextSelected);

    if (batchData) {
      const failed = nextRows.filter((r) => r.validation_status === 'FAILED').length;
      setBatchData({
        ...batchData,
        passedRows: approvedCount,
        reviewRows: 0,
        failedRows: failed,
      });
    }
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

  // Inline Row Editor in Verification Step
  const handleUpdateRowField = (id: string, field: 'detected_sku' | 'new_price', value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r };
        if (field === 'detected_sku') {
          updated.detected_sku = value.trim().toUpperCase();
        } else if (field === 'new_price') {
          const num = parseFloat(value.replace(/,/g, ''));
          updated.new_price = isNaN(num) ? null : num;
          if (updated.new_price && updated.new_price > 0 && updated.validation_status === 'FAILED') {
            updated.validation_status = 'PASS';
            updated.warning_reason = 'แก้ไขราคาแล้ว พร้อมอัปเดต';
          }
        }
        return updated;
      })
    );
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
          overrideRows: rows.filter((r) => selectedRowIds.has(r.id)).map((r) => ({
            id: r.id,
            detected_sku: r.detected_sku,
            new_price: r.new_price,
            validation_status: r.validation_status,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการบันทึกราคา');
      } else {
        setCommitResult(data);
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRICES_UPDATED', timestamp: Date.now() });
            bc.postMessage({ type: 'PRICE_BATCH_UPDATED', batchId: batchData?.batchId, timestamp: Date.now() });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            localStorage.setItem('thaiudon_batch_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
            window.dispatchEvent(new CustomEvent('thaiudon_batch_sync'));
          } catch {}
        }
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการบันทึกราคา');
    } finally {
      setCommitting(false);
    }
  };

  const filteredRows = rows.filter((r) => {
    if (filterTab === 'ALL') return true;
    if (filterTab === 'PASS') return r.validation_status === 'PASS';
    if (filterTab === 'NEEDS_REVIEW') return r.validation_status === 'NEEDS_REVIEW';
    if (filterTab === 'FAILED') return r.validation_status === 'FAILED';
    if (filterTab === 'SELECTED') return selectedRowIds.has(r.id);
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              อัปเดตราคาด้วยไฟล์
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 border border-emerald-200">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              SKU-First & Real-time Update
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            อ่านรหัสสินค้า (SKU) เป็นหลัก พร้อมชื่อประกอบในกรณีข้อมูลไม่ชัดเจน มีระบบตรวจสอบความถูกต้องก่อนอัปเดตจริงบนเว็บแบบ Real-time
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/prices/sample-template"
            download
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)
          </a>
          <Link
            href="/admin/prices/import-history"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <History className="w-4 h-4 text-slate-500" />
            ประวัติการนำเข้า
          </Link>
        </div>
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
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-emerald-950">
                  {commitResult.message}
                </h2>
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-bold">
                  ⚡ Real-time Active
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                ระบบได้บันทึกการเปลี่ยนแปลงราคาลงฐานข้อมูลกลางเรียบร้อยแล้วผ่าน Database Transaction ที่ปลอดภัย
                พร้อมบันทึกประวัติ Price History และ Audit Log ครบถ้วน ลิงก์ลูกค้าและหน้าเว็บจะแสดงราคาล่าสุดทันทีโดยไม่ต้องรีโหลด
              </p>
              <div className="flex items-center gap-3 pt-2">
                <Link
                  href="/admin/prices"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                >
                  ตรวจสอบหน้ารวมราคา
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setCommitResult(null);
                    setBatchData(null);
                    setFile(null);
                  }}
                  className="px-4 py-2 bg-white border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold hover:bg-emerald-100/50 transition"
                >
                  + นำเข้าไฟล์ชุดใหม่
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 1, 2, 3: Catalog Selection, Tier Selection & File Upload */}
      {!batchData && (
        <form onSubmit={handleFileUploadAndParse} className="space-y-6">
          {/* Step 1: Catalog Type Selection */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">
                ขั้นตอนที่ 1: เลือกประเภทแคตตาล็อกสินค้า (Catalog Type)
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              ระบุประเภทแคตตาล็อกสินค้าที่ต้องการอัปเดต เช่น ตู้โล หรือ น็อคดาวน์ เพื่อให้ระบบเจาะจงค้นหารหัสสินค้า (SKU) ได้อย่างแม่นยำ หรือเลือกทั้งหมดเพื่อค้นหาครอบคลุมทั้งระบบ
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  selectedCatalogType === 'all'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">🌐 ทุกแคตตาล็อก (สินค้าทั้งหมด)</div>
                  <div className="text-[11px] text-slate-500 mt-1">ค้นหาและจับคู่ทั้งตู้โลและน็อคดาวน์ (310 รายการ)</div>
                </div>
                <input
                  type="radio"
                  name="catalog_type_select"
                  checked={selectedCatalogType === 'all'}
                  onChange={() => setSelectedCatalogType('all')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
              </label>

              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  selectedCatalogType === 'tuulo'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">🚪 แคตตาล็อกตู้โล (121 รายการ)</div>
                  <div className="text-[11px] text-slate-500 mt-1">ตู้กับข้าว ตู้โชว์อลูมิเนียม เคาน์เตอร์ครัว ตู้พระ</div>
                </div>
                <input
                  type="radio"
                  name="catalog_type_select"
                  checked={selectedCatalogType === 'tuulo'}
                  onChange={() => setSelectedCatalogType('tuulo')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
              </label>

              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  selectedCatalogType === 'knockdown'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">🛏️ แคตตาล็อกน็อคดาวน์ (189 รายการ)</div>
                  <div className="text-[11px] text-slate-500 mt-1">ชุดห้องนอน เตียง ตู้เสื้อผ้า โต๊ะเครื่องแป้ง ตู้คอนโซล</div>
                </div>
                <input
                  type="radio"
                  name="catalog_type_select"
                  checked={selectedCatalogType === 'knockdown'}
                  onChange={() => setSelectedCatalogType('knockdown')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
              </label>
            </div>
          </div>

          {/* Step 2: Tier Selection */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Coins className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">
                ขั้นตอนที่ 2: เลือกประเภทราคาเป้าหมายที่จะอัปเดต (Price Tier Target)
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

          {/* Step 3: Multi-format File Upload (Excel, Word, PDF, CSV, Text) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">
                ขั้นตอนที่ 3: อัปโหลดไฟล์ราคาสินค้า (Excel, Word, PDF, CSV, Text)
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
                รองรับ <strong>Excel (.xlsx, .xls)</strong>, <strong>Word (.docx, .doc)</strong>, <strong>PDF (.pdf)</strong>, <strong>CSV (.csv)</strong>, <strong>Text (.txt)</strong><br />
                ระบบจะค้นหารหัสสินค้า (SKU) เป็นหลัก และใช้ชื่อสินค้าช่วยยืนยัน
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
                accept=".xlsx,.xls,.csv,.txt,.pdf,.docx,.doc"
              />
              <label
                htmlFor="file-upload"
                className="mt-4 inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow-xs"
              >
                {file ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์จากอุปกรณ์'}
              </label>
            </div>

            {uploading && (
              <div className="space-y-2 p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    กำลังอ่านไฟล์และตรวจสอบรหัสสินค้ากับฐานข้อมูล...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-emerald-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  กำลังประมวลผลไฟล์...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  เริ่มวิเคราะห์ไฟล์และเปิดหน้าจอตรวจสอบความถูกต้อง
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Review & Verification Table (Pre-commit Verification Step) */}
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
                PASS (ตรงรหัส 100%)
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
              <div className="text-[10px] text-amber-600 mt-0.5">จับคู่ด้วยชื่อ/รหัสใกล้เคียง (ต้องตรวจก่อน)</div>
            </div>

            <div className="bg-red-50/60 p-4 rounded-2xl border border-red-200 shadow-xs">
              <div className="text-[11px] font-semibold text-red-800 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-600" />
                FAILED (ไม่ผ่าน)
              </div>
              <div className="text-xl font-bold text-red-700 mt-1">{batchData.failedRows} รายการ</div>
              <div className="text-[10px] text-red-600 mt-0.5">ไม่พบรหัสหรือราคาผิดพลาด</div>
            </div>
          </div>

          {/* Action Confirmation Bar */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  เป้าหมาย:
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  {batchData.priceTier?.name_th} ({batchData.priceTier?.code})
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700">
                  {batchData.catalogType === 'tuulo' ? '🚪 แคตตาล็อกตู้โล' : batchData.catalogType === 'knockdown' ? '🛏️ แคตตาล็อกน็อคดาวน์' : '🌐 ทุกแคตตาล็อก'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                โปรดตรวจสอบความถูกต้องของรหัสและราคาก่อนกดปุ่มยืนยัน ข้อมูลจะถูกอัปเดตลงเว็บไซต์แบบ Real-time ทันที
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

              <button
                type="button"
                onClick={handleSingleConfirm}
                disabled={committing || selectedRowIds.size === 0}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 flex items-center gap-2"
              >
                {committing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    กำลังบันทึกและอัปเดตแบบ Real-time...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ยืนยันอัปเดตราคาจริง ({selectedRowIds.size} รายการ)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filter Tabs & Batch Select Tools */}
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApproveAndSelectAll}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-xs flex items-center gap-1.5"
                title="กดอนุมัติทุกรายการที่ระบุราคาและเลือกลงระบบพร้อมกัน"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                ✨ อนุมัติและเลือกทั้งหมด ({rows.filter((r) => r.new_price !== null && r.new_price > 0).length} รายการ)
              </button>
              <button
                type="button"
                onClick={selectAllPass}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition border border-emerald-200"
              >
                เลือกเฉพาะที่ผ่านเกณฑ์
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
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
                    <th className="px-3 py-3.5 w-16 text-center">แถว</th>
                    <th className="px-4 py-3.5 min-w-[140px]">รหัสสินค้า (SKU)</th>
                    <th className="px-4 py-3.5 min-w-[180px]">ชื่อสินค้าที่ตรงกัน</th>
                    <th className="px-4 py-3.5 text-right">ราคาเดิม</th>
                    <th className="px-4 py-3.5 text-right font-bold text-emerald-700 min-w-[120px]">ราคาใหม่</th>
                    <th className="px-4 py-3.5 text-right">ส่วนต่าง</th>
                    <th className="px-4 py-3.5 text-center">สถานะ</th>
                    <th className="px-4 py-3.5">คำอธิบายการตรวจสอบ</th>
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
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            title={r.validation_status !== 'PASS' ? 'เลือกเพื่ออนุมัติรายการนี้' : 'เลือกรายการนี้'}
                          />
                        </td>
                        <td className="px-3 py-3.5 font-mono text-slate-400 text-center">{r.row_number}</td>
                        <td className="px-4 py-3.5">
                          <input
                            type="text"
                            value={r.detected_sku}
                            onChange={(e) => handleUpdateRowField(r.id, 'detected_sku', e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-200 rounded font-mono font-bold text-slate-900 w-full text-xs"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 max-w-xs">
                          <span className="line-clamp-2">{r.detected_product_name}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-500">
                          {r.old_price ? `฿${r.old_price.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <input
                            type="number"
                            value={r.new_price !== null ? r.new_price : ''}
                            onChange={(e) => handleUpdateRowField(r.id, 'new_price', e.target.value)}
                            className="px-2 py-1 bg-white border border-emerald-300 rounded font-mono font-bold text-emerald-700 w-24 text-right text-xs"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          {diff !== null ? (
                            <span className={diff >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {diff >= 0 ? `+฿${diff.toLocaleString()}` : `-฿${Math.abs(diff).toLocaleString()}`}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1">
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
                            {r.validation_status !== 'PASS' && (
                              <button
                                type="button"
                                onClick={() => handleApproveSingleRow(r.id)}
                                className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold transition shadow-2xs flex items-center gap-1"
                                title="กดอนุมัติรายการนี้เพื่อนำเข้า"
                              >
                                <Check className="w-2.5 h-2.5" />
                                อนุมัติ
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                          {r.warning_reason || (
                            <span className="text-emerald-600 font-medium">✓ จับคู่ตรงรหัสสินค้า 100%</span>
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
