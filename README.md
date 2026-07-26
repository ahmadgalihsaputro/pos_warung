# POS Warung — Multi-Tenant PWA

Refactor dari single-file Apps Script (React di dalam HtmlService) menjadi frontend
statis terpisah (installable PWA) + backend Apps Script per warung + Registry pusat
untuk multi-tenant. Tidak ada fitur yang diubah/dihapus — hanya dipisah strukturnya.

## Struktur

```
project/
  frontend/
    index.html
    style.css
    app.js
    api.js
    config.js
    manifest.json
    service-worker.js
    assets/            <- kamu perlu isi sendiri (lihat bagian Assets)
  backend/
    Code.gs
    Api.gs
    Database.gs
  Registry.gs           <- PROJECT APPS SCRIPT TERPISAH (lihat bagian Registry)
  README.md
```

## Cara kerja multi-tenant

1. Setiap warung tetap punya Google Sheet + deployment Apps Script sendiri
   (`Code.gs` + `Api.gs` + `Database.gs` — persis 3 file di folder `backend/`).
2. Ada **satu** Apps Script terpisah bernama Registry (`Registry.gs`, file ini
   TIDAK ikut di-deploy bersama backend warung) yang isinya cuma daftar
   "Kode Warung -> URL Apps Script warung tersebut".
3. Frontend (`index.html` dkk di `frontend/`) hanya ada **satu**, di-hosting sekali
   di mana saja (GitHub Pages / Firebase Hosting / Netlify / dsb — asal HTTPS,
   wajib untuk PWA & Service Worker).
4. Saat pertama kali dibuka, user diminta memasukkan Kode Warung. Frontend
   bertanya ke Registry, dapat URL Apps Script warung tsb, simpan ke Local
   Storage. Sejak itu semua request langsung ke Apps Script warung itu.

## Setup Registry (sekali saja, di awal)

1. Buat Google Sheet baru, buat sheet bernama `Registry` dengan header:
   `ID | Kode Warung | Nama Warung | API URL | Aktif | Dibuat`
2. Buat Apps Script project baru (terpisah dari backend warung manapun), tempel
   isi `Registry.gs`.
3. Ganti `REGISTRY_ADMIN_KEY` di `Registry.gs` dengan kunci rahasiamu sendiri.
4. Deploy > New deployment > **Web app** > Execute as: **Me** > Who has access: **Anyone**.
5. Salin URL deployment, tempel ke `CONFIG.REGISTRY_URL` di `frontend/config.js`.

## Setup backend per warung (diulang untuk setiap warung baru — bisa dilakukan sendiri oleh pemilik toko)

1. Buka **Sheet Template** (Sheet yang sudah ada script Code.gs/Api.gs/Database.gs-nya) → **File → Make a copy**.
2. Buka **Extensions → Apps Script** di Sheet hasil copy → **Deploy → New deployment** → Web app
   → Execute as: **Me**, Who has access: **Anyone** → Deploy. Salin URL-nya (berakhir `/exec`).
3. Jalankan `setupDemoData()` lewat editor Apps Script (Run) untuk isi akun admin awal
   — **jangan** dijalankan lagi setelah data asli mulai diisi, karena fungsi ini menghapus
   semua sheet. Fungsi ini juga sengaja tidak masuk whitelist `ACTIONS` di `Code.gs` (tidak
   bisa dipanggil dari luar/publik).
4. Buka web app frontend → pilih **"Daftarkan warung di sini"** di layar onboarding →
   isi Nama Warung, buat Kode Warung sendiri (mis. `TKB001`), tempel URL dari langkah 2.
   Registry otomatis memvalidasi URL itu (mengetuk baliknya) sebelum menyimpan — tidak perlu
   `adminKey` lagi untuk langkah ini.
5. Kalau mau isi manual tanpa lewat form (opsional), tetap bisa tambah barisnya langsung
   di Google Sheet Registry: `Kode Warung | Nama Warung | API URL | Aktif=1 | Dibuat`.

## Setup frontend

1. Isi `CONFIG.REGISTRY_URL` di `config.js` dengan URL Registry.
2. Buat folder `assets/` dan isi ikon PWA (lihat bagian Assets di bawah).
3. Upload seluruh isi `frontend/` ke hosting statis pilihanmu (harus HTTPS).
4. Buka URL-nya di HP/laptop → browser akan menawarkan "Install App" / "Add to Home Screen".

## Assets (perlu kamu siapkan sendiri)

Service worker & manifest mengharapkan file-file ini ada di `frontend/assets/`:
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `icon-maskable-192.png` & `icon-maskable-512.png` (ikon dengan padding aman untuk Android adaptive icon)

Saya tidak bisa membuat file gambar biner di respons chat ini — silakan export dari
CorelDRAW/Inkscape (yang sudah biasa kamu pakai) dengan ukuran di atas.

## Migrasi ke Firebase/Supabase/MySQL di masa depan

Karena `app.js` HANYA memanggil `API.xxx()` (tidak pernah fetch/google.script.run
langsung), migrasi nanti cukup dengan mengganti isi `api.js` (dan tentu backend-nya)
tanpa menyentuh `app.js` sama sekali — sesuai tujuan awal project ini.

## Technical debt yang sengaja belum dibereskan (lihat komentar di app.js)

Banyak komponen masih pakai inline `style={{...}}` di JSX (perilaku asli dari kode
lama, bukan hal baru). Membersihkannya ke class CSS murni butuh sesi refactor
tersendiri per halaman supaya risikonya kecil — beri tahu saya kalau mau lanjut ke situ.