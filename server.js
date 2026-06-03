const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db  = require('./database');
const sms = require('./sms');

const app = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    if (filePath.endsWith('.js'))  res.setHeader('Content-Type', 'application/javascript');
  }
}));

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
    if (status && status !== 'All')       { sql += ' AND status=?';     params.push(status); }
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
    const { customer, phone, address, product, qty, size, color, amount, pay_status, status, notes, date, delivery_type, tracking_number, logistics } = req.body;
    if (!customer || !phone || !product || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const id = await nextOrderId();
    const orderDate = date || new Date().toISOString().split('T')[0];
    await db.run(
      `INSERT INTO orders (id,customer,phone,address,product,qty,size,color,amount,pay_status,status,notes,date,delivery_type,tracking_number,logistics)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, customer, phone, address||'', product, qty||1, size||'', color||'',
      amount, pay_status||'Unpaid', status||'New', notes||'', orderDate,
      delivery_type||'', tracking_number||'', logistics||''
    );
    const order = await db.get('SELECT * FROM orders WHERE id=?', id);
    res.json(order);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM orders WHERE id=?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    const { customer, phone, address, product, qty, size, color, amount, pay_status, status, notes, date, delivery_type, tracking_number, logistics } = req.body;

    const newStatus     = status     || existing.status;
    const newPayStatus  = pay_status || existing.pay_status;
    const statusChanged = newStatus    !== existing.status;
    const payChanged    = newPayStatus !== existing.pay_status;

    await db.run(
      `UPDATE orders SET customer=?,phone=?,address=?,product=?,qty=?,size=?,color=?,
       amount=?,pay_status=?,status=?,notes=?,date=?,
       delivery_type=?,tracking_number=?,logistics=?,updated_at=NOW() WHERE id=?`,
      customer||existing.customer, phone||existing.phone, address??existing.address,
      product||existing.product, qty||existing.qty, size??existing.size, color??existing.color,
      amount||existing.amount, newPayStatus, newStatus,
      notes??existing.notes, date||existing.date,
      delivery_type!==undefined?delivery_type:existing.delivery_type||'',
      tracking_number!==undefined?tracking_number:existing.tracking_number||'',
      logistics!==undefined?logistics:existing.logistics||'',
      req.params.id
    );

    const order = await db.get('SELECT * FROM orders WHERE id=?', req.params.id);
    if (statusChanged) sms.sendStatusSMS(order, newStatus).catch(e => console.error('SMS error:', e));
    if (payChanged && !statusChanged) sms.sendPaymentSMS(order, newPayStatus).catch(e => console.error('SMS error:', e));
    res.json({ ...order, sms_sent: statusChanged || payChanged });
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

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
app.get('/api/analytics', requireAuth, async (req, res) => {
  try {
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
    const topProducts = await db.all(`
      SELECT product, COUNT(*) as count, SUM(amount) as revenue
      FROM orders GROUP BY product ORDER BY count DESC LIMIT 5
    `);
    const topCustomers = await db.all(`
      SELECT customer, phone, COUNT(*) as order_count,
        SUM(amount) as total_amount,
        SUM(CASE WHEN pay_status='Paid' THEN amount ELSE 0 END) as paid_amount
      FROM orders GROUP BY customer, phone ORDER BY total_amount DESC LIMIT 5
    `);
    const paymentBreakdown = await db.all(`
      SELECT pay_status, COUNT(*) as count, SUM(amount) as total FROM orders GROUP BY pay_status
    `);
    const statusBreakdown = await db.all(`
      SELECT status, COUNT(*) as count FROM orders GROUP BY status
    `);
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

// ── PDF INVOICE ───────────────────────────────────────────────────────────────
app.get('/api/orders/:id/pdf', requireAuth, async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id=?', req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="UrbanFitz-Invoice-${order.id}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    doc.pipe(res);

    const RED = '#D0021B', BLACK = '#111111', GRAY = '#888888';
    const NGN = 'NGN '; // Use NGN instead of ₦ symbol for font compatibility
    const amt = NGN + Number(order.amount).toLocaleString();

    doc.rect(0, 0, 595, 12).fill(RED);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(BLACK).text('URBAN', 50, 30, { continued: true });
    doc.font('Helvetica-BoldOblique').fontSize(28).fillColor(RED).text('Fitz');
    doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK).text('CLOTHINGS', 50, 58, { characterSpacing: 3 });
    doc.font('Helvetica').fontSize(8).fillColor(GRAY);
    doc.text('3 Ajibode Street, Yaba, Lagos, Nigeria', 50, 70);
    doc.text('Phone: 07038245181  |  admin@urbanfitz.ng', 50, 82);
    doc.font('Helvetica-Bold').fontSize(30).fillColor(RED).text('INVOICE', 350, 30, { width: 200, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(BLACK).text(order.id, 350, 65, { width: 200, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor(GRAY);
    const dateStr = new Date(order.date).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    doc.text('Date: ' + dateStr, 350, 80, { width: 200, align: 'right' });
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor(RED).lineWidth(1.5).stroke();
    let y = 115;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(RED).text('BILL TO', 50, y, { characterSpacing: 2 });
    y += 12;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
    y += 10;
    [['CUSTOMER NAME', order.customer], ['PHONE NUMBER', order.phone], ['DELIVERY ADDRESS', order.address||'-']].forEach(([label, value]) => {
      doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(label, 50, y);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text(String(value), 200, y, { width: 345 });
      y += 18;
    });
    y += 8;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(RED).text('ORDER DETAILS', 50, y, { characterSpacing: 2 });
    y += 14;
    doc.rect(50, y, 495, 20).fill(BLACK);
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF');
    doc.text('PRODUCT', 55, y+7); doc.text('SIZE', 240, y+7); doc.text('COLOR', 290, y+7);
    doc.text('QTY', 360, y+7); doc.text('AMOUNT', 400, y+7, { width: 95, align: 'right' });
    y += 20;
    doc.rect(50, y, 495, 22).fill('#F9F9F9').stroke('#EEEEEE');
    doc.font('Helvetica').fontSize(9).fillColor(BLACK);
    doc.text(order.product, 55, y+7, { width: 180 });
    doc.text(order.size||'-', 240, y+7); doc.text(order.color||'-', 290, y+7);
    doc.text(String(order.qty), 360, y+7);
    doc.font('Helvetica-Bold').text(amt, 400, y+7, { width: 95, align: 'right' });
    y += 30;
    const totX = 380;
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text('Subtotal', totX, y);
    doc.fillColor(BLACK).text(amt, totX, y, { width: 115, align: 'right' });
    y += 16;
    doc.fillColor(GRAY).text('Delivery Fee', totX, y);
    doc.fillColor(BLACK).text('NGN 0', totX, y, { width: 115, align: 'right' });
    y += 8;
    doc.moveTo(totX, y).lineTo(545, y).strokeColor(RED).lineWidth(1).stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(13).fillColor(BLACK).text('TOTAL', totX, y);
    doc.fillColor(RED).text(amt, totX, y, { width: 115, align: 'right' });
    y += 24;
    doc.rect(50, y, 495, 22).fill('#F9F9F9');
    doc.rect(50, y, 3, 22).fill(RED);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(BLACK).text('Payment: ', 60, y+8, { continued: true });
    doc.font('Helvetica').text(order.pay_status);
    doc.font('Helvetica-Bold').text('Order Status: ', 260, y+8, { continued: true });
    doc.font('Helvetica').text(order.status);
    y += 36;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
    y += 12;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK).text('Thank you for your business!', 50, y);
    y += 16;
    doc.font('Helvetica').fontSize(8).fillColor(GRAY).text('UrbanFitz Clothings - Quality you can wear with pride.', 50, y);
    doc.end();
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PROFORMA INVOICE PDF ──────────────────────────────────────────────────────
app.get('/api/orders/:id/proforma', requireAuth, async (req, res) => {
  try {
    const order = await db.get('SELECT * FROM orders WHERE id=?', req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="UrbanFitz-Proforma-${order.id}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    doc.pipe(res);

    const BLUE = '#1D6FE8', BLACK = '#111111', GRAY = '#888888', RED = '#D0021B';

    // Blue top bar
    doc.rect(0, 0, 595, 12).fill(BLUE);

    // Logo
    doc.font('Helvetica-Bold').fontSize(24).fillColor(BLACK).text('URBAN', 50, 30, { continued: true });
    doc.font('Helvetica-BoldOblique').fontSize(28).fillColor(RED).text('Fitz');
    doc.font('Helvetica-Bold').fontSize(7).fillColor(BLACK).text('CLOTHINGS', 50, 58, { characterSpacing: 3 });
    doc.font('Helvetica').fontSize(8).fillColor(GRAY);
    doc.text('3 Ajibode Street, Yaba, Lagos, Nigeria', 50, 70);
    doc.text('Phone: 07038245181  |  admin@urbanfitz.ng', 50, 82);

    // Proforma title
    doc.font('Helvetica-Bold').fontSize(26).fillColor(BLUE).text('PROFORMA', 350, 28, { width: 200, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(BLACK).text('INVOICE', 350, 56, { width: 200, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLACK).text(order.id, 350, 70, { width: 200, align: 'right' });
    const dateStr = new Date(order.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
    doc.font('Helvetica').fontSize(8).fillColor(GRAY).text('Date: '+dateStr, 350, 83, { width: 200, align: 'right' });

    // Divider
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor(BLUE).lineWidth(1.5).stroke();

    let y = 115;

    // Customer
    doc.font('Helvetica-Bold').fontSize(7).fillColor(BLUE).text('BILL TO', 50, y, { characterSpacing: 2 });
    y += 12;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
    y += 10;
    [['CUSTOMER NAME', order.customer], ['PHONE NUMBER', order.phone], ['DELIVERY ADDRESS', order.address||'-']].forEach(([label, value]) => {
      doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(label, 50, y);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text(value, 200, y, { width: 345 });
      y += 18;
    });

    y += 8;

    // Order summary
    doc.font('Helvetica-Bold').fontSize(7).fillColor(BLUE).text('ORDER SUMMARY', 50, y, { characterSpacing: 2 });
    y += 14;
    doc.rect(50, y, 495, 20).fill(BLACK);
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF');
    doc.text('PRODUCT', 55, y+7); doc.text('SIZE', 240, y+7);
    doc.text('COLOR', 290, y+7); doc.text('QTY', 360, y+7);
    doc.text('AMOUNT', 400, y+7, { width: 95, align: 'right' });
    y += 20;
    doc.rect(50, y, 495, 22).fill('#F0F7FF').stroke('#DDDDDD');
    doc.font('Helvetica').fontSize(9).fillColor(BLACK);
    doc.text(order.product, 55, y+7, { width: 180 });
    doc.text(order.size||'-', 240, y+7); doc.text(order.color||'-', 290, y+7);
    doc.text(String(order.qty), 360, y+7);
    doc.font('Helvetica-Bold').text('NGN ' +Number(order.amount).toLocaleString(), 400, y+7, { width: 95, align: 'right' });
    y += 30;

    // Total
    const totX = 380;
    doc.font('Helvetica').fontSize(9).fillColor(GRAY).text('Subtotal', totX, y);
    doc.fillColor(BLACK).text('NGN ' +Number(order.amount).toLocaleString(), totX, y, { width: 115, align: 'right' });
    y += 16;
    doc.fillColor(GRAY).text('Delivery Fee', totX, y);
    doc.fillColor(BLACK).text('NGN 0', totX, y, { width: 115, align: 'right' });
    y += 8;
    doc.moveTo(totX, y).lineTo(545, y).strokeColor(BLUE).lineWidth(1).stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BLACK).text('TOTAL', totX, y);
    doc.fillColor(BLUE).text('NGN ' +Number(order.amount).toLocaleString(), totX, y, { width: 115, align: 'right' });
    y += 30;

    // Payment details box
    doc.rect(50, y, 495, 80).fill('#F0F7FF').stroke('#BFDBFE');
    doc.rect(50, y, 4, 80).fill(BLUE);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BLUE).text('PAYMENT DETAILS', 62, y+10, { characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('Kindly make payment into the account below to confirm your order:', 62, y+24, { width: 470 });
    y += 38;
    doc.font('Helvetica').fontSize(8).fillColor(GRAY).text('Bank', 62, y);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLACK).text('StanbicIBTC', 160, y);
    y += 14;
    doc.font('Helvetica').fontSize(8).fillColor(GRAY).text('Account Number', 62, y);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(BLUE).text('0079743487', 160, y-2);
    y += 16;
    doc.font('Helvetica').fontSize(8).fillColor(GRAY).text('Account Name', 62, y);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLACK).text('The Urbanfitz Clothing', 160, y);
    y += 30;

    // Note
    doc.font('Helvetica').fontSize(8).fillColor(GRAY)
       .text('* Payment confirms acceptance of this proforma invoice. Please send payment receipt via WhatsApp to 07038245181.', 50, y, { width: 495 });
    y += 30;

    // Footer
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
    y += 12;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLACK).text('Thank you for choosing UrbanFitz Clothings!', 50, y);
    y += 14;
    doc.font('Helvetica').fontSize(8).fillColor(GRAY).text('Quality you can wear with pride.', 50, y);

    doc.end();
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── BULK PDF BY STATUS ────────────────────────────────────────────────────────
app.get('/api/bulk-pdf', requireAuth, async (req, res) => {
  try {
    const { status, payStatus, dateFrom, dateTo } = req.query;
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];
    if (status && status !== 'All')       { sql += ' AND status=?';     params.push(status); }
    if (payStatus && payStatus !== 'All') { sql += ' AND pay_status=?'; params.push(payStatus); }
    if (dateFrom) { sql += ' AND date>=?'; params.push(dateFrom); }
    if (dateTo)   { sql += ' AND date<=?'; params.push(dateTo); }
    sql += ' ORDER BY date ASC, id ASC';

    const orders = await db.all(sql, ...params);
    if (orders.length === 0) return res.status(404).json({ error: 'No orders found for this filter' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const RED = '#D0021B', BLACK = '#111111', GRAY = '#777777', LGRAY = '#DDDDDD';
    const W = 515; // usable width (595 - 40*2)

    const label = status && status !== 'All' ? status : (payStatus && payStatus !== 'All' ? payStatus : 'All Orders');
    const filename = `UrbanFitz-${label.replace(/\s+/g,'-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // ── Helper: draw page header ──────────────────────────────────────────────
    function drawPageHeader() {
      // Red top bar
      doc.rect(0, 0, 595, 10).fill(RED);
      // Logo
      doc.font('Helvetica-Bold').fontSize(18).fillColor(BLACK).text('URBAN', 40, 22, { continued: true });
      doc.font('Helvetica-BoldOblique').fontSize(22).fillColor(RED).text('Fitz');
      doc.font('Helvetica-Bold').fontSize(6).fillColor(BLACK).text('CLOTHINGS', 40, 44, { characterSpacing: 2 });
      // Title right
      doc.font('Helvetica-Bold').fontSize(14).fillColor(RED)
         .text(label.toUpperCase() + ' ORDERS', 40, 22, { width: W, align: 'right' });
      doc.font('Helvetica').fontSize(8).fillColor(GRAY)
         .text(`Generated: ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}  |  ${orders.length} order${orders.length!==1?'s':''}`, 40, 38, { width: W, align: 'right' });
      // Divider
      doc.moveTo(40, 55).lineTo(555, 55).strokeColor(RED).lineWidth(1.5).stroke();
    }

    // ── Helper: draw summary table header ─────────────────────────────────────
    function drawTableHeader(y) {
      doc.rect(40, y, W, 18).fill(BLACK);
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF');
      doc.text('ORDER ID',  45, y+6);
      doc.text('CUSTOMER',  95, y+6);
      doc.text('PRODUCT',   205, y+6);
      doc.text('DATE',      340, y+6);
      doc.text('AMOUNT',    395, y+6);
      doc.text('PAYMENT',   455, y+6);
      doc.text('STATUS',    510, y+6, { width: 42, align: 'right' });
      return y + 18;
    }

    // ── COVER PAGE ────────────────────────────────────────────────────────────
    drawPageHeader();

    // Summary stats box
    const totalAmt   = orders.reduce((a, o) => a + Number(o.amount), 0);
    const paidAmt    = orders.filter(o => o.pay_status === 'Paid').reduce((a, o) => a + Number(o.amount), 0);
    const unpaidAmt  = totalAmt - paidAmt;

    doc.rect(40, 65, W, 60).fill('#F9F9F9').stroke(LGRAY);
    doc.rect(40, 65, 3, 60).fill(RED);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('TOTAL ORDERS', 55, 73);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(BLACK).text(String(orders.length), 55, 83);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('TOTAL VALUE', 175, 73);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BLACK).text('NGN ' + totalAmt.toLocaleString(), 175, 83);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('PAID', 330, 73);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#059669').text('NGN ' + paidAmt.toLocaleString(), 330, 83);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('OUTSTANDING', 440, 73);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(RED).text('NGN ' + unpaidAmt.toLocaleString(), 440, 83);

    // ── ORDER TABLE ───────────────────────────────────────────────────────────
    let y = 140;
    y = drawTableHeader(y);

    orders.forEach((o, idx) => {
      // Check if need new page
      if (y > 760) {
        doc.addPage();
        doc.rect(0, 0, 595, 10).fill(RED);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY)
           .text(`UrbanFitz Clothings  |  ${label} Orders (continued)`, 40, 16, { width: W });
        doc.moveTo(40, 30).lineTo(555, 30).strokeColor(LGRAY).lineWidth(0.5).stroke();
        y = 40;
        y = drawTableHeader(y);
      }

      const rowH = 20;
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F9F9F9';
      doc.rect(40, y, W, rowH).fill(bg);
      doc.moveTo(40, y+rowH).lineTo(555, y+rowH).strokeColor(LGRAY).lineWidth(0.3).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor(RED).text(o.id, 45, y+7);
      doc.font('Helvetica').fontSize(8).fillColor(BLACK);
      doc.text(o.customer.length > 16 ? o.customer.slice(0,14)+'…' : o.customer, 95, y+7);
      doc.text(o.product.length > 18 ? o.product.slice(0,16)+'…' : o.product, 205, y+7);
      doc.text(new Date(o.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'}), 340, y+7);
      doc.font('Helvetica-Bold').text('NGN ' + Number(o.amount).toLocaleString(), 395, y+7);
      doc.font('Helvetica').fontSize(7).fillColor(o.pay_status==='Paid'?'#059669':o.pay_status==='Unpaid'?RED:'#D97706')
         .text(o.pay_status, 455, y+8);
      doc.font('Helvetica').fontSize(7).fillColor(BLACK)
         .text(o.status.length>10?o.status.slice(0,9)+'…':o.status, 510, y+8, { width: 42, align: 'right' });
      y += rowH;
    });

    // Totals row
    doc.rect(40, y, W, 22).fill('#111111');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
    doc.text('TOTAL', 45, y+7);
    doc.text(`${orders.length} orders`, 95, y+7);
    doc.text('NGN ' + totalAmt.toLocaleString(), 395, y+7);
    y += 22;

    // ── DETAILED ORDER PAGES ──────────────────────────────────────────────────
    orders.forEach((o, idx) => {
      doc.addPage();

      // Mini header
      doc.rect(0, 0, 595, 10).fill(RED);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(BLACK).text('URBAN', 40, 18, { continued: true });
      doc.font('Helvetica-BoldOblique').fontSize(12).fillColor(RED).text('Fitz');
      doc.font('Helvetica-Bold').fontSize(6).fillColor(BLACK).text('CLOTHINGS', 40, 32, { characterSpacing: 2 });
      doc.font('Helvetica').fontSize(8).fillColor(GRAY).text(`Order ${idx+1} of ${orders.length}`, 40, 18, { width: W, align: 'right' });
      doc.moveTo(40, 44).lineTo(555, 44).strokeColor(RED).lineWidth(1).stroke();

      let dy = 55;

      // Order ID + status badge
      doc.font('Helvetica-Bold').fontSize(20).fillColor(BLACK).text(o.id, 40, dy);
      doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(`Created: ${new Date(o.date).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`, 40, dy+24);

      // Status pill (right)
      doc.font('Helvetica-Bold').fontSize(9).fillColor(RED)
         .text(o.status, 40, dy, { width: W, align: 'right' });
      doc.font('Helvetica').fontSize(8).fillColor(GRAY)
         .text(o.pay_status, 40, dy+14, { width: W, align: 'right' });

      dy += 44;
      doc.moveTo(40, dy).lineTo(555, dy).strokeColor(LGRAY).lineWidth(0.5).stroke();
      dy += 10;

      // Customer section
      doc.font('Helvetica-Bold').fontSize(7).fillColor(RED).text('CUSTOMER', 40, dy, { characterSpacing: 1.5 });
      dy += 12;
      const custFields = [['Name', o.customer], ['Phone', o.phone], ['Address', o.address||'-']];
      custFields.forEach(([k, v]) => {
        doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(k, 40, dy);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text(v, 120, dy, { width: 375 });
        dy += 16;
      });

      dy += 4;
      doc.moveTo(40, dy).lineTo(555, dy).strokeColor(LGRAY).lineWidth(0.5).stroke();
      dy += 10;

      // Order details
      doc.font('Helvetica-Bold').fontSize(7).fillColor(RED).text('ORDER DETAILS', 40, dy, { characterSpacing: 1.5 });
      dy += 12;
      const orderFields = [
        ['Product', o.product], ['Quantity', String(o.qty)],
        ['Size', o.size||'-'], ['Color', o.color||'-'],
      ];
      orderFields.forEach(([k, v]) => {
        doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(k, 40, dy);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text(v, 120, dy);
        dy += 16;
      });

      dy += 4;
      doc.moveTo(40, dy).lineTo(555, dy).strokeColor(LGRAY).lineWidth(0.5).stroke();
      dy += 10;

      // Amount
      doc.font('Helvetica-Bold').fontSize(7).fillColor(RED).text('PAYMENT', 40, dy, { characterSpacing: 1.5 });
      dy += 12;
      doc.font('Helvetica').fontSize(7).fillColor(GRAY).text('Amount', 40, dy);
      doc.font('Helvetica-Bold').fontSize(14).fillColor(BLACK).text('NGN ' + Number(o.amount).toLocaleString(), 120, dy-3);
      dy += 20;
      doc.font('Helvetica').fontSize(7).fillColor(GRAY).text('Payment Status', 40, dy);
      doc.font('Helvetica-Bold').fontSize(9)
         .fillColor(o.pay_status==='Paid'?'#059669':o.pay_status==='Unpaid'?RED:'#D97706')
         .text(o.pay_status, 120, dy);
      dy += 16;

      if (o.notes) {
        dy += 8;
        doc.rect(40, dy, W, 1).fill(LGRAY);
        dy += 10;
        doc.font('Helvetica-Bold').fontSize(7).fillColor(RED).text('NOTES', 40, dy, { characterSpacing: 1.5 });
        dy += 12;
        doc.font('Helvetica').fontSize(9).fillColor(BLACK).text(o.notes, 40, dy, { width: W });
      }

      // Footer line
      doc.moveTo(40, 780).lineTo(555, 780).strokeColor(LGRAY).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(7).fillColor(GRAY)
         .text('UrbanFitz Clothings  |  3 Ajibode Street, Yaba, Lagos  |  07038245181', 40, 786, { width: W, align: 'center' });
    });

    doc.end();
  } catch(e) {
    console.error('Bulk PDF error:', e);
    res.status(500).json({ error: e.message });
  }
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

// ── MEASUREMENTS ──────────────────────────────────────────────────────────────
// Get all measurements
app.get('/api/measurements', requireAuth, async (req, res) => {
  try {
    const measurements = await db.all('SELECT * FROM measurements ORDER BY customer ASC');
    res.json(measurements);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Get measurement by phone
app.get('/api/measurements/:phone', requireAuth, async (req, res) => {
  try {
    const m = await db.get('SELECT * FROM measurements WHERE phone=?', req.params.phone);
    if (!m) return res.status(404).json({ error: 'No measurements found' });
    res.json(m);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Save/update measurements (upsert)
app.post('/api/measurements', requireAuth, async (req, res) => {
  try {
    const {
      customer, phone,
      chest, shoulder, sleeve_length, sleeve_round, wrist,
      back_length, front_length, nipple_to_nipple,
      waist, hips, thigh, knee, ankle, trouser_length,
      bust, under_bust, dress_length, gown_length,
      height, weight, notes, unit
    } = req.body;

    if (!customer || !phone) return res.status(400).json({ error: 'Customer and phone required' });

    // Check if exists
    const existing = await db.get('SELECT id FROM measurements WHERE phone=?', phone);

    if (existing) {
      await db.run(`
        UPDATE measurements SET
          customer=?, chest=?, shoulder=?, sleeve_length=?, sleeve_round=?, wrist=?,
          back_length=?, front_length=?, nipple_to_nipple=?,
          waist=?, hips=?, thigh=?, knee=?, ankle=?, trouser_length=?,
          bust=?, under_bust=?, dress_length=?, gown_length=?,
          height=?, weight=?, notes=?, unit=?, updated_at=NOW()
        WHERE phone=?`,
        customer,
        chest||null, shoulder||null, sleeve_length||null, sleeve_round||null, wrist||null,
        back_length||null, front_length||null, nipple_to_nipple||null,
        waist||null, hips||null, thigh||null, knee||null, ankle||null, trouser_length||null,
        bust||null, under_bust||null, dress_length||null, gown_length||null,
        height||null, weight||null, notes||'', unit||'inches', phone
      );
    } else {
      await db.run(`
        INSERT INTO measurements (
          customer, phone, chest, shoulder, sleeve_length, sleeve_round, wrist,
          back_length, front_length, nipple_to_nipple,
          waist, hips, thigh, knee, ankle, trouser_length,
          bust, under_bust, dress_length, gown_length,
          height, weight, notes, unit
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        customer, phone,
        chest||null, shoulder||null, sleeve_length||null, sleeve_round||null, wrist||null,
        back_length||null, front_length||null, nipple_to_nipple||null,
        waist||null, hips||null, thigh||null, knee||null, ankle||null, trouser_length||null,
        bust||null, under_bust||null, dress_length||null, gown_length||null,
        height||null, weight||null, notes||'', unit||'inches'
      );
    }

    const m = await db.get('SELECT * FROM measurements WHERE phone=?', phone);
    res.json(m);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Delete measurements
app.delete('/api/measurements/:phone', requireAuth, async (req, res) => {
  try {
    await db.run('DELETE FROM measurements WHERE phone=?', req.params.phone);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── SMS ROUTES ────────────────────────────────────────────────────────────────
// Check SMS status
app.get('/api/sms/status', requireAuth, (req, res) => {
  res.json({
    enabled: sms.SMS_ENABLED,
    message: sms.SMS_ENABLED
      ? 'SMS is active. Customers will be notified on status changes.'
      : 'SMS is not active. Add TERMII_API_KEY to Render environment variables to enable.'
  });
});

// Send custom SMS to a customer
app.post('/api/sms/send', requireAuth, async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'Phone and message required' });
    const result = await sms.sendCustomSMS(phone, message);
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Send bulk SMS to all customers
app.post('/api/sms/bulk', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    const customers = await db.all(`
      SELECT DISTINCT customer as name, phone FROM orders ORDER BY customer
    `);
    const results = await sms.sendBulkSMS(customers, message);
    const sent    = results.filter(r => r.sent).length;
    const failed  = results.filter(r => !r.sent).length;
    res.json({ total: customers.length, sent, failed, results });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Send SMS to customers with unpaid orders
app.post('/api/sms/payment-reminder', requireAuth, async (req, res) => {
  try {
    const unpaid = await db.all(`
      SELECT DISTINCT customer, phone FROM orders
      WHERE pay_status IN ('Unpaid','Partially Paid')
      ORDER BY customer
    `);
    const message = `Hi [Name], you have an outstanding payment with UrbanFitz Clothings. Kindly complete your payment to proceed with your order. Call/WhatsApp: 07038245181. Thank you!`;
    const results = await sms.sendBulkSMS(unpaid, message);
    const sent = results.filter(r => r.sent).length;
    res.json({ total: unpaid.length, sent, results });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CATCH ALL → serve index.html ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START ─────────────────────────────────────────────────────────────────────
db.init().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UrbanFitz OMS running on port ${PORT}`);
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
