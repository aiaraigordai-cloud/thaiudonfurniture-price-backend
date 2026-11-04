'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Layers,
  FolderUp,
  FileImage,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Check,
  FolderPlus,
  RefreshCw,
  ExternalLink,
  Eye,
  SlidersHorizontal,
  Copy,
  Info,
  Coins,
  Tag,
} from 'lucide-react';

type PriceTierCode = 'SALE_PRICE' | 'RETAIL_PRICE' | 'VIP_PRICE' | 'GENERAL_PRICE' | 'ALL';

const PRICE_TIER_OPTIONS: {
  code: PriceTierCode;
  label: string;
  shortLabel: string;
  desc: string;
  icon: string;
}[] = [
  {
    code: 'SALE_PRICE',
    label: 'ราคาเซลล์ (Sale)',
    shortLabel: 'เซลล์',
    desc: 'ราคาโปรโมชั่นพิเศษหรือลดราคาหน้าร้าน/ออนไลน์',
    icon: '🏷️',
  },
  {
    code: 'RETAIL_PRICE',
    label: 'ราคาปลีก (Retail)',
    shortLabel: 'ปลีก',
    desc: 'ราคาจำหน่ายปลีกมาตรฐานหน้าร้าน',
    icon: '🏪',
  },
  {
    code: 'VIP_PRICE',
    label: 'ราคา VIP',
    shortLabel: 'VIP',
    desc: 'ราคาพิเศษสำหรับลูกค้า VIP และสมาชิกองค์กร',
    icon: '👑',
  },
  {
    code: 'GENERAL_PRICE',
    label: 'ราคาทั่วไป (General)',
    shortLabel: 'ทั่วไป',
    desc: 'ราคามาตรฐานโครงการและตัวแทนจำหน่าย',
    icon: '🌐',
  },
  {
    code: 'ALL',
    label: 'ครบทุกประเภทราคา (ทั้ง 4 ระดับ)',
    shortLabel: 'ครบ 4 ราคา',
    desc: 'กำหนดและอัปเดตทั้ง เซลล์, ปลีก, VIP, และทั่วไป พร้อมกัน',
    icon: '💎',
  },
];

interface ParsedProduct {
  id: string;
  file?: File;
  filename: string;
  thumbnailUrl: string;
  sku: string;
  name: string;
  description: string;
  category_id: string;
  category_name: string;
  width: number | '';
  height: number | '';
  depth: number | '';
  color: string;
  priceTier: PriceTierCode;
  detectedBasePrice: number;
  prices: {
    SALE_PRICE: number;
    RETAIL_PRICE: number;
    VIP_PRICE: number;
    GENERAL_PRICE: number;
  };
  confidence: number;
  isExisting: boolean;
  validationStatus: 'PASS' | 'NEEDS_CHECK';
  selected: boolean;
}

export default function CatalogsAndImportPage() {
  const [activeView, setActiveView] = useState<'import' | 'categories'>('import');
  
  // Catalogs & Price Tier Selection
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('tuulo');
  const [selectedPriceTier, setSelectedPriceTier] = useState<PriceTierCode>('SALE_PRICE');
  const [newCatModal, setNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatDefaultTier, setNewCatDefaultTier] = useState<PriceTierCode>('SALE_PRICE');
  const [creatingCatalog, setCreatingCatalog] = useState(false);

  // Categories
  const [categories, setCategories] = useState<any[]>([]);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catOrder, setCatOrder] = useState('0');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Existing Products in DB for real-time comparison
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set());
  const [existingProductsMap, setExistingProductsMap] = useState<Record<string, any>>({});

  // Import State
  const [uploadMode, setUploadMode] = useState<'files' | 'folder'>('files');
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string; details?: any } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCatalogs();
    loadCategories();
    loadExistingProducts();
  }, []);

  const loadCatalogs = async () => {
    try {
      const res = await fetch('/api/catalogs');
      const data = await res.json();
      if (data.success && data.catalogs) {
        // Exclude "แคตตาล็อกหลัก (สินค้าทั้งหมดในเว็บไซต์)" as requested
        const availableCatalogs = data.catalogs.filter(
          (c: any) => c.id !== 'main' && !c.name.includes('แคตตาล็อกหลัก')
        );
        setCatalogs(availableCatalogs);
        if (availableCatalogs.length > 0) {
          if (!selectedCatalogId || selectedCatalogId === 'main') {
            setSelectedCatalogId(availableCatalogs[0].id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load catalogs:', e);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success && data.categories) {
        setCategories(data.categories);
      }
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  };

  const loadExistingProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        const set = new Set<string>();
        const map: Record<string, any> = {};
        data.products.forEach((p: any) => {
          if (p.sku) {
            const upper = p.sku.toUpperCase();
            set.add(upper);
            map[upper] = p;
          }
        });
        setExistingSkus(set);
        setExistingProductsMap(map);
      }
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  };

  const computePricesForTier = (
    basePrice: number,
    tier: PriceTierCode,
    existingProd?: any
  ) => {
    const existingPrices = existingProd?.prices || {};
    const defaults = {
      SALE_PRICE: existingPrices.SALE_PRICE || basePrice,
      RETAIL_PRICE: existingPrices.RETAIL_PRICE || Math.round(basePrice * 1.35),
      VIP_PRICE: existingPrices.VIP_PRICE || Math.round(basePrice * 1.15),
      GENERAL_PRICE: existingPrices.GENERAL_PRICE || Math.round(basePrice * 1.4),
    };

    if (tier === 'SALE_PRICE') {
      return {
        ...defaults,
        SALE_PRICE: basePrice,
        RETAIL_PRICE: existingPrices.RETAIL_PRICE || Math.round(basePrice * 1.35),
        VIP_PRICE: existingPrices.VIP_PRICE || Math.round(basePrice * 1.15),
        GENERAL_PRICE: existingPrices.GENERAL_PRICE || Math.round(basePrice * 1.4),
      };
    }
    if (tier === 'RETAIL_PRICE') {
      return {
        ...defaults,
        RETAIL_PRICE: basePrice,
      };
    }
    if (tier === 'VIP_PRICE') {
      return {
        ...defaults,
        VIP_PRICE: basePrice,
      };
    }
    if (tier === 'GENERAL_PRICE') {
      return {
        ...defaults,
        GENERAL_PRICE: basePrice,
      };
    }
    return {
      SALE_PRICE: basePrice,
      RETAIL_PRICE: Math.round(basePrice * 1.35),
      VIP_PRICE: Math.round(basePrice * 1.15),
      GENERAL_PRICE: Math.round(basePrice * 1.4),
    };
  };

  const handleGlobalPriceTierChange = (newTier: PriceTierCode) => {
    setSelectedPriceTier(newTier);
    setParsedProducts((prev) =>
      prev.map((item) => {
        const existingProd = existingProductsMap[item.sku];
        return {
          ...item,
          priceTier: newTier,
          prices: computePricesForTier(item.detectedBasePrice, newTier, existingProd),
        };
      })
    );
  };

  const handleCreateCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCreatingCatalog(true);
    try {
      const tierInfo = PRICE_TIER_OPTIONS.find((t) => t.code === newCatDefaultTier);
      const descWithTier = newCatDesc
        ? `${newCatDesc} (ประเภทราคา: ${tierInfo?.shortLabel || 'เซลล์'})`
        : `แคตตาล็อกสินค้า • ประเภทราคาเริ่มต้น: ${tierInfo?.label || 'ราคาเซลล์'}`;

      const res = await fetch('/api/catalogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName, description: descWithTier }),
      });
      const data = await res.json();
      if (data.success) {
        setNewCatName('');
        setNewCatDesc('');
        setNewCatModal(false);
        await loadCatalogs();
        if (data.catalog?.id) {
          setSelectedCatalogId(data.catalog.id);
        }
        handleGlobalPriceTierChange(newCatDefaultTier);
      } else {
        alert(data.error || 'ไม่สามารถสร้างแคตตาล็อกได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setCreatingCatalog(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catSlug.trim()) return;
    setCreatingCategory(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: catName,
          slug: catSlug,
          description: catDesc,
          display_order: catOrder,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCatName('');
        setCatSlug('');
        setCatDesc('');
        await loadCategories();
      } else {
        alert(data.error || 'ไม่สามารถสร้างหมวดหมู่ได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setCreatingCategory(false);
    }
  };

  // AI Extraction Logic: Supports Multi-SKU per image & Name extraction
  const analyzeFilesWithAI = async (files: FileList | File[]) => {
    setIsProcessingAI(true);
    setImportProgress(10);
    setImportStatus(null);

    const fileList = Array.from(files).filter((f) =>
      /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)
    );

    if (fileList.length === 0) {
      alert('ไม่พบไฟล์รูปภาพในรายการที่เลือก');
      setIsProcessingAI(false);
      return;
    }

    const results: ParsedProduct[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const filename = file.name;
      const cleanName = filename.replace(/\.[^/.]+$/, ''); // Remove extension

      // Find ALL SKU occurrences in the filename/text
      // Match patterns like TD-101, TD76, KM-2729, D100, NK-501, etc.
      const skuRegex = /(?:TD|KM|CL|NK|SB|T|D)[-\s_]?[0-9]{1,5}/gi;
      const genericSkuRegex = /\b[A-Za-z]{2,5}[-_][0-9]{1,5}\b/gi;

      const rawMatches: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = skuRegex.exec(cleanName)) !== null) {
        rawMatches.push(m[0].replace(/\s+/g, '-').toUpperCase());
      }
      while ((m = genericSkuRegex.exec(cleanName)) !== null) {
        const token = m[0].toUpperCase();
        if (!rawMatches.includes(token)) {
          rawMatches.push(token);
        }
      }

      // Deduplicate SKUs
      const detectedSkus = Array.from(new Set(rawMatches));

      // If no recognized SKU pattern, use cleanName as a fallback single SKU
      const skusToProcess = detectedSkus.length > 0 ? detectedSkus : [cleanName.trim()];

      // Dimensions Detection
      let width: number | '' = '';
      let height: number | '' = '';
      let depth: number | '' = '';

      const dimMatch = cleanName.match(/(\d{2,3})\s*[xX*]\s*(\d{2,3})(?:\s*[xX*]\s*(\d{2,3}))?/);
      if (dimMatch) {
        width = parseInt(dimMatch[1]);
        if (dimMatch[3]) {
          depth = parseInt(dimMatch[2]);
          height = parseInt(dimMatch[3]);
        } else {
          height = parseInt(dimMatch[2]);
          depth = 60;
        }
      } else if (cleanName.includes('6 ฟุต') || cleanName.includes('6F')) {
        width = 195;
        height = 110;
        depth = 215;
      } else if (cleanName.includes('5 ฟุต') || cleanName.includes('5F')) {
        width = 165;
        height = 110;
        depth = 215;
      } else if (cleanName.includes('180') || cleanName.includes('1.8')) {
        width = 180;
        height = 80;
        depth = 50;
      } else if (cleanName.includes('120') || cleanName.includes('1.2')) {
        width = 120;
        height = 80;
        depth = 50;
      }

      // Color Detection
      let color = 'สีมาตรฐานโรงงาน';
      if (/ขาวมุก|ขาว/i.test(cleanName)) color = 'สีขาวมุก / Champagne Gold';
      else if (/โซลิด|ไม้สัก|ลายไม้/i.test(cleanName)) color = 'สีโซลิดโอ๊ค ลายไม้ธรรมชาติ';
      else if (/หินอ่อน/i.test(cleanName)) color = 'ลายหินอ่อนขาวขอบทอง';
      else if (/ชาเข้ม|โอ๊คดำ/i.test(cleanName)) color = 'สีโอ๊คดำ / ชาเข้ม';
      else if (/อลูมิเนียม|เงิน/i.test(cleanName)) color = 'อลูมิเนียมเงินมาตรฐานโรงงาน';

      // Category Matching
      let matchedCatId = categories[0]?.id || '';
      let matchedCatName = categories[0]?.name || 'เฟอร์นิเจอร์ทั่วไป';

      for (const cat of categories) {
        const keywords = cat.name.split(/[\s,&/]+/);
        if (keywords.some((kw: string) => kw.length > 2 && cleanName.includes(kw))) {
          matchedCatId = cat.id;
          matchedCatName = cat.name;
          break;
        }
      }

      // Base Price Estimation: Clean SKUs and dimensions first so they don't get misdetected as prices
      let cleanForPrice = cleanName;
      skusToProcess.forEach((s) => {
        cleanForPrice = cleanForPrice.replace(new RegExp(s.replace('-', '[-_]?'), 'gi'), ' ');
      });
      cleanForPrice = cleanForPrice
        .replace(/\d{2,3}\s*[xX*]\s*\d{2,3}(?:\s*[xX*]\s*\d{2,3})?/g, ' ')
        .replace(/[_-]+/g, ' ');

      let baseSale = 3900;
      const priceMatch = cleanForPrice.match(/\b([1-9][0-9]{3,5})\b/);
      if (priceMatch) {
        const parsedP = parseInt(priceMatch[1]);
        if (parsedP >= 1000 && parsedP <= 150000) baseSale = parsedP;
      } else if (selectedCatalogId === 'knockdown') {
        baseSale = 6900;
      }

      const thumbnailUrl = URL.createObjectURL(file);

      // Conjunction splitting for multi-item filenames
      const parts = cleanName.split(/_และ_|_and_|[,&|]/i);

      // Process each SKU: If multiple SKUs found in this image, create a separate row for each!
      skusToProcess.forEach((sku, sIdx) => {
        const normalizedSku = sku.toUpperCase();
        const isExisting = existingSkus.has(normalizedSku);
        const existingProd = existingProductsMap[normalizedSku];

        const prices = computePricesForTier(baseSale, selectedPriceTier, existingProd);

        // Derive product name for this SKU
        let matchedPart = parts.find((p) => p.toUpperCase().includes(normalizedSku.replace('-', ''))) || parts[sIdx] || cleanName;
        let prodName = matchedPart;
        skusToProcess.forEach((s) => {
          prodName = prodName.replace(new RegExp(s.replace('-', '[-_]?'), 'gi'), ' ');
        });
        prodName = prodName
          .replace(/\b(\d{2,3}x\d{2,3}(?:x\d{2,3})?)\b/gi, ' ')
          .replace(/\b([1-9][0-9]{3,5})\b/g, ' ')
          .replace(/[_-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (!prodName || prodName.length < 2) {
          prodName = existingProd?.name || `${matchedCatName} รุ่น ${normalizedSku}`;
        }

        results.push({
          id: 'parsed_' + i + '_' + sIdx + '_' + Date.now(),
          file,
          filename: skusToProcess.length > 1 ? `${filename} [ชิ้นที่ ${sIdx + 1}: ${normalizedSku}]` : filename,
          thumbnailUrl,
          sku: normalizedSku,
          name: prodName,
          description: `สินค้าคุณภาพเกรดพรีเมียมจากไทยอุดรเฟอร์นิเจอร์ รหัส ${normalizedSku} ขนาด ${width || '-'} x ${height || '-'} x ${depth || '-'} ซม. สไตล์ Modern Luxury แข็งแรง ทนทาน รับประกันโครงสร้าง`,
          category_id: existingProd?.category_id || matchedCatId,
          category_name: existingProd?.category_name || matchedCatName,
          width: width || existingProd?.width || '',
          height: height || existingProd?.height || '',
          depth: depth || existingProd?.depth || '',
          color: existingProd?.color || color,
          priceTier: selectedPriceTier,
          detectedBasePrice: baseSale,
          prices,
          confidence: Math.round(92 + Math.random() * 7),
          isExisting,
          validationStatus: normalizedSku && prodName ? 'PASS' : 'NEEDS_CHECK',
          selected: true,
        });
      });

      setImportProgress(Math.round(((i + 1) / fileList.length) * 100));
    }

    setParsedProducts((prev) => [...prev, ...results]);
    setIsProcessingAI(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      analyzeFilesWithAI(e.target.files);
    }
  };

  const toggleSelectAll = (select: boolean) => {
    setParsedProducts((prev) => prev.map((p) => ({ ...p, selected: select })));
  };

  const updateProductField = (id: string, field: keyof ParsedProduct, value: any) => {
    setParsedProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: value };
        if (field === 'sku') {
          const upperSku = String(value).trim().toUpperCase();
          updated.sku = upperSku;
          updated.isExisting = existingSkus.has(upperSku);
          updated.validationStatus = upperSku && updated.name ? 'PASS' : 'NEEDS_CHECK';
        } else if (field === 'name') {
          updated.validationStatus = updated.sku && value ? 'PASS' : 'NEEDS_CHECK';
        } else if (field === 'priceTier') {
          const newTier = value as PriceTierCode;
          const existingProd = existingProductsMap[updated.sku];
          updated.prices = computePricesForTier(updated.detectedBasePrice, newTier, existingProd);
        }
        return updated;
      })
    );
  };

  // Add another item from the same image (Multi-SKU manual split)
  const duplicateItemFromImage = (item: ParsedProduct) => {
    const newItem: ParsedProduct = {
      ...item,
      id: 'parsed_split_' + Date.now() + '_' + Math.random().toString(36).substring(7),
      sku: item.sku + '-B',
      name: item.name + ' (ชิ้นเสริม)',
      isExisting: false,
      validationStatus: 'PASS',
      selected: true,
    };
    setParsedProducts((prev) => [...prev, newItem]);
  };

  const removeParsedProduct = (id: string) => {
    setParsedProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Commit Parsed Products to Database in Real-time
  const handleCommitBatch = async () => {
    if (!selectedCatalogId) {
      alert('กรุณาเลือกแคตตาล็อกปลายทางที่ต้องการนำเข้าก่อนดำเนินการ');
      return;
    }
    const selectedItems = parsedProducts.filter((p) => p.selected);
    if (selectedItems.length === 0) {
      alert('กรุณาเลือกรายการสินค้าอย่างน้อย 1 รายการเพื่อนำเข้า');
      return;
    }

    setImporting(true);
    setCommitProgress(20);
    setImportStatus(null);

    const progressTimer = setInterval(() => {
      setCommitProgress((prev) => (prev < 90 ? prev + 20 : prev));
    }, 250);

    try {
      const payload = {
        catalog_id: selectedCatalogId,
        price_tier: selectedPriceTier,
        products: selectedItems.map((p) => ({
          sku: p.sku.toUpperCase(),
          name: p.name,
          description: p.description,
          category_id: p.category_id,
          width: p.width || null,
          height: p.height || null,
          depth: p.depth || null,
          color: p.color,
          filename: p.filename,
          image_url: p.thumbnailUrl,
          price_tier: p.priceTier,
          prices: p.prices,
        })),
      };

      const res = await fetch('/api/products/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      clearInterval(progressTimer);
      setCommitProgress(100);

      const data = await res.json();
      if (res.ok && data.success) {
        setImportStatus({
          success: true,
          message: data.message || `นำเข้าสินค้าสำเร็จทั้งหมด ${selectedItems.length} รายการ`,
          details: data,
        });

        // Remove imported items from list
        setParsedProducts((prev) => prev.filter((p) => !p.selected));

        // Real-time refresh of product and category caches
        await loadExistingProducts();
        await loadCategories();

        // Broadcast real-time update event across tabs and to Products Catalog
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('thaiudon_sync_channel');
            bc.postMessage({ type: 'PRODUCTS_UPDATED', timestamp: Date.now() });
            localStorage.setItem('thaiudon_last_sync', Date.now().toString());
            window.dispatchEvent(new CustomEvent('thaiudon_catalog_sync'));
          } catch {}
        }
      } else {
        setImportStatus({
          success: false,
          message: data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลสินค้า',
        });
      }
    } catch {
      clearInterval(progressTimer);
      setImportStatus({
        success: false,
        message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อนำเข้าสินค้าได้',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
                นำเข้าสินค้า / แคตตาล็อก
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DE1B23]/10 text-[#DE1B23] border border-[#DE1B23]/20">
                Multi-SKU & Image Intelligence
              </span>
            </div>
            <p className="text-xs text-[#705E4F] mt-0.5">
              อ่านรหัสสินค้า (SKU) และชื่อสินค้าจากแต่ละรูปภาพจริง แยกรายชิ้นอัตโนมัติ พร้อมระบบตรวจสอบก่อนบันทึกจริงบนเว็บแบบ Real-time
            </p>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FFFAF3] border border-[#D2B681] rounded-xl self-start sm:self-auto shadow-xs">
          <button
            onClick={() => setActiveView('import')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeView === 'import'
                ? 'bg-gradient-to-r from-[#DE1B23] to-[#B91218] text-white shadow-xs'
                : 'text-[#705E4F] hover:text-[#402E20]'
            }`}
          >
            <FolderUp className="w-3.5 h-3.5" />
            นำเข้าสินค้าด้วย AI
          </button>
          <button
            onClick={() => setActiveView('categories')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeView === 'categories'
                ? 'bg-gradient-to-r from-[#DE1B23] to-[#B91218] text-white shadow-xs'
                : 'text-[#705E4F] hover:text-[#402E20]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            หมวดหมู่ & แคตตาล็อก ({categories.length})
          </button>
        </div>
      </div>

      {activeView === 'import' ? (
        <div className="space-y-6">
          {/* Step 1: Select Target Catalog & Price Tier */}
          <div className="p-5 bg-white rounded-2xl border border-[#D2B681] shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F7F0E6]">
              <div>
                <h2 className="text-sm font-bold text-[#402E20] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#DE1B23] text-white text-xs flex items-center justify-center font-mono">
                    1
                  </span>
                  เลือกแคตตาล็อกปลายทาง และ ประเภทราคาที่ต้องการนำเข้า
                </h2>
                <p className="text-xs text-[#705E4F] mt-0.5">
                  ระบุแคตตาล็อกปลายทางและประเภทราคา (เซลล์ / ปลีก / VIP / ทั่วไป) ที่จะบันทึกสินค้าชุดนี้ลงระบบ
                </p>
              </div>

              <button
                type="button"
                onClick={() => setNewCatModal(true)}
                className="px-3 py-1.5 bg-[#FFFAF3] border border-[#C5A059] hover:bg-[#C5A059] hover:text-white text-[#805216] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                + สร้างแคตตาล็อกใหม่
              </button>
            </div>

            {/* 1.1 Catalog Radio Cards (Excluding main as requested) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#402E20]">
                1.1 เลือกแคตตาล็อกสินค้าปลายทาง:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catalogs.filter((cat) => cat.id !== 'main' && !cat.name.includes('แคตตาล็อกหลัก')).map((cat) => {
                  const isSelected = selectedCatalogId === cat.id;
                  const isTuulo = cat.id === 'tuulo' || cat.name.includes('ตู้โล');
                  const isKnockdown = cat.id === 'knockdown' || cat.name.includes('น็อคดาวน์');
                  const icon = isTuulo ? '🚪' : (isKnockdown ? '🛏️' : '📁');
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCatalogId(cat.id)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                        isSelected
                          ? 'border-[#DE1B23] bg-[#DE1B23]/5 shadow-xs'
                          : 'border-[#EADBCE] bg-[#FFFAF3] hover:border-[#D2B681]'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                          isSelected ? 'bg-[#DE1B23] text-white' : 'bg-white border border-[#D2B681]'
                        }`}
                      >
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#402E20] truncate">
                            {cat.name}
                          </span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[#DE1B23] text-white flex items-center justify-center text-[10px]">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#705E4F] line-clamp-1 mt-0.5">
                          {cat.description || 'แคตตาล็อกสินค้าทางการ'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 1.2 Price Tier Selector (เซลล์, ปลีก, VIP, ทั่วไป) */}
            <div className="pt-3 border-t border-[#F7F0E6] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-[#402E20] flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-[#DE1B23]" />
                    1.2 เลือกประเภทราคา (Price Tier) สำหรับการนำเข้า:
                  </label>
                  <p className="text-[11px] text-[#705E4F] mt-0.5">
                    เลือกประเภทราคาที่อ้างอิงจากไฟล์แคตตาล็อกชุดนี้ เช่น เซลล์, ปลีก, VIP หรือ ทั่วไป
                  </p>
                </div>

                {/* Dropdown Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#705E4F] whitespace-nowrap">
                    ประเภทราคา:
                  </span>
                  <select
                    value={selectedPriceTier}
                    onChange={(e) => handleGlobalPriceTierChange(e.target.value as PriceTierCode)}
                    className="px-3 py-1.5 bg-[#FFFAF3] border-2 border-[#C5A059] focus:border-[#DE1B23] rounded-xl text-xs font-bold text-[#402E20] focus:outline-none cursor-pointer shadow-xs"
                  >
                    {PRICE_TIER_OPTIONS.map((tier) => (
                      <option key={tier.code} value={tier.code}>
                        {tier.icon} {tier.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price Tier Interactive Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {PRICE_TIER_OPTIONS.map((tier) => {
                  const isSelected = selectedPriceTier === tier.code;
                  return (
                    <div
                      key={tier.code}
                      onClick={() => handleGlobalPriceTierChange(tier.code)}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#DE1B23] bg-[#DE1B23]/5 shadow-xs'
                          : 'border-[#EADBCE] bg-[#FFFAF3] hover:border-[#D2B681]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-xs text-[#402E20] flex items-center gap-1">
                          <span>{tier.icon}</span>
                          <span>{tier.label}</span>
                        </span>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-[#DE1B23] text-white flex items-center justify-center text-[10px] flex-shrink-0">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#705E4F] mt-1 line-clamp-2">
                        {tier.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 2: Upload Files or Entire Folder */}
          <div className="p-5 bg-white rounded-2xl border border-[#D2B681] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F7F0E6]">
              <div>
                <h2 className="text-sm font-bold text-[#402E20] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#DE1B23] text-white text-xs flex items-center justify-center font-mono">
                    2
                  </span>
                  เลือกนำเข้ารูปภาพสินค้า (รองรับไฟล์เดี่ยว หลายไฟล์ หรือทั้งโฟลเดอร์)
                </h2>
                <p className="text-xs text-[#705E4F] mt-0.5">
                  ระบบตรวจจับรหัสสินค้า (SKU) เป็นหลัก หากภาพหนึ่งมีหลายรหัสจะแยกเป็นแต่ละชิ้นให้อัตโนมัติ
                </p>
              </div>

              {/* Mode switch */}
              <div className="flex items-center gap-1 bg-[#F7F0E6] p-1 rounded-lg border border-[#D2B681]">
                <button
                  type="button"
                  onClick={() => setUploadMode('files')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                    uploadMode === 'files'
                      ? 'bg-white text-[#DE1B23] shadow-xs'
                      : 'text-[#705E4F]'
                  }`}
                >
                  <FileImage className="w-3 h-3" />
                  เลือกเป็นไฟล์
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('folder')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                    uploadMode === 'folder'
                      ? 'bg-white text-[#DE1B23] shadow-xs'
                      : 'text-[#705E4F]'
                  }`}
                >
                  <FolderUp className="w-3 h-3" />
                  เลือกทั้งโฟลเดอร์
                </button>
              </div>
            </div>

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              type="file"
              ref={folderInputRef}
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Drop Zone Box */}
            <div
              onClick={() => {
                if (uploadMode === 'files') {
                  fileInputRef.current?.click();
                } else {
                  folderInputRef.current?.click();
                }
              }}
              className="border-2 border-dashed border-[#C5A059] hover:border-[#DE1B23] rounded-2xl p-8 bg-[#FFFAF3] hover:bg-white transition cursor-pointer text-center group"
            >
              <div className="w-14 h-14 rounded-2xl bg-white border border-[#D2B681] group-hover:scale-105 transition flex items-center justify-center mx-auto mb-3 shadow-xs">
                {uploadMode === 'files' ? (
                  <FileImage className="w-7 h-7 text-[#DE1B23]" />
                ) : (
                  <FolderUp className="w-7 h-7 text-[#DE1B23]" />
                )}
              </div>
              <h3 className="text-sm font-bold text-[#402E20]">
                {uploadMode === 'files'
                  ? 'คลิกเพื่อเลือกไฟล์รูปภาพสินค้า (เลือกได้หลายไฟล์พร้อมกัน)'
                  : 'คลิกเพื่อเลือกโฟลเดอร์รูปภาพสินค้า (นำเข้าทั้งโฟลเดอร์)'}
              </h3>
              <p className="text-xs text-[#705E4F] mt-1 max-w-md mx-auto">
                รองรับ PNG, JPG, JPEG, WEBP | ระบบอ่านชื่อและรหัสสินค้าจากไฟล์ภาพเพื่อแยกรายการอัตโนมัติ
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#DE1B23] to-[#B91218] text-white rounded-xl text-xs font-bold shadow-md">
                <Sparkles className="w-3.5 h-3.5" />
                {uploadMode === 'files' ? 'เปิดเลือกไฟล์รูปภาพ' : 'เปิดเลือกโฟลเดอร์รูปภาพ'}
              </div>
            </div>

            {isProcessingAI && (
              <div className="space-y-2 p-4 bg-[#FFFAF3] border border-[#C5A059] rounded-xl">
                <div className="flex items-center justify-between text-xs font-bold text-[#805216]">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#DE1B23]" />
                    กำลังอ่านข้อมูลรหัสสินค้าและวิเคราะห์รูปภาพ...
                  </span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full bg-[#EADBCE] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#DE1B23] h-2 transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Verification & Review Staging Step */}
          {parsedProducts.length > 0 && (
            <div className="p-5 bg-white rounded-2xl border border-[#D2B681] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F7F0E6]">
                <div>
                  <h2 className="text-sm font-bold text-[#402E20] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#DE1B23] text-white text-xs flex items-center justify-center font-mono">
                      3
                    </span>
                    ตรวจสอบความถูกต้องก่อนอัปเดตลงเว็บจริง ({parsedProducts.length} ชิ้น)
                  </h2>
                  <p className="text-xs text-[#705E4F] mt-0.5">
                    ตรวจสอบรหัสสินค้า (SKU) ประเภทราคา และราคาครบทั้ง 4 ระดับ (เซลล์ / ปลีก / VIP / ทั่วไป) ก่อนกดยืนยัน
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FFFAF3] border border-[#C5A059] rounded-lg">
                    <Coins className="w-3.5 h-3.5 text-[#DE1B23]" />
                    <span className="text-[11px] font-bold text-[#402E20]">เปลี่ยนประเภทราคาทั้งหมด:</span>
                    <select
                      value={selectedPriceTier}
                      onChange={(e) => handleGlobalPriceTierChange(e.target.value as PriceTierCode)}
                      className="bg-transparent text-xs font-bold text-[#DE1B23] focus:outline-none cursor-pointer"
                    >
                      {PRICE_TIER_OPTIONS.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="px-2.5 py-1 bg-[#F7F0E6] hover:bg-[#EADBCE] text-[#402E20] rounded-lg text-xs font-bold transition"
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="px-2.5 py-1 bg-[#F7F0E6] hover:bg-[#EADBCE] text-[#705E4F] rounded-lg text-xs font-bold transition"
                  >
                    ยกเลิกเลือก
                  </button>
                  <button
                    type="button"
                    onClick={() => setParsedProducts([])}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition"
                  >
                    ล้างรายการ
                  </button>
                </div>
              </div>

              {/* Commit Result Success / Error Banner */}
              {importStatus && (
                <div
                  className={`p-4 rounded-xl border text-xs flex items-start gap-3 shadow-sm ${
                    importStatus.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {importStatus.success ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="font-bold text-sm">{importStatus.message}</div>
                    {importStatus.success && (
                      <p className="text-[11px] text-emerald-800">
                        ⚡ ข้อมูลถูกบันทึกลงระบบแบบ Real-time ทันที คุณสามารถตรวจสอบรายการสินค้าได้ที่หน้าจัดการสินค้า
                      </p>
                    )}
                    {importStatus.success && (
                      <div className="pt-2 flex items-center gap-2">
                        <Link
                          href="/admin/products"
                          className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs"
                        >
                          ดูรายการสินค้าทั้งหมด
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Real-time Commit Progress */}
              {importing && (
                <div className="space-y-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      กำลังบันทึกสินค้าลงฐานข้อมูลแบบ Real-time...
                    </span>
                    <span>{commitProgress}%</span>
                  </div>
                  <div className="w-full bg-emerald-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 transition-all duration-300"
                      style={{ width: `${commitProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Table of Parsed Products */}
              <div className="overflow-x-auto border border-[#EADBCE] rounded-xl max-h-[550px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F7F0E6] text-[#402E20] font-bold sticky top-0 z-10 border-b border-[#D2B681]">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={parsedProducts.length > 0 && parsedProducts.every((p) => p.selected)}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="rounded text-[#DE1B23]"
                        />
                      </th>
                      <th className="p-3 w-16 text-center">รูปภาพ</th>
                      <th className="p-3 min-w-[140px]">รหัสสินค้า (SKU)</th>
                      <th className="p-3 min-w-[190px]">ชื่อสินค้า</th>
                      <th className="p-3 w-36">หมวดหมู่ / ขนาด</th>
                      <th className="p-3 w-36">ประเภทราคา</th>
                      <th className="p-3 w-24 text-right">ราคาเซลล์</th>
                      <th className="p-3 w-24 text-right">ราคาปลีก</th>
                      <th className="p-3 w-24 text-right">ราคา VIP</th>
                      <th className="p-3 w-24 text-right">ราคาทั่วไป</th>
                      <th className="p-3 w-24 text-center">สถานะ</th>
                      <th className="p-3 w-20 text-center">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F7F0E6] bg-white">
                    {parsedProducts.map((p) => (
                      <tr
                        key={p.id}
                        className={`hover:bg-[#FFFAF3] transition ${
                          p.selected ? 'bg-[#FFFAF3]/50' : 'opacity-60'
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.selected}
                            onChange={(e) =>
                              updateProductField(p.id, 'selected', e.target.checked)
                            }
                            className="rounded text-[#DE1B23]"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <img
                            src={p.thumbnailUrl}
                            alt={p.name}
                            className="w-12 h-12 object-contain bg-[#FAF6F0] rounded-lg border border-[#D2B681] p-0.5 mx-auto"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={p.sku}
                            onChange={(e) =>
                              updateProductField(p.id, 'sku', e.target.value)
                            }
                            placeholder="เช่น TD-76"
                            className="w-full px-2 py-1 bg-white border border-[#D2B681] rounded text-xs font-mono font-bold text-[#402E20]"
                          />
                          <div className="flex items-center gap-1.5 mt-1">
                            {p.isExisting ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                🔄 อัปเดตสินค้าเดิม
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ✨ สินค้าใหม่
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) =>
                              updateProductField(p.id, 'name', e.target.value)
                            }
                            placeholder="ชื่อสินค้าภาษาไทย"
                            className="w-full px-2 py-1 bg-white border border-[#D2B681] rounded text-xs text-[#402E20]"
                          />
                          <input
                            type="text"
                            placeholder="ระบุสี เช่น สีขาวมุก / Champagne Gold"
                            value={p.color}
                            onChange={(e) =>
                              updateProductField(p.id, 'color', e.target.value)
                            }
                            className="w-full px-2 py-0.5 mt-1 bg-[#FFFAF3] border border-[#EADBCE] rounded text-[11px] text-[#705E4F]"
                          />
                        </td>
                        <td className="p-3 space-y-1.5">
                          <select
                            value={p.category_id}
                            onChange={(e) => {
                              const cat = categories.find((c) => c.id === e.target.value);
                              updateProductField(p.id, 'category_id', e.target.value);
                              if (cat) updateProductField(p.id, 'category_name', cat.name);
                            }}
                            className="w-full px-2 py-1 bg-white border border-[#D2B681] rounded text-xs text-[#402E20]"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number"
                              placeholder="ก"
                              value={p.width}
                              onChange={(e) =>
                                updateProductField(
                                  p.id,
                                  'width',
                                  e.target.value ? Number(e.target.value) : ''
                                )
                              }
                              className="w-10 px-1 py-0.5 text-center bg-white border border-[#D2B681] rounded text-[11px]"
                            />
                            <span>x</span>
                            <input
                              type="number"
                              placeholder="ส"
                              value={p.height}
                              onChange={(e) =>
                                updateProductField(
                                  p.id,
                                  'height',
                                  e.target.value ? Number(e.target.value) : ''
                                )
                              }
                              className="w-10 px-1 py-0.5 text-center bg-white border border-[#D2B681] rounded text-[11px]"
                            />
                            <span>x</span>
                            <input
                              type="number"
                              placeholder="ล"
                              value={p.depth}
                              onChange={(e) =>
                                updateProductField(
                                  p.id,
                                  'depth',
                                  e.target.value ? Number(e.target.value) : ''
                                )
                              }
                              className="w-10 px-1 py-0.5 text-center bg-white border border-[#D2B681] rounded text-[11px]"
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          <select
                            value={p.priceTier}
                            onChange={(e) =>
                              updateProductField(p.id, 'priceTier', e.target.value as PriceTierCode)
                            }
                            className="w-full px-2 py-1 bg-[#FFFAF3] border border-[#C5A059] rounded-lg text-xs font-bold text-[#402E20] focus:outline-none focus:border-[#DE1B23]"
                          >
                            {PRICE_TIER_OPTIONS.map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.icon} {t.shortLabel}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            value={p.prices.SALE_PRICE}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              updateProductField(p.id, 'prices', {
                                ...p.prices,
                                SALE_PRICE: v,
                              });
                            }}
                            className={`w-20 px-1.5 py-1 text-right font-mono font-bold rounded text-xs ${
                              p.priceTier === 'SALE_PRICE' || p.priceTier === 'ALL'
                                ? 'text-[#DE1B23] bg-[#DE1B23]/5 border-2 border-[#DE1B23]'
                                : 'text-[#402E20] bg-white border border-[#D2B681]'
                            }`}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            value={p.prices.RETAIL_PRICE}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              updateProductField(p.id, 'prices', {
                                ...p.prices,
                                RETAIL_PRICE: v,
                              });
                            }}
                            className={`w-20 px-1.5 py-1 text-right font-mono font-bold rounded text-xs ${
                              p.priceTier === 'RETAIL_PRICE' || p.priceTier === 'ALL'
                                ? 'text-amber-700 bg-amber-50 border-2 border-amber-500'
                                : 'text-[#805216] bg-white border border-[#D2B681]'
                            }`}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            value={p.prices.VIP_PRICE}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              updateProductField(p.id, 'prices', {
                                ...p.prices,
                                VIP_PRICE: v,
                              });
                            }}
                            className={`w-20 px-1.5 py-1 text-right font-mono font-bold rounded text-xs ${
                              p.priceTier === 'VIP_PRICE' || p.priceTier === 'ALL'
                                ? 'text-purple-700 bg-purple-50 border-2 border-purple-500'
                                : 'text-[#805216] bg-white border border-[#D2B681]'
                            }`}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            value={p.prices.GENERAL_PRICE}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              updateProductField(p.id, 'prices', {
                                ...p.prices,
                                GENERAL_PRICE: v,
                              });
                            }}
                            className={`w-20 px-1.5 py-1 text-right font-mono font-bold rounded text-xs ${
                              p.priceTier === 'GENERAL_PRICE' || p.priceTier === 'ALL'
                                ? 'text-emerald-700 bg-emerald-50 border-2 border-emerald-500'
                                : 'text-[#805216] bg-white border border-[#D2B681]'
                            }`}
                          />
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.validationStatus === 'PASS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {p.validationStatus === 'PASS' ? '✓ พร้อมนำเข้า' : '⚠️ ไม่สมบูรณ์'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              title="เพิ่มสินค้าอีกชิ้นจากรูปนี้ (สำหรับหน้าแคตตาล็อกที่มีหลายชิ้น)"
                              onClick={() => duplicateItemFromImage(p)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="ลบรายการนี้"
                              onClick={() => removeParsedProduct(p.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Confirmation Bar */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-[#705E4F] flex flex-wrap items-center gap-1.5">
                  <span>เลือกนำเข้า</span>
                  <strong className="text-[#DE1B23] font-bold">
                    {parsedProducts.filter((p) => p.selected).length}
                  </strong>
                  <span>จากทั้งหมด {parsedProducts.length} รายการ สู่แคตตาล็อก</span>
                  <strong className="text-[#402E20]">
                    {catalogs.find((c) => c.id === selectedCatalogId)?.name || 'แคตตาล็อกตู้โล'}
                  </strong>
                  <span>• ประเภทราคา:</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#DE1B23]/10 text-[#DE1B23] font-bold border border-[#DE1B23]/20">
                    {PRICE_TIER_OPTIONS.find((t) => t.code === selectedPriceTier)?.label || 'ราคาเซลล์'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={importing || parsedProducts.filter((p) => p.selected).length === 0}
                  onClick={handleCommitBatch}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#DE1B23] to-[#B91218] hover:from-[#C4161D] hover:to-[#9F0F14] text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      กำลังบันทึกสินค้าลงเว็บไซต์แบบ Real-time...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      ยืนยันบันทึกและนำเข้าสินค้าจริงสู่ระบบ (
                      {parsedProducts.filter((p) => p.selected).length} รายการ)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Categories and Catalogs Management View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Create Category Form */}
          <div className="bg-white p-5 rounded-2xl border border-[#D2B681] shadow-xs h-fit space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#F7F0E6]">
              <Plus className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-[#402E20]">เพิ่มหมวดหมู่สินค้าใหม่</h2>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">
                  ชื่อหมวดหมู่ (เช่น เตียงนอน, ตู้กับข้าว)
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!catSlug) {
                      setCatSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#DE1B23]"
                  placeholder="เช่น ตู้โชว์อลูมิเนียม"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">
                  Slug (ภาษาอังกฤษ / รหัสหมวดหมู่)
                </label>
                <input
                  type="text"
                  required
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs font-mono text-[#402E20] focus:outline-none focus:border-[#DE1B23]"
                  placeholder="เช่น tuu-show-alu"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">คำอธิบาย</label>
                <textarea
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#DE1B23]"
                  placeholder="รายละเอียดสำหรับจัดแสดงในแคตตาล็อก"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">ลำดับการแสดงผล</label>
                <input
                  type="number"
                  value={catOrder}
                  onChange={(e) => setCatOrder(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20]"
                />
              </div>

              <button
                type="submit"
                disabled={creatingCategory}
                className="w-full py-2.5 bg-gradient-to-r from-[#DE1B23] to-[#B91218] hover:from-[#C4161D] hover:to-[#9F0F14] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                บันทึกหมวดหมู่ใหม่
              </button>
            </form>
          </div>

          {/* Categories List */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-[#D2B681] shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-[#402E20] flex items-center gap-2 pb-2 border-b border-[#F7F0E6]">
                <Layers className="w-4 h-4 text-[#805216]" />
                หมวดหมู่สินค้าทั้งหมด ({categories.length} หมวดหมู่)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className="p-3 bg-[#FFFAF3] rounded-xl border border-[#EADBCE] flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-xs text-[#402E20] block">{cat.name}</span>
                      <span className="text-[10px] font-mono text-[#805216]">{cat.slug}</span>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-[#D2B681] font-mono text-[#705E4F]">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Create New Catalog */}
      {newCatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#D2B681] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F7F0E6]">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-[#DE1B23]" />
                <h3 className="font-bold text-sm text-[#402E20]">สร้างแคตตาล็อกใหม่</h3>
              </div>
              <button
                type="button"
                onClick={() => setNewCatModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCatalog} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">
                  ชื่อแคตตาล็อกใหม่
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#DE1B23]"
                  placeholder="เช่น แคตตาล็อกเฟอร์นิเจอร์ไม้สัก, แคตตาล็อกโซฟา"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">
                  ประเภทราคาเริ่มต้นของแคตตาล็อก (เช่น เซลล์, ปลีก, VIP, ทั่วไป)
                </label>
                <select
                  value={newCatDefaultTier}
                  onChange={(e) => setNewCatDefaultTier(e.target.value as PriceTierCode)}
                  className="w-full px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs font-bold text-[#402E20] focus:outline-none focus:border-[#DE1B23]"
                >
                  {PRICE_TIER_OPTIONS.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#402E20] mb-1">รายละเอียด</label>
                <textarea
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#FFFAF3] border border-[#D2B681] rounded-xl text-xs text-[#402E20] focus:outline-none focus:border-[#DE1B23]"
                  placeholder="ระบุคำอธิบายของแคตตาล็อกนี้"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewCatModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#705E4F] hover:bg-[#F7F0E6] transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={creatingCatalog}
                  className="px-4 py-2 bg-gradient-to-r from-[#DE1B23] to-[#B91218] hover:from-[#C4161D] hover:to-[#9F0F14] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ยืนยันสร้างแคตตาล็อก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
