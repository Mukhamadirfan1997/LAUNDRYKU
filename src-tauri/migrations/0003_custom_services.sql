-- LaundryKu — migrasi 0003: Master Layanan CRUD penuh
-- Tabel layanan dibangun ulang agar kategori dan kecepatan tidak lagi dibatasi
-- pada enam kombinasi tetap. order_items ikut dibangun ulang agar foreign key
-- ke services tetap valid meskipun tabel induk diganti.

CREATE TABLE services_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  category   TEXT    NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 60),
  speed      TEXT    NOT NULL CHECK (length(trim(speed)) BETWEEN 1 AND 60),
  unit       TEXT    NOT NULL DEFAULT 'kg' CHECK (length(trim(unit)) BETWEEN 1 AND 20),
  price      INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO services_new (id, category, speed, unit, price, is_active, created_at, updated_at)
SELECT id, category, speed, unit, price, is_active, created_at, updated_at
FROM services;

CREATE TABLE order_items_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  line_type     TEXT    NOT NULL CHECK (line_type IN ('service', 'item')),
  service_id    INTEGER REFERENCES services_new (id) ON DELETE RESTRICT,
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

INSERT INTO order_items_new
  (id, order_id, line_type, service_id, item_id, name_snapshot, unit,
   price, qty, subtotal, created_at, updated_at)
SELECT id, order_id, line_type, service_id, item_id, name_snapshot, unit,
       price, qty, subtotal, created_at, updated_at
FROM order_items;

DROP TABLE order_items;
DROP TABLE services;
ALTER TABLE services_new RENAME TO services;
ALTER TABLE order_items_new RENAME TO order_items;

CREATE UNIQUE INDEX IF NOT EXISTS idx_services_category_speed
  ON services (category COLLATE NOCASE, speed COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_services_active ON services (is_active);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_service ON order_items (service_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item ON order_items (item_id);
