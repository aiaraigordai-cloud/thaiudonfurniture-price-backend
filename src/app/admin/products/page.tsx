'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import QuickToolNav from '@/components/admin/QuickToolNav';
import { createClient } from '@supabase/supabase-js';
import { getThumbnailUrl } from '@/lib/r2';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Edit,
  ExternalLink,
  Layers,
  AlertCircle,
  Share2,
  Eye,
  X,
  Copy,
  Check,
  Coins,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckSquare,
  Square,
  Sparkles,
  Download,
  Camera,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';

export default function ProductsPage() {
  const downloadFile = (url: string, filename?: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || url.split('/').pop() || 'furniture-image';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [priceTiers, setPriceTiers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  // PAGINATION: 30 items per page by default to eliminate table lag & cut bandwidth
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);

  // 1. Image Preview Modal state
  const [previewProduct, setPreviewProduct] = useState<any | null>(null);
  const [previewPrimaryImgIdx, setPreviewPrimaryImgIdx] = useState(0);
  const [previewRefImgIdx, setPreviewRefImgIdx] = useState(0);
  const [previewActiveTab, setPreviewActiveTab] = useState<'primary' | 'ref'>('primary');

  // 2. Single Share Modal state
  const [shareProduct, setShareProduct] = useState<any | null>(null);
  const [shareTierId, setShareTierId] = useState('');
  const [shareCustomerName, setShareCustomerName] = useState('');
  const [shareExpiresDays, setShareExpiresDays] = useState('30');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareError, setShareError] = useState('');

  // 3. Multi-Product Share State (NEW FEATURE)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [multiShareModalOpen, setMultiShareModalOpen] = useState(false);
  const [multiShareTierId, setMultiShareTierId] = useState('');
  const [multiShareCustomerName, setMultiShareCustomerName] = useState('');
  const [multiShareExpiresDays, setMultiShareExpiresDays] = useState('30');
  const [multiGeneratingLink, setMultiGeneratingLink] = useState(false);
  const [multiGeneratedShareUrl, setMultiGeneratedShareUrl] = useState('');
  const [multiCopiedLink, setMultiCopiedLink] = useState(false);
  const [multiShareError, setMultiShareError] = useState('');

  // 3.1 Batch Move Category State
  const [moveCategoryModalOpen, setMoveCategoryModalOpen] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState('');
  const [targetCatalogType, setTargetCatalogType] = useState<'keep' | 'knockdown' | 'tuulo'>('keep');
  const [movingCategory, setMovingCategory] = useState(false);
  const [moveCategoryError, setMoveCategoryError] = useState('');

  // 4. Catalog Type Filter (all, tuulo, knockdown)
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<'all' | 'tuulo' | 'knockdown'>('all');
  const [catalogCounts, setCatalogCounts] = useState<{ all: number; tuulo: number; knockdown: number }>({
    all: 268,
    tuulo: 111,
    knockdown: 157,
  });

  // Reset pagination to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedStatus, catalogTypeFilter, pageSize]);

  // 5. Real-time Synchronization States
  const [realtimeUpdatedTime, setRealtimeUpdatedTime] = useState<string>('');
  const [showRealtimeToast, setShowRealtimeToast] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // 6. Reference Image Uploading State
  const [uploadingRefId, setUploadingRefId] = useState<string | null>(null);

  // 7. Real-time Quick Edit Modal State
  const [quickEditProduct, setQuickEditProduct] = useState<any | null>(null);
  const [quickEditSku, setQuickEditSku] = useState('');
  const [quickEditName, setQuickEditName] = useState('');
  const [quickEditCatalogType, setQuickEditCatalogType] = useState<'knockdown' | 'tuulo'>('knockdown');
  const [quickEditDescription, setQuickEditDescription] = useState('');
  const [quickEditCategoryId, setQuickEditCategoryId] = useState('');
  const [quickEditWidth, setQuickEditWidth] = useState('');
  const [quickEditHeight, setQuickEditHeight] = useState('');
  const [quickEditDepth, setQuickEditDepth] = useState('');
  const [quickEditColor, setQuickEditColor] = useState('');
  const [quickEditStatus, setQuickEditStatus] = useState('Published');
  const [quickEditSalePrice, setQuickEditSalePrice] = useState('');
  const [quickEditRetailPrice, setQuickEditRetailPrice] = useState('');
  const [quickEditVipPrice, setQuickEditVipPrice] = useState('');
  const [quickEditGeneralPrice, setQuickEditGeneralPrice] = useState('');
  const [quickEditPrimaryImages, setQuickEditPrimaryImages] = useState<string[]>([]);
  const [quickEditRefImages, setQuickEditRefImages] = useState<string[]>([]);
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditError, setQuickEditError] = useState('');
  const [quickEditUploadingPrimary, setQuickEditUploadingPrimary] = useState(false);
  const [quickEditUploadingRef, setQuickEditUploadingRef] = useState(false);

  // Dedicated Single Image Preview Modal State (เห็นเฉพาะรูปภาพนั้นๆ ที่กดดูเท่านั้น)
  const [singlePreviewImage, setSinglePreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // Top & Bottom Horizontal Scrollbars Sync Refs
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1250);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      if (Math.abs(tableScrollRef.current.scrollLeft - topScrollRef.current.scrollLeft) > 1) {
        tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      }
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      if (Math.abs(topScrollRef.current.scrollLeft - tableScrollRef.current.scrollLeft) > 1) {
        topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
      }
    }
  };

  // Helper to format product size consistently in "กว้าง x สูง x ลึก" while strictly preserving "ฟุต"
  const formatProductSizeDisplay = (prod: any) => {
    const rawSizeText = String(prod?.size_text || '').trim();
    if (rawSizeText && rawSizeText.includes('ฟุต')) {
      return rawSizeText;
    }
    if (prod?.width || prod?.height || prod?.depth) {
      return `กว้าง ${prod.width || '-'} x สูง ${prod.height || '-'} x ลึก ${prod.depth || '-'} ซม.`;
    }
    return rawSizeText || '';
  };

  const openSingleImagePreview = (url: string | null | undefined, title: string, subtitle?: string) => {
    if (!url) return;
    setSinglePreviewImage({ url, title, subtitle });
  };

  const uploadDirectToR2 = async (file: File, folder = 'uploads'): Promise<string> => {
    // 1. Try Direct Presigned PUT to Cloudflare R2
    try {
      const presignedRes = await fetch('/api/upload/r2-presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'image/jpeg',
          folder,
        }),
      });
      const presignedData = await presignedRes.json();
      if (presignedRes.ok && presignedData.uploadUrl) {
        const uploadRes = await fetch(presignedData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file,
        });
        if (uploadRes.ok) {
          return presignedData.publicUrl;
        }
      }
    } catch (e) {
      console.warn('Presigned R2 direct upload failed, attempting server relay fallback:', e);
    }

    // 2. High-reliability Server Relay Fallback (Bypasses any browser CORS restrictions)
    try {
      const compressedDataUrl = await compressImageToDataUrl(file, 1600, 1600, 0.88);
      const relayRes = await fetch('/api/upload/r2-presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: 'image/jpeg',
          folder,
          base64Data: compressedDataUrl,
        }),
      });
      const relayData = await relayRes.json();
      if (relayRes.ok && relayData.publicUrl) {
        return relayData.publicUrl;
      }
    } catch (relayErr) {
      console.warn('Server relay upload fallback failed:', relayErr);
    }

    // 3. Ultimate Fallback: compress to DataURL
    return await compressImageToDataUrl(file, 1200, 1200, 0.85);
  };

  const handleUploadQuickEditPrimaryFiles = async (files: FileList | File[]) => {
    try {
      setQuickEditUploadingPrimary(true);
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const r2Url = await uploadDirectToR2(file, 'primary');
          if (r2Url) newUrls.push(r2Url);
        } catch (err) {
          console.warn('Upload primary file failed:', file.name, err);
        }
      }
      if (newUrls.length > 0) {
        setQuickEditPrimaryImages((prev) => [...prev, ...newUrls]);
      }
    } catch {
      setQuickEditError('เกิดข้อผิดพลาดในการโหลดรูปภาพหลัก');
    } finally {
      setQuickEditUploadingPrimary(false);
    }
  };

  const handleUploadQuickEditRefFiles = async (files: FileList | File[]) => {
    try {
      setQuickEditUploadingRef(true);
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const r2Url = await uploadDirectToR2(file, 'ref');
          if (r2Url) newUrls.push(r2Url);
        } catch (err) {
          console.warn('Upload ref file failed:', file.name, err);
        }
      }
      if (newUrls.length > 0) {
        setQuickEditRefImages((prev) => [...prev, ...newUrls]);
      }
    } catch {
      setQuickEditError('เกิดข้อผิดพลาดในการโหลดภาพอ้างอิง');
    } finally {
      setQuickEditUploadingRef(false);
    }
  };

  const handleRemoveQuickEditPrimaryAt = (idx: number) => {
    setQuickEditPrimaryImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveQuickEditRefAt = (idx: number) => {
    setQuickEditRefImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleClearAllQuickEditPrimary = () => {
    setQuickEditPrimaryImages([]);
  };

  const handleClearAllQuickEditRef = () => {
    setQuickEditRefImages([]);
  };

  const openQuickEditModal = (prod: any) => {
    setQuickEditProduct(prod);
    setQuickEditSku(prod.sku || '');
    setQuickEditName(prod.name || '');
    setQuickEditDescription(prod.description || '');
    setQuickEditCategoryId(prod.category_id || '');
    setQuickEditWidth(prod.width ? String(prod.width) : '');
    setQuickEditHeight(prod.height ? String(prod.height) : '');
    setQuickEditDepth(prod.depth ? String(prod.depth) : '');
    const isTuulo = prod.catalog_type === 'tuulo' || prod.catalogType === 'tuulo';
    setQuickEditCatalogType(isTuulo ? 'tuulo' : 'knockdown');
    setQuickEditColor(isTuulo ? 'ตามภาพ' : (prod.color || ''));
    setQuickEditStatus(prod.status || 'Published');

    const p = prod.prices || {};
    setQuickEditSalePrice(p.SALE_PRICE !== undefined && p.SALE_PRICE !== null ? String(p.SALE_PRICE) : '');
    setQuickEditRetailPrice(p.RETAIL_PRICE !== undefined && p.RETAIL_PRICE !== null ? String(p.RETAIL_PRICE) : '');
    setQuickEditVipPrice(p.VIP_PRICE !== undefined && p.VIP_PRICE !== null ? String(p.VIP_PRICE) : '');
    setQuickEditGeneralPrice(p.GENERAL_PRICE !== undefined && p.GENERAL_PRICE !== null ? String(p.GENERAL_PRICE) : '');

    // Extract all primary images
    const mainImagesList: string[] = [];
    if (Array.isArray(prod.images)) {
      prod.images.forEach((img: string) => {
        if (img && typeof img === 'string' && img.trim() && !mainImagesList.includes(img.trim())) {
          mainImagesList.push(img.trim());
        }
      });
    } else if (prod.primary_image_url) {
      mainImagesList.push(prod.primary_image_url);
    }
    setQuickEditPrimaryImages(mainImagesList);

    // Extract all ref images
    const refImagesList: string[] = [];
    if (Array.isArray(prod.ref_images)) {
      prod.ref_images.forEach((img: string) => {
        if (img && typeof img === 'string' && img.trim() && !refImagesList.includes(img.trim())) {
          refImagesList.push(img.trim());
        }
      });
    } else if (prod.ref_image_url) {
      refImagesList.push(prod.ref_image_url);
    }
    setQuickEditRefImages(refImagesList);

    setQuickEditError('');
  };

  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEditProduct) return;
    if (!quickEditSku.trim()) {
      setQuickEditError('กรุณาระบุรหัสสินค้า (SKU)');
      return;
    }
    setQuickEditSaving(true);
    setQuickEditError('');

    const prices: Record<string, number> = {
      SALE_PRICE: quickEditSalePrice ? parseFloat(quickEditSalePrice) : 0,
      RETAIL_PRICE: quickEditRetailPrice ? parseFloat(quickEditRetailPrice) : 0,
      VIP_PRICE: quickEditVipPrice ? parseFloat(quickEditVipPrice) : 0,
      GENERAL_PRICE: quickEditGeneralPrice ? parseFloat(quickEditGeneralPrice) : 0,
    };

    const images = quickEditPrimaryImages.filter((img) => img && typeof img === 'string' && img.trim());
    const ref_images = quickEditRefImages.filter((img) => img && typeof img === 'string' && img.trim());

    const isTuuloProduct = quickEditCatalogType === 'tuulo';
    const finalProductColor = isTuuloProduct ? 'ตามภาพ' : (quickEditColor ? quickEditColor.trim() : null);
    const updatedSku = quickEditSku.trim();

    try {
      const res = await fetch(`/api/products/${quickEditProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: updatedSku,
          name: quickEditName.trim(),
          catalog_type: quickEditCatalogType,
          description: quickEditDescription.trim(),
          category_id: quickEditCategoryId || null,
          width: quickEditWidth ? parseFloat(quickEditWidth) : null,
          height: quickEditHeight ? parseFloat(quickEditHeight) : null,
          depth: quickEditDepth ? parseFloat(quickEditDepth) : null,
          color: finalProductColor,
          status: quickEditStatus,
          images,
          ref_images,
          ref_image_url: ref_images.length > 0 ? ref_images[0] : null,
          prices,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setQuickEditError(data.error || 'แก้ไขสินค้าไม่สำเร็จ');
      } else {
        // Optimistic in-place update for instant UI feedback
        const newW = quickEditWidth ? parseFloat(quickEditWidth) : null;
        const newH = quickEditHeight ? parseFloat(quickEditHeight) : null;
        const newD = quickEditDepth ? parseFloat(quickEditDepth) : null;

        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== quickEditProduct.id) return p;
            const cat = categories.find((c) => c.id === quickEditCategoryId);
            const hasFeet = String(p.size_text || '').includes('ฟุต');
            const updatedSizeText =
              data.size_text ||
              (!hasFeet && (newW || newH || newD)
                ? `กว้าง ${newW || '-'} x สูง ${newH || '-'} x ลึก ${newD || '-'} ซม.`
                : p.size_text);

            return {
              ...p,
              sku: updatedSku,
              name: quickEditName.trim(),
              catalog_type: quickEditCatalogType,
              catalogType: quickEditCatalogType,
              description: quickEditDescription.trim(),
              category_id: quickEditCategoryId || null,
              category_name: cat ? cat.name : p.category_name,
              width: newW,
              height: newH,
              depth: newD,
              size_text: updatedSizeText,
              color: finalProductColor,
              status: quickEditStatus,
              ref_image_url: ref_images.length > 0 ? ref_images[0] : null,
              ref_images,
              images,
              primary_image_url: images.length > 0 ? images[0] : null,
              prices,
            };
          })
        );

        setActionMsg(`✅ แก้ไขข้อมูลสินค้า ${updatedSku} สำเร็จแบบ Real-time`);
        setQuickEditProduct(null);

        // Multi-channel Real-time broadcast
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({
              type: 'PRODUCTS_UPDATED',
              productId: quickEditProduct.id,
              timestamp: Date.now(),
            });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            localStorage.setItem('thaiudon_product_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
          } catch {}
        }
      }
    } catch {
      setQuickEditError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setQuickEditSaving(false);
    }
  };

  const compressImageToDataUrl = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUploadRefImage = async (productId: string, file?: File) => {
    if (!file) return;
    setUploadingRefId(productId);
    setActionMsg('');

    try {
      let r2Url = '';
      try {
        r2Url = await uploadDirectToR2(file, 'ref');
      } catch {
        r2Url = await compressImageToDataUrl(file, 1200, 1200, 0.85);
      }

      const res = await fetch(`/api/products/${productId}/ref-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: r2Url,
          filename: file.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'อัปโหลดภาพอ้างอิงไม่สำเร็จ');
      } else {
        const finalUrl = data.ref_image_url || r2Url;
        // Real-time optimistic update in product state
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== productId) return p;
            const updatedImages = [finalUrl, ...(p.images || []).filter((img: string) => img !== finalUrl)];
            return {
              ...p,
              ref_image_url: finalUrl,
              ref_filename: file.name,
              images: updatedImages,
            };
          })
        );

        if (previewProduct && previewProduct.id === productId) {
          setPreviewProduct((prev: any) => ({
            ...prev,
            ref_image_url: finalUrl,
            ref_filename: file.name,
            images: [finalUrl, ...(prev.images || []).filter((img: string) => img !== finalUrl)],
          }));
        }

        setActionMsg(`📸 อัปโหลดภาพอ้างอิง (${file.name}) สำเร็จแบบ Real-time`);

        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRODUCTS_UPDATED', timestamp: Date.now() });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
          } catch {}
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('เกิดข้อผิดพลาดในการอัปโหลดภาพอ้างอิง');
    } finally {
      setUploadingRefId(null);
    }
  };

  const handleDeleteRefImage = async (productId: string) => {
    if (!confirm('ยืนยันการลบภาพอ้างอิงจริงของสินค้านี้?')) return;
    try {
      const res = await fetch(`/api/products/${productId}/ref-image`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('🗑️ ลบภาพอ้างอิงสำเร็จแบบ Real-time');
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== productId) return p;
            return {
              ...p,
              ref_image_url: null,
              ref_filename: null,
              images: (p.images || []).filter((img: string) => !img.includes('/ref/') && !img.startsWith('data:image')),
            };
          })
        );
        if (previewProduct && previewProduct.id === productId) {
          setPreviewProduct((prev: any) => ({
            ...prev,
            ref_image_url: null,
            ref_filename: null,
            images: (prev.images || []).filter((img: string) => !img.includes('/ref/') && !img.startsWith('data:image')),
          }));
          setPreviewRefImgIdx(0);
        }
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRODUCTS_UPDATED', timestamp: Date.now() });
          } catch {}
        }
      } else {
        alert(data.error || 'ลบภาพอ้างอิงไม่สำเร็จ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const loadProducts = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsSyncing(true);

    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedStatus && !['price_incomplete', 'image_incomplete', 'price_complete', 'image_complete'].includes(selectedStatus)) {
        params.append('status', selectedStatus);
      }
      if (catalogTypeFilter !== 'all') params.append('catalog_type', catalogTypeFilter);

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        if (data.counts) {
          setCatalogCounts(data.counts);
        }
        if (data.priceTiers) {
          setPriceTiers(data.priceTiers);
          if (!shareTierId && data.priceTiers.length > 0) {
            setShareTierId(data.priceTiers[0].id);
          }
          if (!multiShareTierId && data.priceTiers.length > 0) {
            setMultiShareTierId(data.priceTiers[0].id);
          }
        }
        setRealtimeUpdatedTime(new Date().toLocaleTimeString('th-TH'));
        if (silent) {
          setShowRealtimeToast(true);
          setTimeout(() => setShowRealtimeToast(false), 3500);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, selectedCategory, selectedStatus, catalogTypeFilter]);

  // Multi-layer Real-time Sync Listeners: BroadcastChannel, Storage, CustomEvent, Focus & Polling
  useEffect(() => {
    // 1. BroadcastChannel across open browser tabs
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('thaiudon_sync_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'PRICES_UPDATED' || event.data?.type === 'PRODUCTS_UPDATED') {
          loadProducts(true);
        }
      };
    } catch {}

    // 2. Storage Event (across tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'thaiudon_last_sync') {
        loadProducts(true);
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Custom Window Event
    const handleCustomSync = () => loadProducts(true);
    window.addEventListener('thaiudon_catalog_sync', handleCustomSync);

    // 4. Focus Event
    const handleFocus = () => {
      checkSyncToken();
    };
    window.addEventListener('focus', handleFocus);

    // 5. Lightweight Polling relaxed to 45s (Supabase Realtime WebSocket handles instantaneous 0.5s updates)
    let currentToken = '';
    const checkSyncToken = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/products/sync-status');
        const data = await res.json();
        if (data.success) {
          if (data.counts) {
            setCatalogCounts(data.counts);
          }
          if (currentToken && currentToken !== data.syncToken) {
            loadProducts(true);
          }
          currentToken = data.syncToken;
        }
      } catch {}
    };

    const interval = setInterval(checkSyncToken, 45000);

    // 6. Supabase Realtime WebSocket (Instant live sync across all devices/sessions)
    let realtimeChannel: any = null;
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        realtimeChannel = supabase
          .channel('admin-products-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
            loadProducts(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'product_prices' }, () => {
            loadProducts(true);
          })
          .subscribe();
      }
    } catch (e) {
      console.warn('Admin Supabase Realtime subscription error:', e);
    }

    return () => {
      if (bc) bc.close();
      if (realtimeChannel) realtimeChannel.unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('thaiudon_catalog_sync', handleCustomSync);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [search, selectedCategory, selectedStatus, catalogTypeFilter]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.categories || []);
      });
  }, []);

  // Measure table scrollWidth so top horizontal scrollbar matches exact table width
  useEffect(() => {
    const updateWidth = () => {
      if (tableRef.current) {
        const w = Math.max(tableRef.current.scrollWidth, 1200);
        setTableScrollWidth(w);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [products, loading, selectedCategory, selectedStatus, catalogTypeFilter, search]);

  const handleDelete = async (id: string) => {
    const targetProd = products.find((p) => p.id === id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        // Optimistic real-time removal from state & catalog counts
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setCatalogCounts((prev) => {
          const isTuulo = targetProd?.catalog_type === 'tuulo';
          const isKd = targetProd?.catalog_type === 'knockdown';
          return {
            all: Math.max(0, prev.all - 1),
            tuulo: isTuulo ? Math.max(0, prev.tuulo - 1) : prev.tuulo,
            knockdown: isKd ? Math.max(0, prev.knockdown - 1) : prev.knockdown,
          };
        });
        setActionMsg(`🗑️ ลบสินค้า ${targetProd?.sku ? `(${targetProd.sku}) ` : ''}ออกจากระบบสำเร็จแบบ Real-time`);
        setDeleteConfirmId(null);
        if (previewProduct?.id === id) setPreviewProduct(null);
        if (quickEditProduct?.id === id) setQuickEditProduct(null);
        setSelectedProductIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        // Multi-channel Real-time broadcast
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({
              type: 'PRODUCTS_UPDATED',
              action: 'DELETE_PRODUCT',
              productId: id,
              timestamp: Date.now(),
            });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            localStorage.setItem('thaiudon_product_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
          } catch {}
        }

        loadProducts(true);
      } else {
        alert(data.error || 'ลบไม่สำเร็จ');
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการลบสินค้า');
    }
  };

  // Check if 4 prices are incomplete
  const checkPriceIncomplete = (prod: any) => {
    const p = prod.prices || {};
    const s = Number(p.SALE_PRICE) || 0;
    const r = Number(p.RETAIL_PRICE) || 0;
    const v = Number(p.VIP_PRICE) || 0;
    const g = Number(p.GENERAL_PRICE) || 0;
    return s <= 0 || r <= 0 || v <= 0 || g <= 0;
  };

  // Check if images are incomplete: "ในกรณีที่ขาดรูปภาพอ้างอิงหรือสินค้าหลัก อย่างใดอย่างหนึ่ง"
  const checkImageIncomplete = (prod: any) => {
    const hasRef = Boolean(
      prod.ref_image_url ||
      (prod.images && prod.images.some((img: string) => img.includes('/ref/') || img.startsWith('data:image')))
    );
    const hasPrimary = Boolean(
      (prod.images && prod.images.some((img: string) => img !== prod.ref_image_url && !img.includes('/ref/'))) ||
      prod.graphic_filename
    );
    return !hasRef || !hasPrimary;
  };

  const countPriceIncomplete = products.filter(checkPriceIncomplete).length;
  const countImageIncomplete = products.filter(checkImageIncomplete).length;

  // Check if search matches price in any of the 4 price tiers
  const checkPriceMatch = (prod: any, q: string) => {
    const raw = q.trim();
    const cleanDigits = raw.replace(/[,฿\s\.\-]/g, '');
    if (!cleanDigits) return false;
    const prices = prod.prices || {};
    return Object.values(prices).some((val: any) => {
      if (val === undefined || val === null) return false;
      const num = Number(val) || 0;
      if (num <= 0) return false;
      const str = String(num);
      const roundStr = String(Math.round(num));
      const formatted = num.toLocaleString();
      return str.includes(cleanDigits) || roundStr.includes(cleanDigits) || formatted.includes(raw) || str === cleanDigits;
    });
  };

  const displayedProducts = products.filter((prod) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchText =
        (prod.sku && prod.sku.toLowerCase().includes(q)) ||
        (prod.name && prod.name.toLowerCase().includes(q)) ||
        (prod.description && prod.description.toLowerCase().includes(q)) ||
        checkPriceMatch(prod, q);
      if (!matchText) return false;
    }

    if (selectedStatus === 'price_incomplete') {
      return checkPriceIncomplete(prod);
    }
    if (selectedStatus === 'image_incomplete') {
      return checkImageIncomplete(prod);
    }
    if (selectedStatus === 'price_complete') {
      return !checkPriceIncomplete(prod);
    }
    if (selectedStatus === 'image_complete') {
      return !checkImageIncomplete(prod);
    }
    return true;
  });

  // Calculate Pagination Slices
  const totalPages = Math.max(1, Math.ceil(displayedProducts.length / (pageSize || 1)));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * (pageSize || displayedProducts.length);
  const paginatedProducts = pageSize === 0 ? displayedProducts : displayedProducts.slice(startIndex, startIndex + pageSize);

  // Open Complete Product Details Modal (พร้อมแท็บสลับรูปทีละรูป และปุ่มเลื่อน)
  const openProductDetailsModal = (prod: any, tab: 'primary' | 'ref' = 'primary') => {
    setPreviewProduct(prod);
    setPreviewActiveTab(tab);
    setPreviewPrimaryImgIdx(0);
    setPreviewRefImgIdx(0);
  };

  // Open Preview Modal (แสดงเฉพาะรูปภาพนั้นๆ ที่กดดูเท่านั้น)
  const openImagePreview = (prod: any, imgIdx = 0) => {
    if (!prod) return;
    const isRef = imgIdx === 1 && prod.ref_image_url;
    const url = isRef ? prod.ref_image_url : (prod.images?.[imgIdx] || prod.primary_image_url || (prod.images && prod.images[0]));
    const subtitle = isRef ? 'ภาพอ้างอิงจริง (Reference / Dicut)' : prod.name;
    openSingleImagePreview(url, prod.sku, subtitle);
  };

  // Open Quick Share Modal (Single)
  const openQuickShare = (prod: any) => {
    setShareProduct(prod);
    setGeneratedShareUrl('');
    setShareError('');
    setCopiedLink(false);
    setShareCustomerName('');
    if (priceTiers.length > 0 && !shareTierId) {
      setShareTierId(priceTiers[0].id);
    }
  };

  // Handle Single Product Share Link
  const handleGenerateSingleShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareProduct || !shareTierId) return;

    setGeneratingLink(true);
    setShareError('');

    try {
      const res = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharing_mode: 'SINGLE_PRODUCT',
          price_tier_id: shareTierId,
          product_ids: [shareProduct.id],
          customer_name: shareCustomerName || `ลูกค้าสำหรับ ${shareProduct.sku}`,
          expires_days: shareExpiresDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setShareError(data.error || 'ไม่สามารถสร้างลิงก์ได้');
      } else {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const fullUrl = `${origin}${data.url}`;
        setGeneratedShareUrl(fullUrl);
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('share_links_channel');
            bc.postMessage({ type: 'LINK_CREATED' });
            localStorage.setItem('thaiudon_share_link_sync', Date.now().toString());
          } catch {}
        }
      }
    } catch {
      setShareError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyShareLink = () => {
    if (!generatedShareUrl) return;
    navigator.clipboard.writeText(generatedShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Toggle selection for multiple products
  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.size === products.length && products.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      const allIds = new Set(products.map((p) => p.id));
      setSelectedProductIds(allIds);
    }
  };

  // Open Multi-Product Share Modal
  const openMultiShareModal = () => {
    if (selectedProductIds.size === 0) return;
    setMultiGeneratedShareUrl('');
    setMultiShareError('');
    setMultiCopiedLink(false);
    setMultiShareCustomerName('');
    if (priceTiers.length > 0 && !multiShareTierId) {
      setMultiShareTierId(priceTiers[0].id);
    }
    setMultiShareModalOpen(true);
  };

  // Handle Generate Multi-Product Share Link
  const handleGenerateMultiShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductIds.size === 0 || !multiShareTierId) return;

    setMultiGeneratingLink(true);
    setMultiShareError('');

    try {
      const res = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharing_mode: 'MULTIPLE_PRODUCTS',
          price_tier_id: multiShareTierId,
          product_ids: Array.from(selectedProductIds),
          customer_name: multiShareCustomerName || `ชุดสินค้าที่เลือก (${selectedProductIds.size} รายการ)`,
          expires_days: multiShareExpiresDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMultiShareError(data.error || 'ไม่สามารถสร้างลิงก์ได้');
      } else {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const fullUrl = `${origin}${data.url}`;
        setMultiGeneratedShareUrl(fullUrl);
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('share_links_channel');
            bc.postMessage({ type: 'LINK_CREATED' });
            localStorage.setItem('thaiudon_share_link_sync', Date.now().toString());
          } catch {}
        }
      }
    } catch {
      setMultiShareError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setMultiGeneratingLink(false);
    }
  };

  const copyMultiShareLink = () => {
    if (!multiGeneratedShareUrl) return;
    navigator.clipboard.writeText(multiGeneratedShareUrl);
    setMultiCopiedLink(true);
    setTimeout(() => setMultiCopiedLink(false), 2000);
  };

  const openMoveCategoryModal = () => {
    if (selectedProductIds.size === 0) {
      alert('กรุณาเลือกรายการสินค้าที่ต้องการย้ายหมวดหมู่ก่อนครับ');
      return;
    }
    setMoveCategoryError('');
    setTargetCatalogType('keep');
    if (!targetCategoryId && categories.length > 0) {
      setTargetCategoryId(categories[0].id);
    }
    setMoveCategoryModalOpen(true);
  };

  const handleBatchMoveCategory = async () => {
    if (selectedProductIds.size === 0 || !targetCategoryId) {
      setMoveCategoryError('กรุณาเลือกหมวดหมู่ปลายทางที่ต้องการย้าย');
      return;
    }

    setMovingCategory(true);
    setMoveCategoryError('');

    try {
      const selectedIds = Array.from(selectedProductIds);
      const res = await fetch('/api/products/batch-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_ids: selectedIds,
          category_id: targetCategoryId,
          catalog_type: targetCatalogType !== 'keep' ? targetCatalogType : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMoveCategoryError(data.error || 'ย้ายหมวดหมู่ไม่สำเร็จ');
      } else {
        const targetCat = categories.find((c) => c.id === targetCategoryId);
        const targetCatName = targetCat?.name || data.category_name || 'หมวดหมู่ที่เลือก';

        // 1. Optimistic in-place update for instant UI response in admin
        setProducts((prev) =>
          prev.map((p) => {
            if (selectedProductIds.has(p.id)) {
              return {
                ...p,
                category_id: targetCategoryId,
                category_name: targetCatName,
                ...(targetCatalogType !== 'keep'
                  ? {
                      catalog_type: targetCatalogType,
                      catalogType: targetCatalogType,
                      ...(targetCatalogType === 'tuulo' ? { color: 'ตามภาพ' } : {}),
                    }
                  : {}),
              };
            }
            return p;
          })
        );

        const catalogLabel =
          targetCatalogType === 'tuulo'
            ? ' (และย้ายเข้าประเภทตู้โล)'
            : targetCatalogType === 'knockdown'
            ? ' (และย้ายเข้าประเภทน็อคดาวน์)'
            : '';
        setActionMsg(`✅ ย้ายสินค้า ${selectedIds.length} รายการไปยังหมวดหมู่ "${targetCatName}"${catalogLabel} สำเร็จแล้วแบบ Real-time`);

        // 2. Multi-channel Real-time broadcast for open tabs and customer share links
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({
              type: 'PRODUCTS_UPDATED',
              action: 'BATCH_MOVE_CATEGORY',
              product_ids: selectedIds,
              category_id: targetCategoryId,
              category_name: targetCatName,
              catalog_type: targetCatalogType !== 'keep' ? targetCatalogType : undefined,
              timestamp: Date.now(),
            });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            localStorage.setItem('thaiudon_product_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
          } catch {}
        }

        // 3. Close modal and clear selection
        setMoveCategoryModalOpen(false);
        setSelectedProductIds(new Set());

        // 4. Background re-fetch to ensure total server sync
        loadProducts(true);
      }
    } catch {
      setMoveCategoryError('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setMovingCategory(false);
    }
  };

  const selectedProductsList = products.filter((p) => selectedProductIds.has(p.id));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Quick Tool Navigation (Linked Across All Admin Tools) */}
      <QuickToolNav activeTab="products" subtitle="จัดการข้อมูลสินค้า แคตตาล็อก รูปภาพหลัก และภาพอ้างอิงจริง ซิงค์เรียลไทม์กับทุกเครื่องมือ" onRefresh={() => loadProducts(false)} />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#402E20] tracking-tight">ระบบจัดการสินค้า (Product Catalog)</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Real-time {realtimeUpdatedTime ? `(${realtimeUpdatedTime})` : ''}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#C5A059]/20 text-[#805216] text-[10px] font-bold border border-[#D2B681]">
              Multi-Product Sharing
            </span>
          </div>
          <p className="text-xs text-[#705E4F] mt-0.5">
            เลือกสินค้าหลายรายการเพื่อสร้างลิงก์แชร์ชุดสินค้า เลือกระดับราคาที่ต้องการส่งให้ลูกค้า พร้อมพรีวิวรูปภาพ
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Trigger Button for Batch Move Category */}
          {selectedProductIds.size > 0 && (
            <button
              onClick={openMoveCategoryModal}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition animate-in fade-in cursor-pointer"
              title="ย้ายหมวดหมู่สินค้าที่เลือกไปยังหมวดหมู่อื่น"
            >
              <Layers className="w-4 h-4" />
              <span>ย้ายหมวดหมู่ ({selectedProductIds.size})</span>
            </button>
          )}

          {/* Quick Trigger Button for Multi Share */}
          {selectedProductIds.size > 0 && (
            <button
              onClick={openMultiShareModal}
              className="px-4 py-2 bg-gradient-to-r from-[#C5A059] to-[#BB9251] hover:from-[#BB9251] hover:to-[#A67D3D] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition animate-in fade-in cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>แชร์ {selectedProductIds.size} รายการ</span>
            </button>
          )}

          <button
            onClick={() => loadProducts(false)}
            disabled={loading || isSyncing}
            className="p-2.5 bg-white hover:bg-[#FFFAF3] text-[#402E20] border border-[#D2B681] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            title="รีเฟรชข้อมูลแบบ Real-time"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#805216] ${(loading || isSyncing) ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/admin/categories"
            className="px-3.5 py-2 bg-white hover:bg-[#FFFAF3] text-[#402E20] border border-[#D2B681] rounded-xl text-xs font-semibold flex items-center gap-2 transition"
          >
            <Layers className="w-4 h-4 text-[#805216]" />
            จัดการหมวดหมู่
          </Link>
          <Link
            href="/admin/products/new"
            className="px-4 py-2 bg-[#402E20] hover:bg-[#2E2015] text-[#FFFAF3] rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            เพิ่มสินค้าใหม่
          </Link>
        </div>
      </div>

      {/* Real-time sync notification toast */}
      {showRealtimeToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-950 text-white text-xs rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-500/50 animate-in fade-in slide-in-from-bottom-5">
          <Sparkles className="w-5 h-5 text-emerald-400 animate-spin flex-shrink-0" />
          <div>
            <div className="font-bold text-emerald-200">⚡ ระบบซิงค์ข้อมูลล่าสุดแบบ Real-time แล้ว</div>
            <div className="text-[11px] text-slate-300">ตรวจพบการอัปเดตราคาหรือสินค้าชุดใหม่ในระบบ ({products.length} รายการ)</div>
          </div>
        </div>
      )}

      {actionMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="text-emerald-900 font-bold text-xs">✕</button>
        </div>
      )}

      {/* Catalog Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => { setCatalogTypeFilter('all'); setSelectedCategory(''); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs whitespace-nowrap ${
            catalogTypeFilter === 'all'
              ? 'bg-[#161B40] text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>สินค้าทั้งหมด ({catalogCounts.all} รายการ)</span>
        </button>

        <button
          onClick={() => { setCatalogTypeFilter('tuulo'); setSelectedCategory(''); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs whitespace-nowrap ${
            catalogTypeFilter === 'tuulo'
              ? 'bg-[#DE1B23] text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <span>แคตตาล็อกตู้โล ({catalogCounts.tuulo} รายการ)</span>
        </button>

        <button
          onClick={() => { setCatalogTypeFilter('knockdown'); setSelectedCategory(''); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs whitespace-nowrap ${
            catalogTypeFilter === 'knockdown'
              ? 'bg-[#DE1B23] text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <span>แคตตาล็อกน็อคดาวน์ ({catalogCounts.knockdown} รายการ)</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-[#D2B681] shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-[#805216] absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาด้วย SKU, ชื่อสินค้า, รายละเอียด หรือค้นหาด้วยราคา (เช่น 2500, 1500)..."
            className="w-full pl-10 pr-4 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059] transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
          >
            <option value="">ทุกหมวดหมู่ ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
          >
            <option value="">ทุกสถานะ ({products.length})</option>
            <option value="Published">Published (เผยแพร่)</option>
            <option value="Draft">Draft (ร่าง)</option>
            <option value="Archived">Archived (เก็บถาวร)</option>
            <option value="price_incomplete">⚠️ ราคาไม่ครบ ({countPriceIncomplete})</option>
            <option value="image_incomplete">📷 รูปภาพไม่ครบ ({countImageIncomplete})</option>
            <option value="price_complete">✓ ราคาครบ</option>
            <option value="image_complete">✓ รูปภาพครบ</option>
          </select>
        </div>
      </div>

      {/* Quick Status Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#705E4F]">ตัวกรองสถานะด่วน:</span>
        <button
          onClick={() => setSelectedStatus(selectedStatus === 'price_incomplete' ? '' : 'price_incomplete')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
            selectedStatus === 'price_incomplete'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
          }`}
        >
          <span>⚠️ ราคาไม่ครบ</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200/80 text-amber-950 font-mono">
            {countPriceIncomplete}
          </span>
        </button>

        <button
          onClick={() => setSelectedStatus(selectedStatus === 'image_incomplete' ? '' : 'image_incomplete')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
            selectedStatus === 'image_incomplete'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
          }`}
        >
          <span>📷 รูปภาพไม่ครบ</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200/80 text-rose-950 font-mono">
            {countImageIncomplete}
          </span>
        </button>

        {selectedStatus && (
          <button
            onClick={() => setSelectedStatus('')}
            className="text-xs text-slate-500 hover:text-slate-800 underline ml-2 font-medium"
          >
            ล้างตัวกรองสถานะ
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#D2B681] shadow-xs overflow-hidden">
        {/* TOP HORIZONTAL SCROLLBAR (แถบเลื่อนซ้าย-ขวาด้านบนตารางสินค้า) */}
        <div className="bg-[#FFFAF3] border-b border-[#D2B681]/60 px-3 pt-2 pb-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#805216] mb-1">
            <span>↔️ แถบเลื่อนตารางสินค้าด้านบน (เลื่อนซ้าย-ขวาได้ทันที)</span>
            <span className="text-[#705E4F] font-normal">แสดง {displayedProducts.length} รายการ</span>
          </div>
          <div
            ref={topScrollRef}
            onScroll={handleTopScroll}
            className="overflow-x-auto overflow-y-hidden h-3.5 rounded-lg bg-[#F3E8D6]/60"
          >
            <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
          </div>
        </div>

        <div
          ref={tableScrollRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto"
        >
          <table ref={tableRef} className="w-full min-w-[1200px] text-left text-xs">
            <thead className="bg-[#FFFAF3] text-[#705E4F] uppercase font-bold border-b border-[#D2B681]">
              <tr>
                {/* SELECT ALL CHECKBOX */}
                <th className="px-4 py-3.5 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-[#805216] focus:ring-[#C5A059] border-[#D2B681] rounded cursor-pointer"
                    title="เลือกทั้งหมด"
                  />
                </th>
                <th className="px-4 py-3.5">SKU & รูปภาพ (คลิกพรีวิว)</th>
                <th className="px-4 py-3.5">ชื่อสินค้า & ขนาด</th>
                <th className="px-4 py-3.5">หมวดหมู่</th>
                <th className="px-3 py-3.5 text-right text-red-700">ราคาเซลล์</th>
                <th className="px-3 py-3.5 text-right text-blue-700">ราคาปลีก</th>
                <th className="px-3 py-3.5 text-right text-purple-700">ราคา VIP</th>
                <th className="px-3 py-3.5 text-right text-slate-800">ราคาทั่วไป</th>
                <th className="px-3 py-3.5 text-center">สถานะ</th>
                <th className="px-5 py-3.5 text-right">แชร์ & จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D2B681]/30">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#705E4F]">
                    <span className="inline-block w-5 h-5 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin mb-2"></span>
                    <div>กำลังโหลดข้อมูลสินค้า...</div>
                  </td>
                </tr>
              ) : displayedProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#705E4F]">
                    ไม่พบรายการสินค้าที่ค้นหา หรือตรงตามตัวกรองสถานะ
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((prod) => {
                  const isChecked = selectedProductIds.has(prod.id);
                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-[#FFFAF3]/80 transition group ${
                        isChecked ? 'bg-[#FFFAF3] font-medium' : ''
                      }`}
                    >
                      {/* ROW CHECKBOX */}
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectProduct(prod.id)}
                          className="w-4 h-4 text-[#805216] focus:ring-[#C5A059] border-[#D2B681] rounded cursor-pointer"
                        />
                      </td>

                      {/* Thumbnail with Click to Preview Image */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => openProductDetailsModal(prod, 'primary')}
                            className="relative w-12 h-12 rounded-xl bg-white border border-[#D2B681] overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#C5A059]/60 transition flex-shrink-0 group/img shadow-2xs"
                            title="คลิกเพื่อดูรายละเอียดสินค้าและรูปภาพพรีวิวอย่างครบถ้วน"
                          >
                            {prod.images && prod.images[0] ? (
                              <img
                                src={getThumbnailUrl(prod.images[0]) || prod.images[0]}
                                alt={prod.name}
                                className="w-full h-full object-cover group-hover/img:scale-110 transition duration-200"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#705E4F]">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-[#402E20]/50 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>

                          <div>
                            <div className="font-mono font-bold text-[#161B40] flex items-center gap-1.5">
                              <button
                                onClick={() => openProductDetailsModal(prod, 'primary')}
                                className="hover:text-[#C5A059] transition hover:underline text-left cursor-pointer"
                                title="คลิกเพื่อดูรายละเอียดสินค้าและรูปภาพพรีวิว"
                              >
                                {prod.sku}
                              </button>
                              {prod.catalog_type === 'tuulo' ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  ตู้โล
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                  น็อคดาวน์
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <button
                                onClick={() => openProductDetailsModal(prod, 'primary')}
                                className="text-[10px] text-red-600 hover:text-red-700 font-bold flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3 text-red-600" />
                                <span>ดูรูปภาพ{prod.images && prod.images.length > 1 ? ` (${prod.images.length})` : ''}</span>
                              </button>
                              <span className="text-slate-300 text-[10px]">•</span>
                              <button
                                onClick={() => {
                                  if (prod.ref_image_url || (prod.ref_images && prod.ref_images.length > 0)) {
                                    openProductDetailsModal(prod, 'ref');
                                  } else {
                                    alert('สินค้านี้ยังไม่มีภาพอ้างอิงจริง (สามารถเพิ่มได้ในปุ่ม "แก้ไขสินค้าแบบ Real-time")');
                                  }
                                }}
                                className={`text-[10px] font-bold flex items-center gap-1 transition ${
                                  prod.ref_image_url || (prod.ref_images && prod.ref_images.length > 0)
                                    ? 'text-amber-700 hover:text-amber-800'
                                    : 'text-slate-400 hover:text-slate-500'
                                }`}
                                title={prod.ref_image_url || (prod.ref_images && prod.ref_images.length > 0) ? 'คลิกเพื่อดูรูปภาพอ้างอิงจริง' : 'ยังไม่มีภาพอ้างอิงจริง'}
                              >
                                <Eye className={`w-3 h-3 ${prod.ref_image_url || (prod.ref_images && prod.ref_images.length > 0) ? 'text-amber-600' : 'text-slate-400'}`} />
                                <span>ภาพอ้างอิง{prod.ref_images && prod.ref_images.length > 1 ? ` (${prod.ref_images.length})` : ''}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-semibold text-[#161B40] truncate">{prod.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {formatProductSizeDisplay(prod) ? (
                            <span>ขนาด: {formatProductSizeDisplay(prod)}</span>
                          ) : null}
                          {(prod.catalog_type === 'tuulo' || prod.catalogType === 'tuulo') ? (
                            <span className="font-semibold text-blue-700"> | สี: ตามภาพ</span>
                          ) : prod.color ? (
                            <span> | สี: {prod.color}</span>
                          ) : null}
                          {prod.page_num && <span> | แคตตาล็อกหน้า {prod.page_num}</span>}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductIds(new Set([prod.id]));
                            setTargetCategoryId(prod.category_id || (categories[0]?.id || ''));
                            setMoveCategoryModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-[11px] font-semibold transition cursor-pointer inline-flex items-center gap-1 group shadow-2xs"
                          title="คลิกเพื่อย้ายหมวดหมู่สินค้านี้"
                        >
                          <Layers className="w-3 h-3 text-amber-600 group-hover:scale-110 transition-transform" />
                          <span className="truncate max-w-[130px]">{prod.category_name || 'ทั่วไป'}</span>
                        </button>
                      </td>

                      <td className="px-3 py-3.5 text-right font-mono font-bold text-red-700">
                        {prod.prices?.SALE_PRICE && prod.prices.SALE_PRICE > 0
                          ? `฿${prod.prices.SALE_PRICE.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-blue-700">
                        {prod.prices?.RETAIL_PRICE && prod.prices.RETAIL_PRICE > 0
                          ? `฿${prod.prices.RETAIL_PRICE.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-purple-700">
                        {prod.prices?.VIP_PRICE && prod.prices.VIP_PRICE > 0
                          ? `฿${prod.prices.VIP_PRICE.toLocaleString()}`
                          : '-'}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-800">
                        {prod.prices?.GENERAL_PRICE && prod.prices.GENERAL_PRICE > 0
                          ? `฿${prod.prices.GENERAL_PRICE.toLocaleString()}`
                          : '-'}
                      </td>

                      <td className="px-3 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              prod.status === 'Published'
                                ? 'bg-emerald-100 text-emerald-800'
                                : prod.status === 'Draft'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {prod.status}
                          </span>

                          {/* ราคาไม่ครบ */}
                          {checkPriceIncomplete(prod) ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs whitespace-nowrap"
                              title="ราคายังไม่ครบทั้ง 4 ระดับ (กรุณาระบุราคาให้ครบ)"
                            >
                              ⚠️ ราคาไม่ครบ
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title="ราคาทั้ง 4 ระดับครบถ้วน"
                            >
                              ✓ ราคาครบ
                            </span>
                          )}

                          {/* รูปภาพไม่ครบ: ในกรณีที่ขาดรูปภาพอ้างอิงหรือสินค้าหลัก อย่างใดอย่างหนึ่ง */}
                          {checkImageIncomplete(prod) ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs whitespace-nowrap"
                              title={
                                !prod.ref_image_url && !prod.graphic_filename && (!prod.images || prod.images.length === 0)
                                  ? 'ขาดทั้งสินค้าหลักและภาพอ้างอิง'
                                  : !prod.ref_image_url
                                  ? 'ขาดภาพอ้างอิง'
                                  : 'ขาดรูปภาพสินค้าหลัก'
                              }
                            >
                              📷 รูปภาพไม่ครบ
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-200"
                              title="มีทั้งรูปภาพสินค้าหลักและภาพอ้างอิงครบถ้วน"
                            >
                              ✓ รูปภาพครบ
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* QUICK SHARE BUTTON FOR EVERY SINGLE PRODUCT */}
                          <button
                            onClick={() => openQuickShare(prod)}
                            className="px-2.5 py-1.5 bg-[#FFFAF3] hover:bg-[#F7F0E6] text-[#805216] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-[#D2B681] shadow-2xs"
                            title="สร้างลิงก์แชร์สินค้านี้"
                          >
                            <Share2 className="w-3.5 h-3.5 text-[#C5A059]" />
                            <span>แชร์</span>
                          </button>

                          <button
                            onClick={() => openQuickEditModal(prod)}
                            className="p-1.5 text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition border border-blue-200 shadow-2xs"
                            title="แก้ไขข้อมูลสินค้าแบบ Real-time"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(prod.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="ลบสินค้า"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {displayedProducts.length > 0 && (
          <div className="px-5 py-3.5 bg-[#FFFAF3]/60 border-t border-[#D2B681]/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#705E4F]">
            <div className="flex items-center gap-2">
              <span>
                แสดง <strong className="text-[#402E20]">{startIndex + 1}</strong> ถึง{' '}
                <strong className="text-[#402E20]">{Math.min(startIndex + (pageSize || displayedProducts.length), displayedProducts.length)}</strong>{' '}
                จากทั้งหมด <strong className="text-[#402E20]">{displayedProducts.length}</strong> รายการ
              </span>
              <span className="text-[#D2B681]">|</span>
              <div className="flex items-center gap-1.5">
                <span>หน้าละ:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-[#D2B681] rounded-lg text-xs font-semibold text-[#402E20] focus:outline-none focus:ring-1 focus:ring-[#C5A059] cursor-pointer"
                >
                  <option value={30}>30 รายการ</option>
                  <option value={50}>50 รายการ</option>
                  <option value={100}>100 รายการ</option>
                  <option value={0}>แสดงทั้งหมด ({displayedProducts.length})</option>
                </select>
              </div>
            </div>

            {pageSize > 0 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  className="px-2.5 py-1.5 bg-white border border-[#D2B681]/60 rounded-lg hover:bg-[#FFFAF3] text-[#402E20] disabled:opacity-40 disabled:pointer-events-none transition font-medium"
                  title="หน้าแรก"
                >
                  « หน้าแรก
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 bg-white border border-[#D2B681]/60 rounded-lg hover:bg-[#FFFAF3] text-[#402E20] disabled:opacity-40 disabled:pointer-events-none transition"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 py-1 font-bold text-[#402E20]">
                  หน้า {safeCurrentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1.5 bg-white border border-[#D2B681]/60 rounded-lg hover:bg-[#FFFAF3] text-[#402E20] disabled:opacity-40 disabled:pointer-events-none transition"
                  title="หน้าถัดไป"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  className="px-2.5 py-1.5 bg-white border border-[#D2B681]/60 rounded-lg hover:bg-[#FFFAF3] text-[#402E20] disabled:opacity-40 disabled:pointer-events-none transition font-medium"
                  title="หน้าสุดท้าย"
                >
                  หน้าสุดท้าย »
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FLOATING ACTION BAR FOR MULTI-SELECTION (Sticky Bottom Bar) */}
      {selectedProductIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-in slide-in-from-bottom-6 duration-200">
          <div className="bg-[#402E20] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-[#D2B681] flex flex-wrap items-center justify-between gap-4 max-w-2xl w-full">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-[#C5A059] text-[#402E20] font-black text-xs flex items-center justify-center">
                {selectedProductIds.size}
              </span>
              <div>
                <div className="text-xs font-bold text-[#FFFAF3]">
                  เลือกสินค้าแล้ว {selectedProductIds.size} รายการ
                </div>
                <div className="text-[10px] text-[#D2B681]">
                  พร้อมสร้างลิงก์แชร์เฉพาะกลุ่มสินค้านี้
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedProductIds(new Set())}
                className="px-3 py-1.5 bg-[#2E2015] hover:bg-[#1F160E] text-[#D2B681] rounded-xl text-xs font-medium transition cursor-pointer"
              >
                ยกเลิกการเลือก
              </button>

              <button
                onClick={openMoveCategoryModal}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
                title="ย้ายหมวดหมู่สินค้าที่เลือกไปยังหมวดหมู่อื่น"
              >
                <Layers className="w-4 h-4" />
                <span>ย้ายหมวดหมู่ ({selectedProductIds.size})</span>
              </button>

              <button
                onClick={openMultiShareModal}
                className="px-4 py-2 bg-gradient-to-r from-[#C5A059] to-[#BB9251] hover:from-[#BB9251] hover:to-[#A67D3D] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>แชร์สินค้าที่เลือก ({selectedProductIds.size})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. SINGLE IMAGE PREVIEW MODAL (เห็นเฉพาะรูปภาพนั้นๆ ที่กดดูเท่านั้น) */}
      {singlePreviewImage && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-[90] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSinglePreviewImage(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col relative border border-[#D2B681] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 px-6 border-b border-[#D2B681]/40 flex items-center justify-between bg-[#FFFAF3]">
              <div className="flex items-center gap-2.5">
                <span className="font-mono bg-[#402E20] text-[#FFFAF3] px-2.5 py-1 rounded-lg text-xs font-bold">
                  {singlePreviewImage.title}
                </span>
                <span className="font-bold text-sm text-[#402E20] truncate max-w-md">
                  {singlePreviewImage.subtitle || 'พรีวิวรูปภาพ'}
                </span>
              </div>
              <button
                onClick={() => setSinglePreviewImage(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            {/* Focused Single Image */}
            <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[360px] max-h-[70vh] overflow-hidden">
              <img
                src={singlePreviewImage.url}
                alt={singlePreviewImage.title}
                className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>

            {/* Footer */}
            <div className="p-3 px-6 border-t border-[#D2B681]/40 flex items-center justify-between bg-[#FFFAF3]">
              <div className="text-xs text-[#705E4F] font-medium">
                📸 แสดงเฉพาะรูปภาพที่เลือก
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadFile(singlePreviewImage.url, `${singlePreviewImage.title}_preview.jpg`)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>บันทึกไฟล์ภาพ</span>
                </button>
                <button
                  onClick={() => setSinglePreviewImage(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-[#705E4F] hover:bg-[#F7F0E6] rounded-xl transition"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1.1 COMPLETE PRODUCT DETAILS PREVIEW MODAL (SKU & รูปภาพ คลิกพรีวิว) */}
      {previewProduct && (
        <div className="fixed inset-0 bg-[#402E20]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200 border border-[#D2B681] custom-scrollbar">
            {/* Header */}
            <div className="p-4 px-6 border-b border-[#D2B681]/40 flex items-center justify-between bg-[#FFFAF3] sticky top-0 z-10">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono bg-[#402E20] text-[#FFFAF3] px-2.5 py-1 rounded-lg text-xs font-bold">
                  {previewProduct.sku}
                </span>
                {previewProduct.catalog_type === 'tuulo' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    ตู้โล
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                    น็อคดาวน์
                  </span>
                )}
                <span className="font-bold text-sm text-[#402E20] truncate max-w-sm sm:max-w-md">
                  {previewProduct.name}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Real-time Data
                </span>
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition shrink-0"
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* 1. Show One Image at a Time ("โชว์ทีละรูป") with Tabs */}
              <div className="bg-[#FFFAF3] p-4 rounded-2xl border border-[#D2B681]/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#D2B681]/30">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#402E20]">
                    <ImageIcon className="w-4 h-4 text-[#805216]" />
                    <span>รูปภาพสินค้า (แสดงทีละรูป):</span>
                  </div>

                  {/* Tab Selector */}
                  <div className="inline-flex p-1 bg-white rounded-xl border border-[#D2B681] gap-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPreviewActiveTab('primary')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        previewActiveTab === 'primary'
                          ? 'bg-[#161B40] text-white shadow-xs'
                          : 'text-[#705E4F] hover:bg-slate-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      <span>1. รูปภาพสินค้าหลัก</span>
                      {(Array.isArray(previewProduct.images) ? previewProduct.images.length : (previewProduct.primary_image_url ? 1 : 0)) > 1 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500 text-white font-mono">
                          {previewProduct.images.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewActiveTab('ref')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        previewActiveTab === 'ref'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-[#705E4F] hover:bg-slate-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>2. ภาพอ้างอิงจริง (Reference / Dicut)</span>
                      {(Array.isArray(previewProduct.ref_images) ? previewProduct.ref_images.length : (previewProduct.ref_image_url ? 1 : 0)) > 0 && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                          previewActiveTab === 'ref' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {(Array.isArray(previewProduct.ref_images) && previewProduct.ref_images.length > 1) ? `${previewProduct.ref_images.length} รูป` : '✓'}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Main Prominent Image Viewer (SHOWS ONE IMAGE AT A TIME WITH SLIDER CONTROLS) */}
                <div className="space-y-3">
                  {previewActiveTab === 'primary' ? (
                    /* TAB 1: PRIMARY PRODUCT IMAGES SLIDER */
                    (() => {
                      const primaryImgsList: string[] = [];
                      if (Array.isArray(previewProduct.images)) {
                        previewProduct.images.forEach((u: string) => {
                          if (u && typeof u === 'string' && u.trim() && !primaryImgsList.includes(u.trim())) {
                            primaryImgsList.push(u.trim());
                          }
                        });
                      } else if (previewProduct.primary_image_url) {
                        primaryImgsList.push(previewProduct.primary_image_url);
                      }

                      const totalPrimary = primaryImgsList.length;
                      const currentPrimaryIdx = Math.min(Math.max(0, previewPrimaryImgIdx), Math.max(0, totalPrimary - 1));
                      const currentImgUrl = primaryImgsList[currentPrimaryIdx] || null;

                      const handlePrevPrimary = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setPreviewPrimaryImgIdx((prev) => (prev > 0 ? prev - 1 : totalPrimary - 1));
                      };

                      const handleNextPrimary = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setPreviewPrimaryImgIdx((prev) => (prev < totalPrimary - 1 ? prev + 1 : 0));
                      };

                      return (
                        <div className="space-y-3">
                          <div
                            onClick={() => {
                              if (currentImgUrl) {
                                openSingleImagePreview(
                                  currentImgUrl,
                                  previewProduct.sku,
                                  `รูปภาพสินค้าหลัก (ภาพที่ ${currentPrimaryIdx + 1}/${totalPrimary})`
                                );
                              }
                            }}
                            className="relative aspect-16/10 sm:aspect-2/1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer group shadow-xs select-none"
                            title={currentImgUrl ? 'คลิกเพื่อขยายดูภาพหลักขนาดเต็ม' : 'ไม่มีรูปภาพสินค้าหลัก'}
                          >
                            {currentImgUrl ? (
                              <>
                                <img
                                  src={currentImgUrl}
                                  alt={`${previewProduct.name} - ภาพที่ ${currentPrimaryIdx + 1}`}
                                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-200"
                                />
                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white gap-2 font-bold text-xs pointer-events-none">
                                  <Eye className="w-5 h-5" />
                                  <span>คลิกเพื่อขยายดูภาพหลักขนาดเต็ม</span>
                                </div>
                              </>
                            ) : (
                              <div className="text-slate-400 text-xs flex flex-col items-center gap-1.5 py-8">
                                <Package className="w-12 h-12 stroke-1 text-slate-300" />
                                <span>ไม่มีรูปภาพสินค้าหลัก</span>
                              </div>
                            )}

                            {/* Prominent Next / Prev Buttons if > 1 images */}
                            {totalPrimary > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={handlePrevPrimary}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 hover:bg-white text-slate-800 hover:text-blue-600 shadow-xl border border-slate-200 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 z-10 cursor-pointer"
                                  title="ภาพก่อนหน้า (Previous)"
                                  aria-label="Previous main image"
                                >
                                  <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleNextPrimary}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 hover:bg-white text-slate-800 hover:text-blue-600 shadow-xl border border-slate-200 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 z-10 cursor-pointer"
                                  title="ภาพถัดไป (Next)"
                                  aria-label="Next main image"
                                >
                                  <ChevronRight className="w-6 h-6 stroke-[2.5]" />
                                </button>

                                {/* Floating Counter Badge */}
                                <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-xs text-white rounded-full text-xs font-bold tracking-wide shadow-md flex items-center gap-1.5 z-10">
                                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                                  <span>ภาพที่ {currentPrimaryIdx + 1} / {totalPrimary}</span>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Thumbnail Strip if > 1 images */}
                          {totalPrimary > 1 && (
                            <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 custom-scrollbar">
                              {primaryImgsList.map((thumbUrl, idx) => {
                                const isCurrent = idx === currentPrimaryIdx;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setPreviewPrimaryImgIdx(idx)}
                                    className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                                      isCurrent
                                        ? 'border-blue-600 ring-2 ring-blue-400 scale-105 shadow-md'
                                        : 'border-slate-200 hover:border-slate-400 opacity-70 hover:opacity-100'
                                    }`}
                                  >
                                    <img src={thumbUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                    <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] font-bold px-1 rounded-tl">
                                      {idx + 1}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Primary Image Action Footer */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                            <span className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1.5">
                              <span>🖼️ รูปภาพสินค้าหลัก (Graphic)</span>
                              {totalPrimary > 1 && (
                                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                  มีทั้งหมด {totalPrimary} รูป
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                              {currentImgUrl && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openSingleImagePreview(
                                        currentImgUrl,
                                        previewProduct.sku,
                                        `รูปภาพสินค้าหลัก (ภาพที่ ${currentPrimaryIdx + 1}/${totalPrimary})`
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1 transition"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>ดูภาพขยายเต็มจอ</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadFile(
                                        currentImgUrl,
                                        `${previewProduct.sku}_primary_${currentPrimaryIdx + 1}.jpg`
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 transition shadow-xs"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>ดาวน์โหลดภาพนี้</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    /* TAB 2: REFERENCE / DICUT IMAGES SLIDER */
                    (() => {
                      const refImgsList: string[] = [];
                      if (Array.isArray(previewProduct.ref_images)) {
                        previewProduct.ref_images.forEach((u: string) => {
                          if (u && typeof u === 'string' && u.trim() && !refImgsList.includes(u.trim())) {
                            refImgsList.push(u.trim());
                          }
                        });
                      } else if (previewProduct.ref_image_url) {
                        refImgsList.push(previewProduct.ref_image_url);
                      }

                      const totalRef = refImgsList.length;
                      const currentRefIdx = Math.min(Math.max(0, previewRefImgIdx), Math.max(0, totalRef - 1));
                      const currentRefUrl = refImgsList[currentRefIdx] || null;

                      const handlePrevRef = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setPreviewRefImgIdx((prev) => (prev > 0 ? prev - 1 : totalRef - 1));
                      };

                      const handleNextRef = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setPreviewRefImgIdx((prev) => (prev < totalRef - 1 ? prev + 1 : 0));
                      };

                      return (
                        <div className="space-y-3">
                          <div
                            onClick={() => {
                              if (currentRefUrl) {
                                openSingleImagePreview(
                                  currentRefUrl,
                                  previewProduct.sku,
                                  `ภาพอ้างอิงจริง (ภาพที่ ${currentRefIdx + 1}/${totalRef})`
                                );
                              }
                            }}
                            className={`relative aspect-16/10 sm:aspect-2/1 bg-white rounded-2xl border border-amber-200 overflow-hidden flex items-center justify-center shadow-xs select-none ${
                              currentRefUrl ? 'cursor-pointer group' : ''
                            }`}
                            title={currentRefUrl ? 'คลิกเพื่อขยายดูภาพอ้างอิงขนาดเต็ม' : 'ยังไม่มีภาพอ้างอิง'}
                          >
                            {currentRefUrl ? (
                              <>
                                <img
                                  src={currentRefUrl}
                                  alt={`Reference ${currentRefIdx + 1}`}
                                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-200"
                                />
                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white gap-2 font-bold text-xs pointer-events-none">
                                  <Eye className="w-5 h-5" />
                                  <span>คลิกเพื่อขยายดูภาพอ้างอิงขนาดเต็ม</span>
                                </div>
                              </>
                            ) : (
                              <div className="text-amber-800/70 text-xs flex flex-col items-center gap-2 py-8 text-center px-4">
                                <Camera className="w-12 h-12 stroke-1 text-amber-400" />
                                <span className="font-bold">ยังไม่มีภาพอ้างอิงจริง (Reference / Dicut)</span>
                                <span className="text-[11px] text-slate-500">
                                  สามารถเพิ่มภาพอ้างอิงได้ในเมนู "แก้ไขสินค้าแบบ Real-time"
                                </span>
                              </div>
                            )}

                            {/* Prominent Next / Prev Buttons if > 1 ref images */}
                            {totalRef > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={handlePrevRef}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 hover:bg-white text-slate-800 hover:text-amber-600 shadow-xl border border-amber-200 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 z-10 cursor-pointer"
                                  title="ภาพอ้างอิงก่อนหน้า (Previous)"
                                  aria-label="Previous reference image"
                                >
                                  <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleNextRef}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 hover:bg-white text-slate-800 hover:text-amber-600 shadow-xl border border-amber-200 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 z-10 cursor-pointer"
                                  title="ภาพอ้างอิงถัดไป (Next)"
                                  aria-label="Next reference image"
                                >
                                  <ChevronRight className="w-6 h-6 stroke-[2.5]" />
                                </button>

                                {/* Floating Counter Badge */}
                                <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-xs text-white rounded-full text-xs font-bold tracking-wide shadow-md flex items-center gap-1.5 z-10">
                                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                  <span>ภาพอ้างอิง {currentRefIdx + 1} / {totalRef}</span>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Thumbnail Strip if > 1 ref images */}
                          {totalRef > 1 && (
                            <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 custom-scrollbar">
                              {refImgsList.map((thumbUrl, idx) => {
                                const isCurrent = idx === currentRefIdx;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setPreviewRefImgIdx(idx)}
                                    className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                                      isCurrent
                                        ? 'border-amber-600 ring-2 ring-amber-400 scale-105 shadow-md'
                                        : 'border-amber-100 hover:border-amber-300 opacity-70 hover:opacity-100'
                                    }`}
                                  >
                                    <img src={thumbUrl} alt={`Ref Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                    <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] font-bold px-1 rounded-tl">
                                      {idx + 1}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Reference Image Action Footer */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                            <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                              <span>📸 ภาพอ้างอิงจริง (Reference / Dicut)</span>
                              {totalRef > 1 && (
                                <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                  มีทั้งหมด {totalRef} รูป
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                              {currentRefUrl ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openSingleImagePreview(
                                        currentRefUrl,
                                        previewProduct.sku,
                                        `ภาพอ้างอิงจริง (ภาพที่ ${currentRefIdx + 1}/${totalRef})`
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1 transition"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>ดูภาพขยายเต็มจอ</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadFile(
                                        currentRefUrl,
                                        `${previewProduct.sku}_reference_${currentRefIdx + 1}.jpg`
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 transition shadow-xs"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>ดาวน์โหลดภาพนี้</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const prodToEdit = previewProduct;
                                    setPreviewProduct(null);
                                    openQuickEditModal(prodToEdit);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 transition text-xs shadow-xs"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>เพิ่มภาพอ้างอิงในหน้านี้</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* Thumbnail Switcher Below Image */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#D2B681]/30">
                    <span className="text-[10px] text-[#705E4F] font-bold">เลือกสลับดูรูปภาพ:</span>
                    <button
                      type="button"
                      onClick={() => setPreviewActiveTab('primary')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        previewActiveTab === 'primary'
                          ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-400'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>ภาพหลัก</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewActiveTab('ref')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        previewActiveTab === 'ref'
                          ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-400'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      <span>ภาพอ้างอิง {previewProduct.ref_image_url ? '(มีภาพ)' : '(ไม่มี)'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Specs & Dimensions matching Realtime Edit Data */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[#FFFAF3] rounded-xl border border-[#D2B681]/40">
                  <div className="text-[10px] text-[#705E4F]">ขนาด (กว้าง x สูง x ลึก)</div>
                  <div className="font-semibold text-[#402E20] mt-0.5">
                    {formatProductSizeDisplay(previewProduct) || '-'}
                  </div>
                </div>

                <div className="p-3 bg-[#FFFAF3] rounded-xl border border-[#D2B681]/40">
                  <div className="text-[10px] text-[#705E4F]">สี / ลาย</div>
                  <div className="font-semibold text-[#402E20] mt-0.5">
                    {(previewProduct.catalog_type === 'tuulo' || previewProduct.catalogType === 'tuulo') ? 'ตามภาพ' : (previewProduct.color || 'ตามมาตรฐาน')}
                  </div>
                </div>

                <div className="p-3 bg-[#FFFAF3] rounded-xl border border-[#D2B681]/40">
                  <div className="text-[10px] text-[#705E4F]">หมวดหมู่สินค้า</div>
                  <div className="font-semibold text-[#402E20] mt-0.5 truncate">
                    {previewProduct.category_name || '-'}
                  </div>
                </div>

                <div className="p-3 bg-[#FFFAF3] rounded-xl border border-[#D2B681]/40">
                  <div className="text-[10px] text-[#705E4F]">สถานะสินค้า</div>
                  <div className="font-semibold mt-0.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      previewProduct.status === 'Published'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {previewProduct.status || 'Published'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Description */}
              {previewProduct.description && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    รายละเอียดสินค้า (Description)
                  </div>
                  <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                    {previewProduct.description}
                  </div>
                </div>
              )}

              {/* 4. Real-time 4 Prices Box */}
              <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span>ราคาสินค้า 4 ระดับ (Real-time Live Prices):</span>
                  </span>
                  <span className="text-[10px] text-amber-800 font-semibold">
                    อัปเดตตรงตามระบบฐานข้อมูล
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-white rounded-xl border border-amber-200 text-center shadow-2xs">
                    <span className="block text-[10px] font-bold text-red-600">ราคาเซลล์ (SALE)</span>
                    <span className="text-sm font-extrabold text-red-600 font-mono mt-0.5 block">
                      {previewProduct.prices?.SALE_PRICE && previewProduct.prices.SALE_PRICE > 0
                        ? `฿${previewProduct.prices.SALE_PRICE.toLocaleString()}`
                        : '-'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-amber-200 text-center shadow-2xs">
                    <span className="block text-[10px] font-bold text-blue-700">ราคาปลีก (RETAIL)</span>
                    <span className="text-sm font-extrabold text-blue-700 font-mono mt-0.5 block">
                      {previewProduct.prices?.RETAIL_PRICE && previewProduct.prices.RETAIL_PRICE > 0
                        ? `฿${previewProduct.prices.RETAIL_PRICE.toLocaleString()}`
                        : '-'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-amber-200 text-center shadow-2xs">
                    <span className="block text-[10px] font-bold text-purple-700">ราคา VIP (VIP)</span>
                    <span className="text-sm font-extrabold text-purple-700 font-mono mt-0.5 block">
                      {previewProduct.prices?.VIP_PRICE && previewProduct.prices.VIP_PRICE > 0
                        ? `฿${previewProduct.prices.VIP_PRICE.toLocaleString()}`
                        : '-'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-amber-200 text-center shadow-2xs">
                    <span className="block text-[10px] font-bold text-slate-700">บุคคลทั่วไป (GENERAL)</span>
                    <span className="text-sm font-extrabold text-slate-800 font-mono mt-0.5 block">
                      {previewProduct.prices?.GENERAL_PRICE && previewProduct.prices.GENERAL_PRICE > 0
                        ? `฿${previewProduct.prices.GENERAL_PRICE.toLocaleString()}`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-[#D2B681]/40 flex items-center justify-between bg-[#FFFAF3] sticky bottom-0">
              <button
                onClick={() => {
                  const prodToEdit = previewProduct;
                  setPreviewProduct(null);
                  openQuickEditModal(prodToEdit);
                }}
                className="px-4 py-2 bg-[#161B40] hover:bg-[#1f2557] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Edit className="w-3.5 h-3.5 text-amber-300" />
                <span>แก้ไขสินค้านี้แบบ Real-time</span>
              </button>
              <button
                onClick={() => setPreviewProduct(null)}
                className="px-5 py-2 text-xs font-semibold text-[#705E4F] hover:bg-[#F7F0E6] rounded-xl transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MULTI-PRODUCT SHARE MODAL (NEW FEATURE) */}
      {multiShareModalOpen && (
        <div className="fixed inset-0 bg-[#402E20]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 custom-scrollbar relative animate-in fade-in zoom-in-95 duration-200 border border-[#D2B681]">
            <button
              onClick={() => setMultiShareModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#FFFAF3] text-[#705E4F] hover:bg-[#F7F0E6] border border-[#D2B681] transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C5A059]/15 text-[#805216] text-[10px] font-bold border border-[#D2B681] mb-2">
                <Sparkles className="w-3 h-3 text-[#C5A059]" />
                แชร์สินค้าหลายรายการพร้อมกัน (Multiple Products Share)
              </div>
              <h2 className="text-base font-bold text-[#402E20] tracking-tight">
                สร้างลิงก์แชร์เฉพาะกลุ่มสินค้า ({selectedProductIds.size} รายการ)
              </h2>
              <p className="text-xs text-[#705E4F] mt-0.5">
                เลือกระดับราคาที่ต้องการเสนอให้ลูกค้า ลูกค้าจะเห็นเฉพาะกลุ่มสินค้านี้และแสดงคำว่า <strong>"ราคา"</strong> เท่านั้น
              </p>
            </div>

            {/* Selected Products Preview Row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#402E20]">
                <span>รายการสินค้าที่เลือกไว้ ({selectedProductsList.length}):</span>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-[#D2B681]/30 border border-[#D2B681] rounded-2xl bg-[#FFFAF3] p-1 custom-scrollbar">
                {selectedProductsList.map((prod) => (
                  <div key={prod.id} className="p-2 flex items-center justify-between gap-3 hover:bg-white/60 rounded-xl transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {prod.images && prod.images[0] ? (
                        <img
                          src={prod.images[0]}
                          alt={prod.name}
                          className="w-10 h-10 object-cover rounded-lg border border-[#D2B681] flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-bold text-[#805216]">{prod.sku}</div>
                        <div className="text-xs text-[#402E20] truncate">{prod.name}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSelectProduct(prod.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition"
                      title="นำรายการนี้ออก"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {multiShareError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{multiShareError}</span>
              </div>
            )}

            {/* Success View */}
            {multiGeneratedShareUrl ? (
              <div className="bg-[#FFFAF3] border-2 border-[#D2B681] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#805216] font-bold text-xs">
                  <Check className="w-4 h-4 text-[#C5A059]" />
                  <span>สร้างลิงก์แชร์ {selectedProductIds.size} รายการสำเร็จแล้ว!</span>
                </div>

                <div className="p-3 bg-white border border-[#D2B681] rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                  <span className="font-mono text-xs text-[#402E20] truncate select-all">
                    {multiGeneratedShareUrl}
                  </span>
                  <button
                    onClick={copyMultiShareLink}
                    className="px-3.5 py-1.5 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-lg text-xs font-bold flex items-center gap-1 flex-shrink-0 shadow-xs transition"
                  >
                    {multiCopiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {multiCopiedLink ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={multiGeneratedShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 bg-[#402E20] hover:bg-[#2E2015] text-[#FFFAF3] rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#C5A059]" />
                    เปิดดูหน้าแคตตาล็อกลูกค้า
                  </a>
                  <button
                    onClick={() => {
                      setMultiShareModalOpen(false);
                      setSelectedProductIds(new Set());
                    }}
                    className="px-4 py-2.5 bg-white border border-[#D2B681] text-[#705E4F] rounded-xl text-xs font-semibold hover:bg-[#FFFAF3] transition"
                  >
                    เสร็จสิ้น
                  </button>
                </div>
              </div>
            ) : (
              /* Configuration Form */
              <form onSubmit={handleGenerateMultiShareLink} className="space-y-4">
                {/* 4 Price Tier Cards */}
                <div>
                  <label className="block text-xs font-bold text-[#402E20] mb-2">
                    เลือกระดับราคาที่ต้องการเสนอให้ลูกค้า:
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {priceTiers.map((t) => {
                      const isSelected = multiShareTierId === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setMultiShareTierId(t.id)}
                          className={`p-3 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#C5A059] bg-[#FFFAF3] shadow-xs ring-1 ring-[#C5A059]'
                              : 'border-[#D2B681]/60 hover:border-[#D2B681] bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-[#402E20]">{t.name_th}</span>
                            <input
                              type="radio"
                              name="multi_tier"
                              checked={isSelected}
                              onChange={() => setMultiShareTierId(t.id)}
                              className="text-[#805216] focus:ring-[#C5A059]"
                            />
                          </div>
                          <div className="text-[10px] font-mono text-[#805216] font-bold uppercase">
                            {t.code}
                          </div>
                          <div className="text-[10px] text-[#705E4F] mt-1">
                            {t.description || '-'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Customer Name / Reference */}
                <div>
                  <label className="block text-xs font-semibold text-[#402E20] mb-1">
                    ชื่อลูกค้า / บันทึกอ้างอิง (แสดงในหลังบ้านและหัวหน้าเว็บลูกค้า)
                  </label>
                  <input
                    type="text"
                    value={multiShareCustomerName}
                    onChange={(e) => setMultiShareCustomerName(e.target.value)}
                    placeholder="เช่น คุณสมศักดิ์ (ชุดห้องนอน + ตู้เสื้อผ้า)"
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                {/* Expiry */}
                <div>
                  <label className="block text-xs font-semibold text-[#402E20] mb-1">
                    อายุของลิงก์แชร์
                  </label>
                  <select
                    value={multiShareExpiresDays}
                    onChange={(e) => setMultiShareExpiresDays(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                  >
                    <option value="7">7 วัน</option>
                    <option value="14">14 วัน</option>
                    <option value="30">30 วัน (แนะนำ)</option>
                    <option value="90">90 วัน</option>
                    <option value="0">ไม่มีวันหมดอายุ (ใช้ได้ตลอดไป)</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#D2B681]/30">
                  <button
                    type="button"
                    onClick={() => setMultiShareModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-[#705E4F] hover:bg-[#F7F0E6] rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={multiGeneratingLink || selectedProductIds.size === 0 || !multiShareTierId}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#C5A059] to-[#BB9251] hover:from-[#BB9251] hover:to-[#A67D3D] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {multiGeneratingLink ? (
                      'กำลังสร้างลิงก์...'
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        สร้างลิงก์แชร์ ({selectedProductIds.size} รายการ)
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 2.1 BATCH MOVE CATEGORY MODAL (จัดการและย้ายหมวดหมู่สินค้าแบบ Real-time) */}
      {moveCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-amber-200 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setMoveCategoryModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition cursor-pointer"
              title="ปิด"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-200 mb-2">
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span>จัดการและย้ายหมวดหมู่สินค้า (Batch Move Category)</span>
              </div>
              <h2 className="text-base font-bold text-[#402E20] tracking-tight">
                ย้ายหมวดหมู่สินค้า ({selectedProductIds.size} รายการที่เลือก)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                เลือกหมวดหมู่ปลายทางที่ต้องการย้าย ระบบจะอัปเดตแบบ <strong>Real-time</strong> ทั้งในระบบหลังบ้านและลิงก์แชร์ลูกค้าทันที
              </p>
            </div>

            {/* Selected Products Preview Row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#402E20]">
                <span>รายการสินค้าที่เลือก ({selectedProductsList.length}):</span>
                <span className="text-[11px] text-slate-400">คลิกเครื่องหมายกากบาทเพื่อนำรายการออก</span>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-slate-50/70 p-1 custom-scrollbar">
                {selectedProductsList.map((prod) => (
                  <div key={prod.id} className="p-2 flex items-center justify-between gap-3 hover:bg-white rounded-xl transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {prod.images && prod.images[0] ? (
                        <img
                          src={prod.images[0]}
                          alt={prod.name}
                          className="w-9 h-9 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-red-600">{prod.sku}</span>
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded truncate max-w-[130px]">
                            เดิม: {prod.category_name || 'ไม่ระบุหมวด'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-800 truncate">{prod.name}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSelectProduct(prod.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                      title="นำรายการนี้ออกจากการเลือก"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Catalog Type Select */}
            <div className="space-y-1.5 bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200">
              <label className="text-xs font-bold text-amber-950 flex items-center justify-between">
                <span>1. เปลี่ยนประเภทแคตตาล็อก:</span>
                <span className="text-[10px] text-amber-800 font-normal">ตู้โล vs น็อคดาวน์</span>
              </label>
              <select
                value={targetCatalogType}
                onChange={(e) => {
                  const val = e.target.value as 'keep' | 'knockdown' | 'tuulo';
                  setTargetCatalogType(val);
                }}
                className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
              >
                <option value="keep">🔄 คงเดิมตามสินค้าแต่ละชิ้น (ไม่เปลี่ยนประเภทแคตตาล็อก)</option>
                <option value="knockdown">🛋️ เฟอร์นิเจอร์น็อคดาวน์ (Modern Luxury)</option>
                <option value="tuulo">🚪 ตู้โล (Tuulo)</option>
              </select>
            </div>

            {/* Target Category Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#402E20] flex items-center justify-between">
                <span>2. เลือกหมวดหมู่สินค้าปลายทาง:</span>
                <span className="text-[10px] text-amber-700 font-normal">* มีผลทันทีหลังกดยืนยัน</span>
              </label>
              <select
                value={targetCategoryId}
                onChange={(e) => setTargetCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
              >
                <option value="" disabled>-- กรุณาเลือกหมวดหมู่ --</option>
                {categories
                  .filter((c) => {
                    if (targetCatalogType === 'keep') return true;
                    return !c.catalog_type || c.catalog_type === 'all' || c.catalog_type === targetCatalogType;
                  })
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      📁 {c.name} {c.catalog_type ? `(${c.catalog_type === 'tuulo' ? 'ตู้โล' : 'น็อคดาวน์'})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Realtime Notice */}
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div className="text-[11px] leading-relaxed">
                <strong>อัปเดตแบบ Real-time:</strong> หมวดหมู่ของสินค้าจะเปลี่ยนทันทีทั้งในหน้าจัดการนี้ และผู้ใช้งานที่เปิดดูผ่านลิงก์แชร์ลูกค้าจะเห็นการเปลี่ยนแปลงโดยอัตโนมัติ
              </div>
            </div>

            {moveCategoryError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{moveCategoryError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMoveCategoryModalOpen(false)}
                disabled={movingCategory}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleBatchMoveCategory}
                disabled={movingCategory || selectedProductIds.size === 0 || !targetCategoryId}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {movingCategory ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังย้ายหมวดหมู่แบบ Real-time...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    <span>ยืนยันย้ายหมวดหมู่ ({selectedProductIds.size} รายการ)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SINGLE PRODUCT QUICK SHARE MODAL */}
      {shareProduct && (
        <div className="fixed inset-0 bg-[#402E20]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 custom-scrollbar relative animate-in fade-in zoom-in-95 duration-200 border border-[#D2B681]">
            <button
              onClick={() => setShareProduct(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#FFFAF3] text-[#705E4F] hover:bg-[#F7F0E6] border border-[#D2B681] transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C5A059]/15 text-[#805216] text-[10px] font-bold border border-[#D2B681] mb-2">
                <Share2 className="w-3 h-3 text-[#C5A059]" />
                แชร์สินค้าเฉพาะตัว (Single Product Share)
              </div>
              <h2 className="text-base font-bold text-[#402E20] tracking-tight">
                เลือกระดับราคาที่จะแชร์ให้ลูกค้าดู
              </h2>
              <p className="text-xs text-[#705E4F] mt-0.5">
                ลิงก์นี้จะแสดงเฉพาะสินค้าชิ้นนี้ และระบุเพียงคำว่า <strong>"ราคา"</strong> ตามประเภทที่คุณเลือก
              </p>
            </div>

            {/* Product Summary Mini Card */}
            <div className="p-3 bg-[#FFFAF3] rounded-2xl border border-[#D2B681] flex items-center gap-3">
              {shareProduct.images && shareProduct.images[0] ? (
                <img
                  src={shareProduct.images[0]}
                  alt={shareProduct.name}
                  className="w-14 h-14 object-cover rounded-xl border border-[#D2B681] flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                  <Package className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <span className="font-mono text-xs font-bold text-[#805216]">{shareProduct.sku}</span>
                <h4 className="text-xs font-semibold text-[#402E20] truncate">{shareProduct.name}</h4>
                <div className="text-[11px] text-[#705E4F] mt-0.5">{shareProduct.category_name || 'ทั่วไป'}</div>
              </div>
            </div>

            {shareError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{shareError}</span>
              </div>
            )}

            {/* Success state: Link Created! */}
            {generatedShareUrl ? (
              <div className="bg-[#FFFAF3] border-2 border-[#D2B681] rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#805216] font-bold text-xs">
                  <Check className="w-4 h-4 text-[#C5A059]" />
                  <span>สร้างลิงก์แชร์สินค้านี้สำเร็จแล้ว!</span>
                </div>

                <div className="p-3 bg-white border border-[#D2B681] rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                  <span className="font-mono text-xs text-[#402E20] truncate select-all">
                    {generatedShareUrl}
                  </span>
                  <button
                    onClick={copyShareLink}
                    className="px-3.5 py-1.5 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-lg text-xs font-bold flex items-center gap-1 flex-shrink-0 shadow-xs transition"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'คัดลอกแล้ว' : 'คัดลอก'}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={generatedShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 bg-[#402E20] hover:bg-[#2E2015] text-[#FFFAF3] rounded-xl text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#C5A059]" />
                    เปิดดูหน้าลูกค้าที่แชร์
                  </a>
                  <button
                    onClick={() => setShareProduct(null)}
                    className="px-4 py-2.5 bg-white border border-[#D2B681] text-[#705E4F] rounded-xl text-xs font-semibold hover:bg-[#FFFAF3] transition"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            ) : (
              /* Selection Form */
              <form onSubmit={handleGenerateSingleShareLink} className="space-y-4">
                {/* 4 Price Tiers Cards */}
                <div>
                  <label className="block text-xs font-bold text-[#402E20] mb-2">
                    เลือกระดับราคาที่ต้องการเสนอให้ลูกค้า:
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {priceTiers.map((t) => {
                      const tierPrice = shareProduct.prices?.[t.code];
                      const isSelected = shareTierId === t.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setShareTierId(t.id)}
                          className={`p-3 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#C5A059] bg-[#FFFAF3] shadow-xs ring-1 ring-[#C5A059]'
                              : 'border-[#D2B681]/60 hover:border-[#D2B681] bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-[#402E20]">{t.name_th}</span>
                            <input
                              type="radio"
                              name="quick_tier"
                              checked={isSelected}
                              onChange={() => setShareTierId(t.id)}
                              className="text-[#805216] focus:ring-[#C5A059]"
                            />
                          </div>
                          <div className="text-base font-black font-mono text-[#C5A059] mt-1">
                            {tierPrice !== undefined ? `฿${tierPrice.toLocaleString()}` : '-'}
                          </div>
                          <div className="text-[10px] text-[#705E4F] mt-0.5">
                            ลูกค้าจะเห็นเป็น: "ราคา ฿{tierPrice?.toLocaleString() || '0'}"
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Customer Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#402E20] mb-1">
                    ชื่อลูกค้า / บันทึกอ้างอิง (แสดงในหลังบ้านเท่านั้น)
                  </label>
                  <input
                    type="text"
                    value={shareCustomerName}
                    onChange={(e) => setShareCustomerName(e.target.value)}
                    placeholder="เช่น คุณกฤษดา (สนใจชุดนี้)"
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                {/* Expiry */}
                <div>
                  <label className="block text-xs font-semibold text-[#402E20] mb-1">
                    อายุของลิงก์แชร์
                  </label>
                  <select
                    value={shareExpiresDays}
                    onChange={(e) => setShareExpiresDays(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#C5A059]"
                  >
                    <option value="7">7 วัน</option>
                    <option value="14">14 วัน</option>
                    <option value="30">30 วัน (แนะนำ)</option>
                    <option value="90">90 วัน</option>
                    <option value="0">ไม่มีวันหมดอายุ (ใช้ได้ตลอดไป)</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#D2B681]/30">
                  <button
                    type="button"
                    onClick={() => setShareProduct(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-[#705E4F] hover:bg-[#F7F0E6] rounded-xl"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={generatingLink || !shareTierId}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#C5A059] to-[#BB9251] hover:from-[#BB9251] hover:to-[#A67D3D] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {generatingLink ? (
                      'กำลังสร้างลิงก์...'
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        สร้างลิงก์แชร์สินค้านี้ทันที
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 4. REAL-TIME QUICK EDIT MODAL */}
      {quickEditProduct && (
        <div className="fixed inset-0 bg-[#402E20]/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-[#D2B681] my-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#402E20]">แก้ไขสินค้า (Real-time)</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 tracking-wider">
                      {quickEditSku.trim() || quickEditProduct.sku}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      quickEditStatus === 'Published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {quickEditStatus}
                    </span>
                  </div>
                  <p className="text-xs text-[#705E4F] mt-0.5">
                    แก้ไขข้อมูลสินค้า ข้อมูลจะอัปเดตเป็นปัจจุบันทันทีทั้งในระบบและลิงก์แชร์ลูกค้า
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickEditProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quickEditError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{quickEditError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSaveQuickEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Product SKU */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสสินค้า (SKU) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quickEditSku}
                    onChange={(e) => setQuickEditSku(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold font-mono text-blue-900 bg-blue-50/40 rounded-xl border border-blue-200 focus:ring-2 focus:ring-[#C5A059] focus:outline-hidden transition"
                    placeholder="เช่น TD-01"
                  />
                </div>

                {/* Product Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อสินค้า <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quickEditName}
                    onChange={(e) => setQuickEditName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#C5A059] focus:outline-hidden transition"
                    placeholder="เช่น ตู้โชว์ดอนิก 60 CM. TD"
                  />
                </div>

                {/* Catalog Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ประเภทแคตตาล็อก <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={quickEditCatalogType}
                    onChange={(e) => {
                      const newType = e.target.value as 'knockdown' | 'tuulo';
                      setQuickEditCatalogType(newType);
                      if (newType === 'tuulo') {
                        setQuickEditColor('ตามภาพ');
                      }
                    }}
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-blue-300 focus:ring-2 focus:ring-[#C5A059] focus:outline-hidden transition bg-blue-50/50 text-blue-900"
                  >
                    <option value="knockdown">🛋️ เฟอร์นิเจอร์น็อคดาวน์ (Modern Luxury)</option>
                    <option value="tuulo">🚪 ตู้โล (Tuulo)</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">หมวดหมู่</label>
                  <select
                    value={quickEditCategoryId}
                    onChange={(e) => setQuickEditCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#C5A059] focus:outline-hidden transition bg-white"
                  >
                    <option value="">-- ไม่ระบุหมวดหมู่ --</option>
                    {categories
                      .filter((cat) => !cat.catalog_type || cat.catalog_type === 'all' || cat.catalog_type === quickEditCatalogType)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">สถานะ</label>
                  <select
                    value={quickEditStatus}
                    onChange={(e) => setQuickEditStatus(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#C5A059] focus:outline-hidden transition bg-white"
                  >
                    <option value="Published">Published (เผยแพร่)</option>
                    <option value="Draft">Draft (ฉบับร่าง)</option>
                  </select>
                </div>

                {/* Dimensions */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ขนาด (กว้าง x สูง x ลึก ซม.)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      type="number"
                      step="any"
                      placeholder="กว้าง"
                      value={quickEditWidth}
                      onChange={(e) => setQuickEditWidth(e.target.value)}
                      className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#C5A059] focus:outline-hidden text-center"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="สูง"
                      value={quickEditHeight}
                      onChange={(e) => setQuickEditHeight(e.target.value)}
                      className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#C5A059] focus:outline-hidden text-center"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="ลึก"
                      value={quickEditDepth}
                      onChange={(e) => setQuickEditDepth(e.target.value)}
                      className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#C5A059] focus:outline-hidden text-center"
                    />
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สี / ลาย
                    {quickEditCatalogType === 'tuulo' && (
                      <span className="ml-1 text-[10px] text-blue-600 font-bold">(ตู้โล: ตามภาพ)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={quickEditCatalogType === 'tuulo' ? 'ตามภาพ' : quickEditColor}
                    onChange={(e) => setQuickEditColor(e.target.value)}
                    disabled={quickEditCatalogType === 'tuulo'}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#C5A059] focus:outline-hidden transition ${
                      quickEditCatalogType === 'tuulo' ? 'bg-slate-100 text-slate-700 font-bold cursor-not-allowed' : ''
                    }`}
                    placeholder="เช่น โอ๊ค, โซลิด, หินขาว"
                  />
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">รายละเอียดสินค้า</label>
                  <textarea
                    rows={2}
                    value={quickEditDescription}
                    onChange={(e) => setQuickEditDescription(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#C5A059] focus:outline-hidden transition"
                    placeholder="รายละเอียดเพิ่มเติม คุณสมบัติสินค้า..."
                  />
                </div>

                {/* 4 Prices (Live Pricing Integration) */}
                <div className="sm:col-span-2 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span>ราคาสินค้า 4 ระดับ (฿) — อัปเดตทันทีแบบ Real-time:</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="block text-[10px] font-bold text-red-600 mb-0.5">ราคาเซลล์ (SALE):</span>
                      <input
                        type="number"
                        step="any"
                        value={quickEditSalePrice}
                        onChange={(e) => setQuickEditSalePrice(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 text-right"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-blue-700 mb-0.5">ราคาปลีก (RETAIL):</span>
                      <input
                        type="number"
                        step="any"
                        value={quickEditRetailPrice}
                        onChange={(e) => setQuickEditRetailPrice(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 text-right"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-purple-700 mb-0.5">ราคา VIP (VIP):</span>
                      <input
                        type="number"
                        step="any"
                        value={quickEditVipPrice}
                        onChange={(e) => setQuickEditVipPrice(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 text-right"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-700 mb-0.5">บุคคลทั่วไป (GENERAL):</span>
                      <input
                        type="number"
                        step="any"
                        value={quickEditGeneralPrice}
                        onChange={(e) => setQuickEditGeneralPrice(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 text-right"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Images Upload & Preview Section */}
                <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-slate-600" />
                        <span>รูปภาพสินค้า (อัปโหลดและพรีวิวแบบ Real-time)</span>
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        คลิกที่ภาพเพื่อดูพรีวิวแบบเฉพาะรูป หรือกดปุ่ม "เพิ่มภาพ" / "เปลี่ยนภาพเดิม" แยกอิสระตามต้องการ
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        แยกฟังก์ชั่น: เพิ่มภาพ / เปลี่ยนภาพเดิม
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1. Primary Product Images (Multiple Supported) */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-xs font-bold text-slate-800">รูปภาพสินค้าหลัก (Main Images)</span>
                          </div>
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            {quickEditPrimaryImages.length} รูป
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          ภาพกราฟิกหลักที่แสดงในแคตตาล็อก (สามารถเลือกเพิ่มได้หลายรูปพร้อมกัน)
                        </p>

                        {/* Thumbnail Grid */}
                        <div className="mt-2.5 min-h-[72px] p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                          {quickEditPrimaryImages.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {quickEditPrimaryImages.map((imgUrl, idx) => (
                                <div
                                  key={idx}
                                  className="relative group aspect-square rounded-lg bg-white border border-slate-200 overflow-hidden shadow-2xs"
                                >
                                  <img
                                    src={imgUrl}
                                    alt={`Primary ${idx + 1}`}
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={() =>
                                      openSingleImagePreview(
                                        imgUrl,
                                        quickEditProduct?.sku,
                                        `รูปภาพสินค้าหลัก (${idx + 1}/${quickEditPrimaryImages.length})`
                                      )
                                    }
                                  />
                                  <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1 rounded">
                                    {idx === 0 ? 'หลัก' : idx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveQuickEditPrimaryAt(idx)}
                                    className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-md opacity-90 hover:opacity-100 transition shadow-xs cursor-pointer"
                                    title="ลบภาพนี้"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-16 flex flex-col items-center justify-center text-slate-400 text-[11px] gap-1">
                              <ImageIcon className="w-5 h-5 text-slate-300" />
                              <span>ยังไม่มีรูปภาพสินค้าหลัก</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons: เพิ่มหลายรูป / เปลี่ยนทั้งหมด / ลบทั้งหมด */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                        {/* 1. ปุ่มเพิ่มภาพ (รองรับหลายรูป) */}
                        <label className="flex-1 min-w-[110px] py-2 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs">
                          <Plus className="w-3.5 h-3.5" />
                          <span>{quickEditUploadingPrimary ? 'กำลังอัปโหลด...' : '+ เพิ่มภาพหลัก'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={quickEditUploadingPrimary}
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) handleUploadQuickEditPrimaryFiles(files);
                              e.target.value = '';
                            }}
                          />
                        </label>

                        {/* 2. ปุ่มแทนที่ทั้งหมด */}
                        <label className="py-2 px-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                          <span>แทนที่ใหม่</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={quickEditUploadingPrimary}
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                handleClearAllQuickEditPrimary();
                                await handleUploadQuickEditPrimaryFiles(files);
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>

                        {/* 3. ลบภาพหลักทั้งหมด */}
                        {quickEditPrimaryImages.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllQuickEditPrimary}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="ลบรูปภาพหลักทั้งหมด"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 2. Reference Images (Multiple Supported) */}
                    <div className="p-3 bg-white rounded-xl border border-amber-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span className="text-xs font-bold text-amber-900">ภาพอ้างอิงจริง (Reference / Dicut)</span>
                          </div>
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                            {quickEditRefImages.length} รูป
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          ภาพถ่ายจริงหรือภาพไดคัทของสินค้านี้ (สามารถเลือกเพิ่มได้หลายรูปพร้อมกัน)
                        </p>

                        {/* Thumbnail Grid */}
                        <div className="mt-2.5 min-h-[72px] p-2 bg-amber-50/40 rounded-xl border border-amber-200/80">
                          {quickEditRefImages.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {quickEditRefImages.map((imgUrl, idx) => (
                                <div
                                  key={idx}
                                  className="relative group aspect-square rounded-lg bg-white border border-amber-200 overflow-hidden shadow-2xs"
                                >
                                  <img
                                    src={imgUrl}
                                    alt={`Ref ${idx + 1}`}
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={() =>
                                      openSingleImagePreview(
                                        imgUrl,
                                        quickEditProduct?.sku,
                                        `ภาพอ้างอิงจริง (${idx + 1}/${quickEditRefImages.length})`
                                      )
                                    }
                                  />
                                  <span className="absolute top-1 left-1 bg-amber-900/80 text-white text-[9px] font-bold px-1 rounded">
                                    {idx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveQuickEditRefAt(idx)}
                                    className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-md opacity-90 hover:opacity-100 transition shadow-xs cursor-pointer"
                                    title="ลบภาพนี้"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-16 flex flex-col items-center justify-center text-amber-700/60 text-[11px] gap-1">
                              <Camera className="w-5 h-5 text-amber-400" />
                              <span>ยังไม่มีภาพอ้างอิงจริง</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons: เพิ่มหลายรูป / เปลี่ยนทั้งหมด / ลบทั้งหมด */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-amber-100">
                        {/* 1. ปุ่มเพิ่มภาพอ้างอิง (รองรับหลายรูป) */}
                        <label className="flex-1 min-w-[110px] py-2 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs">
                          <Plus className="w-3.5 h-3.5" />
                          <span>{quickEditUploadingRef ? 'กำลังอัปโหลด...' : '+ เพิ่มภาพอ้างอิง'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={quickEditUploadingRef}
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) handleUploadQuickEditRefFiles(files);
                              e.target.value = '';
                            }}
                          />
                        </label>

                        {/* 2. ปุ่มแทนที่ทั้งหมด */}
                        <label className="py-2 px-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                          <span>แทนที่ใหม่</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={quickEditUploadingRef}
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                handleClearAllQuickEditRef();
                                await handleUploadQuickEditRefFiles(files);
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>

                        {/* 3. ลบภาพอ้างอิงทั้งหมด */}
                        {quickEditRefImages.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllQuickEditRef}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="ลบภาพอ้างอิงทั้งหมด"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickEditProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  ยกเลิก
                </button>
                  <button
                    type="submit"
                    disabled={quickEditSaving}
                    className="px-5 py-2 bg-[#161B40] hover:bg-[#1f2557] text-white rounded-xl text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {quickEditSaving ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>บันทึกข้อมูล (Real-time)</span>
                      </>
                    )}
                  </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-[#402E20]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#D2B681]">
            <h3 className="text-base font-bold text-[#402E20] mb-2">ยืนยันการลบสินค้า</h3>
            <p className="text-xs text-[#705E4F] mb-4 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบสินค้ารายการนี้? ประวัติราคาและความเชื่อมโยงกับลิงก์จะถูกนำออกอย่างถาวร
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-[#705E4F] hover:bg-[#F7F0E6] rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
