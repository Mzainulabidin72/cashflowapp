-- Nonaktifkan paket lama
update public.subscription_plans set is_active = false;

-- Paket baru (Gratis / Basic / Pro / Tahunan)
insert into public.subscription_plans (name, description, price, duration_days, is_active)
values
  (
    'Gratis',
    'Mulai Atur Keuangan: pencatatan, kategori, dashboard, batas 200 transaksi/bulan',
    0,
    3650,
    true
  ),
  (
    'Basic',
    'Kelola Keuangan: transaksi unlimited, kategori custom, filter, laporan, export',
    5000,
    30,
    true
  ),
  (
    'Pro',
    'Analisis Keuangan: analitik lengkap, grafik, multi wallet, utang, aset, prioritas support',
    15000,
    30,
    true
  ),
  (
    'Tahunan',
    'Cash Flow Pro Annual: semua fitur Pro 1 tahun, lebih hemat',
    150000,
    365,
    true
  );
