'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
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
  Edit2,
  X,
  Save,
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

  // Row Edit State inside Modal
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editSku, setEditSku] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStatus, setEditStatus] = useState<'PASS' | 'NEEDS_REVIEW' | 'FAILED'>('PASS');
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);

  // Batch Edit State in Main List
  const [editingBatch, setEditingBatch] = useState<any | null>(null);
  const [editBatchFilename, setEditBatchFilename] = useState('');
  const [editBatchCatalogType, setEditBatchCatalogType] = useState('all');
  const [savingBatch, setSavingBatch] = useState(false);

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

  // Multi-layer Real-time Sync Listeners: Supabase Realtime, BroadcastChannel, Storage, CustomEvent, Window Focus, Polling
  useEffect(() => {
    loadBatches(false);

    // 1. Supabase Realtime WebSocket Listener (Direct Cloud Push)
    let supaClient: any = null;
    try {
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supaUrl && supaKey) {
        supaClient = createClient(supaUrl, supaKey);
        const channel = supaClient
          .channel('realtime_price_import_batches')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'price_import_batches' }, () => {
            loadBatches(true);
          })
          .subscribe();

        return () => {
          if (supaClient && channel) {
            supaClient.removeChannel(channel);
          }
        };
      }
    } catch (err) {
      console.warn('Supabase realtime init error:', err);
    }

    // 2. BroadcastChannel across open browser tabs
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

    // 3. Storage event listener (localStorage trigger across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'thaiudon_batch_sync' || e.key === 'thaiudon_last_sync') {
        loadBatches(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 4. CustomEvent listener within same window
    const handleCustomSync = () => {
      loadBatches(true);
    };
    window.addEventListener('thaiudon_batch_sync', handleCustomSync);
    window.addEventListener('thaiudon_catalog_sync', handleCustomSync);

    // 5. Window Focus listener
    const handleFocus = () => {
      loadBatches(true);
    };
    window.addEventListener('focus', handleFocus);

    // 6. Lightweight Heartbeat Polling every 3.5 seconds
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
    setEditingRowId(null);

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

  // Delete an entire batch
  const handleDeleteBatch = async (batchId: string, filename: string) => {
    if (
      !confirm(
        `คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการนำเข้า "${filename}"?\n\n(หมายเหตุ: รายการนี้จะถูกลบออกจากประวัติในระบบและฐานข้อมูล Real-time)`
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
        // Optimistic UI removal
        setBatches((prev) => prev.filter((b) => b.id !== batchId));

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

  // Rollback a batch
  const handleRollback = async (batchId: string) => {
    if (
      !confirm(
        'คุณแน่ใจหรือไม่ว่าต้องการ Rollback ย้อนคืนราคาของ Batch นี้? ข้อมูลราคาจะถูกคืนค่าเดิมก่อนการนำเข้าแบบ Real-time'
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
        setMessage({ type: 'error', text: data.error || 'ย้อนกลับราคาไม่สำเร็จ' });
      } else {
        setMessage({ type: 'success', text: data.message || 'ย้อนกลับราคาสำเร็จ' });

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

  // Start editing a row inside modal
  const handleStartEditRow = (row: any) => {
    setEditingRowId(row.id);
    setEditSku(row.detected_sku || '');
    setEditPrice(row.new_price != null ? String(row.new_price) : '');
    setEditStatus(row.validation_status || 'PASS');
  };

  // Save row edit
  const handleSaveRow = async (rowId: string) => {
    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('กรุณาระบุราคาที่ถูกต้องและมากกว่า 0');
      return;
    }

    setSavingRowId(rowId);
    try {
      const res = await fetch('/api/prices/import-history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowId,
          detected_sku: editSku.trim(),
          new_price: priceNum,
          validation_status: editStatus,
          warning_reason: editStatus === 'PASS' ? 'แก้ไขและอนุมัติโดยผู้ใช้งาน' : 'ปรับสถานะโดยผู้ใช้งาน',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'แก้ไขรายการไม่สำเร็จ');
      } else {
        // Update local modal row state
        setInspectRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? {
                  ...r,
                  detected_sku: editSku.trim(),
                  new_price: priceNum,
                  validation_status: editStatus,
                  warning_reason: editStatus === 'PASS' ? 'แก้ไขและอนุมัติโดยผู้ใช้งาน' : 'ปรับสถานะโดยผู้ใช้งาน',
                }
              : r
          )
        );
        setEditingRowId(null);

        // Broadcast sync
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRICE_BATCH_UPDATED', timestamp: Date.now() });
            localStorage.setItem('thaiudon_batch_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_batch_sync'));
          } catch {}
        }
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSavingRowId(null);
    }
  };

  // Delete an individual row inside modal
  const handleDeleteRow = async (rowId: string, sku: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรายการ SKU "${sku || '-'}" ออกจากชุดนำเข้านี้?`)) {
      return;
    }

    setDeletingRowId(rowId);
    try {
      const res = await fetch(`/api/prices/import-history?rowId=${encodeURIComponent(rowId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'ลบรายการไม่สำเร็จ');
      } else {
        setInspectRows((prev) => prev.filter((r) => r.id !== rowId));
        if (inspectBatch) {
          setInspectBatch({ ...inspectBatch, total_rows: Math.max(0, (inspectBatch.total_rows || 1) - 1) });
        }
        // Broadcast sync
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRICE_BATCH_UPDATED', timestamp: Date.now() });
            localStorage.setItem('thaiudon_batch_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_batch_sync'));
          } catch {}
        }
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setDeletingRowId(null);
    }
  };

  // Open edit batch modal
  const handleOpenEditBatch = (b: any) => {
    setEditingBatch(b);
    setEditBatchFilename(b.filename || '');
    setEditBatchCatalogType(b.catalog_type || 'all');
  };

  // Save batch metadata
  const handleSaveBatchMetadata = async () => {
    if (!editingBatch) return;
    setSavingBatch(true);
    try {
      const res = await fetch('/api/prices/import-history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: editingBatch.id,
          filename: editBatchFilename.trim(),
          catalog_type: editBatchCatalogType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'แก้ไข Batch ไม่สำเร็จ');
      } else {
        setBatches((prev) =>
          prev.map((b) =>
            b.id === editingBatch.id
              ? { ...b, filename: editBatchFilename.trim(), catalog_type: editBatchCatalogType }
              : b
          )
        );
        setEditingBatch(null);

        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRICE_BATCH_UPDATED', timestamp: Date.now() });
            localStorage.setItem('thaiudon_batch_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_batch_sync'));
          } catch {}
        }
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSavingBatch(false);
    }
  };

  const filteredBatches = batches.filter((b) => {
    if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchFile = b.filename?.toLowerCase().includes(term);
      const matchUser = (b.uploader_username || b.uploader_name || '').toLowerCase().includes(term);
      const matchTier = (b.tier_name || '').toLowerCase().includes(term);
      return matchFile || matchUser || matchTier;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/prices"
              className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition"
              title="กลับไปหน้าจัดการราคา"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              ประวัติการนำเข้าราคา & การย้อนกลับ (Import History & Rollback)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Real-time Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ตรวจสอบประวัติการอัปเดตราคาแบบกลุ่ม รองรับ Real-time Synchronization อัตโนมัติ แก้ไข ลบรายการ และกู้คืนราคาย้อนหลังได้อย่างปลอดภัย
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadBatches(false)}
            disabled={loading || isSyncing}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="รีเฟรชข้อมูลแบบ Real-time"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${(loading || isSyncing) ? 'animate-spin' : ''}`} />
            <span>รีเฟรช {lastSyncTime ? `(${lastSyncTime})` : ''}</span>
          </button>
          <Link
            href="/admin/prices/bulk-update"
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>นำเข้าไฟล์ใหม่</span>
          </Link>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
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
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ทั้งหมด ({batches.length})
          </button>
          <button
            onClick={() => setStatusFilter('COMMITTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              statusFilter === 'COMMITTED'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            อัปเดตสำเร็จ ({batches.filter((b) => b.status === 'COMMITTED').length})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            รอดำเนินการ ({batches.filter((b) => b.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setStatusFilter('ROLLED_BACK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              statusFilter === 'ROLLED_BACK'
                ? 'bg-slate-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ย้อนคืนแล้ว ({batches.filter((b) => b.status === 'ROLLED_BACK').length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อไฟล์ หรือผู้นำเข้า..."
            className="pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Main Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">วันที่ & เวลา</th>
                <th className="px-5 py-3.5">ชื่อไฟล์ & ประเภท</th>
                <th className="px-3 py-3.5 text-center">แคตตาล็อก</th>
                <th className="px-3 py-3.5 text-center">Price Tier เป้าหมาย</th>
                <th className="px-3 py-3.5 text-center">ทั้งหมด</th>
                <th className="px-3 py-3.5 text-center text-emerald-700">ผ่าน (PASS)</th>
                <th className="px-3 py-3.5 text-center text-amber-700">รอตรวจ</th>
                <th className="px-3 py-3.5 text-center text-red-700">ล้มเหลว</th>
                <th className="px-3 py-3.5 text-center font-bold text-emerald-800">อัปเดตจริง</th>
                <th className="px-4 py-3.5 text-center">สถานะ</th>
                <th className="px-5 py-3.5 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <span className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></span>
                    <div>กำลังโหลดประวัติการนำเข้า...</div>
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <History className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div>ยังไม่มีประวัติการนำเข้าราคาในหมวดนี้</div>
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5 font-mono text-slate-500 text-[11px]">
                      {b.created_at}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{b.filename}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        .{b.file_type?.toUpperCase()} | โดย {b.uploader_name || b.uploader_username || 'Admin'}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      {b.catalog_type === 'tuulo' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          🚪 ตู้โล
                        </span>
                      ) : b.catalog_type === 'knockdown' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          🛏️ น็อคดาวน์
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          🌐 ทั้งหมด
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-center font-medium text-slate-700">
                      {b.tier_name || b.price_tier_id || 'ราคาเซลล์'}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono font-semibold text-slate-800">
                      {b.total_rows}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono text-emerald-700 font-bold">
                      {b.passed_rows}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono text-amber-700 font-bold">
                      {b.review_rows}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono text-red-600 font-bold">
                      {b.failed_rows}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono font-bold text-emerald-800">
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
                        {/* View Details Button */}
                        <button
                          onClick={() => handleInspectBatch(b)}
                          className="px-2 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 hover:border-emerald-200 text-xs font-medium transition flex items-center gap-1 shadow-2xs"
                          title="ดูและแก้ไขรายละเอียดสินค้าในไฟล์นี้"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>ดูรายการ</span>
                        </button>

                        {/* Edit Batch Metadata Button */}
                        <button
                          onClick={() => handleOpenEditBatch(b)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-200 hover:border-blue-200 transition"
                          title="แก้ไขชื่อไฟล์ / หมวดแคตตาล็อก"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
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
                            title="Rollback ย้อนคืนราคาของ Batch นี้แบบ Real-time"
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
                          title="เคลียร์ / ลบประวัติรายการนี้ออกจากระบบจริง"
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

      {/* 1. Batch Details & Item Editing Modal */}
      {inspectBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
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
                    <span>เป้าหมาย: <strong className="text-slate-800">{inspectBatch.tier_name || inspectBatch.price_tier_id}</strong></span>
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

            {/* Modal Body - Rows Table with Edit & Delete Capability */}
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
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5">ลำดับ</th>
                      <th className="px-3 py-2.5">รหัสสินค้า (SKU)</th>
                      <th className="px-3 py-2.5">ชื่อสินค้า</th>
                      <th className="px-3 py-2.5 text-right">ราคาเดิม</th>
                      <th className="px-3 py-2.5 text-right font-bold text-emerald-800">ราคาใหม่</th>
                      <th className="px-3 py-2.5 text-center">สถานะ</th>
                      <th className="px-3 py-2.5">หมายเหตุ</th>
                      <th className="px-3 py-2.5 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspectRows.map((r, idx) => {
                      const isEditing = editingRowId === r.id;
                      return (
                        <tr key={r.id || idx} className="hover:bg-slate-50/70 transition">
                          <td className="px-3 py-2.5 font-mono text-slate-400">{r.row_number || idx + 1}</td>
                          
                          {/* SKU */}
                          <td className="px-3 py-2.5">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editSku}
                                onChange={(e) => setEditSku(e.target.value)}
                                className="px-2 py-1 bg-white border border-emerald-500 rounded font-mono font-bold text-slate-900 w-28 text-xs focus:outline-none"
                              />
                            ) : (
                              <span className="font-mono font-bold text-slate-900">{r.detected_sku}</span>
                            )}
                          </td>

                          {/* Product Name */}
                          <td className="px-3 py-2.5 text-slate-700 max-w-xs truncate">
                            {r.detected_product_name || '-'}
                          </td>

                          {/* Old Price */}
                          <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                            {r.old_price != null ? `฿${r.old_price.toLocaleString()}` : '-'}
                          </td>

                          {/* New Price */}
                          <td className="px-3 py-2.5 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="px-2 py-1 bg-white border border-emerald-500 rounded font-mono font-bold text-emerald-800 w-24 text-right text-xs focus:outline-none"
                              />
                            ) : (
                              <span className="font-mono font-bold text-emerald-700">
                                {r.new_price != null ? `฿${r.new_price.toLocaleString()}` : '-'}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2.5 text-center">
                            {isEditing ? (
                              <select
                                value={editStatus}
                                onChange={(e: any) => setEditStatus(e.target.value)}
                                className="px-1.5 py-1 bg-white border border-emerald-500 rounded text-[11px] font-bold text-slate-800 focus:outline-none"
                              >
                                <option value="PASS">PASS</option>
                                <option value="NEEDS_REVIEW">REVIEW</option>
                                <option value="FAILED">FAILED</option>
                              </select>
                            ) : (
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
                            )}
                          </td>

                          {/* Reason */}
                          <td className="px-3 py-2.5 text-slate-500 text-[11px] max-w-xs truncate">
                            {r.warning_reason || '-'}
                          </td>

                          {/* Row Actions */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveRow(r.id)}
                                    disabled={savingRowId === r.id}
                                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-2xs"
                                    title="บันทึกการแก้ไข"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingRowId(null)}
                                    className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition"
                                    title="ยกเลิก"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleStartEditRow(r)}
                                    className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-emerald-700 transition"
                                    title="แก้ไข SKU / ราคา / สถานะรายการนี้"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRow(r.id, r.detected_sku)}
                                    disabled={deletingRowId === r.id}
                                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                                    title="ลบรายการนี้ออกจากชุดนำเข้า"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                รวมทั้งหมด <strong>{inspectRows.length}</strong> รายการ (ผ่าน: {inspectRows.filter(r => r.validation_status === 'PASS').length})
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

      {/* 2. Edit Batch Metadata Modal */}
      {editingBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                แก้ไขข้อมูล Batch การนำเข้า
              </h3>
              <button
                onClick={() => setEditingBatch(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อไฟล์อ้างอิง</label>
              <input
                type="text"
                value={editBatchFilename}
                onChange={(e) => setEditBatchFilename(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">หมวดแคตตาล็อก</label>
              <select
                value={editBatchCatalogType}
                onChange={(e) => setEditBatchCatalogType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="all">🌐 สินค้าทั้งหมด</option>
                <option value="tuulo">🚪 แคตตาล็อกตู้โล</option>
                <option value="knockdown">🛏️ แคตตาล็อกน็อคดาวน์</option>
              </select>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t">
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveBatchMetadata}
                disabled={savingBatch || !editBatchFilename.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                {savingBatch ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข (Real-time)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
