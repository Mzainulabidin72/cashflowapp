import SuperAdminShell from '../components/super/SuperAdminShell'

const PRODUCTS = [
  {
    name: 'CashFlow — Buku Kas',
    desc: 'Personal finance & cash flow management',
    status: 'Operational',
  },
  {
    name: 'Time & Habit',
    desc: 'Time blocking and habit tracking',
    status: 'Coming Soon',
  },
  {
    name: 'Productivity Tools',
    desc: 'Focus and productivity utilities',
    status: 'Coming Soon',
  },
]

export default function SuperAdminProducts() {
  return (
    <SuperAdminShell title="Products">
      <p className="sa-muted">
        Multi-product architecture Lanila. Hanya CashFlow yang live saat ini.
      </p>
      <div className="sa-kpi-grid">
        {PRODUCTS.map((p) => (
          <div key={p.name} className="sa-card" style={{ margin: 0 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{p.name}</div>
            <div className="sa-muted" style={{ marginBottom: 10 }}>{p.desc}</div>
            {p.status === 'Operational' ? (
              <span className="sa-badge">Operational</span>
            ) : (
              <span className="sa-badge warn">Coming Soon</span>
            )}
          </div>
        ))}
      </div>
    </SuperAdminShell>
  )
}
