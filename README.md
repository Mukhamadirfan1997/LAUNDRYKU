# LaundryKu

**Kelola laundry, catat kas, tanpa ribet.**

Aplikasi desktop offline-first untuk manajemen keuangan usaha laundry.
Dibangun dengan **Tauri 2 + React + TypeScript + Vite + Tailwind CSS + SQLite**.

> Status saat ini: **Fase 7 - Dashboard, Polishing, Rilis** selesai.
> Seluruh fase pada `DOKUMEN-ACUAN.md` sudah dikerjakan. Installer resmi
> **LaundryKu 1.0.0** (NSIS `.exe` dan MSI `.msi`) sudah berhasil dibangun.

---

## Prasyarat

- Node.js **20.19+** (diuji dengan Node 24)
- Rust **1.90+** (diuji dengan Rust 1.97)
- Windows: WebView2 Runtime (umumnya sudah terpasang di Windows 10/11)
- Build Tools Visual Studio (C++) untuk kompilasi Rust di Windows

## Menjalankan

```bash
npm install
npm run tauri dev
```

Perintah lain:

```bash
npm run typecheck                              # cek TypeScript strict
npm run build                                  # build frontend ke dist/
npm run tauri build                            # installer produksi (.exe/.msi)
cargo check --manifest-path src-tauri/Cargo.toml
```

## Fase 1 — Yang Sudah Ada

- Identitas **LaundryKu** di judul jendela, logo placeholder, tagline, dan ikon aplikasi.
- Palet biru–tosca dengan aksen hijau/merah; **mode terang, gelap, dan ikuti sistem**.
- Layout sidebar lipat (Ctrl+B), topbar dengan info akun, dan navigasi seluruh menu.
- Halaman placeholder untuk setiap modul + dashboard ringkasan awal.
- **SQLite** via `tauri-plugin-sql` dengan migrasi berurutan:
  - `0001_init.sql` — 12 tabel, foreign key, CHECK, dan index.
  - `0002_seed.sql` — profil usaha, 6 layanan, 6 kategori pengeluaran.
- Plugin Tauri terpasang beserta capability: `sql`, `dialog`, `fs`, `opener`, `notification`.
- Command Rust `app_info` untuk versi, identifier, dan lokasi database.
- Reusable UI: tombol, card, badge, input, dropdown, sheet, tooltip, empty state.
- Format Rupiah & tanggal Indonesia terpusat di `src/lib/format.ts`.
- TanStack Router + TanStack Query + Zustand + Recharts sudah terpasang dan dipakai.

## Fase 2 — Yang Sudah Ada

- Halaman login asli dengan validasi, pesan error berbahasa Indonesia, dan tombol tampil/sembunyi password.
- Password di-hash **Argon2id** di Rust; hash tidak pernah dikirim ke frontend.
- Sesi in-memory berlaku **8 jam**, token acak divalidasi ulang ke Rust, dan frontend menyimpan sesi di `sessionStorage`.
- Sesi tidak valid/kedaluwarsa otomatis mengembalikan pengguna ke halaman login.
- Seed admin otomatis **hanya jika tabel `users` kosong**.
- RBAC dua lapis: guard route TanStack Router + filter menu sidebar + helper `require_role` di Rust untuk command sensitif fase berikutnya.
- Halaman `/akses-ditolak`; landing admin/kasir di Dashboard, operator di Antrian.
- Log `login` dan `logout` tersimpan di tabel `activity_logs`.

## Fase 3 — Yang Sudah Ada

- **Master Barang**: tambah, ubah, cari, filter status, urutkan, dan pagination.
  Barang dapat dinonaktifkan tanpa menghapus riwayat. Barang yang belum dipakai
  transaksi boleh dihapus dengan dialog konfirmasi; barang yang sudah dipakai
  ditandai **Hapus (dipakai)** dan ditolak oleh Rust.
- **Master Layanan**: CRUD penuh untuk layanan kustom (kategori + kecepatan),
  satuan, harga, dan status aktif/nonaktif. Layanan yang sudah dipakai transaksi
  tidak dapat dihapus; nonaktifkan agar riwayat tetap utuh. Migrasi
  `0003_custom_services.sql` membangun ulang `services` dan `order_items` agar
  kategori/kecepatan tidak lagi dibatasi enam nilai seed.
- Form memakai React Hook Form + Zod dengan pesan validasi Bahasa Indonesia,
  error dari backend ditampilkan di dalam dialog, dan toast sukses untuk setiap
  perubahan.
- Tabel reusable dengan loading skeleton, empty state, error state, pencarian,
  filter, sort, dan pagination; dialog form serta konfirmasi hapus.
- Command Rust baru di `catalog.rs`: `create_item`, `update_item`,
  `set_item_active`, `delete_item`, `create_service`, `update_service`,
  `delete_service`, `set_service_active`. Semua command menulis master hanya
  untuk **Admin**, memvalidasi token/role di Rust, memakai transaksi database,
  dan mencatat `activity_logs`.
- Kasir tetap dapat membaca master barang/layanan, tetapi tombol tambah, ubah,
  hapus, dan switch status disembunyikan; percobaan memanggil command tulis
  secara langsung ditolak.
- Komponen UI baru: `dialog`, `select`, `switch`, `table`, `ActiveBadge`,
  `ConfirmDialog`, dan `TablePagination`.

## Fase 4 — Yang Sudah Ada

- **Transaksi baru** (`/transaksi/baru`): pelanggan lama dapat dicari lewat
  autocomplete nama/HP, atau pelanggan baru dibuat otomatis dari nama + HP.
  Nomor order berformat `LDR-YYYYMMDD-0001`, tanggal order, catatan, layanan
  dan barang tambahan, harga per baris yang dapat disesuaikan, qty desimal
  untuk layanan berbasis berat, subtotal, dan total otomatis.
- Nomor order dihitung di Rust dan seluruh order + item disimpan dalam satu
  transaksi database. Total dihitung ulang di server; master nonaktif dan
  layanan/barang yang tidak valid ditolak.
- **Antrian Masuk**: tabel order dengan pencarian, filter status/pembayaran,
  sort, pagination, detail order, aksi ubah status, pembayaran, dan struk.
- **Status Order**: papan kanban tiga kolom dengan aksi satu klik
  Masuk → Proses → Selesai. Semua role yang berwenang dapat mengubah status;
  pembayaran, transaksi baru, dan pelanggan hanya untuk Admin/Kasir.
- **Pembayaran**: nominal bebas untuk DP atau pelunasan, metode tunai/transfer/
  QRIS, riwayat pembayaran, dan status `belum_bayar`/`dp`/`lunas` yang dihitung
  di Rust. Nominal nol, negatif, dan melebihi sisa tagihan ditolak.
- **Data Pelanggan**: CRUD, pencarian, detail jumlah order, dan hapus aman.
  Pelanggan yang masih terhubung ke order tidak dihapus paksa; order tetap
  menyimpan snapshot nama/HP.
- **Struk PDF**: thermal 58 mm, thermal 80 mm, dan A5 dengan profil usaha.
  Ekspor memakai dialog **Save As**, `fs.writeFile`, toast dengan aksi
  **Buka file**, notifikasi sistem, dan log aktivitas `export`. Membatalkan
  dialog tidak menampilkan error.
- **Shortcut**: `Ctrl+N` membuka transaksi baru untuk Admin/Kasir; `Ctrl+K`
  memfokuskan pencarian pada halaman Antrian/Status/Pelanggan.
- **Dashboard**: grafik Pendapatan 7 Hari Terakhir kini diambil dari tabel
  `payments` (bukan placeholder) dan mengikuti filter tanggal lokal.
- Command Rust baru: `customers.rs` (CRUD pelanggan) dan `orders.rs`
  (buat order, ubah status, catat pembayaran). Semua command memeriksa
  token/role di Rust dan menulis audit dalam transaksi yang sama.

## Fase 5 - Yang Sudah Ada

- **Pengeluaran** (`/pengeluaran`): CRUD pengeluaran dengan tanggal, kategori,
  keterangan, dan nominal. Daftar memiliki pencarian, filter kategori, rentang
  tanggal, sort, pagination, ringkasan total, serta dialog konfirmasi hapus.
- **Kategori Pengeluaran** (`/pengeluaran/kategori`): CRUD kategori, switch
  aktif/nonaktif, pencarian, filter status, sort, dan indikator jumlah
  pemakaian. Kategori yang sudah dipakai tidak dapat dihapus; UI menonaktifkan
  aksi hapus dan Rust tetap menolak percobaan langsung.
- **Laporan** (`/laporan`): laporan bulanan dan tahunan berisi pendapatan
  diterima, pengeluaran, saldo, jumlah order, order selesai, nilai order, item
  terjual, rincian pengeluaran per kategori, dan grafik tren Recharts.
  Pendapatan dihitung dari `payments.paid_at`; pengeluaran dari
  `expenses.expense_date`; angka operasional dari `orders.order_date`.
- **Ekspor laporan**: PDF (jsPDF + autotable) dan Excel (ExcelJS, dua sheet)
  memakai dialog **Save As** + `fs.writeFile`, loading/disabled saat proses,
  toast dengan aksi **Buka file** dan **Buka folder**, notifikasi sistem, serta
  log aktivitas `export` lewat command Rust admin-only.
- Command Rust baru: `expenses.rs` (CRUD pengeluaran/kategori, validasi,
  transaksi DB, audit) dan `reports.rs` (audit ekspor). Keduanya hanya untuk
  **Admin** dan memeriksa token/role kembali di Rust. Tidak ada migrasi baru;
  tabel `expenses` dan `expense_categories` dari `0001_init.sql` dipakai ulang.

## Fase 6 - Yang Sudah Ada

- **Profil & Tampilan** di `/pengaturan`: nama usaha, nama pemilik, telepon,
  alamat, pilihan tema terang/gelap/ikuti sistem, informasi versi aplikasi,
  lokasi file database, dan ukuran database. Perubahan profil langsung dipakai
  oleh struk, laporan, dan dashboard.
- **Pegawai**: tambah, ubah, cari, filter jabatan/status, urutkan, pagination,
  serta aktif/nonaktif. Jabatan (`Admin`, `Kasir`, `Operator`) menentukan role
  akun login. Pegawai yang masih memiliki akun tidak dapat dihapus; pegawai
  yang terhubung dengan akun sendiri tidak dapat dinonaktifkan atau diubah
  jabatannya. Admin aktif terakhir dilindungi dari penonaktifan/penghapusan.
- **Akun**: satu akun per pegawai, pembuatan akun dengan role otomatis dari
  jabatan, ubah username/pegawai, aktif/nonaktif, dan hapus dengan konfirmasi.
  Menonaktifkan pegawai ikut menonaktifkan akunnya; mengaktifkan kembali
  pegawai tidak otomatis mengaktifkan akun. Akun nonaktif tidak dapat
  diaktifkan selama pegawainya nonaktif.
- **Ganti password** lewat **Akun -> Ubah Password Saya**: verifikasi password
  lama, kebijakan 8-72 karakter dengan huruf besar, huruf kecil, dan angka,
  hashing Argon2id di Rust, serta audit log.
- **Log Aktivitas**: filter rentang tanggal, pengguna, aksi, pencarian,
  validasi rentang tanggal, refresh, dan pagination 10 baris. Aksi baru
  `backup`/`restore` ikut tercatat.
- **Backup**: snapshot SQLite konsisten dibuat di Rust dengan `VACUUM INTO`,
  dibaca lewat plugin `fs`, lalu disimpan melalui dialog **Save As** dengan
  nama `LaundryKu-Backup-YYYY-MM-DD-HHmm.db`. Toast menyediakan aksi buka file
  atau folder, notifikasi sistem, dan audit log. Membatalkan dialog tidak
  menampilkan error.
- **Restore**: pilih file lewat dialog **Open**, konfirmasi, lalu Rust
  memvalidasi integritas SQLite, foreign key, tabel wajib, versi migrasi, dan
  keberadaan minimal satu admin aktif. Sebelum menimpa, snapshot pengaman
  dibuat. Setelah berhasil, koneksi database dibuka ulang, semua sesi dihapus,
  aktivitas `restore` dicatat, dan frontend kembali ke halaman login.
- Command Rust baru di `settings.rs`: profil usaha, CRUD pegawai, CRUD akun,
  ganti password, backup, dan restore. Semua command pengaturan memeriksa
  token/role **Admin** di Rust (kecuali ganti password untuk pengguna yang
  login), memakai transaksi DB, dan menulis audit. Tidak ada migrasi baru.

## Fase 7 - Yang Sudah Ada

- **Dashboard final** di `/`: empat kartu ringkas (pendapatan hari ini dari
  tabel `payments`, order hari ini, order belum selesai, layanan aktif),
  grafik **Pendapatan 7 Hari Terakhir** dari pembayaran lokal, Status Sistem
  (database, profil usaha, master layanan, versi aplikasi, lokasi database),
  dan Akses Cepat yang mengikuti role.
- **Polishing & aksesibilitas**:
  - Tautan **Lewati ke konten utama** dan fokus otomatis ke area konten saat
    pindah halaman.
  - Judul jendela mengikuti halaman aktif (`Dashboard · LaundryKu`, dst.).
  - Batas kesalahan route dengan pesan Indonesia, tombol **Coba lagi**, dan
    jalan kembali ke halaman utama; detail teknis hanya di konsol.
  - Shortcut `Ctrl+B`, `Ctrl+N`, dan `Ctrl+K` tidak aktif saat dialog terbuka;
    atribut `aria-keyshortcuts` menandai kontrol terkait.
  - Fokus keyboard selalu terlihat pada tautan, animasi menghormati
    `prefers-reduced-motion`, dan dialog/Sheet selalu punya judul aksesibel.
  - Versi aplikasi di footer, sidebar, halaman login, dan dashboard diambil dari
    `package.json` saat build agar tidak pernah tertinggal.
- **Rilis 1.0.0**: konfigurasi bundle Tauri lengkap (nama produk,
  publisher, homepage, kategori, deskripsi, ikon, dan lisensi). Installer
  NSIS memakai mode **semua pengguna** (Program Files), bahasa Indonesia,
  halaman lisensi EULA (`src-tauri/installer/LICENSE.rtf`), ikon
  installer/uninstaller, serta header dan sidebar bermerek; MSI memakai banner
  dan dialog bermerek. `npm run tauri build` menghasilkan
  `LaundryKu_1.0.0_x64-setup.exe` dan `LaundryKu_1.0.0_x64_en-US.msi`.
  Aset grafis installer dibuat oleh `src-tauri/installer/generate-assets.ps1`
  dan teks EULA dapat diedit di `src-tauri/installer/LICENSE.txt` lalu
  diregenerasi ke `LICENSE.rtf`.
  Installer belum ditandatangani secara digital, sehingga Windows SmartScreen
  dapat menampilkan peringatan saat pertama kali dijalankan; menghilangkannya
  memerlukan sertifikat *code signing*.

### Akun awal

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin123!` | Admin |

Akun dibuat otomatis saat database masih kosong. Setelah login, ganti password bawaan melalui **Pengaturan -> Akun -> Ubah Password Saya** sebelum aplikasi dipakai untuk data produksi.

## Lokasi Database

Windows:

```text
%APPDATA%\com.laundryku.app\laundryku.db
```

Lokasi persis juga ditampilkan di **Pengaturan → Database Lokal** dan pada kartu
**Status Sistem** di Dashboard.

Untuk mengulang dari database kosong: tutup aplikasi, hapus file
`laundryku.db`, lalu jalankan ulang. Migrasi dan seed akan dibuat otomatis.

## Checklist Uji Fase 1

- [ ] `npm run tauri dev` membuka jendela berjudul **LaundryKu**.
- [ ] Sidebar bisa dilipat dan tetap nyaman di jendela kecil.
- [ ] Tombol tema mengganti terang/gelap dan tersimpan setelah restart.
- [ ] Dashboard menampilkan nama usaha dan **Status Sistem: Terhubung & siap**.
- [ ] Pengaturan menampilkan lokasi file database.
- [ ] Tabel `services` berisi 6 layanan, `expense_categories` 6 kategori.
- [ ] `npm run typecheck`, `npm run build`, dan `cargo check` lulus tanpa error.

## Checklist Uji Fase 2

- [ ] `npm run tauri dev` menampilkan halaman login.
- [ ] Login `admin` / `Admin123!` berhasil dan masuk ke Dashboard dengan nama **Administrator / Admin**.
- [ ] Password salah menampilkan pesan Indonesia dan tetap di halaman login.
- [ ] Menu admin lengkap: Dashboard, Master Barang, Master Layanan, Antrian Masuk, Status Order, Data Pelanggan, Pengeluaran, Laporan, Pengaturan.
- [ ] Klik avatar → **Keluar** kembali ke halaman login.
- [ ] Tutup lalu buka kembali aplikasi → diminta login lagi (sesi Rust in-memory).
- [ ] Tabel `activity_logs` mencatat aksi `login` dan `logout`.
- [ ] `npm run typecheck`, `npm run build`, dan `cargo check` lulus tanpa error.

RBAC kasir/operator sudah diverifikasi dengan akun uji sementara: kasir tidak melihat Pengeluaran/Laporan/Pengaturan, operator hanya melihat Antrian/Status dan diarahkan ke `/transaksi/antrian`, serta route terlarang diarahkan ke `/akses-ditolak`. Akun uji tersebut sudah dihapus agar database kembali hanya berisi admin.

## Checklist Uji Fase 3

- [ ] Login admin, buka **Master Barang**, lalu tambah barang dengan nama, satuan, stok, dan harga.
- [ ] Ubah barang lewat menu aksi; perubahan harga/stok langsung tampil di tabel.
- [ ] Nonaktifkan/aktifkan barang lewat switch status.
- [ ] Cari barang, filter **Aktif/Nonaktif**, urutkan harga/nama/stok, dan pindah halaman pagination.
- [ ] Hapus barang yang belum dipakai transaksi melalui dialog konfirmasi.
- [ ] Barang yang sudah dipakai transaksi menampilkan **Hapus (dipakai)** dan tidak bisa dihapus.
- [ ] Buka **Master Layanan**, ubah satuan/harga, lalu nonaktifkan dan aktifkan kembali layanan.
- [ ] Isi form dengan data kosong, harga bertitik, atau nama barang duplikat → muncul pesan validasi Indonesia.
- [ ] Login sebagai kasir → Master Barang/Layanan hanya bisa dibaca (tanpa tombol tambah/ubah/hapus/switch).
- [ ] Tabel `activity_logs` mencatat `create`, `update`, dan `delete` dari aksi master.
- [ ] `npm run typecheck`, `npm run build`, dan `cargo check` lulus tanpa error.

Verifikasi Fase 3 memakai akun kasir sementara dan data uji; semuanya sudah dibersihkan sehingga database kembali hanya berisi admin, 6 layanan awal, dan tanpa barang/transaksi uji.

## Checklist Uji Fase 4

- [ ] Login admin, buka **Transaksi Baru** (`Ctrl+N` juga bisa), lalu pilih layanan.
- [ ] Isi pelanggan baru dengan nama + HP, atur qty desimal dan harga, lalu simpan. Order baru muncul di Antrian dengan nomor `LDR-YYYYMMDD-0001`.
- [ ] Ulangi dengan HP pelanggan yang sama → pelanggan lama digunakan kembali, bukan dibuat ganda.
- [ ] Ubah status lewat detail atau papan **Status Order**: Masuk → Proses → Selesai; toast muncul dan kolom kanban berpindah.
- [ ] Catat pembayaran sebagian → status menjadi **DP**, sisa tagihan berkurang; catat pelunasan → status **Lunas**.
- [ ] Coba nominal nol/negatif/melebihi sisa → ditolak dengan pesan Indonesia.
- [ ] Coba hapus pelanggan yang masih memiliki order → data order tetap utuh (snapshot nama/HP dipertahankan).
- [ ] Buka **Struk**, pilih 58 mm/80 mm/A5, klik **Unduh PDF**, simpan lewat Save As, lalu buka file dari aksi toast. Batalkan dialog sekali → tidak ada error.
- [ ] Pastikan `activity_logs` mencatat `create` order, `payment`, `status_change`, dan `export`.
- [ ] Login kasir → boleh membuat order/mencatat pembayaran, tetapi Master Layanan hanya baca. Login operator → hanya boleh mengubah status; command order/payment/master ditolak.
- [ ] `Ctrl+K` memfokuskan pencarian di Antrian/Status/Pelanggan; grafik 7 hari Dashboard sesuai total pembayaran.
- [ ] `npm run typecheck`, `npm run build`, dan `cargo check` lulus tanpa error.

Verifikasi Fase 4 memakai data uji dan akun sementara; semuanya sudah dibersihkan sehingga database kembali berisi admin, 6 layanan seed, tanpa order/pelanggan/pembayaran uji.

## Checklist Uji Fase 5

- [ ] Login admin, buka **Pengeluaran**, lalu catat pengeluaran baru dengan tanggal, kategori, keterangan, dan nominal.
- [ ] Cari, filter kategori, filter rentang tanggal, ubah urutan, dan pindah halaman; ringkasan total mengikuti filter.
- [ ] Ubah dan hapus pengeluaran lewat menu aksi; dialog konfirmasi muncul dan toast sukses tampil.
- [ ] Buka **Kategori**, tambah kategori, nonaktifkan/aktifkan lewat switch, lalu pastikan kategori nonaktif hilang dari pilihan form pengeluaran baru.
- [ ] Hapus kategori yang belum dipakai; kategori yang sudah dipakai menampilkan **Hapus (sudah dipakai)** dan ditolak oleh Rust.
- [ ] Buka **Laporan**, bandingkan angka layar dengan data pembayaran/pengeluaran; ganti **Bulanan/Tahunan** dan pastikan grafik serta angka berubah.
- [ ] Unduh **PDF** dan **Excel**, simpan lewat Save As, lalu coba aksi **Buka file** dan **Buka folder**. Batalkan dialog sekali -> tidak ada error.
- [ ] Pastikan nama file mengikuti periode, isi PDF/Excel sama dengan layar, notifikasi muncul, dan `activity_logs` mencatat `export`.
- [ ] Login sebagai kasir sementara -> Pengeluaran/Laporan tidak dapat dibuka; panggilan command pengeluaran/ekspor langsung ditolak Rust.
- [ ] `npm run typecheck`, `npm run build`, dan `cargo check` lulus tanpa error.

Verifikasi Fase 5 memakai data uji dan akun kasir sementara; data uji, file uji, dan log uji sudah dibersihkan sehingga database kembali berisi admin, 6 layanan seed, dan 6 kategori pengeluaran tanpa transaksi uji.

## Checklist Uji Fase 6

- [ ] Login admin, buka **Pengaturan -> Profil & Tampilan**, ubah nama pemilik/telepon/alamat, simpan, lalu pastikan struk dan laporan memakai data baru.
- [ ] Ganti tema terang/gelap/ikuti sistem; pilihan tetap tersimpan setelah aplikasi dibuka kembali.
- [ ] Buka **Pegawai**, tambah pegawai Kasir/Operator, ubah data, cari, filter jabatan/status, urutkan, dan pindah halaman.
- [ ] Coba nonaktifkan pegawai sendiri, hapus pegawai yang masih punya akun, dan ubah jabatan akun sendiri -> aksi dicegah dengan pesan jelas.
- [ ] Buka **Akun**, buat akun untuk pegawai baru; role otomatis mengikuti jabatan. Coba username duplikat dan password lemah -> ditolak.
- [ ] Nonaktifkan pegawai -> akunnya ikut nonaktif. Aktifkan pegawai kembali -> akun tetap nonaktif sampai diaktifkan manual; percobaan aktivasi saat pegawai masih nonaktif ditolak.
- [ ] Login sebagai kasir/operator sementara -> menu **Pengaturan** tidak tersedia, route langsung ke `/pengaturan` diarahkan ke `/akses-ditolak`, dan command profil/pegawai/akun/backup langsung ditolak Rust.
- [ ] Buka **Akun -> Ubah Password Saya**, coba password lama salah, password baru lemah, dan konfirmasi tidak cocok -> muncul pesan Indonesia. Ganti password lalu login ulang dengan password baru.
- [ ] Buka **Log Aktivitas**, filter tanggal, pengguna, aksi, dan pencarian; coba rentang tanggal terbalik -> pesan validasi. Pindah halaman dan segarkan data.
- [ ] Buka **Backup**, simpan cadangan lewat Save As, batalkan dialog sekali, lalu buka file cadangan dan pastikan SQLite valid serta berisi data terbaru.
- [ ] Buka **Restore**, pilih file cadangan, baca konfirmasi, lalu pulihkan. Pastikan data kembali, file lama diganti, semua sesi berakhir, aplikasi kembali ke login, dan log `restore` tercatat.
- [ ] Coba restore dengan file bukan database/rusak -> ditolak dan database lama tetap utuh.
- [ ] `npm run typecheck`, `npm run build`, dan `cargo check` lulus tanpa error.

## Checklist Uji Fase 7

- [ ] `npm run tauri dev` membuka Dashboard dengan empat kartu ringkas; angka
      pendapatan hari ini, order hari ini, dan order belum selesai sesuai data
      transaksi.
- [ ] Grafik **Pendapatan 7 Hari Terakhir** berubah setelah pembayaran dicatat
      dan total badge sama dengan jumlah titik grafik.
- [ ] Tekan `Tab` dari awal halaman: tautan **Lewati ke konten utama** muncul,
      dapat diaktifkan, dan memindahkan fokus ke area konten.
- [ ] Judul jendela berubah mengikuti menu (mis. `Master Barang · LaundryKu`)
      dan kembali ke `Masuk · LaundryKu` setelah logout.
- [ ] `Ctrl+B`, `Ctrl+N`, dan `Ctrl+K` berfungsi; `Ctrl+N` tidak berpindah
      halaman saat dialog sedang terbuka.
- [ ] Buka dialog lalu tutup dengan `Esc`; fokus kembali ke tombol pemicu dan
      tidak ada error di konsol.
- [ ] Perkecil jendela hingga lebar minimum: sidebar berubah menjadi Sheet,
      tabel tetap dapat digeser horizontal, dan tombol tidak terpotong.
- [ ] Matikan animasi lewat pengaturan aksesibilitas Windows; transisi dan
      animasi aplikasi ikut berkurang.
- [ ] `npm run typecheck`, `npm run build`, dan `cargo check` lulus tanpa error.
- [x] Jalankan `npm run tauri build`; installer selesai dibuat dengan nama
      `LaundryKu_1.0.0_x64-setup.exe` dan `LaundryKu_1.0.0_x64_en-US.msi`
      (sudah diverifikasi pada build 1.0.0).
- [ ] Buka installer: tampil header/sidebar bermerek LaundryKu, ikon aplikasi,
      bahasa Indonesia, dan halaman lisensi; instalasi meminta izin
      Administrator lalu memasang ke Program Files.
- [ ] Pasang installer di mesin bersih: aplikasi terbuka dengan ikon dan nama
      **LaundryKu**, login `admin` berhasil, data tetap ada setelah restart,
      dan entri **LaundryKu** muncul di Start Menu serta Apps & Features.

## Struktur Singkat

```text
src/
  components/    # UI shadcn-style, layout, brand, feedback
  features/      # halaman per fitur (auth, dashboard, operasional, transaksi,
                 # pengeluaran, laporan, pengaturan, errors)
  db/            # client SQLite, query, tipe entitas
  lib/           # format, api, util, receipt-pdf, report-pdf, report-excel,
                 # use-document-title
  stores/        # Zustand: tema & sidebar
src-tauri/
  migrations/    # 0001_init.sql, 0002_seed.sql, 0003_custom_services.sql
  src/           # lib.rs, main.rs, auth.rs, catalog.rs, customers.rs,
                 # orders.rs, expenses.rs, reports.rs, settings.rs
  capabilities/  # izin plugin Tauri
  installer/     # aset NSIS/WiX, EULA, generate-assets.ps1
  icons/         # ikon aplikasi dan installer
```

Dokumen acuan lengkap: [`DOKUMEN-ACUAN.md`](./DOKUMEN-ACUAN.md).
Catatan rilis: [`CATATAN-RILIS.md`](./CATATAN-RILIS.md).
