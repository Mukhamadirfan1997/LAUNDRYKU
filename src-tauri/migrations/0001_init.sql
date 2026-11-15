-- LaundryKu — migrasi 0001: skema awal
-- Konvensi: uang disimpan sebagai INTEGER rupiah; waktu ISO-8601 UTC; tanggal bisnis YYYY-MM-DD.

CREATE TABLE IF NOT EXISTS employees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  address     TEXT,
  phone       TEXT,
  position    TEXT    NOT NULL CHECK (position IN ('Admin', 'Operator', 'Kasir')),
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_employees_position ON employees (position);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id   INTEGER REFERENCES employees (id) ON DELETE SET NULL,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('admin', 'kasir', 'operator')),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_login_at TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_employee ON users (employee_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS business_profile (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  business_name TEXT    NOT NULL,
  owner_name    TEXT    NOT NULL,
  address       TEXT    NOT NULL DEFAULT '',
  phone         TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  phone      TEXT    NOT NULL,
  address    TEXT,
  notes      TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);

CREATE TABLE IF NOT EXISTS items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  unit       TEXT    NOT NULL,
  price      INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock      INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_items_name ON items (name);
CREATE INDEX IF NOT EXISTS idx_items_active ON items (is_active);

CREATE TABLE IF NOT EXISTS services (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  category   TEXT    NOT NULL CHECK (category IN ('Cuci + Setrika', 'Setrika')),
  speed      TEXT    NOT NULL CHECK (speed IN ('Reguler', 'Express', 'Kilat Wuzz')),
  unit       TEXT    NOT NULL DEFAULT 'kg',
  price      INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (category, speed)
);

CREATE INDEX IF NOT EXISTS idx_services_active ON services (is_active);

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number   TEXT    NOT NULL UNIQUE,
  customer_id    INTEGER REFERENCES customers (id) ON DELETE SET NULL,
  customer_name  TEXT    NOT NULL,
  customer_phone TEXT    NOT NULL,
  order_date     TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'masuk' CHECK (status IN ('masuk', 'proses', 'selesai')),
  payment_status TEXT    NOT NULL DEFAULT 'belum_bayar' CHECK (payment_status IN ('belum_bayar', 'dp', 'lunas')),
  total          INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes          TEXT,
  created_by     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_number ON orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders (order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_date_status ON orders (order_date, status);

CREATE TABLE IF NOT EXISTS order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  line_type     TEXT    NOT NULL CHECK (line_type IN ('service', 'item')),
  service_id    INTEGER REFERENCES services (id) ON DELETE RESTRICT,
  item_id       INTEGER REFERENCES items (id) ON DELETE RESTRICT,
  name_snapshot TEXT    NOT NULL,
  unit          TEXT    NOT NULL,
  price         INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  qty           REAL    NOT NULL DEFAULT 1 CHECK (qty > 0),
  subtotal      INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (line_type = 'service' AND service_id IS NOT NULL) OR
    (line_type = 'item' AND item_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_service ON order_items (service_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item ON order_items (item_id);

CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  method     TEXT    NOT NULL DEFAULT 'tunai' CHECK (method IN ('tunai', 'transfer', 'qris')),
  paid_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  note       TEXT,
  created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments (paid_at);

CREATE TABLE IF NOT EXISTS expense_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON expense_categories (is_active);

CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT   NOT NULL,
  category_id INTEGER NOT NULL REFERENCES expense_categories (id) ON DELETE RESTRICT,
  description TEXT    NOT NULL DEFAULT '',
  amount      INTEGER NOT NULL CHECK (amount > 0),
  created_by  INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users (id) ON DELETE SET NULL,
  user_name   TEXT    NOT NULL,
  action      TEXT    NOT NULL CHECK (action IN (
                'login', 'logout', 'create', 'update', 'delete',
                'status_change', 'payment', 'export', 'backup', 'restore'
              )),
  entity      TEXT,
  entity_id   INTEGER,
  description TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs (action);
