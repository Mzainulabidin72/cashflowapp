import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { AuthProvider, useAuth } from './context/AuthContext'

import App from './App.jsx'
import Login from './pages/Login'
import Register from './pages/Register'

import ClientChat from './pages/ClientChat'
import ClientComplaints from './pages/ClientComplaints'
import ClientSubscription from './pages/ClientSubscription'

import AdminHome from './pages/AdminHome'
import AdminChat from './pages/AdminChat'
import AdminComplaints from './pages/AdminComplaints'
import AdminSubscriptions from './pages/AdminSubscriptions'
import AdminPayments from './pages/AdminPayments'

import SuperAdminHome from './pages/SuperAdminHome'
import SuperAdminLogs from './pages/SuperAdminLogs'
import SuperAdminReports from './pages/SuperAdminReports'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ProTools from './pages/ProTools'

/* ---------------------------------------------------------------
   RoleRoute — batasi akses berdasarkan role
------------------------------------------------------------------*/
function RoleRoute({ allow, children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#16231F',
          color: '#A9B0A8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Memuat...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const role = profile?.role || 'user'

  // Maintenance: blokir user biasa (admin & super_admin tetap bisa)
  if (
    profile?.maintenance_blocked &&
    role === 'user'
  ) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#16231F',
          color: '#EDEAE0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div>
          <h2 style={{ color: '#C9A24B', fontFamily: 'Georgia, serif' }}>
            Maintenance
          </h2>
          <p style={{ color: '#A9B0A8' }}>
            Sistem sedang dalam perbaikan. Coba lagi nanti.
          </p>
        </div>
      </div>
    )
  }

  if (allow && !allow.includes(role)) {
    // redirect ke home sesuai role
    if (role === 'super_admin') return <Navigate to="/super-admin" replace />
    if (role === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/dashboard" replace />
  }

  return children
}

/* ---------------------------------------------------------------
   HomeRedirect — setelah login ke halaman sesuai role
------------------------------------------------------------------*/
function HomeRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#16231F',
          color: '#A9B0A8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Memuat...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const role = profile?.role || 'user'
  if (role === 'super_admin') return <Navigate to="/super-admin" replace />
  if (role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/dashboard" replace />
}

/* ---------------------------------------------------------------
   PublicOnly — login/register hanya jika belum login
------------------------------------------------------------------*/
function PublicOnly({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#16231F',
          color: '#A9B0A8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Memuat...
      </div>
    )
  }

  if (user) {
    const role = profile?.role || 'user'
    if (role === 'super_admin') return <Navigate to="/super-admin" replace />
    if (role === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function Root() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <Register />
              </PublicOnly>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicOnly>
                <ForgotPassword />
              </PublicOnly>
            }
          />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Redirect root */}
          <Route path="/" element={<HomeRedirect />} />

          {/* USER */}
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
                <ClientChat />
              </RoleRoute>
            }
          />
          <Route
            path="/complaints"
            element={
              <RoleRoute allow={['user']}>
                <ClientComplaints />
              </RoleRoute>
            }
          />
          <Route
            path="/subscription"
            element={
              <RoleRoute allow={['user']}>
                <ClientSubscription />
              </RoleRoute>
            }
          />
          <Route
            path="/pro-tools"
            element={
              <RoleRoute allow={['user']}>
                <ProTools />
              </RoleRoute>
            }
          />

          {/* ADMIN */}
          <Route
            path="/admin"
            element={
              <RoleRoute allow={['admin', 'super_admin']}>
                <AdminHome />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/chat"
            element={
              <RoleRoute allow={['admin', 'super_admin']}>
                <AdminChat />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/complaints"
            element={
              <RoleRoute allow={['admin', 'super_admin']}>
                <AdminComplaints />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/subscriptions"
            element={
              <RoleRoute allow={['admin', 'super_admin']}>
                <AdminSubscriptions />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <RoleRoute allow={['admin', 'super_admin']}>
                <AdminPayments />
              </RoleRoute>
            }
          />

          {/* SUPER ADMIN */}
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
          <Route
            path="/super-admin/reports"
            element={
              <RoleRoute allow={['super_admin']}>
                <SuperAdminReports />
              </RoleRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
