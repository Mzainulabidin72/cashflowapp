import { Link } from 'react-router-dom'
import SuperAdminShell from '../components/super/SuperAdminShell'

export default function SuperAdminChat() {
  return (
    <SuperAdminShell title="Chat">
      <div className="sa-card">
        <h2>Support chat</h2>
        <p className="sa-muted">
          Percakapan client–admin memakai panel chat yang sama. Super Admin dapat membuka
          inbox penuh di Admin Chat.
        </p>
        <Link to="/admin/chat" className="sa-btn sa-btn-primary">
          Buka Admin Chat
        </Link>
      </div>
    </SuperAdminShell>
  )
}
