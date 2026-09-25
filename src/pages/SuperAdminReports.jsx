import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SuperAdminShell from '../components/super/SuperAdminShell'
import { getSuperAdminReport } from '../lib/reportService'

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

export default function SuperAdminReports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getSuperAdminReport()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <SuperAdminShell title="Reports">
      <Link to="/super-admin" className="sa-muted" style={{ display: 'inline-block', marginBottom: 12 }}>
        ← Dashboard
      </Link>
      {error && <p className="sa-err">{error}</p>}
      {loading && <p className="sa-muted">Memuat...</p>}
      {data && (
        <div className="sa-kpi-grid">
          <div className="sa-kpi"><div className="label">Users</div><div className="value">{data.totalUsers}</div></div>
          <div className="sa-kpi"><div className="label">Active subs</div><div className="value">{data.subsActive}</div></div>
          <div className="sa-kpi"><div className="label">Revenue paid</div><div className="value" style={{ fontSize: 16 }}>{rupiah(data.revenuePaid)}</div></div>
          <div className="sa-kpi"><div className="label">Pending pay</div><div className="value">{data.paymentsPending}</div></div>
        </div>
      )}
    </SuperAdminShell>
  )
}
