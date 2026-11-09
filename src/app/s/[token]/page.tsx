'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getThumbnailUrl } from '@/lib/r2';
import {
  Package,
  Search,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Eye,
  X,
  Truck,
  Phone,
  MessageCircle,
  Sparkles,
  MapPin,
  Clock,
  Download,
  Image as ImageIcon,
  Camera,
  ChevronLeft,
  ShoppingCart,
  Check,
  Share2,
  Trash2,
  Copy,
  Send,
  CheckCircle2,
  ListPlus,
  HelpCircle,
  User,
  Coins,
  ChevronDown,
  QrCode,
  ExternalLink,
} from 'lucide-react';

const PRICE_RANGES = [
  { id: 'all', label: 'ทุกช่วงราคา', min: 0, max: Infinity },
  { id: 'under_2k', label: 'ต่ำกว่า 2,000 บาท', min: 1, max: 1999 },
  { id: '2k_2999', label: '2,000–2,999 บาท', min: 2000, max: 2999 },
  { id: '3k_4999', label: '3,000–4,999 บาท', min: 3000, max: 4999 },
  { id: '5k_7999', label: '5,000–7,999 บาท', min: 5000, max: 7999 },
  { id: '8k_11999', label: '8,000–11,999 บาท', min: 8000, max: 11999 },
  { id: '12k_19999', label: '12,000–19,999 บาท', min: 12000, max: 19999 },
  { id: '20k_up', label: '20,000 บาทขึ้นไป', min: 20000, max: Infinity },
  { id: 'inquire', label: 'สอบถามราคา', min: -1, max: 0 },
];

export default function CustomerCatalogPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalogData, setCatalogData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [catalogTab, setCatalogTab] = useState<'all' | 'tuulo' | 'knockdown'>('all');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [isPriceRangeExpanded, setIsPriceRangeExpanded] = useState<boolean>(false);
  const [showSocialChannels, setShowSocialChannels] = useState<boolean>(false);
  const [selectedProductModal, setSelectedProductModal] = useState<any | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'graphic' | 'ref'>('graphic');

  // CART STATES
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartCopied, setCartCopied] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [cartToast, setCartToast] = useState<string | null>(null);

  // CUSTOMER NAME STATE (For Cart & Sharing)
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [sharedCustomerName, setSharedCustomerName] = useState<string>('');

  // SHARED CART VIEW MODE: Displays ONLY the customer's selected products when opened from a shared cart link
  const [isSharedCartView, setIsSharedCartView] = useState(false);
  const [sharedCartSkus, setSharedCartSkus] = useState<string[]>([]);

  // PREVIEW GUIDE MODAL: Shown every visit on initial page load as requested (except when viewing a shared cart link)
  const [showCartGuide, setShowCartGuide] = useState(true);

  // BANDWIDTH OPTIMIZATION: Pagination / Incremental loading (24 items per batch)
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Reset pagination to first batch whenever search, catalog filter, category, price range, or sharedCart changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, catalogTab, selectedCategory, selectedPriceRange, isSharedCartView]);

  // Format product size in "กว้าง x สูง x ลึก" while strictly preserving "ฟุต"
  const formatCustomerProductSize = (prod: any) => {
    const rawSizeText = String(prod?.sizeText || prod?.size_text || '').trim();
    if (rawSizeText && rawSizeText.includes('ฟุต')) {
      return rawSizeText;
    }
    if (prod?.width || prod?.height || prod?.depth) {
      return `กว้าง ${prod.width || '-'} x สูง ${prod.height || '-'} x ลึก ${prod.depth || '-'} ซม.`;
    }
    return rawSizeText || 'ขนาดมาตรฐาน';
  };

  const fetchCustomerCatalog = async (forceRefresh = false) => {
    try {
      const url = forceRefresh
        ? `/api/customer/${params.token}?refresh=1&t=${Date.now()}`
        : `/api/customer/${params.token}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'ไม่สามารถเปิดแคตตาล็อกได้');
      } else {
        setCatalogData(data);
        if (data.catalogFilter && data.catalogFilter !== 'all') {
          setCatalogTab(data.catalogFilter);
        }
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการโหลดแคตตาล็อกสินค้า');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerCatalog();

    // Bandwidth Optimization: Relax passive polling to 60s while relying on instant WebSocket (0.5s)
    const interval = setInterval(() => {
      fetchCustomerCatalog();
    }, 60000);

    // Multi-tab real-time sync via BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('thaiudon_sync_channel');
      bc.onmessage = (event) => {
        if (
          event.data?.type === 'PRICES_UPDATED' ||
          event.data?.type === 'PRICE_BATCH_UPDATED' ||
          event.data?.type === 'CATALOG_UPDATED' ||
          event.data?.type === 'PRODUCTS_UPDATED'
        ) {
          fetchCustomerCatalog(true);
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'thaiudon_last_sync' || e.key === 'thaiudon_batch_sync' || e.key === 'thaiudon_price_sync') {
        fetchCustomerCatalog(true);
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleFocus = () => {
      fetchCustomerCatalog(false);
    };
    window.addEventListener('focus', handleFocus);

    // Supabase Realtime WebSocket (Instant 0.5s updates when admin changes prices or images)
    let realtimeChannel: any = null;
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        realtimeChannel = supabase
          .channel(`customer-catalog-realtime-${params.token}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
            fetchCustomerCatalog(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'product_prices' }, () => {
            fetchCustomerCatalog(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'price_change_history' }, () => {
            fetchCustomerCatalog(true);
          })
          .subscribe();
      }
    } catch (e) {
      console.warn('Customer Supabase Realtime error:', e);
    }

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
      if (realtimeChannel) realtimeChannel.unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [params.token]);

  // Read URL parameters on mount (?cart=... & ?cname=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const cartParam = urlParams.get('cart');
        const cnameParam = urlParams.get('cname') || urlParams.get('name') || urlParams.get('customer_name');

        if (cnameParam && cnameParam.trim()) {
          const cleanName = cnameParam.trim();
          setSharedCustomerName(cleanName);
          setCustomerNameInput(cleanName);
        }

        if (cartParam) {
          const ids = cartParam.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
          if (ids.length > 0) {
            setSharedCartSkus(ids);
            setIsSharedCartView(true);
            setShowCartGuide(false); // Don't block sales rep with welcome guide
          }
        }
      } catch (err) {
        console.error('Error parsing shared cart param', err);
      }
    }
  }, []);

  // Load Cart & Customer Name from sessionStorage if not in shared cart mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedName = sessionStorage.getItem(`thaiudon_cname_${params.token}`);
        if (savedName && !sharedCustomerName) {
          setCustomerNameInput(savedName);
        }

        if (sharedCartSkus.length === 0) {
          const savedCart = sessionStorage.getItem(`thaiudon_cart_${params.token}`);
          if (savedCart) {
            setCart(JSON.parse(savedCart));
          }
        }
      } catch (e) {
        console.error('Failed to load cart/name from storage', e);
      }
    }
  }, [params.token, sharedCartSkus.length, sharedCustomerName]);

  // Populate Cart from catalogData when sharedCartSkus is present
  useEffect(() => {
    if (catalogData?.products && sharedCartSkus.length > 0) {
      const matched = catalogData.products.filter(
        (p: any) =>
          sharedCartSkus.includes(String(p.sku || '').toLowerCase()) ||
          sharedCartSkus.includes(String(p.id || '').toLowerCase())
      );
      if (matched.length > 0) {
        setCart(matched);
        try {
          sessionStorage.setItem(`thaiudon_cart_${params.token}`, JSON.stringify(matched));
        } catch {}
      }
    }
  }, [catalogData, sharedCartSkus, params.token]);

  // Sync open product modal's price if catalogData updates in background
  useEffect(() => {
    if (selectedProductModal && catalogData?.products) {
      const current = catalogData.products.find((p: any) => p.id === selectedProductModal.id);
      if (current && current.price !== selectedProductModal.price) {
        setSelectedProductModal((prev: any) => ({
          ...prev,
          price: current.price,
        }));
      }
    }
  }, [catalogData]);

  // Cart Helper functions
  const showToast = (msg: string) => {
    setCartToast(msg);
    setTimeout(() => {
      setCartToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const handleCustomerNameChange = (val: string) => {
    setCustomerNameInput(val);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`thaiudon_cname_${params.token}`, val);
      } catch {}
    }
  };

  const saveCart = (newCart: any[]) => {
    setCart(newCart);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`thaiudon_cart_${params.token}`, JSON.stringify(newCart));
      } catch (e) {}
    }
  };

  const isInCart = (productId: string) => {
    return cart.some((item) => item.id === productId);
  };

  const toggleCart = (product: any) => {
    if (isInCart(product.id)) {
      const updated = cart.filter((item) => item.id !== product.id);
      saveCart(updated);
      showToast(`นำ "${product.sku || product.name}" ออกจากตะกร้าแล้ว`);
    } else {
      const updated = [...cart, product];
      saveCart(updated);
      showToast(`เพิ่ม "${product.sku || product.name}" ลงในตะกร้าแล้ว 🛒`);
    }
  };

  const removeFromCart = (productId: string) => {
    const item = cart.find((i) => i.id === productId);
    const updated = cart.filter((i) => i.id !== productId);
    saveCart(updated);
    if (item) {
      showToast(`นำ "${item.sku || item.name}" ออกจากตะกร้าแล้ว`);
    }
  };

  const clearCart = () => {
    if (window.confirm('คุณต้องการเคลียร์สินค้าในตะกร้าทั้งหมดใช่หรือไม่?')) {
      saveCart([]);
      showToast('เคลียร์สินค้าในตะกร้าเรียบร้อยแล้ว');
    }
  };

  // Helper to trigger file download with original full-resolution filename & extension
  const downloadFile = async (url: string, filename?: string) => {
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Fetch failed');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || url.split('/').pop() || 'furniture-image.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || url.split('/').pop() || 'furniture-image.jpg';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Pre-filled LINE OA inquiry URL for single product
  const getLineInquiryUrl = (_prod?: any) => {
    return 'https://line.me/ti/p/~0930494178';
  };

  // Cart total calculations
  const cartTotalAmount = cart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  // Generate shareable URL with ONLY cart product SKUs/IDs and optional customer name
  const getCartShareUrl = () => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    if (cart.length === 0) return `${origin}${pathname}`;
    const ids = cart.map((p) => p.sku || p.id).join(',');
    let url = `${origin}${pathname}?cart=${encodeURIComponent(ids)}`;
    if (customerNameInput.trim()) {
      url += `&cname=${encodeURIComponent(customerNameInput.trim())}`;
    }
    return url;
  };

  // Generate full summary text for LINE / Copying
  const getCartSummaryText = () => {
    const shareUrl = getCartShareUrl();
    const hasName = Boolean(customerNameInput.trim());
    const lines = [
      ...(hasName ? [
        `==============================`,
        `👤 ชื่อลูกค้า: คุณ${customerNameInput.trim()}`,
        `==============================`,
      ] : []),
      `🛒 *สรุปรายการสินค้าที่เลือกไว้ในตะกร้า* (${cart.length} รายการ)`,
      `โชว์รูมและโรงงาน: ไทยอุดรเฟอร์นิเจอร์`,
      `-------------------------------------------`,
      ...cart.map((p, idx) => {
        const priceStr = p.price && p.price > 0 ? `฿${p.price.toLocaleString()} บาท` : 'รอฝ่ายขายประเมินราคา';
        const resolvedSize = formatCustomerProductSize(p);
        const sizeStr = resolvedSize ? ` (ขนาด: ${resolvedSize})` : '';
        return `${idx + 1}. [${p.sku}] ${p.name}\n   - ราคา: ${priceStr}${sizeStr}`;
      }),
      `-------------------------------------------`,
      `💰 *ยอดรวมสินค้าโดยประมาณ: ฿${cartTotalAmount.toLocaleString()} บาท*`,
      ...(hasName ? [`👤 *ผู้สั่งซื้อ/ติดต่อ: คุณ${customerNameInput.trim()}*`] : []),
      ``,
      `🔗 *ลิงก์ดูเฉพาะสินค้าที่เลือกในตะกร้า:*`,
      `${shareUrl}`,
      ``,
      `(ต้องการสอบถามค่าจัดส่ง หรือสั่งซื้อสินค้า กรุณาส่งข้อความนี้ต่อให้ฝ่ายขายได้ทันที)`
    ];
    return lines.join('\n');
  };

  // Universal LINE Direct Share Handler (Works on both Mobile & Notebook/PC Desktop)
  const handleDirectLineShare = (e: React.MouseEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const summaryText = getCartSummaryText();
    const shareUrl = getCartShareUrl();

    // 1. Always copy full summary + link to clipboard so PC/Notebook users can also paste (Ctrl+V) immediately in LINE PC
    try {
      navigator.clipboard.writeText(summaryText);
      setCartCopied(true);
      setTimeout(() => setCartCopied(false), 3500);
    } catch {}

    // 2. Detect Mobile vs Notebook/Desktop PC
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    if (isMobile) {
      // On Mobile: open LINE app directly with pre-filled message
      window.location.href = `https://line.me/R/msg/text/?${encodeURIComponent(summaryText)}`;
    } else {
      // On Notebook / PC Desktop:
      // 1) Trigger LINE Desktop native URI scheme (if LINE PC is installed, opens chat picker with full text)
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `line://msg/text/?${encodeURIComponent(summaryText)}`;
        document.body.appendChild(iframe);
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 2500);
      } catch {}

      // 2) Open Official LINE Web Share Plugin popup window (works in any browser on Notebook/PC even without LINE app)
      const lineWebShareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(summaryText)}`;
      window.open(lineWebShareUrl, 'line_share_popup', 'width=620,height=680,menubar=no,toolbar=no,resizable=yes,scrollbars=yes');

      showToast('✅ คัดลอกข้อความและเปิดหน้าต่างแชร์ LINE สำหรับโน้ตบุ๊ก/PC แล้ว (กด Ctrl+V วางในแชท LINE ได้ทันที)');
    }
  };

  // Copy Cart Summary Text
  const copyCartSummary = () => {
    if (cart.length === 0) return;
    const text = getCartSummaryText();
    navigator.clipboard.writeText(text);
    setCartCopied(true);
    setTimeout(() => setCartCopied(false), 2500);
  };

  // Copy Cart Share Link
  const copyCartShareLink = () => {
    const url = getCartShareUrl();
    navigator.clipboard.writeText(url);
    setShareLinkCopied(true);
    setTimeout(() => setShareLinkCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-3 border-[#DE1B23] border-t-transparent rounded-full animate-spin mb-3"></div>
        <div className="text-base font-bold text-[#161B40]">กำลังเปิดแคตตาล็อกทางการ ไทยอุดรเฟอร์นิเจอร์...</div>
        <div className="text-xs text-slate-500 mt-1">อัปเดตราคาล่าสุดตรงจากระบบโรงงาน (Live Pricing)</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-red-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-lg font-bold text-[#161B40]">ไม่สามารถเปิดแคตตาล็อกได้</h1>
          <p className="text-xs text-slate-600 leading-relaxed">{error}</p>
          <div className="pt-2 text-[11px] text-slate-500">
            หากท่านเป็นเจ้าหน้าที่ กรุณาตรวจสอบสถานะลิงก์หรือวันหมดอายุในระบบหลังบ้าน
          </div>
        </div>
      </div>
    );
  }

  const products: any[] = catalogData?.products || [];
  const isSingleProductMode = catalogData?.sharingMode === 'SINGLE_PRODUCT' && products.length === 1;
  const singleProduct = isSingleProductMode ? products[0] : null;

  // BASE PRODUCTS: When in isSharedCartView, restrict base products to ONLY the selected cart products!
  const baseProducts = (isSharedCartView && sharedCartSkus.length > 0)
    ? products.filter(
        (p) =>
          sharedCartSkus.includes(String(p.sku || '').toLowerCase()) ||
          sharedCartSkus.includes(String(p.id || '').toLowerCase())
      )
    : products;

  // Filter products by search (including price), catalogTab (tuulo/knockdown/all), and category
  const filtered = baseProducts.filter((p) => {
    const rawSearch = search.trim();
    const cleanDigits = rawSearch.replace(/[,฿\s\.\-]/g, '');
    const priceNum = Number(p.price) || 0;
    const priceStr = priceNum > 0 ? String(priceNum) : '';
    const formattedPriceStr = priceNum > 0 ? priceNum.toLocaleString() : '';
    const matchPrice =
      Boolean(cleanDigits) &&
      priceNum > 0 &&
      (priceStr.includes(cleanDigits) || formattedPriceStr.includes(rawSearch) || priceStr === cleanDigits);

    const matchSearch =
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.sizeText?.toLowerCase().includes(search.toLowerCase()) ||
      matchPrice;

    const matchCatalog =
      isSharedCartView ||
      catalogTab === 'all' ||
      (catalogTab === 'tuulo' && p.catalogType === 'tuulo') ||
      (catalogTab === 'knockdown' && p.catalogType === 'knockdown');

    const matchCat = isSharedCartView || !selectedCategory || p.category_name === selectedCategory;

    let matchPriceRange = true;
    if (selectedPriceRange === 'all') {
      matchPriceRange = true;
    } else if (selectedPriceRange === 'inquire') {
      // หมายเหตุ : ส่วนสินค้าที่ราคาเป็น 0 หรือไม่มีราคา (-) ให้แยกเป็น “สอบถามราคา” ไม่รวมในช่วง “ต่ำกว่า 2,000 บาท”
      matchPriceRange = priceNum <= 0;
    } else {
      const currentRange = PRICE_RANGES.find((r) => r.id === selectedPriceRange);
      if (currentRange) {
        matchPriceRange = priceNum >= currentRange.min && priceNum <= currentRange.max;
      }
    }

    return matchSearch && matchCatalog && matchCat && matchPriceRange;
  });

  // Calculate available categories based on current catalog tab
  const tabProducts = baseProducts.filter((p) => {
    if (isSharedCartView) return true;
    if (catalogTab === 'tuulo') return p.catalogType === 'tuulo';
    if (catalogTab === 'knockdown') return p.catalogType === 'knockdown';
    return true;
  });

  const categoryCounts: Record<string, number> = {};
  tabProducts.forEach((p) => {
    if (p.category_name) {
      categoryCounts[p.category_name] = (categoryCounts[p.category_name] || 0) + 1;
    }
  });

  const availableCategories = Object.keys(categoryCounts);

  // Calculate price range counts based on tabProducts
  const priceRangeCounts: Record<string, number> = {};
  PRICE_RANGES.forEach((range) => {
    if (range.id === 'all') {
      priceRangeCounts['all'] = tabProducts.length;
    } else if (range.id === 'inquire') {
      priceRangeCounts['inquire'] = tabProducts.filter((p) => {
        const price = Number(p.price) || 0;
        return price <= 0;
      }).length;
    } else {
      priceRangeCounts[range.id] = tabProducts.filter((p) => {
        const price = Number(p.price) || 0;
        return price >= range.min && price <= range.max;
      }).length;
    }
  });

  // Modal navigation
  const currentModalIndex = selectedProductModal
    ? filtered.findIndex((p) => p.id === selectedProductModal.id)
    : -1;

  const handlePrevProduct = () => {
    if (currentModalIndex > 0) {
      setSelectedProductModal(filtered[currentModalIndex - 1]);
      setModalActiveTab('graphic');
    }
  };

  const handleNextProduct = () => {
    if (currentModalIndex < filtered.length - 1) {
      setSelectedProductModal(filtered[currentModalIndex + 1]);
      setModalActiveTab('graphic');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-red-500 selection:text-white relative">
      {/* TOAST NOTIFICATION */}
      {cartToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#161B40] text-white px-5 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 border border-amber-400/50 animate-in fade-in slide-in-from-top-3 duration-200">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{cartToast}</span>
        </div>
      )}

      {/* 1. TOP ANNOUNCEMENT BAR */}
      <div className="bg-[#DE1B23] text-white py-1.5 px-4 text-center text-xs font-semibold tracking-wide flex items-center justify-center gap-2 shadow-xs">
        <Sparkles className="w-3.5 h-3.5 text-amber-200 shrink-0" />
        <span>แคตตาล็อกสินค้าทางการ ไทยอุดรเฟอร์นิเจอร์ — อัปเดตราคาล่าสุดตรงจากระบบโรงงาน (Live Pricing)</span>
      </div>

      {/* 2. OFFICIAL STORE HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/logo-red.png"
              alt="ไทยอุดรเฟอร์นิเจอร์"
              className="w-12 h-12 object-contain rounded-full shadow-sm p-0.5 bg-white border border-slate-200"
              loading="eager"
              decoding="async"
            />
            <div>
              <div className="text-base sm:text-lg font-extrabold text-[#161B40] tracking-tight leading-tight flex items-center gap-2">
                <span>ไทยอุดรเฟอร์นิเจอร์</span>
                <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
                  Official
                </span>
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">
                {sharedCustomerName ? (
                  <span className="inline-flex items-center gap-1.5 text-sm sm:text-base font-black text-[#161B40] bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-lg">
                    👤 ลูกค้า: คุณ{sharedCustomerName}
                  </span>
                ) : (
                  (catalogData?.customerName || 'แคตตาล็อกสินค้าทางการ').replace(/\s*\(?\bVIP\b\)?/gi, '').trim() || 'แคตตาล็อกสินค้าทางการ'
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Social Channels Header Toggle */}
            <button
              onClick={() => setShowSocialChannels(!showSocialChannels)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                showSocialChannels
                  ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title="ช่องทางอื่นๆและติดตามผลงาน"
            >
              <Share2 className="w-4 h-4 text-red-600" />
              <span className="hidden lg:inline">ช่องทางอื่นๆและติดตามผลงาน</span>
              <span className="lg:hidden">ช่องทางอื่น</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  showSocialChannels ? 'rotate-180 text-red-600' : 'text-slate-400'
                }`}
              />
            </button>

            {/* Guide Help Button */}
            <button
              onClick={() => setShowCartGuide(true)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 border border-slate-200"
              title="ดูวิธีใช้งานและสั่งซื้อ"
            >
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">วิธีสั่งซื้อ</span>
            </button>

            {/* Cart Button in Header */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-3.5 py-2 rounded-xl bg-[#161B40] hover:bg-[#202758] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="ดูตะกร้าสินค้า"
            >
              <ShoppingCart className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">ตะกร้า</span>
              {cart.length > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-[18px] text-center">
                  {cart.length}
                </span>
              )}
            </button>

            {/* Direct Line Contact */}
            <a
              href="https://line.me/ti/p/~0930494178"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#06C755] hover:bg-[#05b54c] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden md:inline">สอบถามฝ่ายขาย LINE</span>
            </a>
          </div>
        </div>
      </header>

      {/* 3. MAIN CATALOG CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {/* TOP TAB: ช่องทางอื่นๆและติดตามผลงาน (รูปแบบย่อและแตกย่อยได้) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSocialChannels(!showSocialChannels)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#161B40] to-red-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Share2 className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-extrabold text-[#161B40]">
                  ช่องทางอื่นๆและติดตามผลงาน
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition shrink-0">
              <span>{showSocialChannels ? 'ย่อเก็บ' : 'ดูช่องทางทั้งหมด'}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  showSocialChannels ? 'rotate-180 text-red-600' : 'text-slate-400'
                }`}
              />
            </div>
          </button>

          {/* Sub-channels Grid (แตกย่อยได้) */}
          {showSocialChannels && (
            <div className="p-4 pt-2 border-t border-slate-100 bg-slate-50/70 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Facebook Thai Udon Furniture */}
                <a
                  href="https://www.facebook.com/ThaiUdonfurniture/?locale=th_TH"
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 bg-white hover:bg-red-50/40 rounded-xl border border-slate-200 hover:border-red-300 transition shadow-2xs flex items-center gap-3 group"
                >
                  <img
                    src="https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/social/thaiudon-fb.png"
                    alt="ไทยอุดรเฟอร์นิเจอร์"
                    className="w-11 h-11 rounded-xl object-contain bg-white p-0.5 border border-slate-200 shrink-0 group-hover:scale-105 transition"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-xs text-[#161B40] group-hover:text-red-600 transition truncate">
                      ไทยอุดรเฟอร์นิเจอร์
                    </div>
                    <span className="text-[11px] text-blue-600 font-bold inline-flex items-center gap-0.5 mt-1">
                      <span>เปิด Facebook</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </a>

                {/* 2. Built-In Thai Design */}
                <a
                  href="https://www.facebook.com/p/Built-In-Thai-Design-%E0%B8%9A%E0%B8%B4%E0%B9%89%E0%B8%A7%E0%B8%AD%E0%B8%B4%E0%B8%99%E0%B9%80%E0%B8%9F%E0%B8%AD%E0%B8%A3%E0%B9%8C%E0%B8%99%E0%B8%B4%E0%B9%80%E0%B8%88%E0%B8%AD%E0%B8%A3%E0%B9%8C-%E0%B8%AD%E0%B8%B8%E0%B8%94%E0%B8%A3%E0%B8%98%E0%B8%B2%E0%B8%99%E0%B8%B5-61550839135598/"
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 bg-white hover:bg-amber-50/40 rounded-xl border border-slate-200 hover:border-amber-300 transition shadow-2xs flex items-center gap-3 group"
                >
                  <img
                    src="https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/social/builtin-fb.jpg"
                    alt="Built-In Thai Design"
                    className="w-11 h-11 rounded-xl object-cover bg-white border border-slate-200 shrink-0 group-hover:scale-105 transition"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-xs text-[#161B40] group-hover:text-amber-700 transition truncate">
                      Built-In Thai Design
                    </div>
                    <span className="text-[11px] text-blue-600 font-bold inline-flex items-center gap-0.5 mt-1">
                      <span>เปิด Facebook</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </a>

                {/* 3. FurArii */}
                <a
                  href="https://www.facebook.com/people/FurArii-%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B8%9C%E0%B8%A5%E0%B8%B4%E0%B8%95%E0%B9%80%E0%B8%9F%E0%B8%AD%E0%B8%A3%E0%B9%8C%E0%B8%99%E0%B8%B4%E0%B9%80%E0%B8%88%E0%B8%AD%E0%B8%A3%E0%B9%8C-%E0%B8%8A%E0%B8%B8%E0%B8%94%E0%B8%AB%E0%B9%89%E0%B8%AD%E0%B8%87%E0%B8%99%E0%B8%AD%E0%B8%99-%E0%B9%82%E0%B8%8A%E0%B8%A7%E0%B9%8C%E0%B8%97%E0%B8%B5%E0%B8%A7%E0%B8%B5-%E0%B9%82%E0%B8%94%E0%B8%A2-%E0%B9%84%E0%B8%97%E0%B8%A2%E0%B8%AD%E0%B8%B8%E0%B8%94%E0%B8%A3%E0%B9%80%E0%B8%9F%E0%B8%AD%E0%B8%A3%E0%B9%8C%E0%B8%99%E0%B8%B4%E0%B9%80%E0%B8%88%E0%B8%AD%E0%B8%A3%E0%B9%8C/100083401898084/"
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200 hover:border-blue-300 transition shadow-2xs flex items-center gap-3 group"
                >
                  <img
                    src="https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/social/furarii-fb.jpg"
                    alt="FurArii โรงงานผลิตเฟอร์นิเจอร์"
                    className="w-11 h-11 rounded-xl object-cover bg-white border border-slate-200 shrink-0 group-hover:scale-105 transition"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-xs text-[#161B40] group-hover:text-blue-700 transition truncate">
                      FurArii เฟอร์นิเจอร์
                    </div>
                    <span className="text-[11px] text-blue-600 font-bold inline-flex items-center gap-0.5 mt-1">
                      <span>เปิด Facebook</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </a>

                {/* 4. TikTok @thaiudon_furniture */}
                <a
                  href="https://www.tiktok.com/@thaiudon_furniture"
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 hover:border-slate-400 transition shadow-2xs flex items-center gap-3 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.69a6.34 6.34 0 0 0 6.34 6.34 6.33 6.33 0 0 0 6.33-6.34V9.05a8.28 8.28 0 0 0 4.92 1.6V7.2a4.83 4.83 0 0 1-1-.51z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-xs text-[#161B40] group-hover:text-black transition truncate">
                      TikTok: @thaiudon_furniture
                    </div>
                    <span className="text-[11px] text-slate-800 font-bold inline-flex items-center gap-0.5 mt-1">
                      <span>ชมคลิปผลงานจริง</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </a>
              </div>
            </div>
          )}
        </div>
        {/* SHARED CART BANNER (When viewing a shared cart link) */}
        {isSharedCartView && (
          <div className="bg-gradient-to-r from-[#161B40] to-blue-900 text-white p-5 sm:p-6 rounded-3xl shadow-md border-2 border-amber-400 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <ShoppingCart className="w-7 h-7" />
              </div>
              <div>
                {sharedCustomerName && (
                  <div className="mb-1.5 inline-flex items-center gap-2 bg-amber-400 text-[#161B40] px-4 py-1.5 rounded-2xl shadow-sm">
                    <User className="w-5 h-5 text-[#161B40]" />
                    <span className="text-lg sm:text-2xl font-black tracking-tight">
                      ลูกค้า: คุณ{sharedCustomerName}
                    </span>
                  </div>
                )}
                <div className="font-extrabold text-base sm:text-lg flex flex-wrap items-center gap-2">
                  <span>
                    {sharedCustomerName
                      ? `รายการสินค้าของ "คุณ${sharedCustomerName}" ที่เลือกไว้ (${filtered.length} รายการ)`
                      : `รายการสินค้าที่ลูกค้าเลือกไว้ (${filtered.length} รายการ)`}
                  </span>
                  {!sharedCustomerName && (
                    <span className="bg-amber-400 text-[#161B40] text-[11px] px-2.5 py-0.5 rounded-full font-black">
                      เฉพาะสินค้าในตะกร้า
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {sharedCustomerName
                    ? `คุณ${sharedCustomerName} ได้เลือกสินค้าเหล่านี้และส่งต่อให้ฝ่ายขายตรวจสอบราคาและสต็อกปัจจุบัน`
                    : `ระบบแสดงเฉพาะสินค้าที่ลูกค้าเลือกไว้ในตะกร้า พร้อมราคาปัจจุบันตรงจากโรงงาน เพื่อให้ฝ่ายขายตรวจสอบได้ทันที`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsSharedCartView(false)}
                className="px-4 py-2 bg-white text-[#161B40] hover:bg-slate-100 rounded-xl text-xs font-bold transition shadow-xs whitespace-nowrap"
              >
                ดูแคตตาล็อกทั้งหมด ({products.length} รายการ)
              </button>
            </div>
          </div>
        )}

        {/* SINGLE PRODUCT MODE VIEW */}
        {isSingleProductMode && singleProduct ? (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-2">
            {/* Left: Product Images with Tabs */}
            <div className="p-6 bg-slate-50 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200">
              <div className="space-y-4">
                <div className="relative aspect-square bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs flex items-center justify-center">
                  <img
                    src={singleProduct.images?.[0] || singleProduct.refImageUrl}
                    alt={singleProduct.name}
                    className="w-full h-full object-contain"
                    loading="eager"
                    decoding="async"
                  />
                  {singleProduct.category_name && (
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#161B40] text-white text-xs font-semibold">
                      {singleProduct.category_name}
                    </div>
                  )}
                </div>

                {/* Download Actions */}
                <div className="flex items-center gap-2">
                  {singleProduct.images?.[0] && (
                    <button
                      onClick={() => downloadFile(singleProduct.images[0], singleProduct.graphicFilename)}
                      className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-red-600" />
                      <span>ดาวน์โหลดภาพกราฟิก</span>
                    </button>
                  )}
                  {singleProduct.refImageUrl && (
                    <button
                      onClick={() => downloadFile(singleProduct.refImageUrl, singleProduct.refFilename)}
                      className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>ดาวน์โหลดภาพอ้างอิง</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-[#161B40]">
                  <ShieldCheck className="w-4 h-4 text-red-600" />
                  <span>รับประกันโครงสร้างแข็งแรง มาตรฐานไทยอุดรเฟอร์นิเจอร์</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <Truck className="w-3.5 h-3.5 text-[#06C755]" />
                  <span>จัดส่งให้ติดต่อผ่าน line</span>
                </div>
              </div>
            </div>

            {/* Right: Details & Strict Price */}
            <div className="p-6 md:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="font-mono text-xs font-bold text-red-600 tracking-wider uppercase">
                    รหัสสินค้า: {singleProduct.sku}
                  </div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#161B40] tracking-tight mt-1 leading-snug">
                    {singleProduct.name}
                  </h1>
                </div>

                {singleProduct.description && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    {singleProduct.description}
                  </p>
                )}

                {/* Specs Box */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#161B40]">สเปกและขนาดสินค้า</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">ขนาด</span>
                      <span className="font-bold text-[#161B40]">
                        {formatCustomerProductSize(singleProduct)}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">สี / วัสดุ</span>
                      <span className="font-bold text-[#161B40]">
                        {singleProduct.catalogType === 'tuulo' ? 'ตามภาพ' : (singleProduct.color || 'ตามภาพมาตรฐาน')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strict Price Box — Rule 11: Display '-' if no price */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      ราคา
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-[#DE1B23] font-mono tracking-tight mt-0.5">
                      {singleProduct.price && singleProduct.price > 0
                        ? `฿${singleProduct.price.toLocaleString()}`
                        : '-'}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <div>รวมภาษีมูลค่าเพิ่ม</div>
                    <div className="text-[#06C755] font-semibold flex items-center gap-1 justify-end">
                      <Truck className="w-3 h-3" />
                      <span>จัดส่งให้ติดต่อผ่าน line</span>
                    </div>
                  </div>
                </div>

                {/* Cart Toggle Button */}
                <button
                  onClick={() => toggleCart(singleProduct)}
                  className={`w-full py-3.5 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm ${
                    isInCart(singleProduct.id)
                      ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300'
                      : 'bg-[#161B40] hover:bg-[#202758] text-white'
                  }`}
                >
                  {isInCart(singleProduct.id) ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>อยู่ในตะกร้าแล้ว (กดเพื่อลบออก)</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 text-amber-300" />
                      <span>ใส่ตะกร้าสินค้า</span>
                    </>
                  )}
                </button>

                {/* Direct Line Inquiry */}
                <a
                  href={getLineInquiryUrl(singleProduct)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>สอบถามทาง Line : 0930494178</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* MULTIPLE PRODUCTS / FULL CATALOG VIEW */
          <div className="space-y-6">
            {/* Catalog Switcher Tabs (ทั้งหมด / ตู้โล / น็อคดาวน์) */}
            {!isSharedCartView && catalogData?.catalogFilter === 'all' && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => { setCatalogTab('all'); setSelectedCategory(''); setSelectedPriceRange('all'); setIsPriceRangeExpanded(false); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
                    catalogTab === 'all'
                      ? 'bg-[#161B40] text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>ทั้งหมด ({products.length})</span>
                </button>
                <button
                  onClick={() => { setCatalogTab('tuulo'); setSelectedCategory(''); setSelectedPriceRange('all'); setIsPriceRangeExpanded(false); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
                    catalogTab === 'tuulo'
                      ? 'bg-[#161B40] text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-blue-400" />
                  <span>ตู้โลอลูมิเนียม ({products.filter((p) => p.catalogType === 'tuulo').length})</span>
                </button>
                <button
                  onClick={() => { setCatalogTab('knockdown'); setSelectedCategory(''); setSelectedPriceRange('all'); setIsPriceRangeExpanded(false); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
                    catalogTab === 'knockdown'
                      ? 'bg-[#161B40] text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>น็อคดาวน์ Modern Luxury ({products.filter((p) => p.catalogType === 'knockdown').length})</span>
                </button>
              </div>
            )}

            {/* Search Bar & Category Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหารหัสสินค้า, ชื่อรุ่น, ขนาด หรือค้นหาด้วยราคา (เช่น WU, ตู้กับข้าว, 2500)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-red-500 focus:outline-hidden transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Collapsible Price Range Filter (ปุ่มย่อช่วงราคา กดแล้วค่อยแสดงแต่ละช่วง โดยไม่แสดงจำนวนสินค้า) */}
              {!isSharedCartView && (
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPriceRangeExpanded(!isPriceRangeExpanded)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                        selectedPriceRange !== 'all'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-300 font-black'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                      title="กดเพื่อเปิด/ย่อตัวกรองช่วงราคา"
                    >
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        {selectedPriceRange !== 'all'
                          ? `ช่วงราคา: ${PRICE_RANGES.find((r) => r.id === selectedPriceRange)?.label}`
                          : 'ช่วงราคา'}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isPriceRangeExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {selectedPriceRange !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setSelectedPriceRange('all')}
                        className="text-[11px] text-red-600 hover:text-red-700 font-bold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition"
                        title="ล้างตัวกรองช่วงราคา"
                      >
                        <X className="w-3 h-3" />
                        <span>รีเซ็ตราคา</span>
                      </button>
                    )}
                  </div>

                  {/* Expanded Price Range Buttons (ไม่แสดงจำนวนสินค้าต่อท้าย) */}
                  {isPriceRangeExpanded && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                      {PRICE_RANGES.map((range) => {
                        const isSelected = selectedPriceRange === range.id;
                        return (
                          <button
                            key={range.id}
                            type="button"
                            onClick={() => setSelectedPriceRange(range.id)}
                            className={`px-3 py-1.5 rounded-full text-xs transition shrink-0 whitespace-nowrap cursor-pointer ${
                              isSelected
                                ? range.id === 'inquire'
                                  ? 'bg-slate-800 text-white shadow-xs font-bold ring-2 ring-slate-400'
                                  : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-xs font-black ring-2 ring-amber-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium'
                            }`}
                          >
                            {range.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Category Pills (Hide if in shared cart mode with few items) */}
              {availableCategories.length > 0 && !isSharedCartView && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                    หมวดหมู่:
                  </span>
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition shrink-0 ${
                      !selectedCategory
                        ? 'bg-red-600 text-white shadow-xs font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    ทั้งหมด ({tabProducts.length})
                  </button>
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-red-600 text-white shadow-xs font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat} ({categoryCounts[cat]})
                    </button>
                  ))}
                </div>
              )}

              {/* Status Info */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <div>
                  พบสินค้า <strong className="text-[#161B40] font-bold">{filtered.length}</strong> รายการ
                  {isSharedCartView && (
                    <span className="ml-2 text-amber-600 font-bold">(กำลังแสดงเฉพาะสินค้าในตะกร้า)</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {cart.length > 0 && (
                    <button
                      onClick={() => setIsSharedCartView(!isSharedCartView)}
                      className="text-amber-600 hover:underline flex items-center gap-1 font-bold"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{isSharedCartView ? 'แสดงสินค้าทั้งหมด' : `แสดงเฉพาะสินค้าในตะกร้า (${cart.length})`}</span>
                    </button>
                  )}
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => setShowCartGuide(true)}
                    className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>คำแนะนำการเลือกสินค้า</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Product Grid */}
            {filtered.length === 0 ? (
              <div className="py-20 text-center text-slate-500 space-y-2 bg-white rounded-3xl border border-slate-200">
                <Package className="w-12 h-12 mx-auto text-slate-300" />
                <div className="text-base font-bold text-[#161B40]">
                  {isSharedCartView ? 'ไม่พบสินค้าในตะกร้าที่ระบุ' : 'ไม่พบรายการสินค้าที่ค้นหา'}
                </div>
                <p className="text-xs">
                  {isSharedCartView ? 'กรุณากดดูแคตตาล็อกสินค้าทั้งหมดเพื่อเลือกสินค้าใหม่' : 'ลองพิมพ์คำค้นหาหรือเลือกหมวดหมู่อื่น'}
                </p>
                {isSharedCartView && (
                  <button
                    onClick={() => setIsSharedCartView(false)}
                    className="mt-3 px-4 py-2 bg-[#161B40] text-white rounded-xl text-xs font-bold hover:bg-[#202758] transition"
                  >
                    ดูแคตตาล็อกทั้งหมด ({products.length} รายการ)
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.slice(0, visibleCount).map((prod, idx) => {
                    const fullImg = prod.images?.[0] || prod.refImageUrl;
                    const thumbImg = getThumbnailUrl(fullImg);
                    const displayImg = thumbImg || fullImg;
                    const hasRef = Boolean(prod.refImageUrl);
                    const inCart = isInCart(prod.id);

                    return (
                      <article
                        key={prod.id}
                        className={`bg-white rounded-2xl border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group ${
                          inCart ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Image Click to Modal */}
                        <div
                          onClick={() => { setSelectedProductModal(prod); setModalActiveTab('graphic'); }}
                          className="relative aspect-square bg-slate-50 overflow-hidden cursor-pointer flex items-center justify-center"
                        >
                          {displayImg ? (
                            <img
                              src={displayImg}
                              alt={`${prod.sku} ${prod.name}`}
                              className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                              loading={idx < 4 ? "eager" : "lazy"}
                              decoding="async"
                            />
                          ) : (
                            <Package className="w-16 h-16 text-slate-300" />
                          )}

                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="px-3 py-1.5 rounded-full bg-white/95 text-slate-800 text-xs font-bold shadow-md flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5 text-red-600" />
                              ดูภาพขยาย
                            </span>
                          </div>

                          {prod.category_name && (
                            <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#161B40]/90 text-white text-[10px] font-semibold backdrop-blur-xs">
                              {prod.category_name}
                            </div>
                          )}

                          {/* Cart Badge on Top-Right of Card Image */}
                          {inCart && (
                            <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-sm flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>ในตะกร้า</span>
                            </div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <div className="font-mono text-xs font-bold text-red-600 tracking-wider">
                              {prod.sku}
                            </div>
                            <h2
                              onClick={() => { setSelectedProductModal(prod); setModalActiveTab('graphic'); }}
                              className="font-bold text-sm text-[#161B40] mt-0.5 line-clamp-2 hover:text-red-600 transition cursor-pointer"
                            >
                              {prod.name}
                            </h2>

                            {/* Price — Rule 11: Display '-' if no price */}
                            <p className="text-sm font-semibold text-slate-700 mt-2">
                              ราคา{' '}
                              <strong className="text-lg font-black text-[#DE1B23] font-mono">
                                {prod.price && prod.price > 0 ? `฿${prod.price.toLocaleString()}` : '-'}
                              </strong>
                            </p>

                            {/* Size & Page */}
                            <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                              <div>ขนาด: {formatCustomerProductSize(prod)}</div>
                              <div>
                                สี: <span className="font-semibold text-slate-700">{prod.catalogType === 'tuulo' ? 'ตามภาพ' : (prod.color || 'ตามภาพ')}</span>
                              </div>
                              <small className="text-[10px] text-slate-400 block">แคตตาล็อกหน้า {prod.pageNum || 1}</small>
                            </div>
                          </div>

                          {/* Action Nav Links */}
                          <div className="pt-2 border-t border-slate-100 space-y-2">
                            <div className="flex items-center gap-2">
                              {/* Download Graphic Button — ALWAYS downloads full-res original JPG */}
                              <button
                                onClick={() => downloadFile(fullImg, prod.graphicFilename)}
                                className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition flex items-center justify-center gap-1"
                                title="ดาวน์โหลดภาพกราฟิกไฟล์เดิม (ความละเอียดสูง)"
                              >
                                <Download className="w-3 h-3 text-red-600" />
                                <span>ดาวน์โหลดภาพ</span>
                              </button>

                              {/* Reference Image Button */}
                              {hasRef && (
                                <button
                                  onClick={() => { setSelectedProductModal(prod); setModalActiveTab('ref'); }}
                                  className="flex-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold transition flex items-center justify-center gap-1"
                                  title="ดูภาพอ้างอิงจริง"
                                >
                                  <Camera className="w-3 h-3 text-blue-600" />
                                  <span>📸 ภาพอ้างอิง</span>
                                </button>
                              )}
                            </div>

                            {/* 🛒 ADD TO CART BUTTON */}
                            <button
                              onClick={() => toggleCart(prod)}
                              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs ${
                                inCart
                                  ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300'
                                  : 'bg-[#161B40] hover:bg-[#202758] text-white'
                              }`}
                            >
                              {inCart ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>ใส่ตะกร้าแล้ว (กดเพื่อลบออก)</span>
                                </>
                              ) : (
                                <>
                                  <ShoppingCart className="w-3.5 h-3.5 text-amber-300" />
                                  <span>ใส่ตะกร้าสินค้า</span>
                                </>
                              )}
                            </button>

                            {/* LINE Order Button & QR Code Button */}
                            <div className="pt-1">
                              <a
                                href={getLineInquiryUrl(prod)}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-2 px-3 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs"
                              >
                                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>สอบถามทาง Line : 0930494178</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Pagination / Incremental Load More Bar */}
                {visibleCount < filtered.length && (
                  <div className="mt-8 flex flex-col items-center justify-center gap-3 py-6 px-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <p className="text-xs text-slate-600 font-medium">
                      กำลังแสดง <span className="font-bold text-[#161B40]">{Math.min(visibleCount, filtered.length)}</span> จากทั้งหมด <span className="font-bold text-[#161B40]">{filtered.length}</span> รายการ
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length))}
                        className="px-6 py-2.5 bg-[#161B40] hover:bg-[#202758] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
                      >
                        <span>โหลดสินค้าเพิ่มเติม (+{Math.min(PAGE_SIZE, filtered.length - visibleCount)} รายการ)</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setVisibleCount(filtered.length)}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        แสดงทั้งหมด ({filtered.length} รายการ)
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* 4. PREVIEW MODAL */}
      {selectedProductModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-300 relative">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-lg">
                  {selectedProductModal.sku}
                </span>
                <h3 className="font-bold text-sm text-[#161B40] truncate max-w-[280px] sm:max-w-md">
                  {selectedProductModal.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProductModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Image Viewer with Tabs */}
              <div className="space-y-3">
                {/* Tabs */}
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    onClick={() => setModalActiveTab('graphic')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      modalActiveTab === 'graphic'
                        ? 'bg-white text-red-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>ภาพสินค้า (Graphic)</span>
                  </button>

                  {selectedProductModal.refImageUrl && (
                    <button
                      onClick={() => setModalActiveTab('ref')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        modalActiveTab === 'ref'
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>📸 ภาพอ้างอิงจริง</span>
                    </button>
                  )}
                </div>

                {/* Displayed Image */}
                <div className="relative aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                  <img
                    src={
                      modalActiveTab === 'ref' && selectedProductModal.refImageUrl
                        ? selectedProductModal.refImageUrl
                        : (selectedProductModal.images?.[0] || selectedProductModal.refImageUrl)
                    }
                    alt={selectedProductModal.name}
                    className="w-full h-full object-contain p-2"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                {/* Download Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadFile(
                      selectedProductModal.images?.[0] || selectedProductModal.refImageUrl,
                      selectedProductModal.graphicFilename
                    )}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-red-600" />
                    <span>เซฟภาพกราฟิก</span>
                  </button>

                  {selectedProductModal.refImageUrl && (
                    <button
                      onClick={() => downloadFile(selectedProductModal.refImageUrl, selectedProductModal.refFilename)}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs font-semibold text-blue-700 flex items-center justify-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>เซฟภาพอ้างอิง</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Specifications & Strict Pricing */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-red-600 tracking-wider uppercase">
                      รหัสสินค้า: {selectedProductModal.sku}
                    </span>
                    <h2 className="text-xl font-bold text-[#161B40] mt-0.5">
                      {selectedProductModal.name}
                    </h2>
                  </div>

                  {/* Specs Table */}
                  <div className="space-y-2 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500">หมวดหมู่</div>
                      <div className="font-semibold text-[#161B40]">{selectedProductModal.category_name || '-'}</div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500">ขนาดสินค้า</div>
                      <div className="font-semibold text-[#161B40]">
                        {formatCustomerProductSize(selectedProductModal)}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500">สี / ลวดลาย</div>
                      <div className="font-semibold text-[#161B40]">
                        {selectedProductModal.catalogType === 'tuulo' ? 'ตามภาพ' : (selectedProductModal.color || 'ตามภาพมาตรฐาน')}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500">ตำแหน่งในแคตตาล็อก</div>
                      <div className="font-semibold text-[#161B40]">หน้า {selectedProductModal.pageNum || 1}</div>
                    </div>
                  </div>
                </div>

                {/* Strict Price Box — Rule 11 */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        ราคา
                      </div>
                      <div className="text-2xl font-black text-[#DE1B23] font-mono mt-0.5">
                        {selectedProductModal.price && selectedProductModal.price > 0
                          ? `฿${selectedProductModal.price.toLocaleString()}`
                          : '-'}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      <div className="text-[#06C755] font-semibold">จัดส่งให้ติดต่อผ่าน line</div>
                      <div>รับประกันความพึงพอใจ</div>
                    </div>
                  </div>

                  {/* Cart Toggle in Modal */}
                  <button
                    onClick={() => toggleCart(selectedProductModal)}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs ${
                      isInCart(selectedProductModal.id)
                        ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300'
                        : 'bg-[#161B40] hover:bg-[#202758] text-white'
                    }`}
                  >
                    {isInCart(selectedProductModal.id) ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>อยู่ในตะกร้าแล้ว (กดเพื่อลบออก)</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4 text-amber-300" />
                        <span>ใส่ตะกร้าสินค้ารุ่นนี้</span>
                      </>
                    )}
                  </button>

                  <a
                    href={getLineInquiryUrl(selectedProductModal)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>สอบถามทาง Line : 0930494178</span>
                  </a>

                  {/* Prev / Next navigation inside modal */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={handlePrevProduct}
                      disabled={currentModalIndex <= 0}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>รุ่นก่อนหน้า</span>
                    </button>
                    <span className="text-[11px] text-slate-400">
                      {currentModalIndex + 1} จาก {filtered.length}
                    </span>
                    <button
                      onClick={handleNextProduct}
                      disabled={currentModalIndex >= filtered.length - 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <span>รุ่นถัดไป</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. FLOATING CART POPUP BUTTON (ELEVATED 10% FROM BOTTOM AS REQUESTED) */}
      <div className="fixed bottom-[10%] right-6 z-40">
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative flex items-center gap-3 px-4 py-3 bg-[#161B40] hover:bg-[#1f2557] text-white rounded-full shadow-2xl border-2 border-amber-400 hover:scale-105 active:scale-95 transition-all group"
          title="คลิกเพื่อดูตะกร้าสินค้าและส่งรายการให้ฝ่ายขาย"
        >
          <div className="relative">
            <ShoppingCart className="w-6 h-6 text-amber-400 group-hover:rotate-6 transition-transform" />
            {cart.length > 0 && (
              <span className="absolute -top-2.5 -right-2.5 bg-red-600 text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white animate-bounce">
                {cart.length}
              </span>
            )}
          </div>
          <div className="text-left pr-1">
            <div className="text-[10px] text-amber-300 font-semibold leading-tight">ตะกร้าสินค้า</div>
            <div className="text-xs font-extrabold">
              {cart.length > 0 ? `${cart.length} ชิ้น (฿${cartTotalAmount.toLocaleString()})` : 'ยังไม่มีสินค้า'}
            </div>
          </div>
        </button>
      </div>

      {/* 6. POPUP แสดงสินค้าในตะกร้า & ส่งรายการให้ฝ่ายขาย */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-300 relative animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#161B40] text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                    <span>ตะกร้าสินค้าที่เลือกไว้</span>
                    <span className="bg-amber-400 text-[#161B40] text-xs px-2 py-0.5 rounded-full font-black">
                      {cart.length} รายการ
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">ตรวจสอบรายการและกดส่งให้ฝ่ายขายทาง LINE ได้ทันที</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    title="เคลียร์สินค้าในตะกร้าทั้งหมด"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>เคลียร์สินค้าในตะกร้า</span>
                  </button>
                )}
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="py-14 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <div className="text-base font-bold text-[#161B40]">ยังไม่มีสินค้าในตะกร้า</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    ท่านสามารถเลือกสินค้าที่สนใจโดยกดปุ่ม <strong>"ใส่ตะกร้าสินค้า"</strong> ที่รายการสินค้า เพื่อรวบรวมส่งให้ฝ่ายขายประเมินราคาพร้อมกัน
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-2 px-5 py-2.5 bg-[#161B40] text-white rounded-xl text-xs font-bold hover:bg-[#202758] transition"
                  >
                    กลับไปเลือกสินค้า
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200">
                    <span>รายการสินค้าในตะกร้า ({cart.length} ชิ้น)</span>
                    <button
                      onClick={clearCart}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-bold flex items-center gap-1 border border-red-200 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>เคลียร์สินค้าในตะกร้า</span>
                    </button>
                  </div>

                  {cart.map((item, idx) => {
                    const itemImg = item.images?.[0] || item.refImageUrl;
                    const itemThumb = getThumbnailUrl(itemImg) || itemImg;
                    return (
                      <div
                        key={item.id || idx}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition"
                      >
                        <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-1">
                          {itemThumb ? (
                            <img src={itemThumb} alt={item.name} className="w-full h-full object-contain" loading="lazy" decoding="async" />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[11px] font-bold text-red-600">
                            {item.sku}
                          </div>
                          <div className="font-bold text-xs text-[#161B40] truncate">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {formatCustomerProductSize(item)}
                          </div>
                          <div className="text-xs font-black text-[#DE1B23] font-mono mt-0.5">
                            {item.price && item.price > 0 ? `฿${item.price.toLocaleString()}` : 'สอบถามราคา'}
                          </div>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 rounded-xl bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 flex items-center justify-center transition shrink-0"
                          title="ลบออกจากตะกร้า"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer: Action Buttons */}
            {cart.length > 0 && (
              <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 space-y-3">
                {/* Customer Name Input Box before sharing or sending — EXTRA LARGE DISPLAY */}
                <div className="bg-white p-4 rounded-2xl border-2 border-amber-300 shadow-2xs space-y-2">
                  <label className="text-xs sm:text-sm font-extrabold text-[#161B40] flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>ชื่อลูกค้า / ผู้สั่งซื้อ (ระบุเพื่อให้ฝ่ายขายทราบ):</span>
                  </label>
                  <input
                    type="text"
                    value={customerNameInput}
                    onChange={(e) => handleCustomerNameChange(e.target.value)}
                    placeholder="พิมพ์ชื่อลูกค้า เช่น คุณสมชาย หรือ ร้านเฟอร์นิเจอร์"
                    className="w-full px-3.5 py-2.5 text-base sm:text-lg font-extrabold text-[#161B40] rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-400 focus:outline-hidden transition placeholder:text-slate-400 placeholder:font-normal placeholder:text-xs bg-amber-50/30 focus:bg-white"
                  />
                  {customerNameInput.trim() && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-[#161B40] to-blue-950 text-white flex items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-amber-400 text-[#161B40] text-[10px] font-black uppercase">
                          ชื่อลูกค้า
                        </span>
                        <span className="text-lg sm:text-2xl font-black text-amber-300 tracking-tight">
                          คุณ{customerNameInput.trim()}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-300 hidden sm:inline">พร้อมส่งให้ฝ่ายขาย</span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500">
                    * เมื่อระบุชื่อ ระบบจะแสดงชื่อลูกค้าตัวใหญ่ชัดเจนบนลิงก์และข้อความที่ส่งให้ฝ่ายขายอัตโนมัติ
                  </div>
                </div>

                {/* Total Summary */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      ยอดรวมสินค้าโดยประมาณ ({cart.length} รายการ)
                    </div>
                    {customerNameInput.trim() ? (
                      <div className="text-sm sm:text-base font-black text-blue-700 mt-0.5">
                        👤 ลูกค้า: คุณ{customerNameInput.trim()}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">ค่าจัดส่งติดต่อฝ่ายขายผ่าน LINE</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl sm:text-2xl font-black text-[#DE1B23] font-mono">
                      ฿{cartTotalAmount.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Primary Button: Direct link to Sales LINE */}
                <a
                  href="https://line.me/ti/p/~0930494178"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    try {
                      const text = getCartSummaryText();
                      navigator.clipboard.writeText(text);
                      showToast('คัดลอกรายการสินค้าแล้ว กำลังเปิด LINE: 0930494178...');
                    } catch {}
                  }}
                  className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b54c] text-white rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-md transition hover:scale-[1.01] active:scale-[0.99]"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>ติดต่อฝ่ายขายทาง LINE (0930494178)</span>
                </a>

                {/* Secondary Action: Direct LINE Share Link (Works on both Mobile & Notebook/PC) */}
                <button
                  type="button"
                  onClick={handleDirectLineShare}
                  className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                  title="รองรับทั้งมือถือ และโน้ตบุ๊ก/คอมพิวเตอร์ (เปิดแอป LINE หรือหน้าต่างแชร์ LINE พร้อมคัดลอกข้อความอัตโนมัติ)"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>แชร์ข้อความและลิงก์ตะกร้าเข้าแอป LINE โดยตรง</span>
                </button>

                {/* Secondary Actions: Copy, Share & Clear Cart */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={copyCartSummary}
                    className="py-2.5 px-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-700 flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    {cartCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700 truncate">คัดลอกแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">คัดลอกสรุป</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={copyCartShareLink}
                    className="py-2.5 px-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-700 flex items-center justify-center gap-1 transition cursor-pointer"
                    title="คัดลอกลิงก์ตะกร้าเพื่อส่งต่อ (จะแสดงเฉพาะสินค้าที่เลือกและชื่อลูกค้า)"
                  >
                    {shareLinkCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700 truncate">คัดลอกแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">แชร์ลิงก์ตะกร้า</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={clearCart}
                    className="py-2.5 px-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-600 hover:text-red-700 flex items-center justify-center gap-1 transition cursor-pointer"
                    title="เคลียร์สินค้าในตะกร้าทั้งหมด"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="truncate">เคลียร์สินค้าในตะกร้า</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. PREVIEW แนะนำฟังก์ชั่น เลือกสินค้าใส่ตะกร้า (WELCOME PREVIEW GUIDE MODAL) */}
      {showCartGuide && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-300 relative animate-in fade-in zoom-in-95 duration-200">
            {/* Guide Header with X Button */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#161B40] to-[#202758] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight text-white">
                    ยินดีต้อนรับสู่แคตตาล็อกออนไลน์
                  </h3>
                  <p className="text-[11px] text-amber-300">ไทยอุดรเฟอร์นิเจอร์ — ระบบเลือกสินค้าใส่ตะกร้า</p>
                </div>
              </div>
              <button
                onClick={() => setShowCartGuide(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                title="ปิดคำแนะนำ (X)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Guide Steps */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                ท่านสามารถเลือกดูสินค้าและสั่งซื้อได้สะดวกรวดเร็ว ผ่าน 3 ขั้นตอนง่ายๆ ดังนี้:
              </p>

              {/* Step 1 */}
              <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 font-black text-sm flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#161B40] flex items-center gap-1.5">
                    <span>กดปุ่ม "ใส่ตะกร้าสินค้า"</span>
                    <ShoppingCart className="w-3.5 h-3.5 text-amber-500" />
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    เลือกสินค้าที่ถูกใจได้หลายรายการพร้อมกัน
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 font-black text-sm flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#161B40] flex items-center gap-1.5">
                    <span>ตรวจสอบตะกร้าที่ปุ่มขวาล่าง</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    ปุ่มตะกร้าสีน้ำเงินจะแสดงจำนวนชิ้นที่เลือกไว้ สามารถคลิกเพื่อดูสรุปรายการทั้งหมดและยอดรวมได้ตลอดเวลา
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 font-black text-sm flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#161B40] flex items-center gap-1.5">
                    <span>ส่งรายการให้ฝ่ายขาย (LINE)</span>
                    <MessageCircle className="w-3.5 h-3.5 text-[#06C755]" />
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    กดปุ่มส่งรายการสินค้าหรือแชร์ลิงก์ตะกร้า เพื่อให้ฝ่ายขายสรุปยอดและจัดส่งให้ท่านได้ทันที
                  </p>
                </div>
              </div>
            </div>

            {/* Guide Footer Button */}
            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowCartGuide(false)}
                className="w-full py-3 bg-[#161B40] hover:bg-[#202758] text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>เข้าใจแล้ว / เริ่มเลือกสินค้าเลย</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. SITE FOOTER */}
      <footer className="bg-[#161B40] text-slate-300 py-10 px-4 mt-12 border-t-2 border-red-600">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img src="https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/assets/images/logo-red.png" alt="ไทยอุดรเฟอร์นิเจอร์" className="w-10 h-10 object-contain rounded-full bg-white p-0.5" loading="lazy" decoding="async" />
              <div>
                <div className="font-bold text-white text-sm">ไทยอุดรเฟอร์นิเจอร์</div>
                <div className="text-[10px] text-red-300">โรงงานและโชว์รูมเฟอร์นิเจอร์ครบวงจร</div>
              </div>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              ผู้ผลิตและจัดจำหน่ายเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury และตู้กับข้าว ตู้ครัวอลูมิเนียมคุณภาพสูง จัดส่งให้ติดต่อผ่าน line
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-white text-xs uppercase tracking-wider text-red-400">การจัดส่งสินค้า</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              💬 จัดส่งให้ติดต่อผ่าน line
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-white text-xs uppercase tracking-wider text-red-400">ติดต่อฝ่ายขายและโรงงาน</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              📞 สายด่วน: 093-049-4178, 061-789-1164
              <br />💬 Line ID: 0930494178
              <br />⏰ เวลาทำการ: ทุกวัน 8:00 - 17:30 น.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-slate-700/60 text-center text-[10px] text-slate-500">
          © {new Date().getFullYear()} ไทยอุดรเฟอร์นิเจอร์. สงวนลิขสิทธิ์ทั้งหมด. ระบบแคตตาล็อกทางการ Master Control.
        </div>
      </footer>
    </div>
  );
}
