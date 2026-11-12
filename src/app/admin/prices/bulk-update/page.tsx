'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import QuickToolNav from '@/components/admin/QuickToolNav';
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
  Package,
  ShieldCheck,
  Lock,
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

  // Mode Switcher: 'price' for Price bulk update, 'product_info' for Product Info bulk update
  const [activeMode, setActiveMode] = useState<'price' | 'product_info'>('price');

  // MODE 1: PRICE BULK UPDATE STATES
  const [priceTiers, setPriceTiers] = useState<any[]>([]);
  const [selectedTierId, setSelectedTierId] = useState('');
  const [selectedCatalogType, setSelectedCatalogType] = useState<'all' | 'tuulo' | 'knockdown'>('all');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [commitResult, setCommitResult] = useState<any | null>(null);

  const [batchData, setBatchData] = useState<any | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PASS' | 'NEEDS_REVIEW' | 'FAILED' | 'SELECTED'>('ALL');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // MODE 2: PRODUCT INFO BULK UPDATE STATES (DOES NOT TOUCH PRICES)
  const [infoFile, setInfoFile] = useState<File | null>(null);
  const [infoUploading, setInfoUploading] = useState(false);
  const [infoUploadProgress, setInfoUploadProgress] = useState(0);
  const [infoCatalogType, setInfoCatalogType] = useState<'all' | 'tuulo' | 'knockdown'>('all');
  const [infoBatchData, setInfoBatchData] = useState<any | null>(null);
  const [infoRows, setInfoRows] = useState<any[]>([]);
  const [infoFilterTab, setInfoFilterTab] = useState<'ALL' | 'PASS' | 'FAILED' | 'SELECTED'>('ALL');
  const [infoSelectedRowIds, setInfoSelectedRowIds] = useState<Set<string>>(new Set());
  const [infoCommitting, setInfoCommitting] = useState(false);
  const [infoCommitResult, setInfoCommitResult] = useState<any | null>(null);
  const [infoError, setInfoError] = useState('');

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

  // MODE 1: PRICE PARSE & COMMIT HANDLERS
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
    if (!row || row.new_price === null || row.new_price < 0 || isNaN(row.new_price)) {
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
    if (target.new_price === null || target.new_price < 0 || isNaN(target.new_price)) {
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
      if (r.new_price !== null && r.new_price >= 0 && !isNaN(r.new_price) && r.detected_sku) {
        nextSelected.add(r.id);
        approvedCount++;
        return {
          ...r,
          validation_status: 'PASS' as const,
          warning_reason: r.validation_status === 'PASS' ? r.warning_reason : 'อนุมัติทั้งหมดโดยผู้ใช้',
        };
      }
      return r;
    });

    setRows(nextRows);
    setSelectedRowIds(nextSelected);

    if (batchData) {
      setBatchData({
        ...batchData,
        passedRows: approvedCount,
        reviewRows: 0,
      });
    }
  };

  const handleUpdateRowField = (id: string, field: 'detected_sku' | 'new_price', value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === 'detected_sku') {
          return { ...r, detected_sku: value.trim() };
        }
        if (field === 'new_price') {
          const num = value === '' ? null : parseFloat(value);
          return {
            ...r,
            new_price: isNaN(num as number) ? null : num,
            validation_status: num && num > 0 ? ('PASS' as const) : r.validation_status,
          };
        }
        return r;
      })
    );
  };

  const handleSingleConfirm = async () => {
    if (!batchData || selectedRowIds.size === 0) {
      alert('กรุณาเลือกรายการที่ต้องการอนุมัติอย่างน้อย 1 รายการ');
      return;
    }

    if (
      !confirm(
        `ยืนยันอัปเดตราคาจริงจำนวน ${selectedRowIds.size} รายการ?\n\n* ข้อมูลจะถูกบันทึกลงระบบทันทีแบบ Real-time\n* ลูกค้าจะเห็นราคาใหม่ทันทีโดยไม่ต้องรีโหลด`
      )
    ) {
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
          overrideRows: rows.filter((r) => selectedRowIds.has(r.id)),
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
            bc.postMessage({ type: 'PRICES_UPDATED', batchId: batchData.batchId, timestamp: Date.now() });
            localStorage.setItem('thaiudon_price_sync', Date.now().toString());
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
          } catch {}
        }
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการบันทึกราคา');
    } finally {
      setCommitting(false);
    }
  };

  // MODE 2: PRODUCT INFO PARSE & COMMIT HANDLERS (DOES NOT TOUCH PRICES)
  const handleInfoFileUploadAndParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!infoFile) {
      setInfoError('กรุณาเลือกไฟล์ข้อมูลสินค้าที่ต้องการนำเข้า');
      return;
    }

    setInfoUploading(true);
    setInfoUploadProgress(20);
    setInfoError('');
    setInfoBatchData(null);
    setInfoCommitResult(null);

    const formData = new FormData();
    formData.append('file', infoFile);
    formData.append('catalog_type', infoCatalogType);

    const progressTimer = setInterval(() => {
      setInfoUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 200);

    try {
      const res = await fetch('/api/products/bulk-parse-info', {
        method: 'POST',
        body: formData,
      });
      clearInterval(progressTimer);
      setInfoUploadProgress(100);

      const data = await res.json();
      if (!res.ok) {
        setInfoError(data.error || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์ข้อมูลสินค้า');
      } else {
        setInfoBatchData(data);
        setInfoRows(data.rows || []);

        const autoSelected = new Set<string>();
        (data.rows || []).forEach((r: any) => {
          if (r.validation_status === 'PASS') {
            autoSelected.add(r.id);
          }
        });
        setInfoSelectedRowIds(autoSelected);
      }
    } catch {
      clearInterval(progressTimer);
      setInfoError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setInfoUploading(false);
    }
  };

  const toggleInfoRowSelect = (id: string) => {
    const next = new Set(infoSelectedRowIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setInfoSelectedRowIds(next);
  };

  const handleInfoSelectAll = () => {
    const passedRows = infoRows.filter((r) => r.validation_status === 'PASS');
    if (infoSelectedRowIds.size === passedRows.length) {
      setInfoSelectedRowIds(new Set());
    } else {
      setInfoSelectedRowIds(new Set(passedRows.map((r) => r.id)));
    }
  };

  const handleInfoCommit = async () => {
    if (!infoBatchData || infoSelectedRowIds.size === 0) {
      alert('กรุณาเลือกรายการที่ต้องการบันทึกอย่างน้อย 1 รายการ');
      return;
    }

    const rowsToCommit = infoRows.filter((r) => infoSelectedRowIds.has(r.id) && r.validation_status === 'PASS');
    if (rowsToCommit.length === 0) {
      alert('ไม่มีรายการที่ผ่านเกณฑ์เพื่อบันทึก');
      return;
    }

    if (
      !confirm(
        `ยืนยันอัปเดทข้อมูลสินค้า ${rowsToCommit.length} รายการ?\n\n* ข้อมูลรายละเอียดสินค้าจะถูกอัปเดตลงระบบและ Supabase ทันทีแบบ Real-time\n* 🔒 ราคาเดิมทุกระดับจะได้รับการปกป้องและคงเดิม 100% ไม่มีการเปลี่ยนแปลงใดๆ`
      )
    ) {
      return;
    }

    setInfoCommitting(true);
    setInfoError('');

    try {
      const res = await fetch('/api/products/bulk-commit-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: infoBatchData.batchId,
          rowsToCommit,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setInfoError(data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลสินค้า');
      } else {
        setInfoCommitResult(data);

        // Multi-channel Real-time Broadcast
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({
              type: 'PRODUCTS_UPDATED',
              action: 'BULK_FILE_INFO_UPDATE',
              batchId: infoBatchData.batchId,
              timestamp: Date.now(),
            });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            localStorage.setItem('thaiudon_product_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
          } catch {}
        }
      }
    } catch {
      setInfoError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setInfoCommitting(false);
    }
  };

  const filteredPriceRows = rows.filter((r) => {
    if (filterTab === 'ALL') return true;
    if (filterTab === 'PASS') return r.validation_status === 'PASS';
    if (filterTab === 'NEEDS_REVIEW') return r.validation_status === 'NEEDS_REVIEW';
    if (filterTab === 'FAILED') return r.validation_status === 'FAILED';
    if (filterTab === 'SELECTED') return selectedRowIds.has(r.id);
    return true;
  });

  const filteredInfoRows = infoRows.filter((r) => {
    if (infoFilterTab === 'ALL') return true;
    if (infoFilterTab === 'PASS') return r.validation_status === 'PASS';
    if (infoFilterTab === 'FAILED') return r.validation_status === 'FAILED';
    if (infoFilterTab === 'SELECTED') return infoSelectedRowIds.has(r.id);
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Quick Tool Navigation (Linked Across All Admin Tools) */}
      <QuickToolNav activeTab="bulk-update" subtitle="อัปเดทราคาและข้อมูลสินค้าแบบกลุ่มด้วยไฟล์ Excel พร้อมตรวจสอบความถูกต้องแบบ Real-time" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              อัปเดทราคา/ข้อมูลสินค้า ด้วยไฟล์
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 border border-emerald-200">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              SKU-First & Real-time Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            นำเข้าไฟล์ Excel (.xlsx, .xls) หรือ CSV เพื่ออัปเดตราคา หรืออัปเดตข้อมูลรายละเอียดสินค้าแบบ Real-time พร้อมบันทึกลง Supabase
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeMode === 'price' ? (
            <a
              href="/api/prices/sample-template"
              download
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              ดาวน์โหลดเทมเพลตราคา (.xlsx)
            </a>
          ) : (
            <a
              href="/api/products/sample-template"
              download
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              ดาวน์โหลดเทมเพลตข้อมูลสินค้า (.xlsx)
            </a>
          )}

          <Link
            href="/admin/prices/import-history"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <History className="w-4 h-4 text-slate-500" />
            ประวัติการนำเข้า
          </Link>
        </div>
      </div>

      {/* UPDATE MODE SELECTOR TABS */}
      <div className="flex rounded-2xl bg-slate-200/80 p-1.5 border border-slate-300/80 max-w-2xl shadow-inner">
        <button
          type="button"
          onClick={() => {
            setActiveMode('price');
            setError('');
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeMode === 'price'
              ? 'bg-white text-emerald-800 shadow-md ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coins className="w-4 h-4 text-emerald-600" />
          <span>1. อัปเดตราคาด้วยไฟล์</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode('product_info');
            setInfoError('');
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeMode === 'product_info'
              ? 'bg-white text-blue-900 shadow-md ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4 text-blue-600" />
          <span>2. อัปเดทข้อมูลสินค้าด้วยไฟล์ (ไม่แตะราคา)</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* MODE 1: PRICE BULK UPDATE SECTION                             */}
      {/* ============================================================== */}
      {activeMode === 'price' && (
        <div className="space-y-6">
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
                    ระบบได้บันทึกการเปลี่ยนแปลงราคาลงฐานข้อมูลกลางเรียบร้อยแล้วพร้อมซิงค์ Supabase ลิงก์ลูกค้าและหน้าเว็บจะแสดงราคาล่าสุดทันทีโดยไม่ต้องรีโหลด
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
                      className="px-4 py-2 bg-white border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold hover:bg-emerald-100/50 transition cursor-pointer"
                    >
                      + นำเข้าไฟล์ชุดใหม่
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1, 2, 3: Price Upload Form */}
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
                  ระบุประเภทแคตตาล็อกสินค้าที่ต้องการอัปเดตราคา เช่น ตู้โล หรือ น็อคดาวน์
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
                  การอัปเดตหนึ่ง Batch จะเขียนข้อมูลเฉพาะ Price Tier ที่เลือกเท่านั้น
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
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

                  {/* 5th Tier: ALL 4 TIERS */}
                  <label
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      selectedTierId === 'ALL_4_TIERS'
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-emerald-950 flex items-center gap-1">
                        <span>🔥 ทั้งหมด 4 ระดับ</span>
                      </span>
                      <input
                        type="radio"
                        name="tier_select"
                        checked={selectedTierId === 'ALL_4_TIERS'}
                        onChange={() => setSelectedTierId('ALL_4_TIERS')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="text-[10px] font-mono text-emerald-700 font-bold uppercase">ALL_4_TIERS</div>
                    <div className="text-[11px] text-slate-600 mt-2">
                      อัปเดตทั้ง 4 ระดับพร้อมกัน (เซลล์, ปลีก, VIP, ทั่วไป) ในไฟล์เดียว
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 3: File Upload */}
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
                    รองรับ Excel (.xlsx, .xls), Word (.docx, .doc), PDF (.pdf), CSV (.csv), Text (.txt)
                  </p>
                  <input
                    type="file"
                    id="file-upload-price"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    accept=".xlsx,.xls,.csv,.txt,.pdf,.docx,.doc"
                  />
                  <label
                    htmlFor="file-upload-price"
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
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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

          {/* Step 3: Review Table for Price */}
          {batchData && !commitResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => setFilterTab('ALL')}
                  className={`text-left p-4 rounded-2xl border transition shadow-xs cursor-pointer ${
                    filterTab === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900 ring-offset-2'
                      : 'bg-white text-slate-900 border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <div className={`text-[11px] ${filterTab === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>ข้อมูลทั้งหมดในไฟล์</div>
                  <div className="text-xl font-bold mt-1">{batchData.totalRows} แถว</div>
                  <div className={`text-[10px] truncate mt-0.5 ${filterTab === 'ALL' ? 'text-slate-400' : 'text-slate-400'}`}>
                    {filterTab === 'ALL' ? '● กำลังแสดงทั้งหมด' : batchData.filename}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterTab('PASS')}
                  className={`text-left p-4 rounded-2xl border transition shadow-xs cursor-pointer ${
                    filterTab === 'PASS'
                      ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500 ring-offset-2'
                      : 'bg-emerald-50/60 text-emerald-950 border-emerald-200 hover:bg-emerald-100/60'
                  }`}
                >
                  <div className={`text-[11px] font-semibold flex items-center gap-1.5 ${filterTab === 'PASS' ? 'text-white' : 'text-emerald-800'}`}>
                    <CheckCircle2 className={`w-4 h-4 ${filterTab === 'PASS' ? 'text-white' : 'text-emerald-600'}`} />
                    PASS (ตรงรหัส 100%)
                  </div>
                  <div className={`text-xl font-bold mt-1 ${filterTab === 'PASS' ? 'text-white' : 'text-emerald-700'}`}>{batchData.passedRows} รายการ</div>
                  <div className={`text-[10px] font-semibold mt-0.5 ${filterTab === 'PASS' ? 'text-emerald-100' : 'text-emerald-600'}`}>
                    {filterTab === 'PASS' ? '● กำลังกรองเฉพาะตรงรหัส' : '✓ Auto-selected อัตโนมัติแล้ว'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterTab('NEEDS_REVIEW')}
                  className={`text-left p-4 rounded-2xl border transition shadow-xs cursor-pointer ${
                    filterTab === 'NEEDS_REVIEW'
                      ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-500 ring-offset-2'
                      : 'bg-amber-50/60 text-amber-950 border-amber-200 hover:bg-amber-100/60'
                  }`}
                >
                  <div className={`text-[11px] font-semibold flex items-center gap-1.5 ${filterTab === 'NEEDS_REVIEW' ? 'text-white' : 'text-amber-800'}`}>
                    <AlertTriangle className={`w-4 h-4 ${filterTab === 'NEEDS_REVIEW' ? 'text-white' : 'text-amber-600'}`} />
                    NEEDS_REVIEW
                  </div>
                  <div className={`text-xl font-bold mt-1 ${filterTab === 'NEEDS_REVIEW' ? 'text-white' : 'text-amber-700'}`}>{batchData.reviewRows} รายการ</div>
                  <div className={`text-[10px] mt-0.5 ${filterTab === 'NEEDS_REVIEW' ? 'text-amber-100' : 'text-amber-600'}`}>
                    {filterTab === 'NEEDS_REVIEW' ? '● กำลังกรองต้องตรวจสอบ' : 'ราคาเปลี่ยน >60% / ตรงชื่อ'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterTab('FAILED')}
                  className={`text-left p-4 rounded-2xl border transition shadow-xs cursor-pointer ${
                    filterTab === 'FAILED'
                      ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-500 ring-offset-2'
                      : 'bg-red-50/60 text-red-950 border-red-200 hover:bg-red-100/60'
                  }`}
                >
                  <div className={`text-[11px] font-semibold flex items-center gap-1.5 ${filterTab === 'FAILED' ? 'text-white' : 'text-red-800'}`}>
                    <XCircle className={`w-4 h-4 ${filterTab === 'FAILED' ? 'text-white' : 'text-red-600'}`} />
                    FAILED (ไม่มีในระบบ)
                  </div>
                  <div className={`text-xl font-bold mt-1 ${filterTab === 'FAILED' ? 'text-white' : 'text-red-700'}`}>{batchData.failedRows} รายการ</div>
                  <div className={`text-[10px] mt-0.5 ${filterTab === 'FAILED' ? 'text-red-100' : 'text-red-600'}`}>
                    {filterTab === 'FAILED' ? '● กำลังกรองไม่มีในฐานข้อมูล' : 'ไม่มีรหัสในระบบหรือพิมพ์ผิด'}
                  </div>
                </button>
              </div>

              {/* Table Filter Tabs & Quick Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> ตัวกรอง:
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterTab('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      filterTab === 'ALL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    ทั้งหมด ({rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('PASS')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      filterTab === 'PASS'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    ผ่านเกณฑ์ ({batchData.passedRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('NEEDS_REVIEW')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      filterTab === 'NEEDS_REVIEW'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    ต้องตรวจสอบ ({batchData.reviewRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('FAILED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      filterTab === 'FAILED'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    <XCircle className="w-3 h-3" />
                    ไม่มีในระบบ ({batchData.failedRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('SELECTED')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      filterTab === 'SELECTED'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    ☑️ เลือกแล้ว ({selectedRowIds.size})
                  </button>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleApproveAndSelectAll}
                    className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    title="เลือกทุกรายการที่มีรหัสและราคาถูกต้อง"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    เลือกทั้งหมดที่ผ่าน
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRowIds(new Set())}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    ล้างการเลือก
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      เป้าหมาย:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                      {batchData.priceTier?.name_th} ({batchData.priceTier?.code})
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
                    className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                  >
                    ยกเลิก / อัปโหลดใหม่
                  </button>

                  <button
                    type="button"
                    onClick={handleSingleConfirm}
                    disabled={committing || selectedRowIds.size === 0}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3.5 w-12 text-center">เลือก</th>
                        <th className="px-3 py-3.5 w-12 text-center">#</th>
                        <th className="px-4 py-3.5 font-bold text-slate-900">รหัสสินค้า (SKU)</th>
                        <th className="px-4 py-3.5">ชื่อสินค้า</th>
                        {batchData?.priceTier?.id === 'ALL_4_TIERS' ? (
                          <th className="px-4 py-3.5 font-bold text-emerald-800 min-w-[340px]">
                            ราคาทั้ง 4 ระดับ (เซลล์ • ปลีก • VIP • ทั่วไป)
                          </th>
                        ) : (
                          <>
                            <th className="px-4 py-3.5 text-right">ราคาเดิม</th>
                            <th className="px-4 py-3.5 text-right font-bold text-emerald-700">ราคาใหม่</th>
                            <th className="px-4 py-3.5 text-right">ส่วนต่าง</th>
                          </>
                        )}
                        <th className="px-4 py-3.5 text-center">สถานะ</th>
                        <th className="px-4 py-3.5">คำอธิบาย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPriceRows.map((r) => {
                        const isChecked = selectedRowIds.has(r.id);
                        const diff = r.old_price && r.new_price ? r.new_price - r.old_price : null;
                        return (
                          <tr key={r.id} className={`hover:bg-slate-50/80 transition ${isChecked ? 'bg-emerald-50/20' : ''}`}>
                            <td className="px-4 py-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleRowSelect(r.id, r.validation_status)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-3.5 font-mono text-slate-400 text-center">{r.row_number}</td>
                            <td className="px-4 py-3.5 font-mono font-bold text-slate-900">{r.detected_sku}</td>
                            <td className="px-4 py-3.5 text-slate-700 truncate max-w-xs">{r.detected_product_name}</td>
                            {batchData?.priceTier?.id === 'ALL_4_TIERS' ? (
                              <td className="px-4 py-3.5 font-mono text-[11px]">
                                {(r as any).prices_4_tiers ? (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                      เซลล์: {(r as any).prices_4_tiers.tier_sale > 0 ? `฿${(r as any).prices_4_tiers.tier_sale.toLocaleString()}` : '-'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                      ปลีก: {(r as any).prices_4_tiers.tier_retail > 0 ? `฿${(r as any).prices_4_tiers.tier_retail.toLocaleString()}` : '-'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                                      VIP: {(r as any).prices_4_tiers.tier_vip > 0 ? `฿${(r as any).prices_4_tiers.tier_vip.toLocaleString()}` : '-'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                      ทั่วไป: {(r as any).prices_4_tiers.tier_general > 0 ? `฿${(r as any).prices_4_tiers.tier_general.toLocaleString()}` : '-'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-bold text-emerald-700">
                                    {r.new_price !== null && r.new_price > 0 ? `฿${r.new_price.toLocaleString()} (ทั้ง 4 ระดับ)` : 'ไม่มีราคา (-) ทั้ง 4 ระดับ'}
                                  </span>
                                )}
                              </td>
                            ) : (
                              <>
                                <td className="px-4 py-3.5 text-right font-mono text-slate-500">
                                  {r.old_price !== null && r.old_price > 0 ? `฿${r.old_price.toLocaleString()}` : '-'}
                                </td>
                                <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-700">
                                  {r.new_price !== null && r.new_price > 0 ? (
                                    `฿${r.new_price.toLocaleString()}`
                                  ) : r.new_price === 0 ? (
                                    <span className="text-slate-400 font-normal">ไม่มีราคา (-)</span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-right font-mono">
                                  {diff !== null && r.new_price !== null && r.new_price > 0 && r.old_price && r.old_price > 0 ? (
                                    <span className={diff >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                                      {diff >= 0 ? `+฿${diff.toLocaleString()}` : `-฿${Math.abs(diff).toLocaleString()}`}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </>
                            )}
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
                                {r.validation_status === 'PASS' ? 'ผ่านเกณฑ์' : r.validation_status === 'NEEDS_REVIEW' ? 'ต้องตรวจสอบ' : 'ไม่มีในระบบ/ไม่ผ่าน'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-[11px]">
                              {r.warning_reason?.includes('ไม่มีรหัสสินค้านี้ในฐานข้อมูล') ? (
                                <span className="text-red-600 font-medium flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                                  {r.warning_reason}
                                </span>
                              ) : r.warning_reason?.includes('ราคาในไฟล์เป็น 0') ? (
                                <span className="text-slate-600 font-medium">
                                  {r.warning_reason}
                                </span>
                              ) : (
                                <span className="text-slate-500">{r.warning_reason || '✓ ตรงรหัสสินค้า'}</span>
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
      )}

      {/* ============================================================== */}
      {/* MODE 2: PRODUCT INFO BULK UPDATE SECTION (PROTECTED PRICES)   */}
      {/* ============================================================== */}
      {activeMode === 'product_info' && (
        <div className="space-y-6">
          {infoError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{infoError}</span>
            </div>
          )}

          {/* Success Card */}
          {infoCommitResult && (
            <div className="bg-blue-50 border border-blue-300 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-600/30">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-blue-950">
                      {infoCommitResult.message}
                    </h2>
                    <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded-full text-[10px] font-bold">
                      ⚡ Real-time Synced
                    </span>
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    ระบบได้อัปเดตข้อมูลรายละเอียดสินค้าลงฐานข้อมูลกลาง, Supabase, และ Persistent Store เรียบร้อยแล้ว <strong>โดยราคาเดิมทุกระดับปลอดภัย 100%</strong> หน้าเว็บแชร์ลูกค้าและระบบหลังบ้านจะแสดงข้อมูลใหม่ทันที
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <Link
                      href="/admin/products"
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                    >
                      ตรวจสอบหน้าจัดการสินค้า
                    </Link>
                    <Link
                      href="/s/catalog-tuulo-retail"
                      target="_blank"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                    >
                      เปิดดูหน้าแคตตาล็อกลูกค้า
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setInfoCommitResult(null);
                        setInfoBatchData(null);
                        setInfoFile(null);
                      }}
                      className="px-4 py-2 bg-white border border-blue-300 text-blue-900 rounded-xl text-xs font-semibold hover:bg-blue-100/50 transition cursor-pointer"
                    >
                      + นำเข้าไฟล์ข้อมูลชุดใหม่
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Step: Info Upload */}
          {!infoBatchData && (
            <form onSubmit={handleInfoFileUploadAndParse} className="space-y-6">
              {/* Security & Price Protection Banner */}
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 flex items-start gap-3.5 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Lock className="w-5 h-5 text-emerald-100" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    <span>ระบบป้องกันราคาเดิม 100% (Price Protection Guaranteed)</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                      ปลอดภัยสูงสุด
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    โหมดนี้ออกแบบมาเพื่อ <strong>อัปเดตเฉพาะข้อมูลสินค้า 3 ส่วนหลักเท่านั้น ได้แก่: รหัสสินค้า (SKU), ชื่อสินค้า, และ รายละเอียดสินค้า</strong> โดยระบบจะไม่ไปแตะต้องหรือแก้ไขราคาเดิมทั้ง 4 ระดับ (ราคาเซลล์, ราคาปลีก, ราคา VIP, ราคาทั่วไป) อย่างเด็ดขาด
                  </p>
                </div>
              </div>

              {/* Step 1: Catalog Type Selection */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-800">
                    ขั้นตอนที่ 1: เลือกประเภทแคตตาล็อกสินค้าที่ต้องการอัปเดตข้อมูล
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <label
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      infoCatalogType === 'all'
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">🌐 ทุกแคตตาล็อก (สินค้าทั้งหมด)</div>
                      <div className="text-[11px] text-slate-500 mt-1">อัปเดตข้อมูลทั้งตู้โลและน็อคดาวน์ (268 รายการ)</div>
                    </div>
                    <input
                      type="radio"
                      name="info_catalog_type"
                      checked={infoCatalogType === 'all'}
                      onChange={() => setInfoCatalogType('all')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </label>

                  <label
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      infoCatalogType === 'tuulo'
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">🚪 แคตตาล็อกตู้โล (111 รายการ)</div>
                      <div className="text-[11px] text-slate-500 mt-1">ตู้กับข้าว ตู้โชว์ เคาน์เตอร์ครัว ตู้พระ</div>
                    </div>
                    <input
                      type="radio"
                      name="info_catalog_type"
                      checked={infoCatalogType === 'tuulo'}
                      onChange={() => setInfoCatalogType('tuulo')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </label>

                  <label
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      infoCatalogType === 'knockdown'
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">🛏️ แคตตาล็อกน็อคดาวน์ (157 รายการ)</div>
                      <div className="text-[11px] text-slate-500 mt-1">ชุดห้องนอน เตียง ตู้เสื้อผ้า โต๊ะแป้ง</div>
                    </div>
                    <input
                      type="radio"
                      name="info_catalog_type"
                      checked={infoCatalogType === 'knockdown'}
                      onChange={() => setInfoCatalogType('knockdown')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>

              {/* Step 2: File Upload */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <UploadCloud className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-800">
                    ขั้นตอนที่ 2: อัปโหลดไฟล์ข้อมูลสินค้า (Excel .xlsx / .xls หรือ CSV .csv)
                  </h2>
                </div>

                <div className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl p-8 text-center transition bg-slate-50/50">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-3">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    {infoFile ? infoFile.name : 'ลากไฟล์ข้อมูลสินค้ามาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                    รองรับไฟล์ <strong>Excel (.xlsx, .xls)</strong> หรือ <strong>CSV (.csv)</strong><br />
                    ใช้ข้อมูลเฉพาะ 3 ส่วนเท่านั้น: <strong>รหัสสินค้า (SKU)</strong>, <strong>ชื่อสินค้า</strong>, และ <strong>รายละเอียดสินค้า</strong> (🔒 ราคาเดิมปลอดภัย 100%)
                  </p>
                  <input
                    type="file"
                    id="file-upload-info"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setInfoFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                  />
                  <label
                    htmlFor="file-upload-info"
                    className="mt-4 inline-block px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow-xs"
                  >
                    {infoFile ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์ข้อมูลสินค้า'}
                  </label>
                </div>

                {infoUploading && (
                  <div className="space-y-2 p-4 bg-blue-50/80 border border-blue-200 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        กำลังอ่านไฟล์และจับคู่ข้อมูลสินค้า...
                      </span>
                      <span>{infoUploadProgress}%</span>
                    </div>
                    <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 transition-all duration-300"
                        style={{ width: `${infoUploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={infoUploading || !infoFile}
                  className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {infoUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      กำลังประมวลผลไฟล์...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      เริ่มวิเคราะห์ไฟล์ข้อมูลสินค้า (เปิดหน้าจอตรวจสอบก่อนบันทึก)
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Review Table for Product Info */}
          {infoBatchData && !infoCommitResult && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="text-[11px] text-slate-500">ข้อมูลทั้งหมดในไฟล์</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{infoBatchData.totalRows} แถว</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">{infoBatchData.filename}</div>
                </div>

                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 shadow-xs">
                  <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    PASS (พบรหัสสินค้าในระบบ)
                  </div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">{infoBatchData.passedRows} รายการ</div>
                  <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                    ✓ เลือกอัปเดตอัตโนมัติแล้ว
                  </div>
                </div>

                <div className="bg-red-50/60 p-4 rounded-2xl border border-red-200 shadow-xs">
                  <div className="text-[11px] font-semibold text-red-800 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-red-600" />
                    FAILED (ไม่พบรหัสสินค้า)
                  </div>
                  <div className="text-xl font-bold text-red-700 mt-1">{infoBatchData.failedRows} รายการ</div>
                  <div className="text-[10px] text-red-600 mt-0.5">รหัส SKU ไม่ตรงกับในระบบ</div>
                </div>
              </div>

              {/* Action Confirmation Bar */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      โหมดอัปเดต:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
                      📦 อัปเดทเฉพาะข้อมูลสินค้า
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      ราคาเดิมปลอดภัย 100%
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    ระบบจะอัปเดตเฉพาะรหัสสินค้า (SKU), ชื่อสินค้า, และรายละเอียดสินค้าเท่านั้น โดยราคาเดิมทั้ง 4 ระดับคงเดิมปลอดภัย 100%
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setInfoBatchData(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                  >
                    ยกเลิก / อัปโหลดใหม่
                  </button>

                  <button
                    type="button"
                    onClick={handleInfoCommit}
                    disabled={infoCommitting || infoSelectedRowIds.size === 0}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/25 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {infoCommitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        กำลังบันทึกและซิงค์ Real-time...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        ยืนยันอัปเดทข้อมูลสินค้า ({infoSelectedRowIds.size} รายการ)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['ALL', 'PASS', 'FAILED', 'SELECTED'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setInfoFilterTab(tab)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        infoFilterTab === tab
                          ? 'bg-blue-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab === 'ALL' && `ทั้งหมด (${infoRows.length})`}
                      {tab === 'PASS' && `✓ ผ่าน (${infoBatchData.passedRows})`}
                      {tab === 'FAILED' && `✕ ไม่พบ (${infoBatchData.failedRows})`}
                      {tab === 'SELECTED' && `เลือกไว้ (${infoSelectedRowIds.size})`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInfoSelectAll}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
                  >
                    {infoSelectedRowIds.size === infoBatchData.passedRows ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกรายการที่ผ่านทั้งหมด'}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3.5 w-12 text-center">เลือก</th>
                        <th className="px-3 py-3.5 w-12 text-center">#</th>
                        <th className="px-4 py-3.5 font-bold text-slate-900">รหัสสินค้า (SKU)</th>
                        <th className="px-4 py-3.5 min-w-[200px]">ชื่อสินค้า (เดิม ➔ ใหม่)</th>
                        <th className="px-4 py-3.5 min-w-[260px]">รายละเอียดสินค้า (Description)</th>
                        <th className="px-4 py-3.5 text-center min-w-[130px]">ราคาเดิม (Protected)</th>
                        <th className="px-4 py-3.5 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInfoRows.map((r) => {
                        const isChecked = infoSelectedRowIds.has(r.id);
                        const isSkuChanged = r.new_sku && r.new_sku !== r.detected_sku;
                        const isNameChanged = r.new_name && r.new_name !== r.old_name;
                        const isDescChanged = r.new_description && r.new_description !== r.old_description;

                        return (
                          <tr key={r.id} className={`hover:bg-slate-50/80 transition ${isChecked ? 'bg-blue-50/20' : ''}`}>
                            <td className="px-4 py-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleInfoRowSelect(r.id)}
                                disabled={r.validation_status !== 'PASS'}
                                className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30"
                              />
                            </td>
                            <td className="px-3 py-3.5 font-mono text-slate-400 text-center">{r.row_number}</td>
                            <td className="px-4 py-3.5 font-mono">
                              {isSkuChanged ? (
                                <div>
                                  <span className="text-slate-400 line-through text-[10px] block">{r.detected_sku}</span>
                                  <span className="bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                    ➔ {r.new_sku}
                                  </span>
                                </div>
                              ) : (
                                <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-900">
                                  {r.detected_sku}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              {r.old_name ? (
                                <div>
                                  <div className="text-slate-500 line-through text-[11px]">{r.old_name}</div>
                                  <div className={`font-bold ${isNameChanged ? 'text-blue-700' : 'text-slate-800'}`}>
                                    {r.new_name || r.old_name}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-red-500 font-semibold">{r.detected_product_name || 'ไม่พบในระบบ'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 max-w-sm text-[11px]">
                              {r.new_description ? (
                                <div>
                                  <div className={`line-clamp-2 ${isDescChanged ? 'text-blue-900 font-medium' : 'text-slate-700'}`} title={r.new_description}>
                                    {r.new_description}
                                  </div>
                                  {r.old_description && isDescChanged && (
                                    <div className="text-slate-400 text-[10px] truncate line-through mt-0.5" title={r.old_description}>
                                      เดิม: {r.old_description}
                                    </div>
                                  )}
                                </div>
                              ) : r.old_description ? (
                                <div className="text-slate-500 line-clamp-2" title={r.old_description}>
                                  {r.old_description}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Lock className="w-3 h-3 text-emerald-600" />
                                <span>คงเดิม 100%</span>
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.validation_status === 'PASS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {r.validation_status === 'PASS' ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>PASS</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3 text-red-600" />
                                    <span>ไม่พบ SKU</span>
                                  </>
                                )}
                              </span>
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
      )}
    </div>
  );
}
