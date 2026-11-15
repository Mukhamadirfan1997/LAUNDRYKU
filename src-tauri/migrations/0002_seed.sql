-- LaundryKu — migrasi 0002: data awal
-- Akun admin di-seed pada Fase 2 melalui perintah Rust agar hash Argon2 dibuat aman.

INSERT INTO business_profile (id, business_name, owner_name, address, phone)
VALUES (1, 'LaundryKu', 'Pemilik LaundryKu', '', '');

INSERT INTO services (category, speed, unit, price) VALUES
  ('Cuci + Setrika', 'Reguler',    'kg', 7000),
  ('Cuci + Setrika', 'Express',    'kg', 10000),
  ('Cuci + Setrika', 'Kilat Wuzz', 'kg', 15000),
  ('Setrika',        'Reguler',    'kg', 5000),
  ('Setrika',        'Express',    'kg', 7000),
  ('Setrika',        'Kilat Wuzz', 'kg', 10000);

INSERT INTO expense_categories (name) VALUES
  ('Listrik'),
  ('Air'),
  ('Deterjen'),
  ('Pewangi'),
  ('Gaji'),
  ('Lainnya');
