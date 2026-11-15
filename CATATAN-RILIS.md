# Catatan Rilis LaundryKu 1.0.0

Tanggal rilis: **15 November 2026**
Status: **selesai dibangun dan diverifikasi**

## Artefak installer

| Berkas | Ukuran | SHA-256 |
|---|---:|---|
| `src-tauri/target/release/bundle/nsis/LaundryKu_1.0.0_x64-setup.exe` | 4,52 MB | `43551fd92380554041aa1d9949b2a2d1419f245c7f1d5d8da62c6297b80f3738` |
| `src-tauri/target/release/bundle/msi/LaundryKu_1.0.0_x64_en-US.msi` | 6,68 MB | `017b05efc6cf6b50e1dcf432c8096c5d39f154c9f22560be683897d949d3be19` |

Installer lama versi 0.1.0 sudah dihapus dari folder bundle.

## Identitas aplikasi

- **Nama produk**: LaundryKu
- **Versi**: 1.0.0 (`package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`)
- **Publisher / CompanyName**: LaundryKu
- **Copyright**: Copyright © 2026 LaundryKu
- **Identifier**: `com.laundryku.app`
- **Homepage**: https://github.com/Mukhamadirfan1997/LAUNDRYKU
- **Kategori**: Business
- **Lisensi**: proprietary (`LicenseRef-Proprietary`)

## Branding installer

- **NSIS**
  - Mode instalasi: `perMachine` (Program Files, meminta izin Administrator)
  - Bahasa: Indonesia
  - Halaman lisensi EULA
  - Ikon installer dan uninstaller
  - Header 150×57 dan sidebar 164×314 bermerek
  - Folder Start Menu `LaundryKu`
  - Opsi shortcut desktop dan langsung menjalankan aplikasi
- **MSI/WiX**
  - Banner 493×58 dan dialog 493×312 bermerek
  - Lisensi RTF
- **Aset sumber**
  - `src-tauri/installer/nsis-header.bmp`
  - `src-tauri/installer/nsis-sidebar.bmp`
  - `src-tauri/installer/wix-banner.bmp`
  - `src-tauri/installer/wix-dialog.bmp`
  - `src-tauri/installer/LICENSE.txt` (teks sumber EULA)
  - `src-tauri/installer/LICENSE.rtf` (dipakai installer)
  - `src-tauri/installer/generate-assets.ps1` (regenerasi aset grafis)

## Hasil verifikasi

- `npm run typecheck`, `npm run build`, dan `npm run tauri build` lulus.
- Metadata MSI dibaca langsung dari database MSI:
  - `ProductName = LaundryKu`
  - `ProductVersion = 1.0.0`
  - `Manufacturer = LaundryKu`
  - `ALLUSERS = 1`
- `laundryku.exe` ber-versi 1.0.0 dengan CompanyName LaundryKu.
- Script NSIS hasil build mengonfirmasi `perMachine`, `RequestExecutionLevel admin`,
  halaman lisensi, header/sidebar, ikon, dan bahasa Indonesia.
- Vite hanya memberi peringatan ukuran chunk; tidak menggagalkan build.

## Catatan penting

- Installer **belum ditandatangani secara digital**, sehingga Windows SmartScreen
  dapat menampilkan peringatan saat pertama kali dijalankan. Menghilangkannya
  memerlukan sertifikat *code signing*.
- Sebagian pesan khusus Tauri (misalnya kegagalan WebView2) masih berbahasa
  Inggris; teks utama installer sudah berbahasa Indonesia.
- Uji instalasi pada mesin bersih dan uji login setelah instalasi belum
  dijalankan otomatis pada rilis ini; langkahnya tersedia di checklist
  `README.md`.

## Membangun ulang

```bash
npm install
npm run tauri build
```

## Regenerasi aset installer

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File src-tauri/installer/generate-assets.ps1
```

## Riwayat Git

- Commit rilis: `d635844` — "Rilis 1.0.0: branding installer resmi, EULA, dan mode per-machine"
- Tag: `v1.0.0`
- Repo: https://github.com/Mukhamadirfan1997/LAUNDRYKU
