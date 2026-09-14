# CashFlow — Progressive Web App

Aplikasi pencatatan keuangan pribadi (Buku Kas) yang diubah menjadi **Progressive Web App (PWA)** berbasis React + Vite.

## Fitur

- ✅ Dashboard, Transaksi, Kategori, Ringkasan Keuangan
- ✅ Grafik (Recharts): bar, pie, line
- ✅ CRUD transaksi + filter + pencarian + sorting
- ✅ Manajemen kategori
- ✅ Data tersimpan di `localStorage` (tetap ada setelah refresh / tutup browser)
- ✅ **Installable** sebagai aplikasi (Android, Windows, macOS, iOS via Add to Home Screen)
- ✅ **Offline support** via Service Worker
- ✅ Responsive: HP, tablet, laptop/desktop
- ✅ Safe-area inset untuk notch / home indicator
- ✅ Touch-friendly (min ~44px target)

## Nama aplikasi PWA

- **name**: CashFlow  
- **short_name**: CashFlow  
- **display**: standalone  
- **theme_color / background**: `#16231F`

## Struktur project

```
cashflow-pwa/
├── public/
│   ├── icons/
│   │   ├── pwa-192x192.png
│   │   └── pwa-512x512.png
│   ├── favicon.ico
│   └── favicon.png
├── src/
│   ├── App.jsx          # Seluruh logika aplikasi (dari CashFlowApp.jsx)
│   ├── main.jsx
│   └── index.css        # Reset + safe-area + mobile helpers
├── index.html
├── package.json
├── vite.config.js       # Vite + vite-plugin-pwa
└── README.md
```

## Cara menjalankan

### 1. Install dependency

```bash
cd cashflow-pwa
npm install
```

### 2. Development

```bash
npm run dev
```

Buka `http://localhost:5173` (atau URL yang ditampilkan).

### 3. Production build

```bash
npm run build
```

Output ada di folder `dist/`.

### 4. Preview build

```bash
npm run preview
```

## Install sebagai aplikasi

| Platform     | Cara |
|--------------|------|
| **Android**  | Chrome → menu ⋮ → **Install app** / **Add to Home screen** |
| **Windows**  | Chrome / Edge → ikon install di address bar, atau menu → Install CashFlow |
| **macOS**    | Chrome / Edge / Safari (yang mendukung) → Install / Add to Dock |
| **iOS**      | Safari → Share → **Add to Home Screen** |

## Offline & data

- Service Worker (via `vite-plugin-pwa`) meng-cache HTML, JS, CSS, icon, dan asset.
- Google Fonts di-cache secara runtime; jika offline, fallback ke system font (`Inter` → system-ui, serif/mono fallback).
- Data transaksi menggunakan key:
  - `bukukas:transactions`
  - `bukukas:categories`
  - `bukukas:saldo-awal`
- Data **tidak** dihapus saat update PWA. Service worker memakai `registerType: 'autoUpdate'`.

## Icon

Icon placeholder sederhana (lingkaran brass di atas background hijau gelap) sudah disediakan:

- `public/icons/pwa-192x192.png`
- `public/icons/pwa-512x512.png`

Ganti file tersebut dengan desain logo Anda sendiri (tetap ukuran 192×192 dan 512×512, format PNG) agar lebih profesional.

## Catatan teknis

- Storage diganti dari `window.storage` (custom) menjadi **`localStorage`** standar browser agar berjalan di mana saja.
- Semua fitur, seed data transaksi (Juli 2025 – Agustus 2026), kategori, dan desain visual asli **dipertahankan**.
- Responsive sudah ditingkatkan: bottom navigation di mobile, safe-area, touch target, modal full-width di layar kecil, input 16px untuk cegah zoom iOS.

## Tech stack

- React 18
- Vite 5
- vite-plugin-pwa
- Recharts
- Lucide React
- JavaScript (no TypeScript)

---

Dibuat dari `CashFlowApp.jsx` tanpa menulis ulang fitur dari nol.
