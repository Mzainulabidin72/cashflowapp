# Plan Update — Gratis 200 TX / Basic / Pro / Tahunan

## File di zip ini

| File | Letakkan di |
|------|-------------|
| src/lib/planAccess.js | src/lib/planAccess.js |
| src/components/SubscriptionBanner.jsx | src/components/SubscriptionBanner.jsx |
| src/pages/ClientSubscription.jsx | src/pages/ClientSubscription.jsx |
| src/App.jsx | src/App.jsx (sudah terintegrasi banner + limit) |
| sql/plans.sql | Jalankan di Supabase SQL Editor |

## Langkah

1. Extract zip
2. Copy file ke project sesuai tabel di atas
3. Run `sql/plans.sql` di Supabase
4. Restart `npm run dev`
5. Refresh browser

## Hasil

- User tanpa bayar = paket **Gratis** (max **200** transaksi/bulan)
- Basic Rp 5.000 / 30 hari — unlimited
- Pro Rp 15.000 / 30 hari — unlimited + fitur analisis
- Tahunan Rp 150.000 / 365 hari — setara Pro
