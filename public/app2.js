// ── ORDERS ────────────────────────────────────────────────────────────────────
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
  const statusCounts = {};
  allOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status]||0)+1; });
  el.innerHTML = `
    <div class="page-header">
      <div><h2 class="page-title">Orders</h2><p class="page-sub">${allOrders.length} orders</p></div>
      <div style="display:flex;gap:8px">
        <button onclick="openPrintByStatus()" style="background:#F9F9F9;border:1.5px solid #E8E8E8;border-radius:12px;padding:11px 14px;color:#111;font-weight:700;font-size:13px;cursor:pointer">🖨 Print</button>
        <button class="btn-new" onclick="openOrderForm()">+ New</button>
      </div>
    </div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px;scrollbar-width:none">
      <button onclick="setFStatus('All')" style="flex-shrink:0;padding:7px 14px;border-radius:20px;border:1.5px solid ${filterStatus==='All'?'#D0021B':'#E8E8E8'};background:${filterStatus==='All'?'#FFF0F2':'#fff'};color:${filterStatus==='All'?'#D0021B':'#555'};font-weight:700;font-size:12px;cursor:pointer">All (${allOrders.length})</button>
      ${ALL_STATUSES.map(s => {
        const c = STATUS_COLORS[s]||{};
        const cnt = statusCounts[s]||0;
        const active = filterStatus === s;
        return `<button onclick="setFStatus('${s}')" style="flex-shrink:0;padding:7px 14px;border-radius:20px;border:1.5px solid ${active?c.text:c.border||'#E8E8E8'};background:${active?c.bg:'#fff'};color:${active?c.text:'#555'};font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap">${s} ${cnt>0?'('+cnt+')':''}</button>`;
      }).join('')}
    </div>
    <div class="search-bar">
      <input class="search-input" type="text" placeholder="🔍 Search…" value="${searchQuery}" oninput="searchQuery=this.value;loadOrders()"/>
      <button class="filter-btn ${hasFilter?'active':''}" onclick="toggleFilters()">⚙ ${hasFilter?'●':''}</button>
    </div>
    <div id="filter-panel" style="display:${showFilters?'block':'none'}">
      <div class="filter-panel">
        <div class="filter-label">Payment</div>
        <div class="chip-row">${['All',...ALL_PAY].map(s=>`<button class="chip ${filterPay===s?'active':''}" onclick="setFPay('${s}')">${s}</button>`).join('')}</div>
      </div>
    </div>
    <div id="orders-list">
      ${allOrders.length===0
        ? `<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">No orders found</div></div>`
        : allOrders.map(o=>renderOrderCard(o)).join('')}
    </div>`;
}

function renderOrderCard(o) {
  const sc = STATUS_COLORS[o.status]||{};
  return `
  <div class="order-card" style="border-left:4px solid ${sc.text||'#E8E8E8'}" onclick="viewOrder('${o.id}')">
    <div class="order-card-top">
      <div><div class="order-customer">${o.customer}</div><div class="order-meta">${o.id} · ${dateStr(o.date)}</div></div>
      <div class="order-amount">${fmt(o.amount)}</div>
    </div>
    <div class="order-product">${o.product}${o.size?' · '+o.size:''}${o.color?' · '+o.color:''}</div>
    <div class="order-footer">
      <div style="display:flex;gap:6px;flex-wrap:wrap">${badge(o.status,'status')} ${badge(o.pay_status,'pay')}</div>
      <div class="order-actions" onclick="event.stopPropagation()">
        <button class="icon-btn" style="background:#F0FDF4;color:#059669" onclick="editOrder('${o.id}')">✏️</button>
        <button class="icon-btn" style="background:#FFF0F2;color:#D0021B" onclick="downloadInvoice('${o.id}')">🧾</button>
        <button class="icon-btn" style="background:#FFF0F2;color:#A80016" onclick="confirmDelete('${o.id}')">🗑️</button>
      </div>
    </div>
  </div>`;
}

function toggleFilters() { showFilters = !showFilters; renderOrders(); }
function setFStatus(s) { filterStatus = s; loadOrders(); }
function setFPay(s) { filterPay = s; loadOrders(); }
function viewOrdersByStatus(status) { filterStatus = status; filterPay = 'All'; searchQuery = ''; navigateTo('orders'); }

// ── ORDER DETAIL ──────────────────────────────────────────────────────────────
async function viewOrder(id) {
  try {
    const order = allOrders.find(o => o.id === id) || await API.request('GET', '/api/orders/'+id);
    if (!order) { showToast('Order not found', true); return; }

    // Load items
    let items = [];
    try { items = await API.request('GET', '/api/orders/'+id+'/items'); } catch(e) {}
    if (!items || items.length === 0) {
      items = [{ product: order.product, qty: order.qty, size: order.size, color: order.color, unit_price: order.amount }];
    }

    const rows = [
      ['Customer', order.customer], ['Phone', order.phone],
      ['Date', dateStr(order.date)], ['Address', order.address||'-'],
    ];

    // Items HTML
    const itemsHTML = `
      <div style="margin-bottom:14px">
        <div style="font-size:10px;font-weight:800;color:#D0021B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">📦 Products</div>
        ${items.map((item, i) => `
          <div style="background:#F9F9F9;border-radius:10px;padding:10px 12px;margin-bottom:6px;border-left:3px solid #D0021B">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-weight:700;font-size:14px">${item.product}</div>
              <div style="font-weight:800;font-size:14px;color:#D0021B">${fmt(Number(item.unit_price)*Number(item.qty||1))}</div>
            </div>
            <div style="font-size:12px;color:#A0A0A0;margin-top:3px">
              Qty: ${item.qty||1}${item.size?' · Size: '+item.size:''}${item.color?' · Color: '+item.color:''}
              · Unit: ${fmt(item.unit_price)}
            </div>
          </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:10px 12px;background:#111;border-radius:10px;margin-top:4px">
          <span style="color:#fff;font-weight:700">Total</span>
          <span style="color:#fff;font-weight:900;font-size:16px">${fmt(order.amount)}</span>
        </div>
      </div>`;

    var deliveryHTML = '';
    if (order.delivery_type || order.tracking_number || order.logistics) {
      deliveryHTML = `<div style="margin:14px 0;padding:12px 14px;background:#F0F7FF;border-radius:10px;border-left:3px solid #1D6FE8">
        <div style="font-size:10px;font-weight:800;color:#1D6FE8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🚚 Delivery Tracking</div>
        ${order.delivery_type?`<div class="detail-row"><span class="detail-key">Type</span><span class="detail-val">${order.delivery_type}</span></div>`:''}
        ${order.tracking_number?`<div class="detail-row"><span class="detail-key">${order.delivery_type==='Lagos'?'Rider No.':'Waybill No.'}</span><span class="detail-val" style="color:#1D6FE8;font-weight:800">${order.tracking_number}</span></div>`:''}
        ${order.logistics?`<div class="detail-row"><span class="detail-key">Logistics</span><span class="detail-val">${order.logistics}</span></div>`:''}
      </div>`;
    }

    showSheet(`
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        ${badge(order.status,'status')} ${badge(order.pay_status,'pay')}
      </div>
      ${rows.map(([k,v])=>v&&v!=='-'?`<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`:'').join('')}
      ${itemsHTML}
      ${deliveryHTML}
      <div class="detail-actions">
        <button class="btn-edit" onclick="closeSheet();editOrder('${order.id}')">✏️ Edit</button>
        <button class="btn-invoice" onclick="closeSheet();downloadInvoice('${order.id}')">🧾 PDF</button>
      </div>
      <div style="display:flex;gap:10px;margin-top:10px">
        <button onclick="shareInvoice('${order.id}')" style="flex:1;background:#25D366;border:none;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;cursor:pointer">📤 Share</button>
        <button onclick="downloadProforma('${order.id}')" style="flex:1;background:linear-gradient(135deg,#1D6FE8,#1558C0);border:none;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;cursor:pointer">📋 Proforma PDF</button>
      </div>
    `, order.id);
  } catch(e) { showToast('Failed to load order', true); console.error(e); }
}

// ── SHARE PROFORMA ────────────────────────────────────────────────────────────
async function shareProforma(id) {
  const order = allOrders.find(o=>o.id===id) || await API.request('GET','/api/orders/'+id);
  const amtStr = '₦'+Number(order.amount).toLocaleString('en-NG');
  const d = new Date(order.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  const text = ['━━━━━━━━━━━━━━━━━━━━','  *URBANFITZ CLOTHINGS*','  3 Ajibode Street, Yaba, Lagos','  📞 07038245181','━━━━━━━━━━━━━━━━━━━━','',
    `📋 *PROFORMA INVOICE*`,`Reference: ${order.id}`,`Date: ${d}`,'','👤 *Customer*',`${order.customer}`,`${order.phone}`,'',
    '📦 *Order Summary*',`Product:  ${order.product}`,`Size:     ${order.size||'-'}`,`Color:    ${order.color||'-'}`,`Quantity: ${order.qty}`,'',
    '━━━━━━━━━━━━━━━━━━━━',`💰 *TOTAL AMOUNT: ${amtStr}*`,'━━━━━━━━━━━━━━━━━━━━','',
    '🏦 *Payment Details*','Bank:    StanbicIBTC','Account: 0079743487','Name:    The Urbanfitz Clothing','',
    '_Kindly make payment into the account above to confirm your order._','','_UrbanFitz Clothings — Quality you can wear with pride_ 🌟','━━━━━━━━━━━━━━━━━━━━'].join('\n');
  if (navigator.share) { try { await navigator.share({title:`Proforma ${order.id}`,text}); return; } catch(e){ if(e.name==='AbortError') return; } }
  try { await navigator.clipboard.writeText(text); showToast('✅ Proforma copied!'); }
  catch(e) { const ta=document.createElement('textarea'); ta.value=text; ta.style.cssText='position:fixed;top:0;left:0;opacity:0;'; document.body.appendChild(ta); ta.focus(); ta.select(); try{document.execCommand('copy');showToast('✅ Proforma copied!');}catch(e2){} document.body.removeChild(ta); }
}

// ── SHARE INVOICE ─────────────────────────────────────────────────────────────
async function shareInvoice(id) {
  const order = allOrders.find(o=>o.id===id) || await API.request('GET','/api/orders/'+id);
  const amtStr = '₦'+Number(order.amount).toLocaleString('en-NG');
  const d = new Date(order.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  const text = ['━━━━━━━━━━━━━━━━━━━━','  *URBANFITZ CLOTHINGS*','  3 Ajibode Street, Yaba, Lagos','  📞 07038245181','━━━━━━━━━━━━━━━━━━━━','',
    `🧾 *INVOICE ${order.id}*`,`📅 Date: ${d}`,'','👤 *Customer Details*',`Name: ${order.customer}`,`Phone: ${order.phone}`,`Address: ${order.address||'-'}`,'',
    '📦 *Order Details*',`Product: ${order.product}`,`Size: ${order.size||'-'}`,`Color: ${order.color||'-'}`,`Quantity: ${order.qty}`,'',
    '━━━━━━━━━━━━━━━━━━━━',`💰 *TOTAL: ${amtStr}*`,`💳 Payment: ${order.pay_status}`,`📋 Status: ${order.status}`,'━━━━━━━━━━━━━━━━━━━━','',
    '_Thank you for your business!_','_UrbanFitz Clothings — Quality you can wear with pride_ 🌟'].join('\n');
  if (navigator.share) { try { await navigator.share({title:`Invoice ${order.id}`,text}); return; } catch(e){ if(e.name==='AbortError') return; } }
  try { await navigator.clipboard.writeText(text); showToast('✅ Invoice copied!'); }
  catch(e) { const ta=document.createElement('textarea'); ta.value=text; ta.style.cssText='position:fixed;top:0;left:0;opacity:0;'; document.body.appendChild(ta); ta.focus(); ta.select(); try{document.execCommand('copy');showToast('✅ Invoice copied!');}catch(e2){} document.body.removeChild(ta); }
}

// ── ORDER FORM ────────────────────────────────────────────────────────────────
function orderFormHTML(order) {
  const v = (key,fallback) => order?(order[key]||fallback||''):(fallback||'');
  const sel = (name,options,current) => `<select name="${name}">${options.map(o=>`<option ${o===current?'selected':''}>${o}</option>`).join('')}</select>`;
  return `<div class="form-grid">
    <div class="form-group full"><label>Customer Name *</label><input type="text" name="customer" value="${v('customer')}" placeholder="e.g. Adaeze Okonkwo"/></div>
    <div class="form-group"><label>Phone *</label><input type="tel" name="phone" value="${v('phone')}" placeholder="08012345678"/></div>
    <div class="form-group"><label>Date</label><input type="date" name="date" value="${v('date',new Date().toISOString().split('T')[0])}"/></div>
    <div class="form-group full"><label>Delivery Address</label><input type="text" name="address" value="${v('address')}" placeholder="Full address"/></div>

    <!-- Products Section -->
    <div class="form-group full">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <label style="margin:0">PRODUCTS *</label>
        <button type="button" onclick="addOrderItem()" style="background:#D0021B;border:none;border-radius:8px;padding:6px 12px;color:#fff;font-weight:700;font-size:12px;cursor:pointer">+ Add Item</button>
      </div>
      <div id="order-items-list">
        ${order && order.items && order.items.length > 0
          ? order.items.map((item, i) => orderItemRow(item, i)).join('')
          : orderItemRow(null, 0)
        }
      </div>
      <div style="background:#F9F9F9;border-radius:10px;padding:10px 14px;margin-top:10px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;font-size:13px">Total Amount</span>
        <span id="order-total" style="font-weight:900;font-size:16px;color:#D0021B">${fmt(order?order.amount:0)}</span>
      </div>
    </div>

    <div class="form-group"><label>Payment Status</label>${sel('pay_status',ALL_PAY,v('pay_status','Unpaid'))}</div>
    <div class="form-group full"><label>Order Status</label>${sel('status',ALL_STATUSES,v('status','New'))}</div>
    <div class="form-group full"><label>Notes</label><textarea name="notes" rows="2" placeholder="Any extra notes…">${v('notes')}</textarea></div>
    <div class="form-group full" style="border-top:2px solid #FFF0F2;padding-top:14px;margin-top:4px">
      <div style="font-size:11px;font-weight:800;color:#D0021B;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🚚 Delivery Tracking</div>
    </div>
    <div class="form-group"><label>Delivery Type</label>
      <select name="delivery_type" onchange="updateLogisticsOptions(this.value)">
        <option value="" ${!v('delivery_type')?'selected':''}>-- Select --</option>
        <option value="Lagos" ${v('delivery_type')==='Lagos'?'selected':''}>Lagos (Rider)</option>
        <option value="Interstate" ${v('delivery_type')==='Interstate'?'selected':''}>Interstate (Waybill)</option>
        <option value="Pickup" ${v('delivery_type')==='Pickup'?'selected':''}>Customer Pickup</option>
      </select>
    </div>
    <div class="form-group"><label>Logistics Company</label>
      <select name="logistics" id="logistics-select">
        <option value="" ${!v('logistics')?'selected':''}>-- Select --</option>
        <option value="GIG Logistics" ${v('logistics')==='GIG Logistics'?'selected':''}>GIG Logistics</option>
        <option value="GUO Transport" ${v('logistics')==='GUO Transport'?'selected':''}>GUO Transport</option>
        <option value="DHL" ${v('logistics')==='DHL'?'selected':''}>DHL</option>
        <option value="ABC Transport" ${v('logistics')==='ABC Transport'?'selected':''}>ABC Transport</option>
        <option value="Rider" ${v('logistics')==='Rider'?'selected':''}>Rider (Lagos)</option>
        <option value="Other" ${v('logistics')==='Other'?'selected':''}>Other</option>
      </select>
    </div>
    <div class="form-group full"><label id="tracking-label">Rider Phone / Waybill No.</label>
      <input type="text" name="tracking_number" value="${v('tracking_number')}" placeholder="e.g. 08012345678 or GIG-12345"/>
    </div>
  </div>
  <div class="form-actions">
    <button class="btn-cancel" onclick="closeSheet()">Cancel</button>
    <button class="btn-save" onclick="submitOrderForm('${order?order.id:''}')">${order?'Save Changes':'Create Order'}</button>
  </div>`;
}

function updateLogisticsOptions(type) {
  const sel = document.getElementById('logistics-select');
  const label = document.getElementById('tracking-label');
  if (!sel) return;
  if (type === 'Lagos') { sel.value = 'Rider'; if(label) label.textContent = 'Rider Phone Number'; }
  else if (type === 'Interstate') { sel.value = 'GIG Logistics'; if(label) label.textContent = 'Waybill Number'; }
  else { if(label) label.textContent = 'Rider Phone / Waybill No.'; }
}

function orderItemRow(item, index) {
  const iS = 'width:100%;border:1.5px solid #E8E8E8;border-radius:8px;padding:9px 10px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;';
  return `<div class="order-item-row" id="item-row-${index}" style="background:#F9F9F9;border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid #E8E8E8">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:11px;font-weight:800;color:#D0021B">ITEM ${index+1}</span>
      ${index>0?`<button type="button" onclick="removeOrderItem(${index})" style="background:#FFF0F2;border:none;border-radius:6px;padding:4px 8px;color:#D0021B;font-size:12px;cursor:pointer">✕ Remove</button>`:''}
    </div>
    <input type="text" placeholder="Product name *" data-item="${index}" data-field="product" value="${item?item.product:''}" oninput="updateTotal()" style="${iS}margin-bottom:6px"/>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
      <input type="text" placeholder="Size" data-item="${index}" data-field="size" value="${item?item.size||'':''}" style="${iS}"/>
      <input type="text" placeholder="Color" data-item="${index}" data-field="color" value="${item?item.color||'':''}" style="${iS}"/>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <input type="number" placeholder="Qty" data-item="${index}" data-field="qty" value="${item?item.qty:1}" min="1" oninput="updateTotal()" style="${iS}"/>
      <input type="number" placeholder="Unit Price (₦) *" data-item="${index}" data-field="unit_price" value="${item?item.unit_price:''}" oninput="updateTotal()" style="${iS}"/>
    </div>
  </div>`;
}

function addOrderItem() {
  const list = document.getElementById('order-items-list');
  const count = list.querySelectorAll('.order-item-row').length;
  const div = document.createElement('div');
  div.innerHTML = orderItemRow(null, count);
  list.appendChild(div.firstElementChild);
}

function removeOrderItem(index) {
  document.getElementById('item-row-'+index)?.remove();
  updateTotal();
  // Re-number remaining items
  document.querySelectorAll('.order-item-row').forEach((row, i) => {
    row.id = 'item-row-'+i;
    const label = row.querySelector('span');
    if (label) label.textContent = 'ITEM '+(i+1);
    row.querySelectorAll('[data-item]').forEach(el => el.dataset.item = i);
  });
}

function updateTotal() {
  let total = 0;
  const rows = document.querySelectorAll('.order-item-row');
  rows.forEach(row => {
    const qty = parseFloat(row.querySelector('[data-field="qty"]')?.value)||1;
    const price = parseFloat(row.querySelector('[data-field="unit_price"]')?.value)||0;
    total += qty * price;
  });
  const el = document.getElementById('order-total');
  if (el) el.textContent = '₦' + total.toLocaleString('en-NG');
}

function openOrderForm() { showSheet(orderFormHTML(null), 'New Order'); }
async function editOrder(id) {
  try {
    const order = await API.request('GET', '/api/orders/'+id);
    const items = await API.request('GET', '/api/orders/'+id+'/items');
    order.items = items.length > 0 ? items : null;
    showSheet(orderFormHTML(order), 'Edit '+id);
  } catch(e) { showToast('Failed to load order', true); }
}

async function submitOrderForm(id) {
  const sheet = document.getElementById('bottom-sheet');
  const form = {};
  sheet.querySelectorAll('[name]').forEach(el => { form[el.name] = el.value; });

  // Collect items
  const itemRows = sheet.querySelectorAll('.order-item-row');
  const items = [];
  let valid = true;
  itemRows.forEach(row => {
    const product = row.querySelector('[data-field="product"]')?.value?.trim();
    const qty     = row.querySelector('[data-field="qty"]')?.value;
    const size    = row.querySelector('[data-field="size"]')?.value||'';
    const color   = row.querySelector('[data-field="color"]')?.value||'';
    const price   = row.querySelector('[data-field="unit_price"]')?.value;
    if (!product || !price) { valid = false; return; }
    items.push({ product, qty: parseInt(qty)||1, size, color, unit_price: parseFloat(price) });
  });

  if (!form.customer || !form.phone) { showToast('Fill customer name and phone', true); return; }
  if (!valid || items.length === 0)  { showToast('Fill all product names and prices', true); return; }

  form.items = items;

  try {
    if (id) { await API.updateOrder(id, form); showToast('✅ Order updated'); }
    else     { await API.createOrder(form);    showToast('✅ Order created'); }
    closeSheet();
    await loadOrders();
  } catch(e) { showToast(e.message||'Failed to save', true); }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
function confirmDelete(id) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay'; overlay.id = 'del-overlay';
  overlay.innerHTML = `<div class="confirm-sheet">
    <div class="confirm-icon">🗑️</div>
    <div class="confirm-title">Delete Order?</div>
    <div class="confirm-text">Delete <b>${id}</b>? This cannot be undone.</div>
    <div class="confirm-actions">
      <button class="btn-cancel" onclick="document.getElementById('del-overlay').remove()">Cancel</button>
      <button class="btn-danger" onclick="doDelete('${id}')">Delete</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

async function doDelete(id) {
  try {
    await API.deleteOrder(id);
    document.getElementById('del-overlay')?.remove();
    showToast('✅ Order deleted');
    await loadOrders();
  } catch(e) { showToast('Failed to delete', true); }
}

// ── INVOICE ───────────────────────────────────────────────────────────────────
function downloadInvoice(id)  { showToast('📄 Preparing PDF…');     window.open('/api/orders/'+id+'/pdf','_blank'); }
function downloadProforma(id) { showToast('📋 Preparing Proforma…'); window.open('/api/orders/'+id+'/proforma','_blank'); }
function exportCSV()          { showToast('📊 Preparing CSV…');      window.open('/api/export/orders','_blank'); }
