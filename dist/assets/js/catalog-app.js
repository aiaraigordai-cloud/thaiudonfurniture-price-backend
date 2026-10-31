// Thai Udon Furniture Unified Catalog Engine
(function() {
  'use strict';

  let allProducts = [];
  let filteredProducts = [];
  let activeCatalogType = window.CATALOG_MODE || 'all'; // 'all', 'tuulo', 'knockdown'
  let activePriceTier = 'SALE_PRICE'; // 'SALE_PRICE', 'RETAIL_PRICE'
  let activeCategory = 'all';
  let searchQuery = '';
  let activeModalProduct = null;
  let activeModalTab = 'graphic';

  // Elements
  const gridEl = document.getElementById('product-grid');
  const countEl = document.getElementById('results-count');
  const searchInput = document.getElementById('search-input');
  const pillsContainer = document.getElementById('category-pills');
  const priceSelect = document.getElementById('price-tier-select');
  const catalogSelect = document.getElementById('catalog-type-select');
  const modalEl = document.getElementById('product-modal');

  async function init() {
    try {
      const res = await fetch('assets/data/products.json');
      if (!res.ok) throw new Error('Cannot load products');
      allProducts = await res.json();
      
      // Setup URL params if any
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('tier')) activePriceTier = urlParams.get('tier');
      if (urlParams.get('items')) {
        const allowed = new Set(urlParams.get('items').split(',').map(s => s.trim().toUpperCase()));
        allProducts = allProducts.filter(p => allowed.has(p.sku.toUpperCase()));
        const headerEl = document.querySelector('.catalog-header h1');
        if (headerEl) {
          headerEl.innerHTML += ' <span style="font-size: 18px; color: #A31D1D; font-weight: 700;">(เฉพาะ ' + allProducts.length + ' รายการที่เลือก)</span>';
        }
      }
      if (urlParams.get('customer')) {
        const cust = urlParams.get('customer');
        const headerEl = document.querySelector('.catalog-header p');
        if (headerEl) {
          headerEl.innerHTML = 'สำหรับ: <strong style="color: #A31D1D;">' + cust + '</strong> | ' + headerEl.innerHTML;
        }
      }
      if (urlParams.get('q')) {
        searchQuery = urlParams.get('q');
        if (searchInput) searchInput.value = searchQuery;
      }

      renderCategoryPills();
      filterAndRender();

      // Event Listeners
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchQuery = e.target.value.trim().toLowerCase();
          filterAndRender();
        });
      }

      if (priceSelect) {
        priceSelect.value = activePriceTier;
        priceSelect.addEventListener('change', (e) => {
          activePriceTier = e.target.value;
          filterAndRender();
        });
      }

      if (catalogSelect) {
        catalogSelect.value = activeCatalogType;
        catalogSelect.addEventListener('change', (e) => {
          activeCatalogType = e.target.value;
          renderCategoryPills();
          filterAndRender();
        });
      }

    } catch (err) {
      console.error('Init error:', err);
      if (gridEl) gridEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #A31D1D;">เกิดข้อผิดพลาดในการโหลดแคตตาล็อกสินค้า</div>';
    }
  }

  function getCategoriesForActiveCatalog() {
    const catsMap = new Map();
    allProducts.forEach(p => {
      if (activeCatalogType === 'all' || p.catalog_type === activeCatalogType) {
        const catName = p.category_name || 'ทั่วไป';
        catsMap.set(catName, (catsMap.get(catName) || 0) + 1);
      }
    });
    return Array.from(catsMap.entries());
  }

  function renderCategoryPills() {
    if (!pillsContainer) return;
    const cats = getCategoriesForActiveCatalog();
    let totalCount = allProducts.filter(p => activeCatalogType === 'all' || p.catalog_type === activeCatalogType).length;

    let html = `<button type="button" class="category-pill ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">ทั้งหมด (${totalCount})</button>`;
    cats.forEach(([name, cnt]) => {
      html += `<button type="button" class="category-pill ${activeCategory === name ? 'active' : ''}" data-cat="${name}">${name} (${cnt})</button>`;
    });

    pillsContainer.innerHTML = html;

    pillsContainer.querySelectorAll('.category-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        pillsContainer.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.getAttribute('data-cat');
        filterAndRender();
      });
    });
  }

  function filterAndRender() {
    filteredProducts = allProducts.filter(p => {
      if (activeCatalogType !== 'all' && p.catalog_type !== activeCatalogType) return false;
      if (activeCategory !== 'all' && p.category_name !== activeCategory) return false;
      if (searchQuery) {
        const matchSku = p.sku && p.sku.toLowerCase().includes(searchQuery);
        const matchName = p.name && p.name.toLowerCase().includes(searchQuery);
        const matchDesc = p.description && p.description.toLowerCase().includes(searchQuery);
        const matchSize = p.size_text && p.size_text.toLowerCase().includes(searchQuery);
        if (!matchSku && !matchName && !matchDesc && !matchSize) return false;
      }
      return true;
    });

    if (countEl) {
      countEl.innerText = filteredProducts.length;
    }

    renderGrid();
  }

  function formatPrice(p) {
    const pr = p.prices ? p.prices[activePriceTier] : null;
    if (pr !== null && pr !== undefined && pr > 0) {
      return '฿' + Number(pr).toLocaleString();
    }
    return '-';
  }

  function renderGrid() {
    if (!gridEl) return;
    if (filteredProducts.length === 0) {
      gridEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #705E4F; font-size: 18px;">ไม่พบรายการสินค้าที่ค้นหา</div>';
      return;
    }

    gridEl.innerHTML = filteredProducts.map((p, idx) => {
      const priceStr = formatPrice(p);
      const isTuulo = p.catalog_type === 'tuulo';
      const catBadge = p.category_name || (isTuulo ? 'ตู้โล' : 'น็อคดาวน์');
      const tierLabel = activePriceTier === 'RETAIL_PRICE' ? 'ราคาปลีก' : 'ราคาเซลล์';

      return `
      <div class="product-card" onclick="window.openProductModal('${p.id}')">
        <div class="product-image-wrap">
          <img src="${p.image}" alt="${p.sku}" loading="lazy" onerror="this.src='assets/images/logo/logo-red.png'">
          <span class="product-type-badge ${isTuulo ? 'badge-tuulo' : 'badge-kd'}">${isTuulo ? 'ตู้โล' : 'น็อคดาวน์'}</span>
        </div>
        <div class="product-info">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <span class="product-sku">${p.sku}</span>
            <span class="product-category-tag">${catBadge}</span>
          </div>
          <h3 class="product-name">${p.name}</h3>
          <div class="product-size">📏 ${p.size_text || '-'}</div>
          
          <div class="product-price-row">
            <div>
              <span class="price-tier-label">${tierLabel}</span>
              <div class="product-price">${priceStr}</div>
            </div>
            <button type="button" class="btn-view" onclick="event.stopPropagation(); window.openProductModal('${p.id}')">
              ดูรูป & สเปก
            </button>
          </div>
        </div>
      </div>
      `;
    }).join('');
  }

  // Modal handler
  window.openProductModal = function(id) {
    const prod = allProducts.find(p => p.id === id);
    if (!prod) return;
    activeModalProduct = prod;
    activeModalTab = 'graphic';

    document.getElementById('modal-sku').innerText = prod.sku;
    document.getElementById('modal-name').innerText = prod.name;
    document.getElementById('modal-cat').innerText = prod.category_name || '-';
    document.getElementById('modal-size').innerText = prod.size_text || '-';
    document.getElementById('modal-color').innerText = prod.color || '-';
    
    // Price
    const saleP = prod.prices?.SALE_PRICE ? '฿' + Number(prod.prices.SALE_PRICE).toLocaleString() : '-';
    const retailP = prod.prices?.RETAIL_PRICE ? '฿' + Number(prod.prices.RETAIL_PRICE).toLocaleString() : '-';
    document.getElementById('modal-sale-price').innerText = saleP;
    document.getElementById('modal-retail-price').innerText = retailP;

    // Line order link
    const lineBtn = document.getElementById('modal-line-btn');
    if (lineBtn) {
      const msg = encodeURIComponent(`สวัสดีครับ สนใจสินค้า ${prod.sku} ${prod.name} จากแคตตาล็อกไทยอุดรเฟอร์นิเจอร์ครับ`);
      lineBtn.href = `https://line.me/ti/p/~0930494178?text=${msg}`;
    }

    renderModalImages();
    if (modalEl) modalEl.style.display = 'flex';
  };

  window.closeProductModal = function() {
    if (modalEl) modalEl.style.display = 'none';
  };

  window.switchModalTab = function(tab) {
    activeModalTab = tab;
    renderModalImages();
  };

  function renderModalImages() {
    if (!activeModalProduct) return;
    const graphicBtn = document.getElementById('tab-btn-graphic');
    const refBtn = document.getElementById('tab-btn-ref');
    const imgEl = document.getElementById('modal-main-img');
    const downloadBtn = document.getElementById('modal-download-btn');
    const refNotice = document.getElementById('modal-ref-notice');

    const hasRef = Boolean(activeModalProduct.ref_image);
    if (refBtn) refBtn.style.display = hasRef ? 'inline-flex' : 'none';

    if (activeModalTab === 'ref' && hasRef) {
      if (graphicBtn) graphicBtn.classList.remove('active');
      if (refBtn) refBtn.classList.add('active');
      if (imgEl) imgEl.src = activeModalProduct.ref_image;
      if (downloadBtn) {
        downloadBtn.href = activeModalProduct.ref_image;
        downloadBtn.download = activeModalProduct.ref_filename || (activeModalProduct.sku + '_ref.jpg');
      }
      if (refNotice) refNotice.style.display = 'block';
    } else {
      activeModalTab = 'graphic';
      if (graphicBtn) graphicBtn.classList.add('active');
      if (refBtn) refBtn.classList.remove('active');
      if (imgEl) imgEl.src = activeModalProduct.image;
      if (downloadBtn) {
        downloadBtn.href = activeModalProduct.image;
        downloadBtn.download = activeModalProduct.filename || (activeModalProduct.sku + '.jpg');
      }
      if (refNotice) refNotice.style.display = 'none';
    }
  }

  // Close modal on click outside
  if (modalEl) {
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) window.closeProductModal();
    });
  }

  // Keyboard escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeProductModal();
  });

  document.addEventListener('DOMContentLoaded', init);
})();
