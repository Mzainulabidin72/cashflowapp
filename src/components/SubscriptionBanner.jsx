import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserPlanInfo, countTxThisMonth } from '../lib/planAccess'

export default function SubscriptionBanner({ transactions = [] }) {
  const { user } = useAuth()
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) return
      try {
        const data = await getUserPlanInfo(user.id)
        if (!cancelled) setInfo(data)
      } catch (e) {
        console.error(e)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user, transactions.length])

  if (!info) return null

  const used = countTxThisMonth(transactions)
  const limit = info.txLimitPerMonth
  const isPaidActive = info.source === 'subscription' && info.rank >= 1

  if (isPaidActive) {
    const ends = info.subscription?.ends_at
    return (
      <div style={styles.ok}>
        Paket <b>{info.planName}</b> aktif
        {ends ? ` sampai ${new Date(ends).toLocaleDateString('id-ID')}` : ''}.{' '}
        <Link to="/subscription" style={styles.link}>
          Detail
        </Link>
      </div>
    )
  }

  if (info.source === 'pending') {
    return (
      <div style={styles.warn}>
        Langganan menunggu konfirmasi pembayaran.{' '}
        <Link to="/subscription" style={styles.link}>
          Lihat status
        </Link>
      </div>
    )
  }

  return (
    <div style={styles.warn}>
      Paket <b>Gratis</b>
      {limit != null ? ` · ${used}/${limit} transaksi bulan ini` : ''}.{' '}
      <Link to="/subscription" style={styles.link}>
        Upgrade
      </Link>
    </div>
  )
}

const styles = {
  ok: {
    background: 'rgba(127,163,127,0.15)',
    border: '1px solid rgba(127,163,127,0.35)',
    color: '#EDEAE0',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 14,
  },
  warn: {
    background: 'rgba(201,162,75,0.12)',
    border: '1px solid rgba(201,162,75,0.35)',
    color: '#EDEAE0',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 14,
  },
  link: {
    color: '#C9A24B',
    fontWeight: 600,
    textDecoration: 'none',
  },
}
