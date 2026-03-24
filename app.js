/**
 * 运动户外专用版 app.js (最终修正版)
 * 解决：1. 数量虚高/数据错位 2. 占位图失效 3. CSV换行符干扰
 */

const state = { allProducts: [], filteredProducts: [] };

const els = {
  siteTitle: document.getElementById('siteTitle'),
  keyword: document.getElementById('keyword'),
  category1: document.getElementById('category1'),
  category2: document.getElementById('category2'),
  priority: document.getElementById('priority'),
  minPrice: document.getElementById('minPrice'),
  maxPrice: document.getElementById('maxPrice'),
  sortBy: document.getElementById('sortBy'),
  resetBtn: document.getElementById('resetBtn'),
  exportBtn: document.getElementById('exportBtn'),
  filteredCount: document.getElementById('filteredCount'),
  cardGrid: document.getElementById('cardGrid'),
  emptyState: document.getElementById('emptyState'),
  toast: document.getElementById('toast')
};

async function init() {
  try {
    const response = await fetch('./data.csv?v=' + Date.now());
    if (!response.ok) throw new Error('找不到 data.csv 文件，请确认它在根目录');
    
    const csvText = await response.text();
    const products = parseCSV(csvText);
    
    if (products.length === 0) throw new Error('CSV 解析后无有效数据');

    state.allProducts = products;
    fillCategory1Options();
    bindEvents();
    applyFilters();
    
    console.log("✅ 加载成功，有效条数：" + products.length);
  } catch (error) {
    console.error("❌ 加载失败:", error);
    if(els.cardGrid) {
      els.cardGrid.innerHTML = `<div style="color:red;padding:20px;text-align:center;">数据加载失败: ${error.message}</div>`;
    }
  }
}

function parseCSV(text) {
  if (window.Papa) {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: 'greedy', // 强力跳过空行
      quoteChar: '"',
      escapeChar: '"'
    });
    
    /**
     * 【关键修正】过滤逻辑：
     * 只有同时包含 标题(title) 和 价格(price) 的行才被视为有效产品。
     * 这能剔除掉 CSV 内部换行导致的 97 条错位碎片数据。
     */
    return result.data.filter(item => {
      return item.title && item.title.trim().length > 1 && item.price;
    });
  }
  return [];
}

function bindEvents() {
  [els.keyword, els.minPrice, els.maxPrice].forEach(el => {
    if(el) ['input','change'].forEach(evt => el.addEventListener(evt, applyFilters));
  });
  [els.category1, els.category2, els.priority, els.sortBy].forEach(el => {
    if(el) el.addEventListener('change', () => {
      if (el === els.category1) refillCategory2Options();
      applyFilters();
    });
  });
  els.resetBtn?.addEventListener('click', () => {
    els.keyword.value = '';
    els.category1.value = '';
    refillCategory2Options();
    els.category2.value = '';
    els.priority.value = '';
    els.minPrice.value = '';
    els.maxPrice.value = '';
    els.sortBy.value = 'default';
    applyFilters();
  });
}

function fillCategory1Options() {
  const values = [...new Set(state.allProducts.map(x => x.l1).filter(Boolean))];
  if(els.category1) {
    els.category1.innerHTML = '<option value="">二级类目(全部)</option>';
    values.sort().forEach(v => {
      const op = document.createElement('option');
      op.value = v;
      op.textContent = v;
      els.category1.appendChild(op);
    });
  }
  refillCategory2Options();
}

function refillCategory2Options() {
  if(!els.category2) return;
  els.category2.innerHTML = '<option value="">三级类目(全部)</option>';
  const selected = els.category1.value;
  let source = state.allProducts;
  if (selected) source = source.filter(x => x.l1 === selected);
  const values = [...new Set(source.map(x => x.l2).filter(Boolean))];
  values.sort().forEach(v => {
    const op = document.createElement('option');
    op.value = v;
    op.textContent = v;
    els.category2.appendChild(op);
  });
}

function applyFilters() {
  const keyword = (els.keyword.value || '').trim().toLowerCase();
  const category1 = els.category1.value;
  const category2 = els.category2.value;
  const priority = els.priority.value;
  const minPrice = parseFloat(els.minPrice.value);
  const maxPrice = parseFloat(els.maxPrice.value);
  const sortBy = els.sortBy.value;

  let list = state.allProducts.filter(item => {
    const haystack = [
      item.title, item.inviteId, item.itemid, item.modelId, item.variant, item.l1, item.l2
    ].join(' ').toLowerCase();

    const okKeyword = !keyword || haystack.includes(keyword);
    const okCat1 = !category1 || item.l1 === category1;
    const okCat2 = !category2 || item.l2 === category2;
    const okPriority = !priority || (item['提品优先级'] || '').includes(priority);
    const price = parseFloat(item.price || 0);
    const okMin = Number.isNaN(minPrice) || price >= minPrice;
    const okMax = Number.isNaN(maxPrice) || price <= maxPrice;

    return okKeyword && okCat1 && okCat2 && okPriority && okMin && okMax;
  });

  if (sortBy === 'priceAsc') list.sort((a,b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
  else if (sortBy === 'priceDesc') list.sort((a,b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
  else if (sortBy === 'dateDesc') list.sort((a,b) => String(b['update date'] || '').localeCompare(String(a['update date'] || '')));

  state.filteredProducts = list;
  renderCards();
}

function renderCards() {
  if(els.filteredCount) els.filteredCount.textContent = state.filteredProducts.length;

  if (!state.filteredProducts.length) {
    els.cardGrid.innerHTML = '';
    els.emptyState?.classList.remove('hidden');
    return;
  }
  els.emptyState?.classList.add('hidden');

  els.cardGrid.innerHTML = state.filteredProducts.map(item => {
    const pVal = item['提品优先级'] || '-';
    const pClass = pVal.includes('高') ? 'p0' : 'p1';
    
    // 修正：更稳定的备用图片地址
    const placeholder = "https://images.placeholders.dev/?width=200&height=200&text=无图片&fontSize=24";
    
    return `
      <article class="card">
        <div class="card-top">
          <span class="priority-badge ${pClass}">${escapeHtml(pVal)}</span>
          <div class="card-image-wrap">
            <img class="card-image" 
                 src="${escapeHtml(item.imgUrl)}" 
                 alt="product" 
                 loading="lazy" 
                 referrerpolicy="no-referrer" 
                 onerror="this.src='${placeholder}'; this.onerror=null;">
          </div>
        </div>
        <div class="card-bottom">
          <div class="title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
          <div class="price-row">
            <div class="price">¥${formatPrice(item.price)}</div>
            <div class="spec-name">${escapeHtml(item.variant || '')}</div>
          </div>
          <div class="id-row">
            <div class="count-badge">ID: ${escapeHtml(item.modelId || '')}</div>
            <div class="invitation-box" data-copy="${escapeHtml(item.inviteId || '')}">${escapeHtml(item.inviteId || '')}</div>
          </div>
          <div class="meta-row">
            <div class="meta"><strong>${escapeHtml(item['update date'] || '')}</strong></div>
            ${item.link ? `<a class="link-btn link-origin" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">原品 >>></a>` : ''}
            ${item.final_1688_link ? `<a class="link-btn link-1688" href="${escapeHtml(item.final_1688_link)}" target="_blank" rel="noopener">1688链接 >>></a>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.invitation-box').forEach(el => {
    el.onclick = async () => {
      const val = el.getAttribute('data-copy');
      if (val) {
        try {
          await navigator.clipboard.writeText(val);
          showToast(`已复制邀请码：${val}`);
        } catch(e) {
          showToast('复制失败');
        }
      }
    };
  });
}

function formatPrice(v) {
  const p = parseFloat(v || 0);
  return isNaN(p) ? "0.00" : p.toFixed(2);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

let timer = null;
function showToast(msg) {
  if(!els.toast) return;
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(timer);
  timer = setTimeout(() => els.toast.classList.add('hidden'), 1800);
}

init();
