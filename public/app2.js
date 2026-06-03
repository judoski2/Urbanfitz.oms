async function loadOrders() {
  const el = document.getElementById('page-orders');
  try {
    const params = {};
    if (searchQuery) params.search = searchQuery;
    if (filterStatus !== 'All') params.status = filterStatus;
    if (filterPay    !== 'All') params.payStatus = filterPay;
    allOrders = await API.getOrders(params);
    renderOrders();
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Failed to load orders</div></div>`;
  }
}

function renderOrders() {
  const el = document.getElementById('page-orders');
  const hasFilter = filterStatus !== 'All' || filterPay !== 'All';

  // Group orders by status for counts
  const statusCounts = {};
  allOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status]||0)+1; });

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Orders</h2>
        <p class="page-sub">${allOrders.length} orders</p>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="openPrintByStatus()" style="background:#F9F9F9;border:1.5px solid #E8E8E8;border-radius:12px;padding:11px 14px;color:#111;font-weight:700;font-size:13px;cursor:pointer">🖨 Print</button>
        <button class="btn-new" onclick="openOrderForm()">+ New</button>
      </div>
    </div>

    <!-- Status quick-filter tabs -->
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px;scrollbar-width:none">
      <button onclick="setFStatus('All')" style="flex-shrink:0;padding:7px 14px;border-radius:20px;border:1.5px solid ${filterStatus==='All'?'#D0021B':'#E8E8E8'};background:${filterStatus==='All'?'#FFF0F2':'#fff'};color:${filterStatus==='All'?'#D0021B':'#555'};font-weight:700;font-size:12px;cursor:pointer">
        All (${allOrders.length})
      </button>
      ${ALL_STATUSES.map(s => {
        const c = STATUS_COLORS[s]||{};
        const cnt = statusCounts[s]||0;
        const active = filterStatus === s;
        return `<button onclick="setFStatus('${s}')" style="flex-shrink:0;padding:7px 14px;border-radius:20px;border:1.5px solid ${active?c.text:c.border||'#E8E8E8'};background:${active?c.bg:'#fff'};color:${active?c.text:'#555'};font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap">
          ${s} ${cnt>0?'('+cnt+')':''}
        </button>`;
      }).join('')}
    </div>

    <div class="search-bar">
      <input class="search-input" type="text" placeholder="🔍 Search…" value="${searchQuery}"
        oninput="searchQuery=this.value;loadOrders()" />
      <button class="filter-btn ${hasFilter ? 'active' : ''}" onclick="toggleFilters()">
        ⚙ ${hasFilter ? '●' : ''}
      </button>
    </div>
    <div id="filter-panel" style="display:${showFilters?'block':'none'}">
      <div class="filter-panel">
        <div class="filter-label">Payment</div>
        <div class="chip-row">
          ${['All',...ALL_PAY].map(s => `<button class="chip ${filterPay===s?'active':''}" onclick="setFPay('${s}')">${s}</button>`).join('')}
        </div>
      </div>
    </div>
    <div id="orders-list">
      ${allOrders.length === 0
        ? `<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">No orders found</div></div>`
        : allOrders.map(o => renderOrderCard(o)).join('')
      }
    </div>`;
}

function renderOrderCard(o) {
  const sc = STATUS_COLORS[o.status] || {};
  return `
  <div class="order-card" style="border-left:4px solid ${sc.text||'#E8E8E8'}" onclick="viewOrder('${o.id}')">
    <div class="order-card-top">
      <div>
        <div class="order-customer">${o.customer}</div>
        <div class="order-meta">${o.id} · ${dateStr(o.date)}</div>
      </div>
      <div class="order-amount">${fmt(o.amount)}</div>
    </div>
    <div class="order-product">${o.product}${o.size?' · '+o.size:''}${o.color?' · '+o.color:''}</div>
    <div class="order-footer">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${badge(o.status,'status')}
        ${badge(o.pay_status,'pay')}
      </div>
      <div class="order-actions" onclick="event.stopPropagation()">
        <button class="icon-btn" style="background:#F0FDF4;color:#059669" onclick="editOrder('${o.id}')">✏️</button>
        <button class="icon-btn" style="background:#FFF0F2;color:#D0021B" onclick="downloadInvoice('${o.id}')">🧾</button>
        <button class="icon-btn" style="background:#FFF0F2;color:#A80016" onclick="confirmDelete('${o.id}')">🗑️</button>
      </div>
    </div>
  </div>`;
}

function toggleMoreMenu() {
  const menu    = document.getElementById('more-menu');
  const overlay = document.getElementById('more-overlay');
  const isOpen  = menu.style.display === 'block';
  menu.style.display    = isOpen ? 'none' : 'block';
  overlay.style.display = isOpen ? 'none' : 'block';
  // Highlight More btn when open
  document.getElementById('more-btn').classList.toggle('active', !isOpen);
}

function closeMoreMenu() {
  document.getElementById('more-menu').style.display    = 'none';
  document.getElementById('more-overlay').style.display = 'none';
  document.getElementById('more-btn').classList.remove('active');
}

function navigateMore(page) {
  closeMoreMenu();
  // Deactivate bottom nav tabs
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  // Highlight More btn
  document.getElementById('more-btn').classList.add('active');
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  currentPage = page;
  loadPage(page);
}
function setFStatus(s) { filterStatus = s; loadOrders(); }
function setFPay(s) { filterPay = s; loadOrders(); }

// Tap status from dashboard → go to Orders filtered by that status
function viewOrdersByStatus(status) {
  filterStatus = status;
  filterPay = 'All';
  searchQuery = '';
  navigateTo('orders');
}

// ── ORDER DETAIL ──────────────────────────────────────────────────────────────
async function viewOrder(id) {
  const order = allOrders.find(o => o.id === id) || await API.request('GET', '/api/orders/'+id);
  const pc = PAY_COLORS[order.pay_status] || {};
  const rows = [
    ['Customer', order.customer], ['Phone', order.phone],
    ['Product',  order.product],  ['Amount', fmt(order.amount)],
    ['Qty', order.qty],           ['Size', order.size||'-'],
    ['Color', order.color||'-'],  ['Date', dateStr(order.date)],
    ['Address', order.address||'-'],
  ];

  // Delivery tracking section
  var deliveryHTML = '';
  if (order.delivery_type || order.tracking_number || order.logistics) {
    deliveryHTML = `
      <div style="margin:14px 0;padding:12px 14px;background:#F0F7FF;border-radius:10px;border-left:3px solid #1D6FE8">
        <div style="font-size:10px;font-weight:800;color:#1D6FE8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🚚 Delivery Tracking</div>
        ${order.delivery_type ? `<div class="detail-row"><span class="detail-key">Type</span><span class="detail-val">${order.delivery_type}</span></div>` : ''}
        ${order.tracking_number ? `<div class="detail-row"><span class="detail-key">${order.delivery_type==='Lagos'?'Rider No.':'Waybill No.'}</span><span class="detail-val" style="color:#1D6FE8;font-weight:800">${order.tracking_number}</span></div>` : ''}
        ${order.logistics ? `<div class="detail-row"><span class="detail-key">Logistics</span><span class="detail-val">${order.logistics}</span></div>` : ''}
      </div>`;
  }

  showSheet(`
    <div class="amount-hero">
      <span class="amount-hero-label">ORDER AMOUNT</span>
      <span class="amount-hero-value">${fmt(order.amount)}</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
      ${badge(order.status,'status')} ${badge(order.pay_status,'pay')}
    </div>
    ${rows.map(([k,v]) => v ? `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>` : '').join('')}
    ${deliveryHTML}
    <div class="detail-actions">
      <button class="btn-edit" onclick="closeSheet();editOrder('${order.id}')">✏️ Edit</button>
      <button class="btn-invoice" onclick="closeSheet();downloadInvoice('${order.id}')">🧾 PDF</button>
    </div>
    <div style="display:flex;gap:10px;margin-top:10px">
      <button onclick="shareInvoice('${order.id}')" style="flex:1;background:#25D366;border:none;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;cursor:pointer">
        📤 Share Invoice
      </button>
      <button onclick="shareProforma('${order.id}')" style="flex:1;background:linear-gradient(135deg,#1D6FE8,#1558C0);border:none;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;cursor:pointer">
        📋 Proforma
      </button>
    </div>
  `, order.id);
}

// ── SHARE PROFORMA ────────────────────────────────────────────────────────────
async function shareProforma(id) {
  const order = allOrders.find(o => o.id === id) || await API.request('GET', '/api/orders/'+id);
  const amtStr = '₦' + Number(order.amount).toLocaleString('en-NG');
  const dateStr2 = new Date(order.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});

  const text = [
    '━━━━━━━━━━━━━━━━━━━━',
    '  *URBANFITZ CLOTHINGS*',
    '  3 Ajibode Street, Yaba, Lagos',
    '  📞 07038245181',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `📋 *PROFORMA INVOICE*`,
    `Reference: ${order.id}`,
    `Date: ${dateStr2}`,
    '',
    '👤 *Customer*',
    `${order.customer}`,
    `${order.phone}`,
    '',
    '📦 *Order Summary*',
    `Product:  ${order.product}`,
    `Size:     ${order.size||'-'}`,
    `Color:    ${order.color||'-'}`,
    `Quantity: ${order.qty}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `💰 *TOTAL AMOUNT: ${amtStr}*`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '🏦 *Payment Details*',
    `Bank:    StanbicIBTC`,
    `Account: 0079743487`,
    `Name:    The Urbanfitz Clothing`,
    '',
    '_Kindly make payment into the account above to confirm your order._',
    '_Payment confirms acceptance of this proforma._',
    '',
    '_UrbanFitz Clothings — Quality you can wear with pride_ 🌟',
    '━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');

  // Try native share sheet
  if (navigator.share) {
    try {
      await navigator.share({ title: `Proforma ${order.id} - UrbanFitz`, text });
      return;
    } catch(e) {
      if (e.name === 'AbortError') return;
    }
  }
  // Fallback: clipboard
  try {
    await navigator.clipboard.writeText(text);
    showToast('✅ Proforma copied! Paste into WhatsApp');
  } catch(e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); showToast('✅ Proforma copied! Paste into WhatsApp'); }
    catch(e2) { showToast('Could not copy', true); }
    document.body.removeChild(ta);
  }
}
async function shareInvoice(id) {
  const order = allOrders.find(o => o.id === id) || await API.request('GET', '/api/orders/'+id);
  const amtStr = '₦' + Number(order.amount).toLocaleString('en-NG');
  const dateStr2 = new Date(order.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});

  const text = [
    '━━━━━━━━━━━━━━━━━━━━',
    '  *URBANFITZ CLOTHINGS*',
    '  3 Ajibode Street, Yaba, Lagos',
    '  📞 07038245181',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🧾 *INVOICE ${order.id}*`,
    `📅 Date: ${dateStr2}`,
    '',
    '👤 *Customer Details*',
    `Name: ${order.customer}`,
    `Phone: ${order.phone}`,
    `Address: ${order.address||'-'}`,
    '',
    '📦 *Order Details*',
    `Product: ${order.product}`,
    `Size: ${order.size||'-'}`,
    `Color: ${order.color||'-'}`,
    `Quantity: ${order.qty}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `💰 *TOTAL: ${amtStr}*`,
    `💳 Payment: ${order.pay_status}`,
    `📋 Status: ${order.status}`,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '_Thank you for your business!_',
    '_UrbanFitz Clothings — Quality you can wear with pride_ 🌟',
  ].join('\n');

  // Try native share sheet first (works on iPhone)
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Invoice ${order.id} - UrbanFitz`,
        text: text,
      });
      return;
    } catch(e) {
      if (e.name === 'AbortError') return; // user cancelled
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
    showToast('✅ Invoice copied! Paste into WhatsApp');
  } catch(e) {
    // Last resort: textarea copy trick
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); showToast('✅ Invoice copied! Paste into WhatsApp'); }
    catch(e2) { showToast('Tap and hold to copy invoice text', true); }
    document.body.removeChild(ta);
  }
}

// ── ORDER FORM ────────────────────────────────────────────────────────────────
function orderFormHTML(order) {
  const v = (key, fallback) => order ? (order[key]||fallback||'') : (fallback||'');
  const sel = (name, options, current) =>
    `<select name="${name}">${options.map(o=>`<option ${o===current?'selected':''}>${o}</option>`).join('')}</select>`;
  return `
    <div class="form-grid">
      <div class="form-group full">
        <label>Customer Name *</label>
        <input type="text" name="customer" value="${v('customer')}" placeholder="e.g. Adaeze Okonkwo"/>
      </div>
      <div class="form-group">
        <label>Phone *</label>
        <input type="tel" name="phone" value="${v('phone')}" placeholder="08012345678"/>
      </div>
      <div class="form-group">
        <label>Amount (₦) *</label>
        <input type="number" name="amount" value="${v('amount')}" placeholder="45000"/>
      </div>
      <div class="form-group full">
        <label>Product *</label>
        <input type="text" name="product" value="${v('product')}" placeholder="e.g. Custom Ankara Suit"/>
      </div>
      <div class="form-group full">
        <label>Delivery Address</label>
        <input type="text" name="address" value="${v('address')}" placeholder="Full address"/>
      </div>
      <div class="form-group">
        <label>Quantity</label>
        <input type="number" name="qty" value="${v('qty',1)}" min="1"/>
      </div>
      <div class="form-group">
        <label>Size</label>
        <input type="text" name="size" value="${v('size')}" placeholder="S/M/L/XL"/>
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="text" name="color" value="${v('color')}" placeholder="e.g. Blue/Gold"/>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" name="date" value="${v('date', new Date().toISOString().split('T')[0])}"/>
      </div>
      <div class="form-group">
        <label>Payment Status</label>
        ${sel('pay_status', ALL_PAY, v('pay_status','Unpaid'))}
      </div>
      <div class="form-group full">
        <label>Order Status</label>
        ${sel('status', ALL_STATUSES, v('status','New'))}
      </div>
      <div class="form-group full">
        <label>Notes</label>
        <textarea name="notes" rows="2" placeholder="Any extra notes…">${v('notes')}</textarea>
      </div>
      <div class="form-group full" style="border-top:2px solid #FFF0F2;padding-top:14px;margin-top:4px">
        <div style="font-size:11px;font-weight:800;color:#D0021B;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🚚 Delivery Tracking</div>
      </div>
      <div class="form-group">
        <label>Delivery Type</label>
        <select name="delivery_type" onchange="updateLogisticsOptions(this.value)">
          <option value="" ${!v('delivery_type')?'selected':''}>-- Select --</option>
          <option value="Lagos" ${v('delivery_type')==='Lagos'?'selected':''}>Lagos (Rider)</option>
          <option value="Interstate" ${v('delivery_type')==='Interstate'?'selected':''}>Interstate (Waybill)</option>
          <option value="Pickup" ${v('delivery_type')==='Pickup'?'selected':''}>Customer Pickup</option>
        </select>
      </div>
      <div class="form-group">
        <label>Logistics Company</label>
        <select name="logistics" id="logistics-select" onchange="handleLogisticsChange(this.value)">
          <option value="" ${!v('logistics')?'selected':''}>-- Select --</option>
          <option value="GIG Logistics" ${v('logistics')==='GIG Logistics'?'selected':''}>GIG Logistics</option>
          <option value="GUO Transport" ${v('logistics')==='GUO Transport'?'selected':''}>GUO Transport</option>
          <option value="DHL" ${v('logistics')==='DHL'?'selected':''}>DHL</option>
          <option value="ABC Transport" ${v('logistics')==='ABC Transport'?'selected':''}>ABC Transport</option>
          <option value="Rider" ${v('logistics')==='Rider'?'selected':''}>Rider (Lagos)</option>
          <option value="Other" ${v('logistics')==='Other'?'selected':''}>Other</option>
        </select>
      </div>
      <div class="form-group" id="logistics-other-wrap" style="display:${v('logistics')==='Other'?'flex':'none'}">
        <label>Specify Logistics</label>
        <input type="text" name="logistics_other" value="${v('logistics_other')}" placeholder="Enter logistics name"/>
      </div>
      <div class="form-group full">
        <label id="tracking-label">Rider Phone / Waybill No.</label>
        <input type="text" name="tracking_number" value="${v('tracking_number')}" placeholder="e.g. 08012345678 or GIG-12345"/>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeSheet()">Cancel</button>
      <button class="btn-save" onclick="submitOrderForm('${order ? order.id : ''}')">${order ? 'Save Changes' : 'Create Order'}</button>
    </div>`;
}

function openOrderForm() { showSheet(orderFormHTML(null), 'New Order'); }

function updateLogisticsOptions(type) {
  var sel = document.getElementById('logistics-select');
  var label = document.getElementById('tracking-label');
  if (!sel) return;
  if (type === 'Lagos') {
    // For Lagos show Rider option first
    sel.value = 'Rider';
    if (label) label.textContent = 'Rider Phone Number';
  } else if (type === 'Interstate') {
    // For interstate default to GIG
    sel.value = 'GIG Logistics';
    if (label) label.textContent = 'Waybill Number';
  } else {
    if (label) label.textContent = 'Rider Phone / Waybill No.';
  }
}

function handleLogisticsChange(val) {
  var wrap = document.getElementById('logistics-other-wrap');
  if (wrap) wrap.style.display = val === 'Other' ? 'flex' : 'none';
}
async function editOrder(id) {
  try {
    const order = await API.request('GET', '/api/orders/'+id);
    showSheet(orderFormHTML(order), 'Edit ' + id);
  } catch(e) { showToast('Failed to load order', true); }
}

