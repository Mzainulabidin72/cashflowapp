import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import RoleRoute from './components/RoleRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminHome from './pages/AdminHome'
import SuperAdminHome from './pages/SuperAdminHome'
import SuperAdminLogs from './pages/SuperAdminLogs'
import ClientChat from './pages/ClientChat'
import AdminChat from './pages/AdminChat'
import ClientComplaints from './pages/ClientComplaints'
import AdminComplaints from './pages/AdminComplaints'
import ClientSubscription from './pages/ClientSubscription'
import AdminSubscriptions from './pages/AdminSubscriptions'
import AdminPayments from './pages/AdminPayments'
import App from './App'
import './index.css'

function HomeRedirect() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#16231F',
          color: '#A9B0A8',
        }}
      >
        Memuat...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  const role = profile?.role || 'user'
  if (role === 'super_admin') return <Navigate to="/super-admin" replace />
  if (role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/dashboard" replace />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route
            path="/dashboard"
            element={
              <RoleRoute allow={['user']}>
                <App />
              </RoleRoute>
            }
          />

          <Route
            path="/chat"
            element={
              <RoleRoute allow={['user']}>
                <div style={{ minHeight: '100vh', background: '#16231F', padding: 24 }}>
                  <ClientChat />
                </div>
              </RoleRoute>
            }
          />

          <Route
            path="/complaints"
            element={
              <RoleRoute allow={['user']}>
                <div style={{ minHeight: '100vh', background: '#16231F', padding: 24 }}>
                  <ClientComplaints />
                </div>
              </RoleRoute>
            }
          />

          <Route
            path="/subscription"
            element={
              <RoleRoute allow={['user']}>
                <div style={{ minHeight: '100vh', background: '#16231F', padding: 24 }}>
                  <ClientSubscription />
                </div>
              </RoleRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <RoleRoute allow={['admin']}>
                <AdminHome />
              </RoleRoute>
            }
          />

          <Route
            path="/admin/chat"
            element={
              <RoleRoute allow={['admin', 'super_admin']}>
                <div style={{ minHeight: '100vh', background: '#16231F', padding: 24 }}>
                  <AdminChat />
                </div>
              </RoleRoute>
            }
          />

          <Route
            path="/admin/complaints"
            element={
              <RoleRoute allow={['admin', 'super_admin']}>
                <div style={{ minHeight: '100vh', background: '#16231F', padding: 24 }}>
                  <AdminComplaints />
                </div>
              </RoleRoute>
            }
          />

          <Route
            path="/admin/subscriptions"
            element={
              <RoleRoute allow={['admin', 'super_admin']}>
                <div style={{ minHeight: '100vh', background: '#16231F', padding: 24 }}>
                  <AdminSubscriptions />
                </div>
              </RoleRoute>
            }
          />

          <Route
            path="/admin/payments"
            element={
              <RoleRoute allow={['admin', 'super_admin']}>
                <div style={{ minHeight: '100vh', background: '#16231F', padding: 24 }}>
                  <AdminPayments />
                </div>
              </RoleRoute>
            }
          />

          <Route
            path="/super-admin"
            element={
              <RoleRoute allow={['super_admin']}>
                <SuperAdminHome />
              </RoleRoute>
            }
          />

          <Route
            path="/super-admin/logs"
            element={
              <RoleRoute allow={['super_admin']}>
                <SuperAdminLogs />
              </RoleRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)