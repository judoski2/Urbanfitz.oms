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
    <div id="page-dashboard"    class="page"></div>
    <div id="page-orders"       class="page"></div>
    <div id="page-customers"    class="page"></div>
    <div id="page-invoices"     class="page"></div>
    <div id="page-analytics"    class="page"></div>
    <div id="page-sms"          class="page"></div>
    <div id="page-measurements" class="page"></div>
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
      <button class="nav-btn" id="more-btn" onclick="toggleMoreMenu()">
        <span class="nav-icon">☰</span><span>More</span><div class="nav-dot"></div>
      </button>
    </nav>
    <!-- More dropdown menu -->
    <div id="more-menu" style="display:none;position:fixed;bottom:68px;right:0;left:0;z-index:200;display:none">
      <div style="background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -4px 24px rgba(0,0,0,0.15);padding:8px 0 4px">
        <div style="display:flex;justify-content:center;padding:6px 0 10px">
          <div style="width:40px;height:4px;background:#E8E8E8;border-radius:2px"></div>
        </div>
        <button onclick="navigateMore('measurements')" class="more-menu-item">
          <span style="font-size:22px">📏</span>
          <div><div style="font-weight:700;font-size:15px">Measurements</div><div style="font-size:12px;color:#A0A0A0">Customer body measurements</div></div>
          <span style="color:#A0A0A0;font-size:18px">›</span>
        </button>
        <button onclick="navigateMore('analytics')" class="more-menu-item">
          <span style="font-size:22px">📊</span>
          <div><div style="font-weight:700;font-size:15px">Analytics</div><div style="font-size:12px;color:#A0A0A0">Revenue, top products & charts</div></div>
          <span style="color:#A0A0A0;font-size:18px">›</span>
        </button>
        <button onclick="navigateMore('sms')" class="more-menu-item">
          <span style="font-size:22px">💬</span>
          <div><div style="font-weight:700;font-size:15px">SMS Centre</div><div style="font-size:12px;color:#A0A0A0">Bulk SMS & notifications</div></div>
          <span style="color:#A0A0A0;font-size:18px">›</span>
        </button>
        <div style="height:8px"></div>
      </div>
    </div>
    <!-- Overlay to close more menu -->
    <div id="more-overlay" onclick="closeMoreMenu()" style="display:none;position:fixed;inset:0;z-index:199;background:rgba(0,0,0,0.3)"></div>
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
  if (page === 'dashboard')    await loadDashboard();
  if (page === 'orders')       await loadOrders();
  if (page === 'customers')    await loadCustomers();
  if (page === 'invoices')     await loadInvoices();
  if (page === 'analytics')    await loadAnalytics();
  if (page === 'sms')          await loadSMS();
  if (page === 'measurements') await loadMeasurements();
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

