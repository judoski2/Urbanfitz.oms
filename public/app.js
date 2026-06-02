// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  'New':                { bg:'#EBF4FF', text:'#1D6FE8', border:'#BFDBFE' },
  'In Production':      { bg:'#FFF7ED', text:'#C05621', border:'#FED7AA' },
  'Ready for Delivery': { bg:'#F0FDF4', text:'#166534', border:'#BBF7D0' },
  'Shipped':            { bg:'#F5F3FF', text:'#6D28D9', border:'#DDD6FE' },
  'Delivered':          { bg:'#ECFDF5', text:'#065F46', border:'#A7F3D0' },
  'Cancelled':          { bg:'#FFF0F2', text:'#A80016', border:'#FECDD3' },
};
const PAY_COLORS = {
  'Paid':           { bg:'#ECFDF5', text:'#065F46' },
  'Partially Paid': { bg:'#FFFBEB', text:'#92400E' },
  'Unpaid':         { bg:'#FFF0F2', text:'#A80016' },
};
const ALL_STATUSES  = ['New','In Production','Ready for Delivery','Shipped','Delivered','Cancelled'];
const ALL_PAY       = ['Unpaid','Partially Paid','Paid'];

function fmt(n) { return '₦' + Number(n).toLocaleString('en-NG'); }
function dateStr(d) { return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
function badge(text, type) {
  const c = type === 'pay' ? (PAY_COLORS[text]||{}) : (STATUS_COLORS[text]||{});
  return `<span class="badge" style="background:${c.bg};color:${c.text};border:1px solid ${c.border||c.bg}">${text}</span>`;
}

// ── STATE ─────────────────────────────────────────────────────────────────────
let currentPage  = 'dashboard';
let allOrders    = [];
let filterStatus = 'All';
let filterPay    = 'All';
let searchQuery  = '';
let showFilters  = false;

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, isError) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 2500);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const me = await API.me();
    if (me.loggedIn) { showApp(); }
    else { showLogin(); }
  } catch { showLogin(); }
});

function showLogin() {
  document.getElementById('app').innerHTML = renderLogin();
  attachLoginEvents();
}

function showApp() {
  document.getElementById('app').innerHTML = renderApp();
  attachNavEvents();
  navigateTo('dashboard');
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function renderLogin(mode) {
  mode = mode || 'login';
  return `
  <div id="login-page">
    <div class="login-card">
      <div class="login-logo">
        <div><span class="logo-urban">URBAN</span><span class="logo-fitz">Fitz</span></div>
        <div class="login-sub">Order Management System</div>
      </div>
      ${mode === 'login' ? `
        <h2>Welcome back 👋</h2>
        <div id="login-err" class="err-box" style="display:none"></div>
        <label class="form-label">Email</label>
        <input class="form-input" type="email" id="login-email" value="admin@urbanfitz.ng" placeholder="admin@urbanfitz.ng"/>
        <label class="form-label">Password</label>
        <div class="pw-wrap">
          <input class="form-input" type="password" id="login-pass" value="admin123" placeholder="••••••••"/>
          <button class="pw-toggle" onclick="togglePw()">Show</button>
        </div>
        <div style="text-align:right;margin-bottom:20px">
          <button class="btn-link" onclick="showForgot()">Forgot password?</button>
        </div>
        <button class="btn-primary" id="login-btn" onclick="doLogin()">Sign In</button>
        <div class="login-hint">admin@urbanfitz.ng / admin123</div>
      ` : `
        <h2>Reset Password</h2>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;margin-bottom:20px">Enter your email to receive a reset link</p>
        <label class="form-label">Email</label>
        <input class="form-input" type="email" id="reset-email" value="admin@urbanfitz.ng"/>
        <button class="btn-primary" onclick="doReset()">Send Reset Link</button>
        <div style="text-align:center;margin-top:14px">
          <button class="btn-link" onclick="showLoginMode()">← Back to login</button>
        </div>
      `}
    </div>
  </div>`;
}

function attachLoginEvents() {}
function togglePw() {
  const i = document.getElementById('login-pass');
  const b = document.querySelector('.pw-toggle');
  if (i.type === 'password') { i.type = 'text'; b.textContent = 'Hide'; }
  else { i.type = 'password'; b.textContent = 'Show'; }
}
function showForgot() { document.getElementById('app').innerHTML = renderLogin('reset'); }
function showLoginMode() { document.getElementById('app').innerHTML = renderLogin('login'); }
function doReset() { alert('Reset link sent! (Demo mode)'); showLoginMode(); }

async function doLogin() {
  const email = document.getElementById('login-email').value;
  const pass  = document.getElementById('login-pass').value;
  const btn   = document.getElementById('login-btn');
  const err   = document.getElementById('login-err');
  btn.disabled = true; btn.textContent = 'Signing in…';
  err.style.display = 'none';
  try {
    await API.login(email, pass);
    showApp();
  } catch(e) {
    err.textContent = e.message || 'Invalid credentials';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

// ── APP SHELL ─────────────────────────────────────────────────────────────────
function renderApp() {
  return `
  <div id="main-app" class="active">
    <div class="topbar">
      <div class="topbar-logo">
        <div><span class="logo-urban">URBAN</span><span class="logo-fitz">Fitz</span></div>
        <span class="logo-clothings">CLOTHINGS</span>
      </div>
      <button class="btn-logout" onclick="doLogout()">Logout</button>
    </div>
    <div id="page-dashboard" class="page"></div>
    <div id="page-orders"    class="page"></div>
    <div id="page-customers" class="page"></div>
    <div id="page-invoices"  class="page"></div>
    <div id="page-analytics" class="page"></div>
    <nav class="bottom-nav">
      <button class="nav-btn" data-page="dashboard" onclick="navigateTo('dashboard')">
        <span class="nav-icon">⊞</span><span>Home</span><div class="nav-dot"></div>
      </button>
      <button class="nav-btn" data-page="orders" onclick="navigateTo('orders')">
        <span class="nav-icon">📦</span><span>Orders</span><div class="nav-dot"></div>
      </button>
      <button class="nav-btn" data-page="customers" onclick="navigateTo('customers')">
        <span class="nav-icon">👥</span><span>Customers</span><div class="nav-dot"></div>
      </button>
      <button class="nav-btn" data-page="invoices" onclick="navigateTo('invoices')">
        <span class="nav-icon">🧾</span><span>Invoices</span><div class="nav-dot"></div>
      </button>
      <button class="nav-btn" data-page="analytics" onclick="navigateTo('analytics')">
        <span class="nav-icon">📊</span><span>Analytics</span><div class="nav-dot"></div>
      </button>
    </nav>
  </div>`;
}

function attachNavEvents() {}

async function doLogout() {
  await API.logout().catch(() => {});
  showLogin();
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  loadPage(page);
}

async function loadPage(page) {
  if (page === 'dashboard')  await loadDashboard();
  if (page === 'orders')     await loadOrders();
  if (page === 'customers')  await loadCustomers();
  if (page === 'invoices')   await loadInvoices();
  if (page === 'analytics')  await loadAnalytics();
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const el = document.getElementById('page-dashboard');
  el.innerHTML = '<div class="empty"><div class="spinner" style="margin:40px auto"></div></div>';
  try {
    const s = await API.getStats();
    const today = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
    const revStr = fmt(s.revenue);
    el.innerHTML = `
      <p style="font-size:12px;color:#A0A0A0;margin-bottom:2px">${today}</p>
      <h2 class="page-title" style="margin-bottom:20px">Good day, Admin 👋</h2>
      <div class="stat-grid">
        <div class="stat-card border-black">
          <div class="stat-icon">📦</div>
          <div class="stat-value">${s.total}</div>
          <div class="stat-label">Total Orders</div>
        </div>
        <div class="stat-card border-purple">
          <div class="stat-icon">📅</div>
          <div class="stat-value">${s.thisMonth}</div>
          <div class="stat-label">This Month</div>
        </div>
        <div class="stat-card border-green">
          <div class="stat-icon">💰</div>
          <div class="stat-value ${revStr.length > 10 ? 'small' : ''}">${revStr}</div>
          <div class="stat-label">Revenue</div>
        </div>
        <div class="stat-card border-red">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${s.pending}</div>
          <div class="stat-label">Pending</div>
        </div>
      </div>
      <div class="white-box">
        <h3 class="box-title">Order Statuses — tap to view</h3>
        ${s.byStatus.map(r => {
          const c = STATUS_COLORS[r.status] || {};
          const pct = s.total ? (r.c / s.total * 100) : 0;
          return `<div class="status-row" onclick="viewOrdersByStatus('${r.status}')" style="cursor:pointer;padding:8px;margin:-4px;border-radius:10px;transition:background 0.15s" onmouseenter="this.style.background='#F9F9F9'" onmouseleave="this.style.background=''">
            <div class="status-dot" style="background:${c.text}"></div>
            <span class="status-name">${r.status}</span>
            <div class="status-bar-bg"><div class="status-bar-fill" style="width:${pct}%;background:${c.text}"></div></div>
            <span class="status-count" style="color:${c.text};font-weight:800">${r.c} →</span>
          </div>`;
        }).join('')}
      </div>
      <div class="white-box">
        <h3 class="box-title">Recent Orders</h3>
        ${s.recent.map(o => {
          const c = STATUS_COLORS[o.status] || {};
          return `<div class="recent-row">
            <div>
              <div class="recent-name">${o.customer}</div>
              <div class="recent-sub">${o.id} · ${o.product}</div>
            </div>
            <div>
              <div class="recent-amt">${fmt(o.amount)}</div>
              <span class="badge" style="background:${c.bg};color:${c.text};font-size:10px">${o.status}</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Failed to load</div></div>`;
  }
}

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

  // Group orders by status for counts
  const statusCounts = {};
  allOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status]||0)+1; });

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 class="page-title">Orders</h2>
        <p class="page-sub">${allOrders.length} orders</p>
      </div>
      <button class="btn-new" onclick="openOrderForm()">+ New</button>
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

function toggleFilters() { showFilters = !showFilters; renderOrders(); }
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
  showSheet(`
    <div class="amount-hero">
      <span class="amount-hero-label">ORDER AMOUNT</span>
      <span class="amount-hero-value">${fmt(order.amount)}</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
      ${badge(order.status,'status')} ${badge(order.pay_status,'pay')}
    </div>
    ${rows.map(([k,v]) => v ? `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>` : '').join('')}
    <div class="detail-actions">
      <button class="btn-edit" onclick="closeSheet();editOrder('${order.id}')">✏️ Edit</button>
      <button class="btn-invoice" onclick="closeSheet();downloadInvoice('${order.id}')">🧾 PDF</button>
    </div>
    <button onclick="shareInvoice('${order.id}')" style="width:100%;margin-top:10px;background:#25D366;border:none;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
      📤 Share Invoice
    </button>
  `, order.id);
}

// ── SHARE INVOICE ─────────────────────────────────────────────────────────────
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
  window.location.href = '/api/orders/' + id + '/pdf';
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
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="btn-view-inv" onclick="downloadInvoice('${o.id}')">📄 PDF</button>
        <button class="btn-view-inv" style="background:#25D366" onclick="shareInvoice('${o.id}')">📤</button>
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
      <div class="white-box">
        <h3 class="box-title">Top Products</h3>
        ${prodBars}
      </div>` : ''}

      <!-- Top Customers -->
      ${d.topCustomers.length > 0 ? `
      <div class="white-box">
        <h3 class="box-title">Top Customers</h3>
        ${custRows}
      </div>` : ''}
    `;
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Failed to load analytics</div></div>`;
  }
}

function exportCSV() {
  showToast('📊 Preparing CSV…');
  window.location.href = '/api/export/orders';
}
