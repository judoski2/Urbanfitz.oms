const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'urbanfitz-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// Helper: generate next order ID
async function nextOrderId() {
  const last = await db.get('SELECT id FROM orders ORDER BY created_at DESC LIMIT 1');
  let nextNum = 1;
  if (last) {
    const n = parseInt(last.id.split('-')[1]);
    if (!isNaN(n)) nextNum = n + 1;
  }
  return 'UF-' + String(nextNum).padStart(3, '0');
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email=?', email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    req.session.userId = user.id;
    req.session.userName = user.name;
    res.json({ success: true, name: user.name });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.userId) res.json({ loggedIn: true, name: req.session.userName });
  else res.json({ loggedIn: false });
});

// ── ORDERS ────────────────────────────────────────────────────────────────────
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const { search, status, payStatus, dateFrom, dateTo } = req.query;
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];
    if (search) {
      sql += ' AND (customer ILIKE ? OR id ILIKE ? OR product ILIKE ? OR phone ILIKE ?)';
      const q = '%' + search + '%';
      params.push(q, q, q, q);
    }
    if (status && status !== 'All')    { sql += ' AND status=?';     params.push(status); }
    if (payStatus && payStatus !== 'All') { sql += ' AND pay_status=?'; params.push(payStatus); }
    if (dateFrom) { sql += ' AND date>=?'; params.push(dateFrom); }
    if (dateTo)   { sql += ' AND date<=?'; params.push(dateTo); }
    sql += ' ORDER BY created_at DESC';
    const orders = await db.all(sql, ...params);
    res.json(orders);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id=?', req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const { customer, phone, address, product, qty, size, color, amount, pay_status, status, notes, date } = req.body;
    if (!customer || !phone || !product || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const id = await nextOrderId();
    const orderDate = date || new Date().toISOString().split('T')[0];
    await db.run(
      `INSERT INTO orders (id,customer,phone,address,product,qty,size,color,amount,pay_status,status,notes,date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, customer, phone, address||'', product, qty||1, size||'', color||'',
      amount, pay_status||'Unpaid', status||'New', notes||'', orderDate
    );
    const order = await db.get('SELECT * FROM orders WHERE id=?', id);
    res.json(order);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM orders WHERE id=?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    const { customer, phone, address, product, qty, size, color, amount, pay_status, status, notes, date } = req.body;
    await db.run(
      `UPDATE orders SET customer=?,phone=?,address=?,product=?,qty=?,size=?,color=?,
       amount=?,pay_status=?,status=?,notes=?,date=?,updated_at=NOW() WHERE id=?`,
      customer||existing.customer, phone||existing.phone, address??existing.address,
      product||existing.product, qty||existing.qty, size??existing.size, color??existing.color,
      amount||existing.amount, pay_status||existing.pay_status, status||existing.status,
      notes??existing.notes, date||existing.date, req.params.id
    );
    const order = await db.get('SELECT * FROM orders WHERE id=?', req.params.id);
    res.json(order);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM orders WHERE id=?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    await db.run('DELETE FROM orders WHERE id=?', req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────
app.get('/api/customers', requireAuth, async (req, res) => {
  try {
    const customers = await db.all(`
      SELECT customer as name, phone,
        COUNT(*) as order_count,
        SUM(CASE WHEN pay_status='Paid' THEN amount ELSE 0 END) as total_spent,
        MAX(date) as last_order_date
      FROM orders GROUP BY phone, customer ORDER BY order_count DESC
    `);
    res.json(customers);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/customers/:phone/orders', requireAuth, async (req, res) => {
  try {
    const orders = await db.all('SELECT * FROM orders WHERE phone=? ORDER BY date DESC', req.params.phone);
    res.json(orders);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── STATS ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const total      = (await db.get('SELECT COUNT(*) as c FROM orders')).c;
    const thisMonthC = (await db.get("SELECT COUNT(*) as c FROM orders WHERE date LIKE ?", thisMonth + '%')).c;
    const revenue    = (await db.get("SELECT COALESCE(SUM(amount),0) as s FROM orders WHERE date LIKE ? AND pay_status='Paid'", thisMonth + '%')).s;
    const pending    = (await db.get("SELECT COUNT(*) as c FROM orders WHERE status IN ('New','In Production','Ready for Delivery')")).c;
    const byStatus   = await db.all('SELECT status, COUNT(*) as c FROM orders GROUP BY status');
    const recent     = await db.all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
    res.json({ total: parseInt(total), thisMonth: parseInt(thisMonthC), revenue: parseFloat(revenue)||0, pending: parseInt(pending), byStatus, recent });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PDF INVOICE ───────────────────────────────────────────────────────────────
app.get('/api/orders/:id/pdf', requireAuth, async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id=?', req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="UrbanFitz-Invoice-${order.id}.pdf"`);
    doc.pipe(res);

    const RED = '#D0021B', BLACK = '#111111', GRAY = '#888888';

    // Red top bar
    doc.rect(0, 0, 595, 12).fill(RED);

    // Logo
    doc.font('Helvetica-Bold').fontSize(24).fillColor(BLACK).text('URBAN', 50, 30, { continued: true });
    doc.font('Helvetica-BoldOblique').fontSize(28).fillColor(RED).text('Fitz');
    doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK).text('CLOTHINGS', 50, 58, { characterSpacing: 3 });
    doc.font('Helvetica').fontSize(8).fillColor(GRAY);
    doc.text('3 Ajibode Street, Yaba, Lagos, Nigeria', 50, 70);
    doc.text('Phone: 07038245181  |  admin@urbanfitz.ng', 50, 82);

    // Invoice title
    doc.font('Helvetica-Bold').fontSize(30).fillColor(RED).text('INVOICE', 350, 30, { width: 200, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(BLACK).text(order.id, 350, 65, { width: 200, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor(GRAY);
    const dateStr = new Date(order.date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    doc.text('Date: ' + dateStr, 350, 80, { width: 200, align: 'right' });

    // Divider
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor(RED).lineWidth(1.5).stroke();

    let y = 115;
    // Bill To
    doc.font('Helvetica-Bold').fontSize(7).fillColor(RED).text('BILL TO', 50, y, { characterSpacing: 2 });
    y += 12;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
    y += 10;

    [['CUSTOMER NAME', order.customer], ['PHONE NUMBER', order.phone], ['DELIVERY ADDRESS', order.address||'-']].forEach(([label, value]) => {
      doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(label, 50, y);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text(value, 200, y, { width: 345 });
      y += 18;
    });

    y += 8;
    // Order Details
    doc.font('Helvetica-Bold').fontSize(7).fillColor(RED).text('ORDER DETAILS', 50, y, { characterSpacing: 2 });
    y += 14;

    // Table header
    doc.rect(50, y, 495, 20).fill(BLACK);
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF');
    doc.text('PRODUCT', 55, y+7); doc.text('SIZE', 240, y+7); doc.text('COLOR', 290, y+7);
    doc.text('QTY', 360, y+7);   doc.text('AMOUNT', 400, y+7, { width: 95, align: 'right' });
    y += 20;

    // Table row
    doc.rect(50, y, 495, 22).fill('#F9F9F9').stroke('#EEEEEE');
    doc.font('Helvetica').fontSize(9).fillColor(BLACK);
    doc.text(order.product, 55, y+7, { width: 180 });
    doc.text(order.size||'-', 240, y+7); doc.text(order.color||'-', 290, y+7);
    doc.text(String(order.qty), 360, y+7);
    doc.font('Helvetica-Bold').text('\u20A6' + Number(order.amount).toLocaleString(), 400, y+7, { width: 95, align: 'right' });
    y += 30;

    // Totals
    const totX = 380;
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text('Subtotal', totX, y);
    doc.fillColor(BLACK).text('\u20A6' + Number(order.amount).toLocaleString(), totX, y, { width: 115, align: 'right' });
    y += 16;
    doc.fillColor(GRAY).text('Delivery Fee', totX, y);
    doc.fillColor(BLACK).text('\u20A60', totX, y, { width: 115, align: 'right' });
    y += 8;
    doc.moveTo(totX, y).lineTo(545, y).strokeColor(RED).lineWidth(1).stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(13).fillColor(BLACK).text('TOTAL', totX, y);
    doc.fillColor(RED).text('\u20A6' + Number(order.amount).toLocaleString(), totX, y, { width: 115, align: 'right' });
    y += 24;

    // Status bar
    doc.rect(50, y, 495, 22).fill('#F9F9F9');
    doc.rect(50, y, 3, 22).fill(RED);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text('Payment: ', 60, y+8, { continued: true });
    doc.font('Helvetica').text(order.pay_status);
    doc.font('Helvetica-Bold').text('Order Status: ', 260, y+8, { continued: true });
    doc.font('Helvetica').text(order.status);
    y += 36;

    // Footer
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
    y += 12;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK).text('Thank you for your business!', 50, y);
    y += 16;
    doc.font('Helvetica').fontSize(8).fillColor(GRAY).text('UrbanFitz Clothings \u2014 Quality you can wear with pride.', 50, y);
    y += 12;
    doc.text('Generated: ' + new Date().toLocaleString(), 50, y);

    doc.end();
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
app.post('/api/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await db.get('SELECT * FROM users WHERE id=?', req.session.userId);
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await db.run('UPDATE users SET password=? WHERE id=?', hash, req.session.userId);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
app.get('/api/analytics', requireAuth, async (req, res) => {
  try {
    // Revenue by month (last 6 months)
    const revenueByMonth = await db.all(`
      SELECT
        TO_CHAR(DATE(date), 'Mon YYYY') as month,
        date_trunc('month', DATE(date)) as month_sort,
        SUM(amount) as total_revenue,
        SUM(CASE WHEN pay_status='Paid' THEN amount ELSE 0 END) as paid_revenue,
        COUNT(*) as order_count
      FROM orders
      WHERE DATE(date) >= NOW() - INTERVAL '6 months'
      GROUP BY month, month_sort
      ORDER BY month_sort ASC
    `);

    // Top 5 products
    const topProducts = await db.all(`
      SELECT product, COUNT(*) as count, SUM(amount) as revenue
      FROM orders
      GROUP BY product
      ORDER BY count DESC
      LIMIT 5
    `);

    // Top 5 customers
    const topCustomers = await db.all(`
      SELECT customer, phone,
        COUNT(*) as order_count,
        SUM(amount) as total_amount,
        SUM(CASE WHEN pay_status='Paid' THEN amount ELSE 0 END) as paid_amount
      FROM orders
      GROUP BY customer, phone
      ORDER BY total_amount DESC
      LIMIT 5
    `);

    // Payment breakdown
    const paymentBreakdown = await db.all(`
      SELECT pay_status, COUNT(*) as count, SUM(amount) as total
      FROM orders GROUP BY pay_status
    `);

    // Status breakdown
    const statusBreakdown = await db.all(`
      SELECT status, COUNT(*) as count FROM orders GROUP BY status
    `);

    // Overall totals
    const totals = await db.get(`
      SELECT
        COUNT(*) as total_orders,
        SUM(amount) as total_revenue,
        SUM(CASE WHEN pay_status='Paid' THEN amount ELSE 0 END) as paid_revenue,
        SUM(CASE WHEN pay_status='Unpaid' THEN amount ELSE 0 END) as unpaid_revenue,
        SUM(CASE WHEN pay_status='Partially Paid' THEN amount ELSE 0 END) as partial_revenue,
        AVG(amount) as avg_order_value
      FROM orders
    `);

    res.json({ revenueByMonth, topProducts, topCustomers, paymentBreakdown, statusBreakdown, totals });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CSV EXPORT ────────────────────────────────────────────────────────────────
app.get('/api/export/orders', requireAuth, async (req, res) => {
  try {
    const orders = await db.all('SELECT * FROM orders ORDER BY date DESC');
    const headers = ['Order ID','Customer','Phone','Address','Product','Qty','Size','Color','Amount','Payment Status','Order Status','Notes','Date','Created At'];
    const rows = orders.map(o => [
      o.id, o.customer, o.phone, o.address||'', o.product,
      o.qty, o.size||'', o.color||'', o.amount,
      o.pay_status, o.status, o.notes||'',
      o.date, new Date(o.created_at).toLocaleString()
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `UrbanFitz-Orders-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
db.init().then(() => {
  app.listen(PORT, () => console.log(`UrbanFitz OMS running on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
