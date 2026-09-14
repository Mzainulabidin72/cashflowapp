import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMaintenance } from '../lib/adminService'
import MaintenancePage from '../pages/MaintenancePage'

export default function RoleRoute({ children, allow }) {
  const { session, profile, loading } = useAuth()
  const [maint, setMaint] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const m = await getMaintenance()
        if (!cancelled) setMaint(m)
      } catch (e) {
        console.error(e)
        if (!cancelled) setMaint({ enabled: false })
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (loading || checking) {
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

  if (!session) return <Navigate to="/login" replace />

  const role = profile?.role || 'user'

  // Maintenance hanya blokir user biasa
  if (maint?.enabled && role === 'user') {
    return <MaintenancePage info={maint} />
  }

  if (!allow.includes(role)) {
    if (role === 'super_admin') return <Navigate to="/super-admin" replace />
    if (role === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/dashboard" replace />
  }

  return children
}