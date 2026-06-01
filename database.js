const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT DEFAULT '',
      product TEXT NOT NULL,
      qty INTEGER DEFAULT 1,
      size TEXT DEFAULT '',
      color TEXT DEFAULT '',
      amount NUMERIC NOT NULL,
      pay_status TEXT DEFAULT 'Unpaid',
      status TEXT DEFAULT 'New',
      notes TEXT DEFAULT '',
      date TEXT DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Seed admin
  const existing = await pool.query('SELECT id FROM users WHERE email=$1', ['admin@urbanfitz.ng']);
  if (existing.rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3)',
      ['admin@urbanfitz.ng', hash, 'Admin']
    );
  }

  // Seed demo orders
  const count = await pool.query('SELECT COUNT(*) as c FROM orders');
  if (parseInt(count.rows[0].c) === 0) {
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
    for (const d of demo) {
      await pool.query(
        `INSERT INTO orders (id,customer,phone,address,product,qty,size,color,amount,pay_status,status,date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
        d
      );
    }
  }
}

// DB helper — mirrors better-sqlite3 API but async
const db = {
  pool,
  init,
  async get(sql, ...params) {
    // Convert ? placeholders to $1,$2...
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => '$' + (++i));
    const res = await pool.query(pgSql, params);
    return res.rows[0] || null;
  },
  async all(sql, ...params) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => '$' + (++i));
    const res = await pool.query(pgSql, params);
    return res.rows;
  },
  async run(sql, ...params) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => '$' + (++i));
    const res = await pool.query(pgSql, params);
    return res;
  }
};

module.exports = db;
