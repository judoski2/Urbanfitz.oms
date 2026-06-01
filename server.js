const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'urbanfitz-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// ── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  req.session.userId = user.id;
  req.session.userName = user.name;
  res.json({ success: true, name: user.name });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ loggedIn: true, name: req.session.userName });
  } else {
    res.json({ loggedIn: false });
  }
});

// ── ORDER ROUTES ─────────────────────────────────────────────────────────────
app.get('/api/orders', requireAuth, (req, res) => {
  const { search, status, payStatus, dateFrom, dateTo } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (search) {
    sql += ' AND (customer LIKE ? OR id LIKE ? OR product LIKE ? OR phone LIKE ?)';
    const q = '%' + search + '%';
    params.push(q, q, q, q);
  }
  if (status && status !== 'All') { sql += ' AND status = ?'; params.push(status); }
  if (payStatus && payStatus !== 'All') { sql += ' AND pay_status = ?'; params.push(payStatus); }
  if (dateFrom) { sql += ' AND date >= ?'; params.push(dateFrom); }
  if (dateTo)   { sql += ' AND date <= ?'; params.push(dateTo); }
  sql += ' ORDER BY created_at DESC';
  const orders = db.prepare(sql).all(...params);
  res.json(orders);
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/orders', requireAuth, (req, res) => {
  const { customer, phone, address, product, qty, size, color, amount, pay_status, status, notes, date } = req.body;
  if (!customer || !phone || !product || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Generate next ID
  const last = db.prepare("SELECT id FROM orders ORDER BY created_at DESC LIMIT 1").get();
  let nextNum = 1;
  if (last) {
    const n = parseInt(last.id.split('-')[1]);
    if (!isNaN(n)) nextNum = n + 1;
  }
  const id = 'UF-' + String(nextNum).padStart(3, '0');
  const orderDate = date || new Date().toISOString().split('T')[0];
  db.prepare(`
    INSERT INTO orders (id, customer, phone, address, product, qty, size, color, amount, pay_status, status, notes, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, customer, phone, address||'', product, qty||1, size||'', color||'', amount, pay_status||'Unpaid', status||'New', notes||'', orderDate);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.json(order);
});

app.put('/api/orders/:id', requireAuth, (req, res) => {
  const { customer, phone, address, product, qty, size, color, amount, pay_status, status, notes, date } = req.body;
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  db.prepare(`
    UPDATE orders SET
      customer=?, phone=?, address=?, product=?, qty=?, size=?, color=?,
      amount=?, pay_status=?, status=?, notes=?, date=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    customer||existing.customer, phone||existing.phone, address||existing.address,
    product||existing.product, qty||existing.qty, size||existing.size, color||existing.color,
    amount||existing.amount, pay_status||existing.pay_status, status||existing.status,
    notes||existing.notes||'', date||existing.date, req.params.id
  );
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json(order);
});

app.delete('/api/orders/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── CUSTOMER ROUTES ──────────────────────────────────────────────────────────
app.get('/api/customers', requireAuth, (req, res) => {
  const customers = db.prepare(`
    SELECT
      customer as name, phone,
      COUNT(*) as order_count,
      SUM(CASE WHEN pay_status='Paid' THEN amount ELSE 0 END) as total_spent,
      MAX(date) as last_order_date
    FROM orders
    GROUP BY phone
    ORDER BY order_count DESC
  `).all();
  res.json(customers);
});

app.get('/api/customers/:phone/orders', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE phone = ? ORDER BY date DESC').all(req.params.phone);
  res.json(orders);
});

// ── DASHBOARD STATS ──────────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, (req, res) => {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const total       = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const thisMonthC  = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date LIKE ?").get(thisMonth + '%').c;
  const revenue     = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM orders WHERE date LIKE ? AND pay_status='Paid'").get(thisMonth + '%').s;
  const pending     = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('New','In Production','Ready for Delivery')").get().c;
  const byStatus    = db.prepare("SELECT status, COUNT(*) as c FROM orders GROUP BY status").all();
  const recent      = db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 5").all();
  res.json({ total, thisMonth: thisMonthC, revenue, pending, byStatus, recent });
});

// ── PDF INVOICE ──────────────────────────────────────────────────────────────
app.get('/api/orders/:id/pdf', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="UrbanFitz-Invoice-${order.id}.pdf"`);
  doc.pipe(res);

  const RED = '#D0021B';
  const BLACK = '#111111';
  const GRAY = '#888888';
  const W = 595 - 100; // usable width

  // Red top bar
  doc.rect(0, 0, 595, 12).fill(RED);

  // Logo
  doc.y = 30;
  doc.font('Helvetica-Bold').fontSize(24).fillColor(BLACK).text('URBAN', 50, 30, { continued: true });
  doc.font('Helvetica-BoldOblique').fontSize(28).fillColor(RED).text('Fitz');
  doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK).text('CLOTHINGS', 50, 58, { characterSpacing: 3 });
  doc.font('Helvetica').fontSize(8).fillColor(GRAY);
  doc.text('3 Ajibode Street, Yaba, Lagos, Nigeria', 50, 70);
  doc.text('Phone: 07038245181  |  admin@urbanfitz.ng', 50, 82);

  // Invoice title (right)
  doc.font('Helvetica-Bold').fontSize(30).fillColor(RED).text('INVOICE', 350, 30, { width: 200, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(BLACK).text(order.id, 350, 65, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor(GRAY);
  const dateStr = new Date(order.date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  doc.text('Date: ' + dateStr, 350, 80, { width: 200, align: 'right' });

  // Divider
  doc.moveTo(50, 100).lineTo(545, 100).strokeColor(RED).lineWidth(1.5).stroke();

  // Bill To
  let y = 115;
  doc.font('Helvetica-Bold').fontSize(7).fillColor(RED).text('BILL TO', 50, y, { characterSpacing: 2 });
  y += 12;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
  y += 10;

  const fields = [
    ['CUSTOMER NAME', order.customer],
    ['PHONE NUMBER', order.phone],
    ['DELIVERY ADDRESS', order.address || '-'],
  ];
  fields.forEach(([label, value]) => {
    doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(label, 50, y);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text(value, 200, y, { width: 345 });
    y += 18;
  });

  y += 8;
  // Order Details
  doc.font('Helvetica-Bold').fontSize(7).fillColor(RED).text('ORDER DETAILS', 50, y, { characterSpacing: 2 });
  y += 14;

  // Table header
  doc.rect(50, y, W, 20).fill(BLACK);
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF');
  doc.text('PRODUCT',  55,  y+7);
  doc.text('SIZE',     240, y+7);
  doc.text('COLOR',    290, y+7);
  doc.text('QTY',      360, y+7);
  doc.text('AMOUNT',   400, y+7, { width: 95, align: 'right' });
  y += 20;

  // Table row
  doc.rect(50, y, W, 22).fill('#F9F9F9').stroke('#EEEEEE');
  doc.font('Helvetica').fontSize(9).fillColor(BLACK);
  doc.text(order.product,            55,  y+7, { width: 180 });
  doc.text(order.size  || '-',       240, y+7);
  doc.text(order.color || '-',       290, y+7);
  doc.text(String(order.qty),        360, y+7);
  doc.font('Helvetica-Bold');
  doc.text('\u20A6' + Number(order.amount).toLocaleString(), 400, y+7, { width: 95, align: 'right' });
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
  doc.rect(50, y, W, 22).fill('#F9F9F9');
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
});

// ── CHANGE PASSWORD ──────────────────────────────────────────────────────────
app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.session.userId);
  res.json({ success: true });
});

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`UrbanFitz OMS running on http://localhost:${PORT}`);
});
