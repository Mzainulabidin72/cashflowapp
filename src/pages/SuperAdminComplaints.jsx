import { Link } from 'react-router-dom'
import SuperAdminShell from '../components/super/SuperAdminShell'

export default function SuperAdminComplaints() {
  return (
    <SuperAdminShell title="Complaints">
      <div className="sa-card">
        <h2>Keluhan / tickets</h2>
        <p className="sa-muted">Kelola ticket keluhan client di panel Admin Complaints.</p>
        <Link to="/admin/complaints" className="sa-btn sa-btn-primary">
          Buka Admin Complaints
        </Link>
      </div>
    </SuperAdminShell>
  )
}
