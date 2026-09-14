import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RoleRoute({ children, allow }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#16231F',
        color: '#A9B0A8',
      }}>
        Memuat...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  const role = profile?.role || 'user'
  if (!allow.includes(role)) {
    // salah role → lempar ke tempat yang sesuai
    if (role === 'super_admin') return <Navigate to="/super-admin" replace />
    if (role === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/dashboard" replace />
  }

  return children
}