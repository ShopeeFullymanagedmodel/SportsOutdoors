/**
 * 运动户外专用版 app.js
 * 适配 CSV 字段：title, variant, price, imgUrl, link, l1, l2, inviteId, modelId, final_1688_link, 提品优先级, update date, itemid
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
    // 强制读取根目录下的 data.csv (请确保 GitHub 仓库里文件名就是 data.csv)
    const response = await fetch('./data.csv?v=' + Date.now());
    if (!response.ok) throw new Error('找不到 data.csv 文件，请确认它在根目录');
    
    const csvText = await response.text();
    const products = parseCSV(csvText);
    
    state.allProducts = products;
    fillCategory1Options();
    bindEvents();
    applyFilters();
    
    console.log("✅ 加载成功，共 " + products.length + " 条数据");
  } catch (error) {
    console.error("❌ 加载失败:", error);
    if(els.cardGrid) els.cardGrid.innerHTML = `<div style="color:red;padding:20px;">加载失败: ${error.message}</div>`;
  }
}

// 适配你 CSV 格式的解析函数
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  // 1. 获取第一行表头
  const headers = lines[0].split(',').map(h => h.trim());
  
  // 2. 解析每一行数据
  return lines.slice(1).map(line => {
    // 处理带引号和逗号的复杂情况
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const obj = {};
    headers.forEach((header, index) => {
      let val = values[index] ? values[index].trim() : '';
      obj[header] = val.replace(/^"|"$/g, ''); 
    });
    return obj;
  });
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
  els.category1.innerHTML = '<option value="">二级类目(全部)</option>';
  values.forEach(v => {
    const op = document.createElement('option');
    op.value = v;
    op.textContent = v;
    els.category1.appendChild(op);
  });
  refillCategory2Options();
}

function refillCategory2Options() {
  els.category2.innerHTML = '<option value="">三级类目(全部)</option>';
  const selected = els.category1.value;
  let source = state.allProducts;
  if (selected) source = source.filter(x => x.l1 === selected);
  const values = [...new Set(source.map(x => x.l2).filter(Boolean))];
  values.forEach(v => {
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
    const okPriority = !priority || item['提品优先级'] === priority;
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
    // 映射颜色：高优先级->红色/绿色
    const pVal = item['提品优先级'] || '';
    const pClass = pVal.includes('高') ? 'p0' : 'p1';
    
    return `
      <article class="card">
        <div class="card-top">
          <span class="priority-badge ${pClass}">${escapeHtml(pVal)}</span>
          <div class="card-image-wrap">
            <img class="card-image" src="${escapeHtml(item.imgUrl)}" alt="product" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
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
            <div class="meta"><strong>${escapeHtml(item['update date'])}</strong></div>
            ${item.link ? `<a class="link-btn link-origin" href="${escapeHtml(item.link)}" target="_blank">原品 >>></a>` : ''}
            ${item.final_1688_link ? `<a class="link-btn link-1688" href="${escapeHtml(item.final_1688_link)}" target="_blank">1688链接 >>></a>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.invitation-box').forEach(el => {
    el.onclick = async () => {
      const val = el.getAttribute('data-copy');
      if (val) {
        await navigator.clipboard.writeText(val);
        showToast(`已复制邀请码：${val}`);
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
