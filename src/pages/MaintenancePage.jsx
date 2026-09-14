export default function MaintenancePage({ info }) {
  const title = info?.title || 'Maintenance'
  const message = info?.message || 'Sistem sedang dalam perbaikan.'
  const estimated = info?.estimated_end

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.msg}>{message}</p>
        {estimated && (
          <p style={styles.sub}>Perkiraan selesai: {estimated}</p>
        )}
        <a href="/login" style={styles.link}>Kembali ke Login</a>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#16231F',
    padding: 16,
  },
  card: {
    maxWidth: 420,
    width: '100%',
    background: '#1D2E28',
    border: '1px solid #2B3E37',
    borderRadius: 12,
    padding: 28,
    textAlign: 'center',
  },
  title: {
    margin: '0 0 12px',
    fontFamily: 'Georgia, serif',
    fontSize: 26,
    color: '#C9A24B',
  },
  msg: { margin: 0, color: '#EDEAE0', lineHeight: 1.5 },
  sub: { margin: '12px 0 0', color: '#A9B0A8', fontSize: 13 },
  link: {
    display: 'inline-block',
    marginTop: 20,
    color: '#C9A24B',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
  },
}