/**
 * Konfigurasi navigasi sidebar klien (Lanila Buku Kas) — satu sumber untuk sidebar desktop
 * dan sheet "Lainnya" di mobile.
 *
 * Tiap item:
 *   key      → nilai state `tab` di App.jsx (juga penentu menu aktif)
 *   label    → teks menu (bahasa Indonesia)
 *   icon     → komponen lucide-react
 *   nav      → 'tab'   : ganti tab di dalam App (URL tidak berubah)
 *              'route' : pindah rute lewat goTab() (/chat, /complaints, …)
 *   route    → rute tujuan bila nav === 'route' (dokumentasi; navigasi tetap lewat goTab)
 *   access   → (opsional) nama flag planInfo yang wajib true, mis. 'canUseProTools'
 *   lockedMessage → pesan toast bila flag access belum terpenuhi
 */

import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  ChartPie,
  MessagesSquare,
  MessageSquareWarning,
  CreditCard,
  Settings,
  Sparkles,
} from 'lucide-react'

export const CLIENT_NAV = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, nav: 'tab' }],
  },
  {
    id: 'keuangan',
    label: 'Keuangan',
    items: [
      { key: 'transactions', label: 'Transaksi', icon: ArrowLeftRight, nav: 'tab' },
      { key: 'categories', label: 'Kategori', icon: Tags, nav: 'tab' },
      { key: 'summary', label: 'Ringkasan', icon: ChartPie, nav: 'tab' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    items: [
      { key: 'chat', label: 'Chat Admin', icon: MessagesSquare, nav: 'route', route: '/chat' },
      { key: 'complaints', label: 'Keluhan', icon: MessageSquareWarning, nav: 'route', route: '/complaints' },
      { key: 'subscription', label: 'Langganan', icon: CreditCard, nav: 'route', route: '/subscription' },
      { key: 'settings', label: 'Pengaturan', icon: Settings, nav: 'tab' },
      {
        key: 'pro-tools',
        label: 'Tools Pro',
        icon: Sparkles,
        nav: 'route',
        route: '/pro-tools',
        access: 'canUseProTools',
        lockedMessage: 'Tools Pro (wallet, utang, prediksi, PDF) khusus paket Pro. Silakan upgrade di Langganan.',
      },
    ],
  },
]

export const CLIENT_NAV_ITEMS = CLIENT_NAV.flatMap((g) => g.items)

/** Menu yang tampil di sheet "Lainnya" (mobile); sisanya sudah ada di tab bar bawah. */
const MOBILE_MORE_KEYS = ['categories', 'chat', 'complaints', 'subscription', 'settings', 'pro-tools']
export const MOBILE_MORE_ITEMS = MOBILE_MORE_KEYS.map((k) => CLIENT_NAV_ITEMS.find((i) => i.key === k))

/** Apakah paket pengguna boleh memakai item ini? (tanpa flag access → selalu boleh) */
export const canAccess = (item, planInfo) => !item.access || !!planInfo?.[item.access]
