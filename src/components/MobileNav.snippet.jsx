/**
 * Tempel di App.jsx (CashFlowApp) — ganti blok bk-mobile-tabs lama
 * Butuh: tab, setTab, moreOpen, setMoreOpen, planInfo, showToast, handleLogout, user/profile
 * Icons: LayoutGrid, List, PieIcon, Wallet (or Sparkles), Menu
 */

{/* MOBILE HEADER */}
<div className="bk-mobile-header">
  <div className="brand">
    <span>Lanila</span>
    <span className="page-title">
      · {tab === 'dashboard' ? 'Dashboard' : tab === 'transactions' ? 'Transaksi' : tab === 'summary' ? 'Ringkasan' : tab === 'categories' ? 'Kategori' : 'Buku Kas'}
    </span>
  </div>
  <button type="button" onClick={() => setMoreOpen(true)} aria-label="Menu lainnya">
    ☰
  </button>
</div>

{/* BOTTOM NAV — 5 primary */}
<nav className="bk-mobile-tabs" aria-label="Navigasi utama">
  <button type="button" className={'nav-item' + (tab === 'dashboard' ? ' is-active' : '')} onClick={() => setTab('dashboard')}>
    <LayoutGrid size={20} />
    Home
  </button>
  <button type="button" className={'nav-item' + (tab === 'transactions' ? ' is-active' : '')} onClick={() => setTab('transactions')}>
    <List size={20} />
    Transaksi
  </button>
  <button type="button" className={'nav-item' + (tab === 'summary' ? ' is-active' : '')} onClick={() => setTab('summary')}>
    <PieIcon size={20} />
    Ringkasan
  </button>
  {planInfo?.canUseProTools ? (
    <a href="/pro-tools" className="nav-item">
      <Wallet size={20} />
      Tools
    </a>
  ) : (
    <button type="button" className="nav-item" onClick={() => showToast('Tools Pro khusus paket Pro')}>
      <Wallet size={20} />
      Tools
    </button>
  )}
  <button type="button" className="nav-item" onClick={() => setMoreOpen(true)}>
    <Menu size={20} />
    Lainnya
  </button>
</nav>

{/* MORE SHEET */}
{moreOpen && (
  <div className="bk-more-sheet-bg" onClick={() => setMoreOpen(false)}>
    <div className="bk-more-sheet" onClick={(e) => e.stopPropagation()}>
      <div className="sheet-title">Lainnya</div>
      <button type="button" className="sheet-item" onClick={() => { setTab('categories'); setMoreOpen(false) }}>Kategori</button>
      <a href="/chat" className="sheet-item" onClick={() => setMoreOpen(false)}>Chat Admin</a>
      <a href="/complaints" className="sheet-item" onClick={() => setMoreOpen(false)}>Keluhan</a>
      <a href="/subscription" className="sheet-item" onClick={() => setMoreOpen(false)}>Langganan</a>
      {planInfo?.canUseProTools && (
        <a href="/pro-tools" className="sheet-item" onClick={() => setMoreOpen(false)}>Tools Pro</a>
      )}
      <div className="sheet-title">Akun</div>
      <div className="sheet-item" style={{ opacity: 0.8, cursor: 'default' }}>
        {profile?.full_name || user?.email}
      </div>
      <button type="button" className="sheet-item" onClick={() => { setMoreOpen(false); handleLogout() }} style={{ color: 'var(--clay)' }}>
        Logout
      </button>
      <button type="button" className="sheet-item" onClick={() => setMoreOpen(false)}>Tutup</button>
    </div>
  </div>
)}
