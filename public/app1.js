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
const ALL_STATUSES = ['New','In Production','Ready for Delivery','Shipped','Delivered','Cancelled'];
const ALL_PAY      = ['Unpaid','Partially Paid','Paid'];

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

// ── SHEET ─────────────────────────────────────────────────────────────────────
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

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, isError) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 2500);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const me = await API.me();
    if (me.loggedIn) showApp();
    else showLogin();
  } catch { showLogin(); }
});

function showLogin() { document.getElementById('app').innerHTML = renderLogin(); }
function showApp()   { document.getElementById('app').innerHTML = renderApp(); navigateTo('dashboard'); }

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function renderLogin(mode) {
  mode = mode || 'login';
  return `<div id="login-page">
    <div class="login-card">
      <div class="login-logo">
        <div><span class="logo-urban">URBAN</span><span class="logo-fitz">Fitz</span></div>
        <div class="login-sub">Order Management System</div>
      </div>
      ${mode === 'login' ? `
        <h2>Welcome back 👋</h2>
        <div id="login-err" class="err-box" style="display:none"></div>
        <label class="form-label">Email</label>
        <input class="form-input" type="email" id="login-email" value="admin@urbanfitz.ng"/>
        <label class="form-label">Password</label>
        <div class="pw-wrap">
          <input class="form-input" type="password" id="login-pass" value="admin123"/>
          <button class="pw-toggle" onclick="togglePw()">Show</button>
        </div>
        <div style="text-align:right;margin-bottom:20px">
          <button class="btn-link" onclick="showForgot()">Forgot password?</button>
        </div>
        <button class="btn-primary" id="login-btn" onclick="doLogin()">Sign In</button>
        <div class="login-hint">admin@urbanfitz.ng / admin123</div>
      ` : `
        <h2>Reset Password</h2>
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

function togglePw() {
  const i = document.getElementById('login-pass');
  const b = document.querySelector('.pw-toggle');
  if (i.type === 'password') { i.type = 'text'; b.textContent = 'Hide'; }
  else { i.type = 'password'; b.textContent = 'Show'; }
}
function showForgot()   { document.getElementById('app').innerHTML = renderLogin('reset'); }
function showLoginMode(){ document.getElementById('app').innerHTML = renderLogin('login'); }
function doReset()      { alert('Reset link sent! (Demo mode)'); showLoginMode(); }

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
  return `<div id="main-app" class="active">
    <div class="topbar">
      <div class="topbar-logo">
        <div><span class="logo-urban">URBAN</span><span class="logo-fitz">Fitz</span></div>
        <span class="logo-clothings">CLOTHINGS</span>
      </div>
      <button class="btn-logout" onclick="doLogout()">Logout</button>
    </div>
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
    <div id="more-menu" style="display:none;position:fixed;bottom:68px;right:0;left:0;z-index:200">
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
    <div id="more-overlay" onclick="closeMoreMenu()" style="display:none;position:fixed;inset:0;z-index:199;background:rgba(0,0,0,0.3)"></div>
  </div>`;
}

async function doLogout() { await API.logout().catch(()=>{}); showLogin(); }

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.getElementById('more-btn').classList.remove('active');
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  loadPage(page);
}

function toggleMoreMenu() {
  const menu = document.getElementById('more-menu');
  const overlay = document.getElementById('more-overlay');
  const isOpen = menu.style.display === 'block';
  menu.style.display = isOpen ? 'none' : 'block';
  overlay.style.display = isOpen ? 'none' : 'block';
  document.getElementById('more-btn').classList.toggle('active', !isOpen);
}
function closeMoreMenu() {
  document.getElementById('more-menu').style.display = 'none';
  document.getElementById('more-overlay').style.display = 'none';
  document.getElementById('more-btn').classList.remove('active');
}
function navigateMore(page) {
  closeMoreMenu();
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('more-btn').classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  currentPage = page;
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
        <div class="stat-card border-black"><div class="stat-icon">📦</div><div class="stat-value">${s.total}</div><div class="stat-label">Total Orders</div></div>
        <div class="stat-card border-purple"><div class="stat-icon">📅</div><div class="stat-value">${s.thisMonth}</div><div class="stat-label">This Month</div></div>
        <div class="stat-card border-green"><div class="stat-icon">💰</div><div class="stat-value ${revStr.length>10?'small':''}">${revStr}</div><div class="stat-label">Revenue</div></div>
        <div class="stat-card border-red"><div class="stat-icon">⏳</div><div class="stat-value">${s.pending}</div><div class="stat-label">Pending</div></div>
      </div>
      <div class="white-box">
        <h3 class="box-title">Order Statuses — tap to view</h3>
        ${s.byStatus.map(r => {
          const c = STATUS_COLORS[r.status]||{};
          const pct = s.total ? (r.c/s.total*100) : 0;
          return `<div class="status-row" onclick="viewOrdersByStatus('${r.status}')" style="cursor:pointer;padding:8px;margin:-4px;border-radius:10px" onmouseenter="this.style.background='#F9F9F9'" onmouseleave="this.style.background=''">
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
          const c = STATUS_COLORS[o.status]||{};
          return `<div class="recent-row">
            <div><div class="recent-name">${o.customer}</div><div class="recent-sub">${o.id} · ${o.product}</div></div>
            <div><div class="recent-amt">${fmt(o.amount)}</div><span class="badge" style="background:${c.bg};color:${c.text};font-size:10px">${o.status}</span></div>
          </div>`;
        }).join('')}
      </div>`;
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Failed to load</div></div>`;
  }
}
