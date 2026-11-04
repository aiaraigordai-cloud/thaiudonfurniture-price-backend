'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  History,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  AlertTriangle,
  ArrowLeft,
  Trash2,
  RefreshCw,
  Eye,
  Search,
  Sparkles,
  Clock,
  Layers,
  Check,
} from 'lucide-react';

export default function ImportHistoryPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMMITTED' | 'PENDING' | 'ROLLED_BACK'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State for inspecting batch rows & committing pending batches
  const [inspectBatch, setInspectBatch] = useState<any | null>(null);
  const [inspectRows, setInspectRows] = useState<any[]>([]);
  const [loadingInspectRows, setLoadingInspectRows] = useState(false);
  const [committingBatchId, setCommittingBatchId] = useState<string | null>(null);

  const syncTokenRef = useRef<string>('');

  const loadBatches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsSyncing(true);

    try {
      const res = await fetch('/api/prices/import-history', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (data.success) {
        setBatches(data.batches || []);
        setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
      }
    } catch (e) {
      console.error('Failed to load import batches:', e);
    } finally {
      if (!silent) setLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Multi-layer Real-time Sync Listeners: BroadcastChannel, Storage, CustomEvent, Window Focus, Polling
  useEffect(() => {
    loadBatches(false);

    // 1. BroadcastChannel across open browser tabs
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('thaiudon_sync_channel');
      bc.onmessage = (event) => {
        if (
          event.data?.type === 'PRICE_BATCH_UPDATED' ||
          event.data?.type === 'PRICES_UPDATED' ||
          event.data?.type === 'CATALOG_UPDATED'
        ) {
          loadBatches(true);
        }
      };
    } catch {}

    // 2. Storage event listener (localStorage trigger across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'thaiudon_batch_sync' || e.key === 'thaiudon_last_sync') {
        loadBatches(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. CustomEvent listener within same window
    const handleCustomSync = () => {
      loadBatches(true);
    };
    window.addEventListener('thaiudon_batch_sync', handleCustomSync);
    window.addEventListener('thaiudon_catalog_sync', handleCustomSync);

    // 4. Window Focus listener (re-fetch silently when user returns to this tab)
    const handleFocus = () => {
      loadBatches(true);
    };
    window.addEventListener('focus', handleFocus);

    // 5. Lightweight Heartbeat Polling every 3.5 seconds
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch('/api/products/sync-status');
        const data = await res.json();
        if (data.success && data.syncToken) {
          if (!syncTokenRef.current) {
            syncTokenRef.current = data.syncToken;
          } else if (syncTokenRef.current !== data.syncToken) {
            syncTokenRef.current = data.syncToken;
            loadBatches(true);
          }
        }
      } catch {}
    }, 3500);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('thaiudon_batch_sync', handleCustomSync);
      window.removeEventListener('thaiudon_catalog_sync', handleCustomSync);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, [loadBatches]);

  // Open inspection modal
  const handleInspectBatch = async (batch: any) => {
    setInspectBatch(batch);
    setLoadingInspectRows(true);
    setInspectRows([]);

    try {
      const res = await fetch(`/api/prices/import-history?batchId=${encodeURIComponent(batch.id)}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (data.success) {
        setInspectRows(data.rows || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInspectRows(false);
    }
  };

  // Commit a PENDING batch directly from modal
  const handleCommitPendingBatch = async (batchId: string) => {
    if (!confirm('ยืนยันอัปเดตราคาจริงลงเว็บจากไฟล์ชุดนี้ทันทีหรือไม่?')) {
      return;
    }

    setCommittingBatchId(batchId);
    setMessage(null);

    try {
      const res = await fetch('/api/prices/bulk-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'เกิดข้อผิดพลาดในการบันทึกราคา' });
      } else {
        setMessage({ type: 'success', text: data.message || 'บันทึกราคาลงระบบจริงสำเร็จ' });
        setInspectBatch(null);

        // Broadcast realtime update
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRICES_UPDATED', timestamp: Date.now() });
            bc.postMessage({ type: 'PRICE_BATCH_UPDATED', batchId, timestamp: Date.now() });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            localStorage.setItem('thaiudon_batch_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
            window.dispatchEvent(new CustomEvent('thaiudon_batch_sync'));
          } catch {}
        }
        loadBatches(true);
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' });
    } finally {
      setCommittingBatchId(null);
    }
  };

  const handleDeleteBatch = async (batchId: string, filename: string) => {
    if (
      !confirm(
        `คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการนำเข้า "${filename}"?\n\n(หมายเหตุ: การลบรายการประวัตินี้จะไม่กระทบกับราคาสินค้าปัจจุบันบนเว็บ แต่รายการนี้จะถูกนำออกจากประวัติและไม่สามารถ Rollback ได้อีก)`
      )
    ) {
      return;
    }

    setDeletingId(batchId);
    setMessage(null);

    try {
      const res = await fetch(`/api/prices/import-history?id=${encodeURIComponent(batchId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'ลบประวัติไม่สำเร็จ' });
      } else {
        setMessage({ type: 'success', text: data.message || 'ลบรายการประวัติสำเร็จ' });
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRICE_BATCH_UPDATED', batchId, timestamp: Date.now() });
            localStorage.setItem('thaiudon_batch_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_batch_sync'));
          } catch {}
        }
        loadBatches(true);
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRollback = async (batchId: string) => {
    if (
      !confirm(
        'คุณแน่ใจหรือไม่ว่าต้องการ Rollback ย้อนคืนราคาของ Batch นี้? ข้อมูลราคาจะถูกคืนค่าเดิมก่อนการนำเข้า'
      )
    ) {
      return;
    }

    setRollingBackId(batchId);
    setMessage(null);

    try {
      const res = await fetch('/api/prices/import-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Rollback ไม่สำเร็จ' });
      } else {
        setMessage({ type: 'success', text: data.message || 'Rollback สำเร็จ' });
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRICES_UPDATED', timestamp: Date.now() });
            bc.postMessage({ type: 'PRICE_BATCH_UPDATED', batchId, timestamp: Date.now() });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            localStorage.setItem('thaiudon_batch_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
            window.dispatchEvent(new CustomEvent('thaiudon_batch_sync'));
          } catch {}
        }
        loadBatches(true);
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setRollingBackId(null);
    }
  };

  // Filter batches
  const filteredBatches = batches.filter((b) => {
    if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchFile = b.filename?.toLowerCase().includes(q);
      const matchUser = (b.uploader_name || b.uploader_username || '').toLowerCase().includes(q);
      const matchTier = (b.tier_name || '').toLowerCase().includes(q);
      if (!matchFile && !matchUser && !matchTier) return false;
    }
    return true;
  });

  const committedCount = batches.filter((b) => b.status === 'COMMITTED').length;
  const pendingCount = batches.filter((b) => b.status === 'PENDING').length;
  const rolledBackCount = batches.filter((b) => b.status === 'ROLLED_BACK').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/prices"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-950 transition shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                ประวัติการนำเข้าราคา & การย้อนกลับ (Import History & Rollback)
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ⚡ Real-time Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ตรวจสอบประวัติการอัปเดตราคาแบบกลุ่ม รองรับ Real-time Synchronization อัตโนมัติ ป้องกันข้อมูลตกหล่น พร้อมกู้คืนราคาย้อนหลังได้อย่างปลอดภัย
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-time Indicator & Manual Refresh */}
          <button
            onClick={() => loadBatches(true)}
            disabled={isSyncing}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            title="รีเฟรชข้อมูล Real-time ทันที"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'กำลังซิงค์...' : 'รีเฟรช'}</span>
            {lastSyncTime && <span className="text-[10px] text-slate-400 font-mono">({lastSyncTime})</span>}
          </button>

          <Link
            href="/admin/prices/bulk-update"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            นำเข้าไฟล์ใหม่
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="font-bold text-xs p-1 hover:opacity-70">
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ทั้งหมด ({batches.length})
          </button>
          <button
            onClick={() => setStatusFilter('COMMITTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'COMMITTED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <span>✅ อัปเดตสำเร็จ ({committedCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            <span>⏳ รอดำเนินการ ({pendingCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('ROLLED_BACK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              statusFilter === 'ROLLED_BACK'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ย้อนคืนแล้ว ({rolledBackCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="ค้นหาชื่อไฟล์ หรือผู้นำเข้า..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">วันที่ & เวลา</th>
                <th className="px-4 py-3.5">ชื่อไฟล์ & ประเภท</th>
                <th className="px-3 py-3.5 text-center">แคตตาล็อก</th>
                <th className="px-4 py-3.5">Price Tier เป้าหมาย</th>
                <th className="px-3 py-3.5 text-center">ทั้งหมด</th>
                <th className="px-3 py-3.5 text-center text-emerald-700">ผ่าน (PASS)</th>
                <th className="px-3 py-3.5 text-center text-amber-700">รอตรวจ</th>
                <th className="px-3 py-3.5 text-center text-red-700">ล้มเหลว</th>
                <th className="px-3 py-3.5 text-center font-bold">อัปเดตจริง</th>
                <th className="px-4 py-3.5 text-center">สถานะ</th>
                <th className="px-5 py-3.5 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && batches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                    <div>กำลังโหลดประวัติ...</div>
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    {searchTerm ? 'ไม่พบประวัติการนำเข้าที่ตรงกับคำค้นหา' : 'ยังไม่มีประวัติการนำเข้าไฟล์ราคา'}
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition group">
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {b.created_at}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition">
                        {b.filename}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-mono">
                        .{b.file_type} | โดย {b.uploader_name || b.uploader_username || 'Admin'}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      {b.catalog_type === 'tuulo' ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          🚪 ตู้โล
                        </span>
                      ) : b.catalog_type === 'knockdown' ? (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                          🛏️ น็อคดาวน์
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          🌐 ทั้งหมด
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-semibold">
                        {b.tier_name}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono">{b.total_rows}</td>
                    <td className="px-3 py-3.5 text-center font-mono font-bold text-emerald-700">
                      {b.passed_rows}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono text-amber-700">
                      {b.review_rows}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono text-red-700">
                      {b.failed_rows}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono font-bold text-slate-900">
                      {b.updated_rows}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {b.status === 'COMMITTED' ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          COMMITTED
                        </span>
                      ) : b.status === 'PENDING' ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          ⏳ PENDING
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                          ROLLED_BACK
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Rows / Details Button */}
                        <button
                          onClick={() => handleInspectBatch(b)}
                          className="px-2 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 hover:border-emerald-200 text-xs font-medium transition flex items-center gap-1 shadow-2xs"
                          title="ดูรายละเอียดสินค้าและราคาในไฟล์นี้"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>ดูรายการ</span>
                        </button>

                        {/* Commit button if PENDING */}
                        {b.status === 'PENDING' && (
                          <button
                            onClick={() => handleCommitPendingBatch(b.id)}
                            disabled={committingBatchId === b.id}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-xs disabled:opacity-50"
                            title="ยืนยันและอัปเดตราคาจริงลงเว็บตอนนี้"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{committingBatchId === b.id ? 'กำลังบันทึก...' : 'ยืนยันราคา'}</span>
                          </button>
                        )}

                        {/* Rollback button if COMMITTED */}
                        {b.status === 'COMMITTED' && b.updated_rows > 0 && (
                          <button
                            onClick={() => handleRollback(b.id)}
                            disabled={rollingBackId === b.id || deletingId === b.id}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 rounded-lg text-xs font-semibold transition flex items-center gap-1 border border-slate-200 disabled:opacity-50"
                            title="Rollback ย้อนคืนราคาของ Batch นี้"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Rollback</span>
                          </button>
                        )}

                        {/* Delete Batch button */}
                        <button
                          onClick={() => handleDeleteBatch(b.id, b.filename)}
                          disabled={deletingId === b.id || rollingBackId === b.id}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition disabled:opacity-50"
                          title="เคลียร์ / ลบประวัติรายการนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Details Modal */}
      {inspectBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    {inspectBatch.filename}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inspectBatch.status === 'COMMITTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : inspectBatch.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {inspectBatch.status}
                    </span>
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                    <span>เป้าหมาย: <strong className="text-slate-800">{inspectBatch.tier_name}</strong></span>
                    <span>•</span>
                    <span>แคตตาล็อก: <strong className="text-slate-800">{inspectBatch.catalog_type === 'tuulo' ? 'ตู้โล' : inspectBatch.catalog_type === 'knockdown' ? 'น็อคดาวน์' : 'ทั้งหมด'}</strong></span>
                    <span>•</span>
                    <span>เวลา: <span className="font-mono">{inspectBatch.created_at}</span></span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectBatch(null)}
                className="w-8 h-8 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm transition"
              >
                ✕
              </button>
            </div>

            {/* If PENDING, show reminder banner */}
            {inspectBatch.status === 'PENDING' && (
              <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between px-5">
                <div className="flex items-center gap-2 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>ไฟล์ชุดนี้ถูกนำเข้าและตรวจสอบแล้ว แต่ยังไม่ได้กดยืนยันอัปเดตลงระบบจริง</span>
                </div>
                <button
                  onClick={() => handleCommitPendingBatch(inspectBatch.id)}
                  disabled={committingBatchId === inspectBatch.id}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{committingBatchId === inspectBatch.id ? 'กำลังบันทึก...' : '⚡ กดยืนยันอัปเดตราคาจริงลงเว็บ'}</span>
                </button>
              </div>
            )}

            {/* Modal Body - Rows Table */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingInspectRows ? (
                <div className="py-12 text-center text-slate-400">
                  <span className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                  <div>กำลังโหลดรายการข้อมูลสินค้า...</div>
                </div>
              ) : inspectRows.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  ไม่พบรายการสินค้าที่บันทึกไว้ใน Batch นี้
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">ลำดับ</th>
                      <th className="px-3 py-2.5">รหัสสินค้า (SKU)</th>
                      <th className="px-3 py-2.5">ชื่อสินค้า</th>
                      <th className="px-3 py-2.5 text-right">ราคาเดิม</th>
                      <th className="px-3 py-2.5 text-right font-bold text-emerald-800">ราคาใหม่</th>
                      <th className="px-3 py-2.5 text-center">สถานะ</th>
                      <th className="px-3 py-2.5">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspectRows.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 font-mono text-slate-400">{r.row_number || idx + 1}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{r.detected_sku}</td>
                        <td className="px-3 py-2.5 text-slate-700">{r.detected_product_name || '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                          {r.old_price != null ? `฿${r.old_price.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                          {r.new_price != null ? `฿${r.new_price.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.validation_status === 'PASS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.validation_status === 'NEEDS_REVIEW'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {r.validation_status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 text-[11px]">{r.warning_reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                รวมทั้งหมด <strong>{inspectRows.length}</strong> รายการ
              </span>
              <button
                onClick={() => setInspectBatch(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
