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
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeSheet()">Cancel</button>
      <button class="btn-save" onclick="submitOrderForm('${order ? order.id : ''}')">${order ? 'Save Changes' : 'Create Order'}</button>
    </div>`;
}

function openOrderForm() { showSheet(orderFormHTML(null), 'New Order'); }
async function editOrder(id) {
  try {
    const order = await API.request('GET', '/api/orders/'+id);
    showSheet(orderFormHTML(order), 'Edit ' + id);
  } catch(e) { showToast('Failed to load order', true); }
}

async function submitOrderForm(id) {
  const sheet = document.getElementById('bottom-sheet');
  const form  = {};
  sheet.querySelectorAll('[name]').forEach(el => { form[el.name] = el.value; });
  if (!form.customer || !form.phone || !form.product || !form.amount) {
    showToast('Fill all required fields (*)', true); return;
  }
  try {
    if (id) { await API.updateOrder(id, form); showToast('✅ Order updated'); }
    else     { await API.createOrder(form);    showToast('✅ Order created'); }
    closeSheet();
    await loadOrders();
  } catch(e) { showToast(e.message || 'Failed to save', true); }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
function confirmDelete(id) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'del-overlay';
  overlay.innerHTML = `
    <div class="confirm-sheet">
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
function downloadInvoice(id) {
  showToast('📄 Preparing PDF…');
  window.open('/api/orders/' + id + '/pdf', '_blank');
}

function downloadProforma(id) {
  showToast('📋 Preparing Proforma…');
  window.open('/api/orders/' + id + '/proforma', '_blank');
}

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────
async function loadCustomers() {
  const el = document.getElementById('page-customers');
  el.innerHTML = '<div class="empty"><div class="spinner" style="margin:40px auto"></div></div>';
  try {
    const customers = await API.getCustomers();
    el.innerHTML = `
      <div class="page-header" style="margin-bottom:4px">
        <div><h2 class="page-title">Customers</h2><p class="page-sub">${customers.length} customers</p></div>
      </div>
      <input class="search-input" style="width:100%;margin-bottom:14px" type="text"
        placeholder="🔍 Search customers…" oninput="filterCustomers(this.value,'${encodeURIComponent(JSON.stringify(customers))}')"/>
      <div id="customers-list">
        ${customers.map(c => renderCustomerCard(c)).join('')}
      </div>`;
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Failed to load</div></div>`;
  }
}

function renderCustomerCard(c) {
  return `
  <div class="customer-card" onclick="viewCustomer('${encodeURIComponent(c.phone)}','${encodeURIComponent(c.name)}')">
    <div class="customer-avatar">${c.name.charAt(0)}</div>
    <div class="customer-info">
      <div class="customer-name">${c.name}</div>
      <div class="customer-phone">${c.phone}</div>
      <div class="customer-last">${c.last_order_date ? 'Last order: '+dateStr(c.last_order_date) : 'No orders yet'}</div>
    </div>
    <div class="customer-stats">
      <div class="customer-spent">${fmt(c.total_spent)}</div>
      <div class="customer-orders">${c.order_count} order${c.order_count!==1?'s':''}</div>
    </div>
  </div>`;
}

function filterCustomers(q, encoded) {
  try {
    const all = JSON.parse(decodeURIComponent(encoded));
    const filtered = q ? all.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q)) : all;
    document.getElementById('customers-list').innerHTML = filtered.map(c => renderCustomerCard(c)).join('');
  } catch(e) {}
}

async function viewCustomer(phone, name) {
  try {
    const orders = await API.getCustomerOrders(decodeURIComponent(phone));
    const totalSpent = orders.filter(o=>o.pay_status==='Paid').reduce((a,o)=>a+Number(o.amount),0);
    showSheet(`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">
        <div style="background:#F9F9F9;border-radius:12px;padding:14px">
          <div style="font-size:10px;color:#A0A0A0;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">Orders</div>
          <div style="font-weight:900;font-size:24px">${orders.length}</div>
        </div>
        <div style="background:#ECFDF5;border-radius:12px;padding:14px">
          <div style="font-size:10px;color:#A0A0A0;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">Spent (Paid)</div>
          <div style="font-weight:900;font-size:20px;color:#059669">${fmt(totalSpent)}</div>
        </div>
      </div>
      <h4 style="font-weight:800;color:#111;font-size:12px;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.8px">Order History</h4>
      ${orders.map(o => {
        const c = STATUS_COLORS[o.status]||{};
        return `<div class="detail-row">
          <div><div style="font-weight:700;font-size:13px">${o.product}</div><div style="font-size:11px;color:#A0A0A0">${o.id} · ${dateStr(o.date)}</div></div>
          <div style="text-align:right"><div style="font-weight:800">${fmt(o.amount)}</div><span class="badge" style="background:${c.bg};color:${c.text};font-size:10px">${o.status}</span></div>
        </div>`;
      }).join('')}
    `, decodeURIComponent(name));
  } catch(e) { showToast('Failed to load customer', true); }
}

// ── INVOICES ──────────────────────────────────────────────────────────────────
async function loadInvoices() {
  const el = document.getElementById('page-invoices');
  el.innerHTML = '<div class="empty"><div class="spinner" style="margin:40px auto"></div></div>';
  try {
    const orders = await API.getOrders();
    el.innerHTML = `
      <div style="margin-bottom:4px"><h2 class="page-title">Invoices</h2><p class="page-sub">Download PDF for any order</p></div>
      <input class="search-input" style="width:100%;margin-bottom:14px" type="text"
        placeholder="🔍 Search…" oninput="filterInvoices(this.value)"/>
      <div id="invoices-list">
        ${orders.map(o => renderInvoiceCard(o)).join('')}
      </div>`;
    window._allInvoiceOrders = orders;
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Failed to load</div></div>`;
  }
}

function renderInvoiceCard(o) {
  const pc = PAY_COLORS[o.pay_status] || {};
  return `
  <div class="invoice-card">
    <div class="invoice-icon">🧾</div>
    <div class="invoice-info">
      <div class="invoice-customer">${o.customer}</div>
      <div class="invoice-id">${o.id}</div>
      <div class="invoice-meta">${o.product} · ${dateStr(o.date)}</div>
    </div>
    <div class="invoice-right">
      <div class="invoice-amount">${fmt(o.amount)}</div>
      <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn-view-inv" onclick="downloadInvoice('${o.id}')">🧾 Invoice</button>
        <button class="btn-view-inv" style="background:#1D6FE8" onclick="downloadProforma('${o.id}')">📋 Proforma</button>
        <button class="btn-view-inv" style="background:#25D366" onclick="shareProforma('${o.id}')">📤</button>
      </div>
    </div>
  </div>`;
}

function filterInvoices(q) {
  const all = window._allInvoiceOrders || [];
  const filtered = q ? all.filter(o => o.customer.toLowerCase().includes(q.toLowerCase()) || o.id.toLowerCase().includes(q.toLowerCase())) : all;
  document.getElementById('invoices-list').innerHTML = filtered.map(o => renderInvoiceCard(o)).join('');
}

// ── BOTTOM SHEET ──────────────────────────────────────────────────────────────
function showSheet(content, title) {
  closeSheet();
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'bottom-sheet-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeSheet(); };
  overlay.innerHTML = `
    <div class="sheet" id="bottom-sheet">
      <div class="sheet-handle"><div class="sheet-handle-bar"></div></div>
      <div class="sheet-header">
        <span class="sheet-title">${title||''}</span>
        <button class="btn-close" onclick="closeSheet()">✕</button>
      </div>
      <div class="sheet-body">${content}</div>
    </div>`;
  document.body.appendChild(overlay);
}

function closeSheet() {
  document.getElementById('bottom-sheet-overlay')?.remove();
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
async function loadAnalytics() {
  const el = document.getElementById('page-analytics');
  el.innerHTML = '<div class="empty"><div class="spinner" style="margin:40px auto"></div></div>';
  try {
    const d = await API.get('/api/analytics');
    const t = d.totals;
    const fmt2 = n => '₦' + Number(n||0).toLocaleString('en-NG');
    const fmtShort = n => {
      n = Number(n||0);
      if (n >= 1000000) return '₦' + (n/1000000).toFixed(1) + 'M';
      if (n >= 1000)    return '₦' + (n/1000).toFixed(0) + 'K';
      return '₦' + n;
    };

    // Revenue bar chart
    const maxRev = Math.max(...d.revenueByMonth.map(m => Number(m.paid_revenue)||0), 1);
    const monthBars = d.revenueByMonth.map(m => {
      const pct = Math.max(4, ((Number(m.paid_revenue)||0) / maxRev) * 100);
      const label = m.month.split(' ')[0]; // "Jan", "Feb" etc
      return `<div class="month-col">
        <div class="month-amt">${fmtShort(m.paid_revenue)}</div>
        <div class="month-bar" style="height:${pct}%;background:linear-gradient(180deg,#D0021B,#A80016)"></div>
        <div class="month-label">${label}</div>
      </div>`;
    }).join('');

    // Top products bars
    const maxProd = Math.max(...d.topProducts.map(p => Number(p.count)), 1);
    const prodBars = d.topProducts.map((p, i) => {
      const pct = (Number(p.count) / maxProd) * 100;
      const colors = ['#D0021B','#C05621','#6D28D9','#059669','#1D6FE8'];
      return `<div class="chart-bar-wrap">
        <div class="chart-bar-label">
          <span>${p.product}</span>
          <span>${p.count} orders · ${fmt2(p.revenue)}</span>
        </div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill" style="width:${pct}%;background:${colors[i]||'#D0021B'}"></div>
        </div>
      </div>`;
    }).join('');

    // Top customers
    const rankMedals = ['gold','silver','bronze','',''];
    const custRows = d.topCustomers.map((c, i) => `
      <div class="rank-row">
        <div class="rank-num ${rankMedals[i]||''}">${i+1}</div>
        <div class="rank-info">
          <div class="rank-name">${c.customer}</div>
          <div class="rank-sub">${c.order_count} orders · ${c.phone}</div>
        </div>
        <div class="rank-value">${fmt2(c.paid_amount)}</div>
      </div>`).join('');

    // Payment breakdown
    const totalPay = d.paymentBreakdown.reduce((a, r) => a + Number(r.count), 0) || 1;
    const payColors = { 'Paid':'#059669', 'Partially Paid':'#D97706', 'Unpaid':'#D0021B' };
    const payBars = d.paymentBreakdown.map(r => {
      const pct = (Number(r.count) / totalPay) * 100;
      return `<div class="chart-bar-wrap">
        <div class="chart-bar-label">
          <span>${r.pay_status}</span>
          <span>${r.count} orders · ${fmt2(r.total)}</span>
        </div>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill" style="width:${pct}%;background:${payColors[r.pay_status]||'#111'}"></div>
        </div>
      </div>`;
    }).join('');

    // Outstanding amount
    const outstanding = Number(t.unpaid_revenue||0) + Number(t.partial_revenue||0);

    el.innerHTML = `
      <div class="analytics-header">
        <div><h2 class="page-title">Analytics</h2><p class="page-sub">Business insights</p></div>
        <button class="btn-export" onclick="exportCSV()">⬇ Export CSV</button>
      </div>

      <!-- Key Metrics -->
      <div class="metric-grid">
        <div class="metric-card" style="border-top:3px solid #059669">
          <div class="metric-label">Total Revenue</div>
          <div class="metric-value green ${fmt2(t.total_revenue).length > 10 ? 'small' : ''}">${fmt2(t.total_revenue)}</div>
        </div>
        <div class="metric-card" style="border-top:3px solid #D0021B">
          <div class="metric-label">Outstanding</div>
          <div class="metric-value red ${fmt2(outstanding).length > 10 ? 'small' : ''}">${fmt2(outstanding)}</div>
        </div>
        <div class="metric-card" style="border-top:3px solid #111">
          <div class="metric-label">Total Orders</div>
          <div class="metric-value">${t.total_orders}</div>
        </div>
        <div class="metric-card" style="border-top:3px solid #6D28D9">
          <div class="metric-label">Avg Order Value</div>
          <div class="metric-value small">${fmt2(Math.round(t.avg_order_value||0))}</div>
        </div>
      </div>

      <!-- Monthly Revenue Chart -->
      ${d.revenueByMonth.length > 0 ? `
      <div class="white-box">
        <h3 class="box-title">Monthly Revenue (Paid)</h3>
        <div class="month-chart">${monthBars}</div>
      </div>` : ''}

      <!-- Payment Breakdown -->
      <div class="white-box">
        <h3 class="box-title">Payment Breakdown</h3>
        ${payBars || '<div style="color:#A0A0A0;font-size:13px">No data yet</div>'}
      </div>

      <!-- Top Products -->
      ${d.topProducts.length > 0 ? `
