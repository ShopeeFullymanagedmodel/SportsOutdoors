/**
 * 运动户外专用版 app.js - 核心逻辑回归版
 */

const state = { 
  allProducts: [], 
  filteredProducts: [],
  selectedIds: new Set() 
};

const els = {
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
    // 强制不使用缓存读取
    const response = await fetch('./data.csv?v=' + Date.now());
    if (!response.ok) throw new Error('找不到 data.csv');
    const csvText = await response.text();
    
    // 使用最稳妥的解析方式
    const result = Papa.parse(csvText, { header: true, skipEmptyLines: 'greedy' });
    state.allProducts = result.data.filter(item => item.title || item.itemid);
    
    fillCategory1Options();
    bindEvents();
    applyFilters();
  } catch (error) {
    console.error("加载数据失败:", error);
  }
}

function bindEvents() {
  [els.keyword, els.minPrice, els.maxPrice].forEach(el => el?.addEventListener('input', applyFilters));
  [els.category1, els.category2, els.priority, els.sortBy].forEach(el => el?.addEventListener('change', () => {
    if (el === els.category1) refillCategory2Options();
    applyFilters();
  }));
  els.resetBtn?.addEventListener('click', () => {
    location.reload(); // 最彻底的重置
  });
  els.exportBtn?.addEventListener('click', exportData);
}

function applyFilters() {
  const kw = els.keyword.value.trim().toLowerCase();
  const c1 = els.category1.value;
  const c2 = els.category2.value;
  const pr = els.priority.value;
  const min = parseFloat(els.minPrice.value);
  const max = parseFloat(els.maxPrice.value);

  state.filteredProducts = state.allProducts.filter(item => {
    const text = [item.title, item.inviteId, item.modelId, item.itemid].join(' ').toLowerCase();
    const price = parseFloat(item.price || 0);
    return (!kw || text.includes(kw)) &&
           (!c1 || String(item.l1) === c1) &&
           (!c2 || String(item.l2) === c2) &&
           (!pr || (item['提品优先级'] || '').includes(pr)) &&
           (isNaN(min) || price >= min) &&
           (isNaN(max) || price <= max);
  });
  renderCards();
}

// 这里是你要求的语法修正点！
function updateCountDisplay() {
  if (!els.filteredCount) return;
  const checked = state.selectedIds.size;
  const filtered = state.filteredProducts.length;
  
  // 严格按照您的要求：(已筛选：1370款——已勾选：1款)
  let content = `已筛选：${filtered}款`;
  if (checked > 0) {
    content += `——<span style="color: #0b57d7; font-weight: bold;">已勾选：${checked}款</span>`;
  }
  els.filteredCount.innerHTML = `(${content})`;
}

function renderCards() {
  updateCountDisplay();
  if (!state.filteredProducts.length) {
    els.cardGrid.innerHTML = '';
    els.emptyState?.classList.remove('hidden');
    return;
  }
  els.emptyState?.classList.add('hidden');

  els.cardGrid.innerHTML = state.filteredProducts.map(item => {
    const id = String(item.modelId || item.itemid || '');
    const isChecked = state.selectedIds.has(id) ? 'checked' : '';
    const pVal = item['提品优先级'] || '-';
    return `
      <article class="card">
        <div class="card-checkbox"><input type="checkbox" class="select-item" data-id="${id}" ${isChecked}></div>
        <div class="card-top">
          <span class="priority-badge ${pVal.includes('高')?'p0':'p1'}">${pVal}</span>
          <div class="card-image-wrap"><img class="card-image" src="${item.imgUrl}" onerror="this.src='https://via.placeholder.com/200';"></div>
        </div>
        <div class="card-bottom">
          <div class="title" title="${item.title}">${item.title}</div>
          <div class="price-row"><div class="price">¥${parseFloat(item.price||0).toFixed(2)}</div></div>
          <div class="invitation-row"><div class="invitation-box" onclick="copyValue('${item.inviteId}')">${item.inviteId || ''}</div></div>
          <div class="links-row">
            <a class="link-btn link-origin" href="${item.link}" target="_blank">原品</a>
            <a class="link-btn link-1688" href="${item.final_1688_link}" target="_blank">1688</a>
          </div>
        </div>
      </article>`;
  }).join('');

  document.querySelectorAll('.select-item').forEach(cb => {
    cb.onchange = (e) => {
      const id = e.target.dataset.id;
      e.target.checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
      updateCountDisplay();
    };
  });
}

// 补齐工具函数
window.copyValue = (val) => {
  navigator.clipboard.writeText(val).then(() => showToast("已复制"));
};

function showToast(msg) {
  els.toast.textContent = msg; els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 2000);
}

function fillCategory1Options() {
  const values = [...new Set(state.allProducts.map(x => x.l1).filter(Boolean))].sort();
  els.category1.innerHTML = '<option value="">二级类目(全部)</option>' + values.map(v => `<option value="${v}">${v}</option>`).join('');
  refillCategory2Options();
}

function refillCategory2Options() {
  const selected = els.category1.value;
  const source = selected ? state.allProducts.filter(x => x.l1 === selected) : state.allProducts;
  const values = [...new Set(source.map(x => x.l2).filter(Boolean))].sort();
  els.category2.innerHTML = '<option value="">三级类目(全部)</option>' + values.map(v => `<option value="${v}">${v}</option>`).join('');
}

function exportData() {
  let data = state.selectedIds.size > 0 ? state.allProducts.filter(item => state.selectedIds.has(String(item.modelId || item.itemid))) : state.filteredProducts;
  const csv = Papa.unparse(data);
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `export.csv`;
  link.click();
}

init();
