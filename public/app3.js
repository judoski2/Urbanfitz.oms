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

    // Daily revenue chart — last 30 days
    const dailyBars = (d.revenueByDay && d.revenueByDay.length > 0) ? (() => {
      const maxDay = Math.max(...d.revenueByDay.map(m => Number(m.paid_revenue)||0), 1);
      return d.revenueByDay.map(m => {
        const pct = Math.max(4, ((Number(m.paid_revenue)||0) / maxDay) * 100);
        const hasOrders = Number(m.order_count) > 0;
        return `<div style="flex:1;min-width:20px;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%;justify-content:flex-end">
          <div style="font-size:7px;color:#111;font-weight:700;text-align:center;writing-mode:horizontal-tb">${Number(m.paid_revenue)>0?fmtShort(m.paid_revenue):''}</div>
          <div style="width:100%;border-radius:4px 4px 0 0;background:${hasOrders?'linear-gradient(180deg,#D0021B,#A80016)':'#F3F3F3'};height:${pct}%;min-height:4px"></div>
          <div style="font-size:7px;color:#A0A0A0;text-align:center;white-space:nowrap">${m.day}</div>
        </div>`;
      }).join('');
    })() : '';
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

      <!-- Daily Revenue Chart -->
      ${d.revenueByDay && d.revenueByDay.length > 0 ? `
      <div class="white-box">
        <h3 class="box-title">Daily Revenue — Last 30 Days</h3>
        <div style="overflow-x:auto;padding-bottom:4px">
          <div style="display:flex;align-items:flex-end;gap:3px;height:130px;min-width:${(d.revenueByDay.length*24)}px">
            ${dailyBars}
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#A0A0A0;margin-top:8px;padding-top:8px;border-top:1px solid #F3F3F3">
          <span>${d.revenueByDay.length} days</span>
          <span>Total paid: ${fmt2(d.revenueByDay.reduce((a,m)=>a+Number(m.paid_revenue||0),0))}</span>
        </div>
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
  window.open('/api/export/orders', '_blank');
}

// ── SMS PAGE ──────────────────────────────────────────────────────────────────
async function loadSMS() {
  const el = document.getElementById('page-sms');
  if (!el) return;
  el.innerHTML = '<div class="empty"><div class="spinner" style="margin:40px auto"></div></div>';
  try {
    const status = await API.get('/api/sms/status');
    el.innerHTML = `
      <h2 class="page-title">SMS Centre</h2>
      <p class="page-sub">Send automated & bulk messages</p>

      <!-- Status card -->
      <div class="white-box" style="border-top:3px solid ${status.enabled?'#059669':'#D0021B'}">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <span style="font-size:28px">${status.enabled?'✅':'⚠️'}</span>
          <div>
            <div style="font-weight:800;font-size:15px">${status.enabled?'SMS Active':'SMS Not Active'}</div>
            <div style="font-size:12px;color:#A0A0A0;margin-top:2px">${status.message}</div>
          </div>
        </div>
        ${!status.enabled ? `
        <div style="background:#FFF7ED;border-radius:10px;padding:14px;border-left:3px solid #D97706;margin-top:10px">
          <div style="font-weight:800;font-size:13px;color:#92400E;margin-bottom:6px">How to activate SMS:</div>
          <div style="font-size:12px;color:#92400E;line-height:1.8">
            1. Sign up at <b>termii.com</b><br/>
            2. Get your API key from dashboard<br/>
            3. Go to Render → your service → <b>Environment</b><br/>
            4. Add variable: <b>TERMII_API_KEY</b> = your key<br/>
            5. Redeploy — SMS will be active!
          </div>
        </div>` : ''}
      </div>

      <!-- Auto SMS info -->
      <div class="white-box">
        <h3 class="box-title">Automatic Notifications</h3>
        <p style="font-size:13px;color:#555;margin-bottom:14px">SMS is sent automatically when you update an order status:</p>
        ${[
          ['🧵','In Production','We have started making your outfit!'],
          ['🎉','Ready for Delivery','Your order is ready for pickup!'],
          ['🚚','Shipped','Your order is on the way!'],
          ['✅','Delivered','Enjoy your outfit! Thank you!'],
          ['❌','Cancelled','Your order has been cancelled'],
        ].map(([icon,status,msg]) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F3F3F3">
            <span style="font-size:20px">${icon}</span>
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px">${status}</div>
              <div style="font-size:11px;color:#A0A0A0">${msg}</div>
            </div>
            <span style="font-size:10px;background:#ECFDF5;color:#065F46;padding:3px 8px;border-radius:10px;font-weight:700">AUTO</span>
          </div>`).join('')}
      </div>

      <!-- Bulk SMS -->
      <div class="white-box">
        <h3 class="box-title">Bulk SMS</h3>
        <div style="margin-bottom:12px">
          <label style="display:block;font-size:12px;font-weight:700;color:#555;margin-bottom:6px;text-transform:uppercase">Message (use [Name] for customer name)</label>
          <textarea id="bulk-msg" rows="4" placeholder="Hi [Name]! UrbanFitz Clothings here. We have exciting new collections ready. Call/WhatsApp: 07038245181"
            style="width:100%;border:1.5px solid #E8E8E8;border-radius:10px;padding:12px;font-size:14px;font-family:inherit;resize:none;outline:none;box-sizing:border-box"></textarea>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="sendBulkSMS()" style="flex:1;background:linear-gradient(135deg,#D0021B,#A80016);border:none;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;cursor:pointer">
            📤 Send to All Customers
          </button>
        </div>
      </div>

      <!-- Payment reminder -->
      <div class="white-box">
        <h3 class="box-title">Payment Reminders</h3>
        <p style="font-size:13px;color:#555;margin-bottom:14px">Send automatic reminder to all customers with unpaid or partially paid orders.</p>
        <button onclick="sendPaymentReminder()" style="width:100%;background:linear-gradient(135deg,#D97706,#B45309);border:none;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;cursor:pointer">
          💰 Send Payment Reminders
        </button>
      </div>

      <!-- Custom SMS -->
      <div class="white-box">
        <h3 class="box-title">Custom SMS</h3>
        <div style="margin-bottom:10px">
          <label style="display:block;font-size:12px;font-weight:700;color:#555;margin-bottom:5px;text-transform:uppercase">Phone Number</label>
          <input type="tel" id="custom-phone" placeholder="08012345678"
            style="width:100%;border:1.5px solid #E8E8E8;border-radius:10px;padding:12px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box"/>
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;font-size:12px;font-weight:700;color:#555;margin-bottom:5px;text-transform:uppercase">Message</label>
          <textarea id="custom-msg" rows="3" placeholder="Type your message here…"
            style="width:100%;border:1.5px solid #E8E8E8;border-radius:10px;padding:12px;font-size:14px;font-family:inherit;resize:none;outline:none;box-sizing:border-box"></textarea>
        </div>
        <button onclick="sendCustomSMS()" style="width:100%;background:#111;border:none;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;cursor:pointer">
          📱 Send SMS
        </button>
      </div>
      <div style="height:20px"></div>
    `;
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Failed to load SMS centre</div></div>`;
  }
}

async function sendBulkSMS() {
  const msg = document.getElementById('bulk-msg').value.trim();
  if (!msg) { showToast('Please enter a message', true); return; }
  if (!confirm('Send this SMS to ALL your customers?')) return;
  showToast('📤 Sending…');
  try {
    const r = await API.post('/api/sms/bulk', { message: msg });
    showToast(`✅ Sent ${r.sent} of ${r.total} messages`);
  } catch(e) { showToast('Failed to send: ' + e.message, true); }
}

async function sendPaymentReminder() {
  if (!confirm('Send payment reminders to all customers with unpaid orders?')) return;
  showToast('📤 Sending reminders…');
  try {
    const r = await API.post('/api/sms/payment-reminder', {});
    showToast(`✅ Sent ${r.sent} of ${r.total} reminders`);
  } catch(e) { showToast('Failed: ' + e.message, true); }
}

async function sendCustomSMS() {
  const phone = document.getElementById('custom-phone').value.trim();
  const msg   = document.getElementById('custom-msg').value.trim();
  if (!phone || !msg) { showToast('Enter phone and message', true); return; }
  showToast('📤 Sending…');
  try {
    await API.post('/api/sms/send', { phone, message: msg });
    showToast('✅ SMS sent!');
    document.getElementById('custom-phone').value = '';
    document.getElementById('custom-msg').value = '';
  } catch(e) { showToast('Failed: ' + e.message, true); }
}

// ── MEASUREMENTS ──────────────────────────────────────────────────────────────
const MEASUREMENT_SECTIONS = [
  {
    title: '👔 Top Measurements',
    fields: [
      { key:'chest',            label:'Chest' },
      { key:'shoulder',         label:'Shoulder Width' },
      { key:'sleeve_length',    label:'Sleeve Length' },
      { key:'sleeve_round',     label:'Sleeve Round' },
      { key:'wrist',            label:'Wrist' },
      { key:'back_length',      label:'Back Length' },
      { key:'front_length',     label:'Front Length' },
    ]
  },
  {
    title: '👖 Bottom Measurements',
    fields: [
      { key:'waist',          label:'Waist' },
      { key:'hips',           label:'Hips' },
      { key:'thigh',          label:'Thigh' },
      { key:'knee',           label:'Knee Round' },
      { key:'ankle',          label:'Ankle Round' },
      { key:'trouser_length', label:'Trouser Length' },
    ]
  }
];

async function loadMeasurements() {
  const el = document.getElementById('page-measurements');
  if (!el) return;
  el.innerHTML = '<div class="empty"><div class="spinner" style="margin:40px auto"></div></div>';
  try {
    const measurements = await API.get('/api/measurements');
    el.innerHTML = `
      <div class="page-header">
        <div><h2 class="page-title">Measurements</h2>
        <p class="page-sub">${measurements.length} customer records</p></div>
        <button class="btn-new" onclick="openMeasurementForm()">+ Add</button>
      </div>
      <input class="search-input" style="width:100%;margin-bottom:14px" type="text"
        placeholder="🔍 Search customers…" oninput="filterMeasurements(this.value)"/>
      <div id="measurements-list">
        ${measurements.length === 0
          ? `<div class="empty"><div class="empty-icon">📏</div><div class="empty-text">No measurements saved yet</div><div style="font-size:13px;color:#A0A0A0;margin-top:8px">Tap + Add to save customer measurements</div></div>`
          : measurements.map(m => renderMeasurementCard(m)).join('')
        }
      </div>`;
    window._allMeasurements = measurements;
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Failed to load</div></div>`;
  }
}

function renderMeasurementCard(m) {
  const filled = MEASUREMENT_SECTIONS.flatMap(s => s.fields).filter(f => m[f.key]).length;
  const total  = MEASUREMENT_SECTIONS.flatMap(s => s.fields).length;
  const pct    = Math.round((filled / total) * 100);
  return `
  <div class="order-card" onclick="viewMeasurement('${encodeURIComponent(m.phone)}')">
    <div class="order-card-top">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:42px;height:42px;background:linear-gradient(135deg,#D0021B,#A80016);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:17px;flex-shrink:0">${m.customer.charAt(0)}</div>
        <div>
          <div class="order-customer">${m.customer}</div>
          <div class="order-meta">${m.phone} · ${m.unit||'inches'}</div>
        </div>
      </div>
      <button onclick="event.stopPropagation();openMeasurementForm('${encodeURIComponent(m.phone)}')" 
        style="background:#F0FDF4;border:none;border-radius:8px;padding:7px 10px;cursor:pointer;color:#059669;font-size:15px">✏️</button>
    </div>
    <div style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#A0A0A0;margin-bottom:4px">
        <span>Measurements filled</span><span>${filled}/${total}</span>
      </div>
      <div style="height:5px;background:#F3F3F3;border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#D0021B,#A80016);border-radius:3px"></div>
      </div>
    </div>
    ${m.notes ? `<div style="margin-top:8px;font-size:12px;color:#555;background:#F9F9F9;padding:8px 10px;border-radius:8px;border-left:3px solid #D0021B">📝 ${m.notes}</div>` : ''}
  </div>`;
}

function filterMeasurements(q) {
  const all = window._allMeasurements || [];
  const filtered = q ? all.filter(m => m.customer.toLowerCase().includes(q.toLowerCase()) || m.phone.includes(q)) : all;
  document.getElementById('measurements-list').innerHTML = filtered.length === 0
    ? `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No results</div></div>`
    : filtered.map(m => renderMeasurementCard(m)).join('');
}

async function viewMeasurement(phoneEncoded) {
  const phone = decodeURIComponent(phoneEncoded);
  try {
    const m = await API.get('/api/measurements/' + encodeURIComponent(phone));
    const unit = m.unit || 'inches';
    const rows = MEASUREMENT_SECTIONS.map(section => {
      const filled = section.fields.filter(f => m[f.key]);
      if (filled.length === 0) return '';
      return `
        <div style="margin-bottom:16px">
          <div style="font-size:11px;font-weight:800;color:#D0021B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${section.title}</div>
          ${filled.map(f => `
            <div class="detail-row">
              <span class="detail-key">${f.label}</span>
              <span class="detail-val" style="color:#111;font-weight:800">${m[f.key]} ${unit}</span>
            </div>`).join('')}
        </div>`;
    }).join('');

    showSheet(`
      <div class="amount-hero" style="background:linear-gradient(135deg,#D0021B,#A80016)">
        <div>
          <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:700">CUSTOMER</div>
          <div style="color:#fff;font-size:18px;font-weight:900;margin-top:2px">${m.customer}</div>
          <div style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:2px">${m.phone}</div>
        </div>
        <div style="text-align:right">
          <div style="color:rgba(255,255,255,0.7);font-size:11px">UNIT</div>
          <div style="color:#fff;font-size:16px;font-weight:800">${unit}</div>
        </div>
      </div>
      ${rows || '<div style="text-align:center;color:#A0A0A0;padding:20px">No measurements recorded yet</div>'}
      ${m.notes ? `<div style="background:#F9F9F9;padding:12px;border-radius:10px;border-left:3px solid #D0021B;font-size:13px;margin-top:8px"><b>Notes:</b> ${m.notes}</div>` : ''}
      <div style="display:flex;gap:10px;margin-top:16px">
        <button onclick="closeSheet();openMeasurementForm('${encodeURIComponent(phone)}')" style="flex:1;background:#111;border:none;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;cursor:pointer">✏️ Edit</button>
        <button onclick="deleteMeasurement('${encodeURIComponent(phone)}')" style="flex:0 0 auto;background:#FFF0F2;border:none;border-radius:12px;padding:13px 16px;color:#D0021B;font-weight:800;font-size:14px;cursor:pointer">🗑️</button>
      </div>
    `, m.customer + ' — Measurements');
  } catch(e) { showToast('Failed to load measurements', true); }
}

async function openMeasurementForm(phoneEncoded) {
  let m = null;
  // Pre-fill from existing measurements or from orders
  if (phoneEncoded) {
    const phone = decodeURIComponent(phoneEncoded);
    try { m = await API.get('/api/measurements/' + encodeURIComponent(phone)); } catch {}
  }

  // Pre-fill customer list from orders for dropdown
  let customerOptions = '';
  try {
    const customers = await API.get('/api/customers');
    customerOptions = customers.map(c =>
      `<option value="${c.phone}" data-name="${c.name}" ${m && m.phone===c.phone?'selected':''}>${c.name} — ${c.phone}</option>`
    ).join('');
  } catch {}

  const val = (key) => m && m[key] ? m[key] : '';
  const iS = 'width:100%;border:1.5px solid #E8E8E8;border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;';

  const sectionsHTML = MEASUREMENT_SECTIONS.map(section => `
    <div style="margin-bottom:18px">
      <div style="font-size:12px;font-weight:800;color:#D0021B;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #F3F3F3">${section.title}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${section.fields.map(f => `
          <div>
            <label style="display:block;font-size:11px;font-weight:700;color:#555;margin-bottom:4px">${f.label}</label>
            <input type="number" step="0.1" name="${f.key}" value="${val(f.key)}" placeholder="0.0" style="${iS}"/>
          </div>`).join('')}
      </div>
    </div>`).join('');

  showSheet(`
    <div style="margin-bottom:16px">
      <label style="display:block;font-size:12px;font-weight:700;color:#555;margin-bottom:5px;text-transform:uppercase">Select Customer</label>
      <select id="meas-customer-select" style="${iS}" onchange="prefillMeasCustomer(this)">
        <option value="">-- Choose existing customer --</option>
        ${customerOptions}
      </select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div>
        <label style="display:block;font-size:12px;font-weight:700;color:#555;margin-bottom:5px;text-transform:uppercase">Customer Name *</label>
        <input type="text" id="meas-name" value="${m?m.customer:''}" placeholder="Full name" style="${iS}"/>
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:700;color:#555;margin-bottom:5px;text-transform:uppercase">Phone *</label>
        <input type="tel" id="meas-phone" value="${m?m.phone:''}" placeholder="08012345678" style="${iS}"/>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <label style="display:block;font-size:12px;font-weight:700;color:#555;margin-bottom:5px;text-transform:uppercase">Unit</label>
      <select id="meas-unit" style="${iS}">
        <option value="inches" ${(!m||m.unit==='inches')?'selected':''}>Inches</option>
        <option value="cm" ${(m&&m.unit==='cm')?'selected':''}>Centimetres (cm)</option>
      </select>
    </div>
    <div id="meas-sections">${sectionsHTML}</div>
    <div style="margin-bottom:16px">
      <label style="display:block;font-size:12px;font-weight:700;color:#555;margin-bottom:5px;text-transform:uppercase">Notes</label>
      <textarea id="meas-notes" rows="2" placeholder="Any special notes about this customer's fit…" style="${iS}resize:none;">${m?m.notes:''}</textarea>
    </div>
    <div style="display:flex;gap:10px;margin-top:4px">
      <button onclick="closeSheet()" style="flex:1;background:#F3F3F3;border:none;border-radius:12px;padding:14px;font-weight:700;color:#555;font-size:15px;cursor:pointer">Cancel</button>
      <button onclick="saveMeasurement()" style="flex:2;background:linear-gradient(135deg,#D0021B,#A80016);border:none;border-radius:12px;padding:14px;font-weight:800;color:#fff;font-size:15px;cursor:pointer">💾 Save Measurements</button>
    </div>
    <div style="height:20px"></div>
  `, m ? 'Edit — ' + m.customer : 'New Measurements');
}

function prefillMeasCustomer(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  document.getElementById('meas-phone').value = opt.value;
  document.getElementById('meas-name').value  = opt.dataset.name || '';
}

async function saveMeasurement() {
  const name  = document.getElementById('meas-name').value.trim();
  const phone = document.getElementById('meas-phone').value.trim();
  const unit  = document.getElementById('meas-unit').value;
  const notes = document.getElementById('meas-notes').value.trim();
  if (!name || !phone) { showToast('Customer name and phone required', true); return; }

  const data = { customer: name, phone, unit, notes };
  document.getElementById('meas-sections').querySelectorAll('input[name]').forEach(inp => {
    if (inp.value) data[inp.name] = parseFloat(inp.value);
  });

  try {
    await API.post('/api/measurements', data);
    showToast('✅ Measurements saved!');
    closeSheet();
    await loadMeasurements();
  } catch(e) { showToast('Failed to save: ' + e.message, true); }
}

async function deleteMeasurement(phoneEncoded) {
  if (!confirm('Delete these measurements?')) return;
  try {
    await API.del('/api/measurements/' + decodeURIComponent(phoneEncoded));
    showToast('✅ Deleted');
    closeSheet();
    await loadMeasurements();
  } catch(e) { showToast('Failed to delete', true); }
}

// ── PRINT BY STATUS ───────────────────────────────────────────────────────────
function openPrintByStatus() {
  const statusCounts = {};
  (window._allOrdersForPrint || allOrders).forEach(o => {
    statusCounts[o.status] = (statusCounts[o.status]||0)+1;
  });

  const ALL_STATUSES_EXT = ['New','In Production','Ready for Delivery','Shipped','Delivered','Cancelled'];
  const PAY_STATUSES_EXT = ['Unpaid','Partially Paid','Paid'];

  showSheet(`
    <p style="font-size:13px;color:#555;margin-bottom:18px">
      Select a filter below. All matching orders will be combined into one PDF — summary table on the first page, then individual detail pages.
    </p>

    <!-- By Order Status -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:800;color:#D0021B;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">By Order Status</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${ALL_STATUSES_EXT.map(s => {
          const c = STATUS_COLORS[s]||{};
          const cnt = statusCounts[s]||0;
          return `<button onclick="downloadBulkPDF('${s}','All','','',this)"
            style="padding:14px 10px;border-radius:12px;border:1.5px solid ${c.border||'#E8E8E8'};background:${c.bg||'#fff'};color:${c.text||'#111'};font-weight:700;font-size:13px;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:3px">
            <span>${s}</span>
            <span style="font-size:11px;opacity:0.7">${cnt} order${cnt!==1?'s':''}</span>
          </button>`;
        }).join('')}
      </div>
    </div>

    <!-- By Payment Status -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:800;color:#D0021B;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">By Payment Status</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        ${PAY_STATUSES_EXT.map(s => {
          const c = PAY_COLORS[s]||{};
          const cnt = allOrders.filter(o=>o.pay_status===s).length;
          return `<button onclick="downloadBulkPDF('All','${s}','','',this)"
            style="padding:14px 10px;border-radius:12px;border:1.5px solid ${c.bg||'#E8E8E8'};background:${c.bg||'#fff'};color:${c.text||'#111'};font-weight:700;font-size:12px;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:3px">
            <span>${s}</span>
            <span style="font-size:11px;opacity:0.7">${cnt} order${cnt!==1?'s':''}</span>
          </button>`;
        }).join('')}
      </div>
    </div>

    <!-- All orders -->
    <button onclick="downloadBulkPDF('All','All','','',this)"
      style="width:100%;padding:14px;border-radius:12px;border:none;background:#111;color:#fff;font-weight:800;font-size:14px;cursor:pointer">
      📄 Print ALL Orders
    </button>

    <!-- Date range -->
    <div style="margin-top:16px;padding:14px;background:#F9F9F9;border-radius:12px;border:1px solid #E8E8E8">
      <div style="font-size:11px;font-weight:800;color:#D0021B;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Filter by Date Range</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div>
          <label style="display:block;font-size:11px;font-weight:700;color:#555;margin-bottom:4px">From</label>
          <input type="date" id="pdf-date-from" style="width:100%;border:1.5px solid #E8E8E8;border-radius:8px;padding:9px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box"/>
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:700;color:#555;margin-bottom:4px">To</label>
          <input type="date" id="pdf-date-to" style="width:100%;border:1.5px solid #E8E8E8;border-radius:8px;padding:9px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box"/>
        </div>
      </div>
      <button onclick="downloadBulkPDFDated(this)"
        style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#D0021B,#A80016);color:#fff;font-weight:800;font-size:13px;cursor:pointer">
        📅 Print by Date Range
      </button>
    </div>
    <div style="height:20px"></div>
  `, '🖨 Print Orders by Status');
}

async function downloadBulkPDF(status, payStatus, dateFrom, dateTo, btn) {
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '⏳ Generating…'; btn.disabled = true; }
  try {
    const params = new URLSearchParams();
    if (status && status !== 'All')    params.set('status', status);
    if (payStatus && payStatus !== 'All') params.set('payStatus', payStatus);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo)   params.set('dateTo', dateTo);
    showToast('📄 Generating PDF…');
    window.open('/api/bulk-pdf?' + params.toString(), '_blank');
    setTimeout(() => {
      if (btn) { btn.innerHTML = orig; btn.disabled = false; }
    }, 3000);
  } catch(e) {
    if (btn) { btn.innerHTML = orig; btn.disabled = false; }
    showToast('Failed: ' + e.message, true);
  }
}

function downloadBulkPDFDated(btn) {
  const from = document.getElementById('pdf-date-from').value;
  const to   = document.getElementById('pdf-date-to').value;
  if (!from && !to) { showToast('Please select at least one date', true); return; }
  downloadBulkPDF('All', 'All', from, to, btn);
}
