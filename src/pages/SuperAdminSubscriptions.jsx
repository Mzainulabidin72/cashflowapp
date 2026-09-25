import { Link } from 'react-router-dom'
import SuperAdminShell from '../components/super/SuperAdminShell'

export default function SuperAdminSubscriptions() {
  return (
    <SuperAdminShell title="Subscriptions">
      <div className="sa-card">
        <h2>Subscription management</h2>
        <p className="sa-muted">
          FREE · BASIC · PRO — status, expiry, dan aktivasi.
        </p>
        <Link to="/admin/subscriptions" className="sa-btn sa-btn-primary">
          Buka Admin Subscriptions
        </Link>
      </div>
    </SuperAdminShell>
  )
}
