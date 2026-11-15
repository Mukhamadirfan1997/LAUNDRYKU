
# LaundryKu — Dokumen Acuan Proyek

> **LaundryKu** — *"Kelola laundry, catat kas, tanpa ribet"*
> Aplikasi desktop manajemen keuangan usaha laundry. Offline-first, tanpa server eksternal.

Dokumen ini adalah **sumber kebenaran tunggal** untuk pengembangan. Setiap fase dikerjakan berurutan dan berhenti untuk konfirmasi. Jika ada perubahan kebutuhan, dokumen ini diperbarui lebih dulu.

---

## 1. Identitas Aplikasi

| Item | Nilai |
|---|---|
| Nama aplikasi | LaundryKu |
| Tagline | Kelola laundry, catat kas, tanpa ribet |
| Identifier Tauri | `com.laundryku.app` |
| Nama jendela | LaundryKu |
| Nama installer | LaundryKu (`LaundryKu_<versi>_x64-setup.exe` / `LaundryKu_<versi>_x64_en-US.msi`) |
| Logo | Placeholder: ikon `WashingMachine` (lucide-react) di dalam kotak gradien biru–tosca + wordmark "LaundryKu". Disimpan di `src/components/brand/Logo.tsx`, mudah diganti. |

### Palet warna
- **Primer:** biru–tosca (`#0891B2` / cyan-600) — sidebar aktif, tombol utama, aksen.
- **Sekunder:** biru laut (`#0E7490` / cyan-700), latar lembut `#ECFEFF`.
- **Sukses / pendapatan:** hijau (`#16A34A` / green-600, latar `#DCFCE7`).
- **Bahaya / pengeluaran:** merah (`#DC2626` / red-600, latar `#FEE2E2`).
- **Netral:** slate untuk teks dan border.
- Mode terang & gelap memakai CSS variable shadcn (`:root` dan `.dark`) di `src/index.css`.
- Semua teks UI **Bahasa Indonesia**; mata uang `Rp 10.000`; tanggal `09 November 2026` (format Indonesia).

---

## 2. Tech Stack (wajib)

| Lapisan | Pilihan |
|---|---|
| Desktop | Tauri 2 (Rust) |
| Frontend | React 18/19 + TypeScript **strict** + Vite |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Routing | TanStack Router |
| Data | TanStack Query |
| State global | Zustand |
| Form | React Hook Form + Zod (pesan error Bahasa Indonesia) |
| Grafik | Recharts |
| Database | SQLite via `tauri-plugin-sql` + file migrasi SQL berurutan |
| Password | Argon2 di Rust (`argon2` crate) via Tauri command |
| PDF | `jspdf` + `jspdf-autotable` |
| Excel | `exceljs` (`.xlsx`) |
| Plugin Tauri | `dialog`, `fs`, `opener`, `notification`, `sql` |

**Keputusan teknis yang dipakai:**
- Package manager: **npm** (lockfile `package-lock.json`).
- Routing: **code-based route tree** (`src/router.tsx`) agar type-safe tanpa generator plugin; route tree dibagi per fitur.
- Tidak memakai `next-themes`; tema dikelola provider kecil sendiri (Zustand + `localStorage` + class `dark`).
- Tema disimpan di `localStorage` (bukan tabel DB) karena daftar tabel sudah dikunci.
- `qty` boleh desimal (mis. 2,5 kg); **semua uang disimpan integer rupiah**.
- Total order disimpan denormalisasi di `orders.total` untuk laporan, tetapi **selalu dihitung ulang dari `order_items` di dalam transaksi DB** setiap kali item berubah.
- PDF memakai jsPDF + autotable dengan font bawaan (Helvetica) yang mendukung teks Latin/Rupiah.
- Excel memakai ExcelJS dengan format number `"Rp"#,##0` dan tanggal Indonesia di header.
- Antrian/sidebar: kasir boleh **membaca** master layanan & barang untuk membuat order, tetapi tidak boleh mengubahnya.

---

## 3. Struktur Folder Target

```
APLIKASI LAUNDRY/
├─ DOKUMEN-ACUAN.md
├─ README.md
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ components.json                # shadcn
├─ tailwind.config.ts
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ router.tsx                  # route tree TanStack Router
│  ├─ index.css                   # tailwind + CSS variable tema
│  ├─ components/
│  │  ├─ ui/                      # shadcn/ui (button, input, dialog, dll)
│  │  ├─ brand/Logo.tsx
│  │  ├─ layout/AppLayout.tsx, Sidebar.tsx, Topbar.tsx, ThemeToggle.tsx
│  │  ├─ data-table/DataTable.tsx # pencarian, filter, sort, pagination reusable
│  │  ├─ feedback/EmptyState.tsx, LoadingState.tsx, ConfirmDialog.tsx
│  │  └─ common/CurrencyInput.tsx, PageHeader.tsx
│  ├─ features/
│  │  ├─ auth/                    # login, session store, guard
│  │  ├─ dashboard/
│  │  ├─ operasional/             # master barang, master layanan
│  │  ├─ transaksi/               # antrian, status, pembayaran, pelanggan, struk
│  │  ├─ pengeluaran/
│  │  ├─ laporan/
│  │  └─ pengaturan/              # profil, pegawai, akun, log, backup/restore
│  ├─ db/
│  │  ├─ migrations/              # 0001_init.sql, 0002_seed.sql, dst.
│  │  ├─ client.ts                # koneksi tauri-plugin-sql
│  │  ├─ queries/                 # query per fitur (typed)
│  │  └─ types.ts                 # tipe entitas & DTO
│  ├─ lib/
│  │  ├─ export.ts                # saveFileWithDialog (wajib)
│  │  ├─ pdf.ts, excel.ts         # builder laporan & struk
│  │  ├─ format.ts                # rupiah, tanggal, nomor
│  │  ├─ api.ts                   # invoke wrapper + penanganan error
│  │  └─ utils.ts                 # cn()
│  └─ stores/                     # theme, sidebar, session
└─ src-tauri/
   ├─ Cargo.toml
   ├─ tauri.conf.json
   ├─ build.rs
   ├─ capabilities/default.json
   ├─ icons/
   └─ src/
      ├─ main.rs
      ├─ lib.rs
      ├─ auth.rs                  # argon2, sesi, RBAC
      ├─ commands/                # command sensitif (akun, backup, restore, ekspor)
      └─ db.rs                    # path DB, backup/restore
```

---

## 4. Skema Database (SQLite)

Konvensi: uang `INTEGER` rupiah; waktu `TEXT` ISO-8601 UTC; tanggal bisnis `TEXT` `YYYY-MM-DD`; semua tabel punya `created_at` & `updated_at`; foreign key `ON DELETE RESTRICT` kecuali `order_items` (CASCADE); aktif/nonaktif memakai `is_active` (tanpa hard delete untuk data yang sudah dipakai).

### 4.1 `users`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| employee_id | INTEGER NULL → employees(id) | akun boleh tanpa pegawai |
| username | TEXT NOT NULL UNIQUE | |
| password_hash | TEXT NOT NULL | format PHC Argon2id |
| role | TEXT NOT NULL | CHECK `admin`/`kasir`/`operator` |
| is_active | INTEGER NOT NULL DEFAULT 1 | |
| last_login_at | TEXT NULL | |
| created_at, updated_at | TEXT NOT NULL | |

### 4.2 `employees`
id, name NOT NULL, address, phone, position CHECK (`Admin`,`Operator`,`Kasir`), is_active, created_at, updated_at.

### 4.3 `business_profile`
Satu baris (`id = 1`): business_name, owner_name, address, phone, created_at, updated_at.

### 4.4 `customers`
id, name NOT NULL, phone NOT NULL, address, notes, created_at, updated_at.
Index: `idx_customers_phone (phone)`, `idx_customers_name (name)`.

### 4.5 `items` (master barang)
id, name NOT NULL, unit NOT NULL (pcs/liter/dll), price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0, is_active, created_at, updated_at.

### 4.6 `services` (master layanan — 6 baris)
id, category CHECK (`Cuci + Setrika`,`Setrika`), speed CHECK (`Reguler`,`Express`,`Kilat Wuzz`), unit NOT NULL, price INTEGER NOT NULL, is_active, created_at, updated_at.
`UNIQUE(category, speed)`. Nama tampilan = `"{category} - {speed}"`.

### 4.7 `orders`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | INTEGER PK | |
| order_number | TEXT NOT NULL UNIQUE | `LDR-YYYYMMDD-0001` |
| customer_id | INTEGER NULL → customers(id) | |
| customer_name | TEXT NOT NULL | snapshot |
| customer_phone | TEXT NOT NULL | snapshot, indexed |
| order_date | TEXT NOT NULL | `YYYY-MM-DD`, indexed |
| status | TEXT NOT NULL | `masuk`/`proses`/`selesai`, indexed |
| payment_status | TEXT NOT NULL | `belum_bayar`/`dp`/`lunas`, indexed |
| total | INTEGER NOT NULL DEFAULT 0 | hasil hitung `order_items` |
| notes | TEXT NULL | |
| created_by | INTEGER NULL → users(id) | |
| created_at, updated_at | TEXT NOT NULL | |

Index tambahan: `idx_orders_date_status (order_date, status)`.

### 4.8 `order_items`
id, order_id → orders(id) ON DELETE CASCADE, line_type CHECK (`service`,`item`), service_id NULL → services(id), item_id NULL → items(id), name_snapshot NOT NULL, unit NOT NULL, price INTEGER NOT NULL, qty REAL NOT NULL DEFAULT 1, subtotal INTEGER NOT NULL, created_at, updated_at.
Index: `idx_order_items_order (order_id)`.

### 4.9 `payments`
id, order_id → orders(id) RESTRICT, amount INTEGER NOT NULL, method TEXT NOT NULL DEFAULT `tunai` (`tunai`/`transfer`/`qris`), paid_at TEXT NOT NULL, note, created_by NULL → users(id), created_at, updated_at.
Index: `idx_payments_order (order_id)`, `idx_payments_paid_at (paid_at)`.

### 4.10 `expense_categories` (CRUD — ditambahkan atas permintaan)
id, name TEXT NOT NULL UNIQUE, is_active INTEGER NOT NULL DEFAULT 1, created_at, updated_at.
Seed awal: listrik, air, deterjen, pewangi, gaji, lainnya.

### 4.11 `expenses`
id, expense_date TEXT NOT NULL, category_id INTEGER NOT NULL → expense_categories(id), description, amount INTEGER NOT NULL, created_by NULL → users(id), created_at, updated_at.
Index: `idx_expenses_date (expense_date)`, `idx_expenses_category (category_id)`.
Kategori yang sudah dipakai tidak di-hard-delete; dinonaktifkan (`is_active = 0`).

### 4.12 `activity_logs`
id, user_id NULL → users(id), user_name NOT NULL, action NOT NULL (`login`,`logout`,`create`,`update`,`delete`,`status_change`,`export`,`backup`,`restore`), entity TEXT, entity_id INTEGER, description TEXT, created_at, updated_at.
Index: `idx_activity_created (created_at)`, `idx_activity_user (user_id)`.

### Aturan data penting
- **Nomor order** dibuat di dalam transaksi DB: ambil urutan terakhir untuk `order_date` terkait (`MAX(order_number)` pola `LDR-YYYYMMDD-%`), tambah 1, format 4 digit. Constraint UNIQUE menjadi pengaman terakhir.
- **Total order** = `SUM(order_items.subtotal)`; disimpan ulang setiap mutasi item, dalam transaksi yang sama.
- **Sisa bayar** = `orders.total - SUM(payments.amount)`; `payment_status` diturunkan: 0 → `belum_bayar`, 0 < bayar < total → `dp`, bayar ≥ total → `lunas`.
- Semua operasi multi-tabel (order + items, pembayaran, restore) memakai `BEGIN … COMMIT/ROLLBACK`.
- Migrasi berurutan: `0001_init.sql` (skema + index), `0002_seed.sql` (profil default, 6 layanan, 6 kategori pengeluaran), `0003_custom_services.sql` (rebuild `services` + `order_items` agar kategori/kecepatan layanan kustom didukung tanpa merusak FK). Akun admin awal **tidak** dibuat lewat SQL; Rust membuatnya saat tabel `users` masih kosong.
- **Backup** membuat snapshot konsisten dengan `VACUUM INTO` di folder data aplikasi, lalu frontend membacanya lewat plugin `fs` dan menyimpannya melalui dialog Save As. Audit `backup` ditulis setelah file tujuan berhasil ditulis.
- **Restore** memvalidasi file dengan `PRAGMA integrity_check`, `foreign_key_check`, tabel wajib, versi migrasi, dan minimal satu akun admin aktif. Snapshot pengaman dibuat sebelum penggantian; pool SQLite ditutup lalu dibuka kembali, semua sesi dihapus, dan audit `restore` dicatat.

---

## 5. Autentikasi, Sesi, dan RBAC

### Alur login
1. Form login → command Rust `login(username, password)`.
2. Rust memuat `password_hash` dari SQLite, verifikasi **Argon2id** (`argon2` crate). Hash **tidak pernah** menyentuh frontend.
3. Jika sukses: Rust membuat **session token acak** (32 byte) yang disimpan di state Rust (`Mutex<HashMap<String, Session>>`) berisi `user_id`, `role`, `username`, `expires_at` (8 jam). Token dikembalikan ke frontend.
4. Frontend menyimpan token + profil di Zustand `persist` dengan `sessionStorage` (bukan `localStorage`). Setelah reload jendela, token divalidasi ulang ke Rust; setelah aplikasi ditutup, sesi Rust hilang sehingga pengguna harus login lagi.
5. Setiap command sensitif menerima `token`, divalidasi ulang di Rust (role + masa berlaku). Token kedaluwarsa → frontend logout paksa + toast.
6. Logout memanggil `logout(token)` (hapus sesi Rust + catat log) dan membersihkan store.

### Matriks hak akses
| Fitur | Admin | Kasir | Operator |
|---|:--:|:--:|:--:|
| Dashboard | ✅ | ✅ | ❌ |
| Master Barang & Layanan (ubah) | ✅ | 👁 baca saja | ❌ |
| Antrian / order baru | ✅ | ✅ | 👁 lihat |
| Ubah status Proses/Selesai | ✅ | ✅ | ✅ |
| Pembayaran | ✅ | ✅ | ❌ |
| Pelanggan | ✅ | ✅ | ❌ |
| Cetak struk | ✅ | ✅ | ❌ |
| Pengeluaran | ✅ | ❌ | ❌ |
| Laporan + ekspor | ✅ | ❌ | ❌ |
| Pengaturan, pegawai, akun, log | ✅ | ❌ | ❌ |
| Backup / restore | ✅ | ❌ | ❌ |

Proteksi **dua lapis**: guard route TanStack Router (frontend) + validasi token/role di command Rust (sensitif: akun, hapus data, ekspor laporan, backup/restore, ubah status). Menu yang tidak berhak tidak ditampilkan.
Halaman default tiap role: admin/kasir → Dashboard; operator → Antrian.

### Seed akun awal
- Username: `admin`
- Password awal: `Admin123!`
- Ganti password tersedia di **Pengaturan -> Akun -> Ubah Password Saya** (semua role yang dapat membuka halaman ini). Password baru wajib 8-72 karakter dengan huruf besar, huruf kecil, dan angka; password lama diverifikasi Argon2id di Rust. Penggantian paksa saat login pertama **tidak** diterapkan.

---

## 6. Ekspor / Unduh (WAJIB)

**Dilarang:** `<a download>`, `URL.createObjectURL` + klik anchor, `window.open` untuk mengunduh.

**Helper tunggal** `src/lib/export.ts`:

```ts
export type ExportResult =
  | { status: "saved"; path: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export async function saveFileWithDialog(opts: {
  defaultName: string;                 // mis. Laporan-Bulanan-2026-11.pdf
  filters: { name: string; extensions: string[] }[];
  data: Uint8Array;
}): Promise<ExportResult>
```

Alur helper:
1. Tentukan folder awal: `documentDir()` (fallback `downloadDir()`), gabung `defaultName`.
2. `save({ defaultPath, filters })` dari `@tauri-apps/plugin-dialog`.
3. `null` → `{ status:"cancelled" }` (tanpa toast error/sukses).
4. Pilih path → `writeFile(path, data)` dari `@tauri-apps/plugin-fs`.
5. Sukses → `{ status:"saved", path }`.
6. Gagal → pesan Indonesia yang menjelaskan penyebab (izin, disk penuh, file terkunci) + saran; `{ status:"error", message }`.

**Setelah `saved`, komponen pemanggil:**
- Toast sukses: `"Laporan berhasil diunduh"` + nama file + aksi **Buka File** (`openPath`) dan **Buka Folder** (`revealItemInDir`).
- Notifikasi OS via `@tauri-apps/plugin-notification`: minta izin **sekali** (`isPermissionGranted`/`requestPermission`); jika ditolak, lewati tanpa error.
- Catat `activity_logs` action `export` (siapa, jenis laporan, periode, kapan) — lewat command Rust `log_activity` bertoken.
- Tombol menampilkan loading: disabled + spinner selama pembuatan & penulisan file.
- Error → toast error jelas (bukan gagal diam-diam), tanpa catatan sukses.

**Plugin & permission**
- `Cargo.toml`: `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-opener`, `tauri-plugin-notification`, `tauri-plugin-sql` (fitur `sqlite`), `argon2`, `rand`, `uuid`, `chrono`.
- Registrasi di `lib.rs` (`tauri::Builder::default().plugin(...)`) — `main.rs` hanya memanggil `laundryku_lib::run()`.
- JS: `@tauri-apps/plugin-dialog`, `-fs`, `-opener`, `-notification`, `@tauri-apps/plugin-sql`.
- `src-tauri/capabilities/default.json`: `core:default`, `dialog:default`, `opener:default`, `notification:default`, `sql:default`, `sql:allow-execute` (bila diperlukan), serta `fs:allow-write-file` dengan scope `$DOCUMENT/**`, `$DOWNLOAD/**`, `$DESKTOP/**`, `$HOME/**` (lokasi di luar itu ditolak dengan pesan jelas).
- **Wajib diuji via `npm run tauri build`**, bukan hanya dev.

**Checklist pengujian ekspor**
- [ ] Simpan berhasil → file ada, toast + notifikasi OS muncul, tombol Buka File/Folder bekerja.
- [ ] Batal di dialog → tidak ada file, tidak ada toast sukses/error.
- [ ] Nama file sudah ada → dialog konfirmasi timpa bawaan OS tampil dan berfungsi.
- [ ] Folder tanpa izin tulis (mis. `C:\Windows\System32`) → toast error jelas + saran.
- [ ] File hasil terbuka normal di PDF reader & Excel; angka sama persis dengan layar.
- [ ] Ekspor tercatat di `activity_logs`.
- [ ] Izin notifikasi ditolak → ekspor tetap sukses tanpa crash.

---

## 7. Rencana Fase & Kriteria Selesai

### Fase 1 — Fondasi Proyek
- Scaffold Tauri 2 + React + TS + Vite; Tailwind + shadcn/ui + lucide-react.
- Identitas: `productName` LaundryKu, identifier, judul jendela, logo placeholder, palet, mode terang/gelap.
- Layout: sidebar lipat, topbar (user & logout placeholder), area konten, responsif.
- SQLite + `tauri-plugin-sql`, migrasi `0001_init`, `0002_seed` (profil, 6 layanan, 6 kategori pengeluaran), lalu `0003_custom_services` pada Fase 3.
- Semua plugin terpasang + capabilities; command health-check `app_info`.
- Halaman login kosmetik? **Tidak** — login asli di Fase 2; Fase 1 memakai layout dengan route placeholder per menu.
- **Selesai bila:** `npm run tauri dev` menampilkan shell aplikasi, DB terbentuk di app data, 6 layanan & profil seed ada, tema bisa diganti, `cargo check` & `tsc` bersih.

### Fase 2 — Autentikasi & RBAC
- Command Rust `login`, `logout`, `validate_session`, `log_activity`. (`change_password` masuk Fase 6 bersama pengaturan akun.)
- Argon2id, sesi in-memory, seed admin (`Admin123!`).
- Halaman login, store sesi, guard route, redirect per role, menu sesuai hak, 403 page.
- Log login/logout.
- **Selesai bila:** login benar/salah berfungsi, token kedaluwarsa logout, role tidak bisa membuka route terlarang, command sensitif menolak token/role salah.

### Fase 3 — Operasional
- CRUD master barang (nama, harga, satuan, jumlah/stok), aktif/nonaktif.
- Master layanan: CRUD layanan kustom (kategori × kecepatan), ubah satuan/harga/aktif; layanan yang terpakai hanya boleh dinonaktifkan, tidak boleh hard delete.
- Tabel reusable: cari, filter, sort, pagination; dialog konfirmasi hapus; empty/loading state; form validasi Indonesia.
- **Selesai bila:** CRUD berjalan, validasi & toast benar, log aktivitas tercatat.

### Fase 4 — Transaksi
- Order baru: pilih layanan, tanggal, pelanggan (autocomplete nama/HP), satuan, harga, qty, total otomatis; simpan order + items dalam transaksi; nomor `LDR-YYYYMMDD-0001`.
- Daftar antrian tabel + kanban status (Masuk → Proses → Selesai, satu klik).
- Pembayaran: belum/DP/lunas, riwayat, validasi nominal.
- Pelanggan: CRUD + pencarian.
- Struk PDF thermal 58mm, 80mm, A5 via helper ekspor; header LaundryKu + profil usaha.
- Shortcut `Ctrl+N` transaksi baru; `Ctrl+K` pencarian (bila relevan).
- **Selesai bila:** alur order → status → pembayaran → struk utuh, total & sisa bayar konsisten, RBAC ditegakkan.

### Fase 5 — Pengeluaran, Laporan, Ekspor
- CRUD pengeluaran + CRUD kategori pengeluaran (kategori terpakai hanya dinonaktifkan).
- Laporan bulanan/tahunan: operasional (jumlah order, item terjual), pendapatan, pengeluaran per kategori, saldo, grafik Recharts.
- Ekspor PDF & Excel via `saveFileWithDialog`, notifikasi in-app + OS, log aktivitas, checklist §6 lulus.
- **Selesai bila:** angka layar = PDF = Excel, seluruh checklist ekspor lulus di build produksi.

### Fase 6 — Pengaturan
- Profil usaha (tampil di struk/laporan), pegawai, akun (buat akun sesuai role jabatan), ganti password.
- Log activity: filter tanggal/user/aksi, pagination.
- Backup: salin file SQLite via dialog Save As + `fs`; restore via dialog Open + konfirmasi + validasi file + restart koneksi DB.
- **Selesai bila:** backup menghasilkan file valid, restore mengembalikan data, aksi tercatat, RBAC admin-only.

### Fase 7 — Dashboard, Polishing, Rilis
- Dashboard: pendapatan hari ini, order hari ini, order belum selesai, grafik 7 hari.
- Polishing responsif, empty/loading/error state, aksesibilitas dasar, shortcut.
- Uji build produksi (`npm run tauri build`), perbaiki permission.
- Installer `.exe`/`.msi` bernama LaundryKu + ikon.
- **Selesai bila:** installer terpasang & berjalan di mesin bersih, checklist ekspor lulus, tidak ada error konsol.

---

## 8. Konvensi Kode

- TypeScript `strict: true`; **tanpa `any`**. Tipe DB di `src/db/types.ts`, DTO input Zod diturunkan dengan `z.infer`.
- Nama file komponen `PascalCase.tsx`, util `kebab-case.ts`, query per fitur `src/db/queries/<fitur>.ts`.
- Semua akses DB lewat modul query; komponen tidak menulis SQL.
- TanStack Query untuk semua data; invalidasi cache setelah mutasi; key terpusat `queryKeys`.
- Toast: `sonner`; dialog: shadcn `AlertDialog`; form error span merah di bawah field.
- Format Rupiah & tanggal hanya lewat `src/lib/format.ts` (`formatRupiah`, `formatTanggal`, `formatTanggalWaktu`).
- Error dari Rust dipetakan ke pesan Indonesia di `src/lib/api.ts`; detail teknis hanya `console.error`.
- Jangan menambah fitur di luar daftar tanpa persetujuan.
- Setiap akhir fase: update dokumen ini bila ada penyimpangan + langkah menjalankan/menguji.

---

## 9. Perintah Penting

```bash
npm install
npm run tauri dev
npm run tauri build
npx tsc --noEmit
cargo check --manifest-path src-tauri/Cargo.toml
```

---

## 10. Keputusan yang Sudah Dikonfirmasi

1. **Password admin awal** `Admin123!`.
2. **Ganti password wajib saat login pertama**: belum termasuk (tidak ada di daftar fitur) — saat ini hanya banner peringatan.
3. **Kategori pengeluaran**: dibuat **CRUD** penuh (tabel `expense_categories`); kategori yang sudah dipakai transaksi dinonaktifkan, bukan dihapus permanen.
4. **Metode pembayaran**: tunai, transfer, qris.
5. **Scope fs ekspor**: `$DOCUMENT/**`, `$DOWNLOAD/**`, `$DESKTOP/**`, `$HOME/**`; lokasi di luar scope ditolak dengan toast error yang jelas.

---

## 11. Status Implementasi

### Fase 1 — Fondasi Proyek ✅
- Scaffold Tauri 2 (`com.laundryku.app`, jendela LaundryKu 1280×820, minimum 900×600) + React 19 + TypeScript strict + Vite 8.
- Tailwind CSS v4 + komponen shadcn-style (button, card, input, label, badge, separator, skeleton, avatar, tooltip, dropdown, sheet, sonner) + lucide-react.
- Identitas: logo placeholder `WashingMachine`, ikon aplikasi kustom (`.ico`/`.png`), palet biru–tosca, tema terang/gelap/sistem persisten.
- Layout: sidebar lipat (Ctrl+B), topbar akun & logout placeholder, navigasi lengkap, responsif, footer versi.
- Database: `tauri-plugin-sql`, migrasi `0001_init` (12 tabel + index + FK) dan `0002_seed` (profil, 6 layanan, 6 kategori).
- Plugin & capability: `sql`, `dialog`, `fs` (scope terbatas), `opener`, `notification`; command `app_info`.
- Halaman: Dashboard ringkasan + grafik 7 hari (Recharts), Pengaturan pratinjau (profil, DB, tema, versi), placeholder modul lain.
- Verifikasi: `npm run typecheck`, `npm run build`, `cargo check` lulus.

### Fase 2 — Autentikasi & RBAC ✅
- Rust `auth.rs`: verifikasi **Argon2id** (`argon2` + `rand_core`), hash tidak pernah dikirim ke frontend; sesi in-memory dengan token acak 64 karakter, TTL 8 jam, pemangkasan sesi kedaluwarsa saat login/validasi.
- Seed admin otomatis hanya bila tabel `users` kosong: username `admin`, password `Admin123!`, pegawai `Administrator`; log aktivitas `create` ikut dibuat.
- Command: `login`, `logout`, `validate_session`, `log_activity`; helper `require_role` disiapkan untuk command sensitif fase berikutnya. Log `login`/`logout` tersimpan di `activity_logs`.
- Frontend: halaman login dengan pesan error Indonesia, Zustand `persist` memakai `sessionStorage`, guard `ensureSession`/`requireRole`/`redirectAuthenticated`, auto-logout saat token tidak valid/kedaluwarsa, halaman `/akses-ditolak`.
- Navigasi per role: admin melihat seluruh menu; kasir tanpa Pengeluaran/Laporan/Pengaturan; operator hanya Antrian Masuk dan Status Order. Landing operator di `/transaksi/antrian`.
- Verifikasi: login salah & benar, logout lewat menu, token palsu ditolak, sesi kedaluwarsa diarahkan ke login, kasir/operator tidak bisa membuka route terlarang; akun uji sementara sudah dihapus sehingga database kembali hanya berisi admin.
- `npm run typecheck`, `npm run build`, dan `cargo check` lulus.

### Fase 3 — Operasional ✅
- Rust `catalog.rs`: `create_item`, `update_item`, `set_item_active`, `delete_item`, `update_service`, `set_service_active`. Semua command tulis memvalidasi token/role **admin** di Rust, memakai transaksi database, dan menulis audit ke `activity_logs` dalam transaksi yang sama.
- Master Barang: CRUD dengan nama, satuan, harga, stok, dan status aktif; nama unik case-insensitive; hapus hanya untuk barang yang belum dipakai `order_items`; barang terpakai ditolak dengan pesan Indonesia dan disarankan dinonaktifkan.
- Master Layanan: CRUD penuh termasuk layanan kustom dengan kategori/kecepatan bebas (unik case-insensitive), satuan, harga, dan status aktif. Migrasi `0003_custom_services` membangun ulang `services` + `order_items`; data dan FK lama dipertahankan. Layanan yang sudah dipakai transaksi tidak dapat dihapus dan disarankan dinonaktifkan.
- Frontend: halaman `MasterBarangPage` dan `MasterLayananPage` dengan pencarian, filter status, sort, pagination 10 baris, loading skeleton, empty/error state, dialog form, dialog konfirmasi hapus, serta toast sukses/gagal.
- Form React Hook Form + Zod: validasi Indonesia untuk field wajib, panjang, harga/stok bilangan bulat, batas nominal, dan error duplikat dari backend ditampilkan inline di dialog.
- Komponen reusable baru: `dialog`, `select`, `switch`, `table`, `ActiveBadge`, `ConfirmDialog`, `TablePagination`. Kasir melihat master secara read-only; tombol tulis dan switch status tidak dirender, dan command tulis tetap menolak token kasir.
- Verifikasi: tambah/ubah/hapus/nonaktifkan barang, filter/sort/pagination, validasi kosong & duplikat, update/harga/status layanan, guard barang terpakai, RBAC kasir read-only, serta penolakan command langsung. Data uji dan akun kasir sementara sudah dibersihkan; `npm run typecheck`, `npm run build`, dan `cargo check` lulus.

### Fase 4 — Transaksi ✅
- Rust `orders.rs`: `create_order`, `update_order_status`, `record_payment`; Rust membuat nomor `LDR-YYYYMMDD-0001`, menyimpan order + item dalam satu transaksi, menghitung ulang total/subtotal, menolak layanan/barang nonaktif, dan menurunkan `payment_status` dari total pembayaran. `customers.rs`: CRUD pelanggan dengan hapus aman; order menyimpan snapshot nama/HP.
- RBAC backend: buat order, catat pembayaran, dan CRUD pelanggan hanya Admin/Kasir; ubah status boleh Admin/Kasir/Operator. Semua mutasi memakai audit log dan pesan error Indonesia.
- Frontend transaksi: form order dengan autocomplete pelanggan, pembuatan/penggunaan pelanggan otomatis, baris layanan/barang, harga editable, qty desimal, subtotal/total otomatis, dan detail order.
- Antrian tabel + kanban Status Order dengan alur Masuk → Proses → Selesai, filter/pencarian/sort/pagination, dialog pembayaran DP/pelunasan, dialog pelanggan, serta struk PDF 58 mm/80 mm/A5.
- Ekspor struk memakai `saveFileWithDialog` (Save As + `fs.writeFile`), toast dengan aksi buka file, notifikasi OS, dan log `export`; pembatalan dialog tidak menampilkan error.
- Shortcut `Ctrl+N` untuk transaksi baru (Admin/Kasir) dan `Ctrl+K` untuk pencarian pada halaman transaksi. Dashboard memakai data `payments` untuk grafik pendapatan 7 hari.
- Verifikasi: alur order → status → pembayaran → struk diuji end-to-end, termasuk auto-create/reuse pelanggan, DP/lunas, overpayment ditolak, guard layanan terpakai, RBAC admin/kasir/operator, dan ekspor PDF. Data uji dibersihkan; `npm run typecheck`, `npm run build`, dan `cargo check` lulus.

**Catatan teknis:** Vite 8 memakai minifier `oxc` (bukan esbuild); komponen shadcn ditulis langsung agar cocok dengan Tailwind v4 dan React 19; `@types/node` di-pin ke versi modern karena ExcelJS membawa dependensi tipe lama.

### Fase 5 - Pengeluaran, Laporan, Ekspor
- Rust `expenses.rs`: CRUD pengeluaran dan kategori pengeluaran dengan validasi, transaksi DB, audit, serta proteksi hard delete untuk kategori yang sudah dipakai. `reports.rs` mencatat audit ekspor laporan.
- Frontend `pengeluaran/`: daftar pengeluaran dengan pencarian, filter kategori/tanggal, sort, pagination, ringkasan total, form RHF + Zod, dan konfirmasi hapus; halaman kategori dengan switch aktif/nonaktif dan indikator pemakaian.
- Frontend `laporan/`: ringkasan bulanan/tahunan, pendapatan dari `payments.paid_at`, pengeluaran dari `expenses.expense_date`, saldo, jumlah order, item terjual, grafik Recharts, serta ekspor PDF (jsPDF/autotable) dan Excel (ExcelJS) melalui `saveFileWithDialog`.
- Verifikasi: CRUD pengeluaran/kategori, validasi, guard kategori terpakai, angka layar = PDF = Excel, pembatalan dialog, notifikasi, audit `export`, dan RBAC admin-only lulus. Data uji dan file uji dibersihkan.

### Fase 6 - Pengaturan
- Rust `settings.rs`: `update_business_profile`, `create_employee`, `update_employee`, `set_employee_active`, `delete_employee`, `create_user_account`, `update_user_account`, `set_user_account_active`, `delete_user_account`, `change_password`, `prepare_database_backup`, `finalize_database_backup`, `discard_database_backup`, `restore_database`.
- Role akun selalu diturunkan dari jabatan pegawai di Rust; satu akun per pegawai; akun sendiri dan admin aktif terakhir dilindungi; perubahan role/status menghapus sesi pengguna terkait agar role cache tidak basi.
- Frontend `pengaturan/`: lima tab (Profil & Tampilan, Pegawai, Akun, Log Aktivitas, Backup), form RHF + Zod, daftar dengan pencarian/filter/sort/pagination, dialog konfirmasi, dialog ubah password, dan filter log tanggal/pengguna/aksi/pencarian.
- Backup memakai snapshot `VACUUM INTO` + plugin `fs` + dialog Save As. Restore memakai dialog Open, konfirmasi, validasi integritas/foreign key/tabel/migrasi/admin aktif, snapshot pengaman, buka ulang pool SQLite, hapus semua sesi, audit, dan logout paksa ke halaman login.
- Verifikasi: profil, CRUD pegawai, CRUD akun, role otomatis, deaktivasi pegawai -> akun nonaktif, guard admin terakhir/akun sendiri, ganti password, filter/pagination log, backup valid, restore end-to-end + logout, penolakan file invalid, RBAC admin-only, dan penolakan command langsung lulus. Data uji dan file uji dibersihkan; `npm run typecheck`, `npm run build`, dan `cargo check` lulus.

### Fase 7 - Dashboard, Polishing, Rilis
- Dashboard final: kartu pendapatan hari ini (dari `payments`), order hari ini, order belum selesai, layanan aktif, grafik pendapatan 7 hari, Status Sistem, dan Akses Cepat sesuai role. Tidak ada query baru di luar `src/db/queries/bootstrap.ts`.
- Polishing & aksesibilitas: tautan lewati-ke-konten, fokus pindah ke `<main>` setiap perubahan pathname, judul jendela per halaman lewat `src/lib/use-document-title.ts`, error boundary route (`RouteErrorPage`) dengan pemulihan `router.invalidate()`, penjagaan shortcut saat dialog terbuka, `aria-keyshortcuts` pada kontrol `Ctrl+B`/`Ctrl+N`/`Ctrl+K`, fokus tautan yang jelas, dan `prefers-reduced-motion`.
- Versi tampilan diambil dari `package.json` melalui define Vite `__APP_VERSION__` sehingga footer, sidebar, login, dan dashboard selalu sinkron dengan versi bundle.
- Rilis: konfigurasi `bundle` di `tauri.conf.json` (produk, publisher, kategori, deskripsi, ikon) dan verifikasi `npm run tauri build` menghasilkan installer NSIS `LaundryKu_0.1.0_x64-setup.exe` serta MSI `LaundryKu_0.1.0_x64_en-US.msi`.
- Verifikasi: `npm run typecheck`, `npm run build`, `cargo check`, dan `npm run tauri build` lulus; tidak ada perubahan skema database, command Rust, atau aturan RBAC.
