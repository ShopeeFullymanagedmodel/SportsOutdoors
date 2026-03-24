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

// 初始化：读取数据
async function init() {
  try {
    // 1. 读取根目录下的 data.csv (请确保文件名全小写)
    const response = await fetch('./data.csv');
    if (!response.ok) throw new Error('找不到 data.csv 文件，请确认文件在根目录且名为 data.csv');
    
    const csvText = await response.text();
    
    // 2. 解析 CSV (处理逗号、换行和空格)
    const products = parseCSV(csvText);
    
    if (products.length === 0) throw new Error('CSV 文件内容为空或格式错误');

    // 3. 填充数据
    els.siteTitle.textContent = '运动户外热销原品清单';
    state.allProducts = products;
    
    // 4. 运行页面逻辑
    fillCategory1Options();
    bindEvents();
    applyFilters();
    
    console.log("✅ 数据加载成功:", products.length, "条数据");
  } catch (error) {
    console.error("❌ 加载失败:", error);
    showToast("加载失败: " + error.message);
  }
}

// CSV 解析辅助函数 (支持处理带引号的单元格)
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  // 获取表头并清理
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  return lines.slice(1).map(line => {
    // 简单的逗号分割，如果数据中包含逗号，建议使用 PapaParse 库
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); 
    const obj = {};
    headers.forEach((header, index) => {
      let val = values[index] ? values[index].trim() : '';
      obj[header] = val.replace(/^"|"$/g, ''); // 去除两侧引号
    });
    return obj;
  });
}

function bindEvents() {
  [els.keyword, els.minPrice, els.maxPrice].forEach(el => {
    if(!el) return;
    ['input','change'].forEach(evt => el.addEventListener(evt, applyFilters));
  });
  [els.category1, els.category2, els.priority, els.sortBy].forEach(el => {
    if(!el) return;
    el.addEventListener('change', () => {
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
  els.exportBtn?.addEventListener('click', exportCurrentCsv);
}

function fillCategory1Options() {
  const values = [...new Set(state.allProducts.map(x => x.category1).filter(Boolean))];
  els.category1.innerHTML = '<option value="">一级类目(全部)</option>';
  values.forEach(v => {
    const op = document.createElement('option');
    op.value = v;
    op.textContent = v;
    els.category1.appendChild(op);
  });
  refillCategory2Options();
}

function refillCategory2Options() {
  els.category2.innerHTML = '<option value="">二级类目(全部)</option>';
  const selected = els.category1.value;
  let source = state.allProducts;
  if (selected) source = source.filter(x => x.category1 === selected);
  const values = [...new Set(source.map(x => x.category2).filter(Boolean))];
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
      item.title, item.invitationId, item.itemId, item.modelId, item.specName, item.category1, item.category2
    ].join(' ').toLowerCase();

    const okKeyword = !keyword || haystack.includes(keyword);
    const okCat1 = !category1 || item.category1 === category1;
    const okCat2 = !category2 || item.category2 === category2;
    const okPriority = !priority || (item.priority && item.priority.toUpperCase() === priority.toUpperCase());
    const price = parseFloat(item.targetPrice || 0);
    const okMin = Number.isNaN(minPrice) || price >= minPrice;
    const okMax = Number.isNaN(maxPrice) || price <= maxPrice;

    return okKeyword && okCat1 && okCat2 && okPriority && okMin && okMax;
  });

  if (sortBy === 'priceAsc') list.sort((a,b) => parseFloat(a.targetPrice || 0) - parseFloat(b.targetPrice || 0));
  else if (sortBy === 'priceDesc') list.sort((a,b) => parseFloat(b.targetPrice || 0) - parseFloat(a.targetPrice || 0));
  else if (sortBy === 'dateDesc') list.sort((a,b) => String(b.updateDate || '').localeCompare(String(a.updateDate || '')));

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
    const pClass = (item.priority || '').toLowerCase();
    const imgUrl = item.image || '';
    
    const imagePart = imgUrl 
      ? `<img class="card-image" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" />`
      : `<div class="img-fallback">暂无图片</div>`;

    const badge = item.pricingLink
      ? `<a class="priority-link" href="${escapeHtml(item.pricingLink)}" target="_blank"><span class="priority-badge ${pClass}">${escapeHtml(item.priority || '-')}</span></a>`
      : `<span class="priority-badge ${pClass}">${escapeHtml(item.priority || '-')}</span>`;

    return `
      <article class="card">
        <div class="card-top">
          ${badge}
          <div class="card-image-wrap">${imagePart}</div>
        </div>
        <div class="card-bottom">
          <div class="title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
          <div class="price-row">
            <div class="price">¥${formatPrice(item.targetPrice)}</div>
            <div class="spec-name">${escapeHtml(item.specName || '')}</div>
          </div>
          <div class="id-row">
            <div class="count-badge">共${escapeHtml(item.specCount || '1')}款</div>
            <div class="invitation-box" data-copy="${escapeHtml(item.invitationId || '')}">${escapeHtml(item.invitationId || '')}</div>
          </div>
          <div class="meta-row">
            <div class="meta"><strong>${escapeHtml(item.updateDate)}</strong>发布</div>
            <div class="meta">${escapeHtml(item.modelId || '')}</div>
            ${item.originLink ? `<a class="link-btn link-origin" href="${escapeHtml(item.originLink)}" target="_blank">原品 &gt;&gt;&gt;</a>` : ''}
            ${item.link1688 ? `<a class="link-btn link-1688" href="${escapeHtml(item.link1688)}" target="_blank">1688链接 &gt;&gt;&gt;</a>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  // 绑定点击复制
  document.querySelectorAll('.invitation-box').forEach(el => {
    el.onclick = async () => {
      const val = el.getAttribute('data-copy');
      if (!val) return;
      try {
        await navigator.clipboard.writeText(val);
        showToast(`已复制：${val}`);
      } catch (err) {
        showToast('复制失败');
      }
    };
  });
}

function exportCurrentCsv() {
  if (!state.filteredProducts.length) return;
  const rows = state.filteredProducts;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(r => headers.map(h => csvEscape(r[h])).join(','))
  ].join('\n');

  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'export.csv';
  a.click();
}

function formatPrice(v) {
  const p = parseFloat(v || 0);
  return isNaN(p) ? "0.00" : p.toFixed(2);
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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

// 启动程序
init();
