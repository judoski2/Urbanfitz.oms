const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'urbanfitz.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    product TEXT NOT NULL,
    qty INTEGER DEFAULT 1,
    size TEXT,
    color TEXT,
    amount REAL NOT NULL,
    pay_status TEXT DEFAULT 'Unpaid',
    status TEXT DEFAULT 'New',
    notes TEXT,
    date TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed admin user if not exists
const bcrypt = require('bcryptjs');
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@urbanfitz.ng');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run('admin@urbanfitz.ng', hash, 'Admin');
}

// Seed demo orders if empty
const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get();
if (orderCount.c === 0) {
  const insert = db.prepare(`
    INSERT INTO orders (id, customer, phone, address, product, qty, size, color, amount, pay_status, status, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const demo = [
    ['UF-001','Adaeze Okonkwo','08012345678','14 Allen Ave, Ikeja, Lagos','Custom Ankara Suit',1,'M','Blue/Gold',45000,'Paid','Delivered','2026-05-01'],
    ['UF-002','Emeka Eze','09087654321','5 Bode Thomas, Surulere, Lagos','Ready-to-Wear Agbada',2,'XL','White',80000,'Partially Paid','In Production','2026-05-10'],
    ['UF-003','Funmi Adeyemi','07011223344','22 Ogunlana Drive, Surulere','Kaftan Set',1,'L','Red/Gold',35000,'Unpaid','New','2026-05-18'],
    ['UF-004','Tunde Bakare','08033445566','3 Adeola Odeku, VI, Lagos','Linen Senator Set',3,'S','Cream',90000,'Paid','Shipped','2026-05-20'],
    ['UF-005','Ngozi Obi','08055667788','10 Isaac John, GRA Ikeja','Aso-Oke Gele Set',1,'M','Maroon/Silver',60000,'Paid','Ready for Delivery','2026-05-22'],
    ['UF-006','Chidi Okafor','07099887766','8 Fola Agoro, Yaba, Lagos','Corporate Suit',1,'XL','Navy Blue',55000,'Unpaid','Cancelled','2026-05-05'],
    ['UF-007','Bimpe Afolabi','08166778899','1 Obafemi Awolowo Way, Ikoyi','Bridal Lace Gown',1,'M','Ivory/Rose',120000,'Partially Paid','In Production','2026-05-25'],
    ['UF-008','Seun Lawal','09011223300','45 Coker Rd, Ilupeju, Lagos','Yoruba Native Wear',2,'L','Green/Gold',70000,'Paid','Delivered','2026-05-28'],
  ];
  demo.forEach(d => insert.run(...d));
}

module.exports = db;
