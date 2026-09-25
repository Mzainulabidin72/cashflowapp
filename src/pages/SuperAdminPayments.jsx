import { Link } from 'react-router-dom'
import SuperAdminShell from '../components/super/SuperAdminShell'

export default function SuperAdminPayments() {
  return (
    <SuperAdminShell title="Payments">
      <div className="sa-card">
        <h2>Payment verification</h2>
        <p className="sa-muted">
          Verifikasi transfer manual, bukti bayar, dan aktivasi langganan.
        </p>
        <Link to="/admin/payments" className="sa-btn sa-btn-primary">
          Buka Admin Payments
        </Link>
      </div>
    </SuperAdminShell>
  )
}
