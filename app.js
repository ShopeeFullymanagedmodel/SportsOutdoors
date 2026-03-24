/**
 * 运动户外专用版 app.js (优化版)
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
    // 强制读取根目录下的 data.csv，添加时间戳防止浏览器缓存旧数据
    const response = await fetch('./data.csv?v=' + Date.now());
    if (!response.ok) throw new Error('找不到 data.csv 文件，请确认它在根目录且名为 data.csv');
    
    const csvText = await response.text();
    const products = parseCSV(csvText);
    
    if (products.length === 0) throw new Error('CSV 文件内容为空或解析失败');

    state.allProducts = products;
    fillCategory1Options();
    bindEvents();
    applyFilters();
    
    console.log("✅ 数据加载成功，共 " + products.length + " 条");
  } catch (error) {
    console.error("❌ 加载失败:", error);
    if(els.cardGrid) {
      els.cardGrid.innerHTML = `<div style="color:red;padding:20px;text-align:center;">加载失败: ${error.message}<br>请检查 data.csv 是否在根目录。</div>`;
    }
  }
}

/**
 * 核心解析函数：优先使用 PapaParse 处理复杂 CSV，回退使用正则处理
 */
function parseCSV(text) {
  // 如果 index.html 里已经成功引入了 PapaParse 库
  if (window.Papa) {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });
    return result.data;
  }

  // 备用方案：简单正则解析 (防止 PapaParse 加载失败时页面挂掉)
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    // 处理带引号的列
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

  // 排序逻辑
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
                 onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
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

  // 绑定点击复制邀请码
  document.querySelectorAll('.invitation-box').forEach(el => {
    el.onclick = async () => {
      const val = el.getAttribute('data-copy');
      if (val) {
        try {
          await navigator.clipboard.writeText(val);
          showToast(`已复制邀请码：${val}`);
        } catch(e) {
          showToast('复制失败，请手动选择复制');
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

// 启动
init();
