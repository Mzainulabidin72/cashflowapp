import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserPlanInfo } from '../lib/planAccess'

function formatDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function SubscriptionBanner() {
  const { user } = useAuth()
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getUserPlanInfo(user.id)
      .then((p) => {
        if (!cancelled) setInfo(p)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])

  if (!info) return null

  const name = info.planName || 'Gratis'
  const isPro =
    /pro|tahun|annual/i.test(String(name)) && info.source === 'subscription'
  const ends = formatDate(info.subscription?.ends_at)

  if (!isPro && info.source !== 'pending') {
    // optional soft CTA for free users — keep minimal
    return null
  }

  if (info.source === 'pending') {
    return (
      <div className="sub-banner" role="status">
        <span className="badge">PENDING</span>
        <span>Pembayaran langganan menunggu konfirmasi.</span>
        <Link to="/subscription">Detail →</Link>
      </div>
    )
  }

  return (
    <div className="sub-banner" role="status">
      <span className="badge">PRO</span>
      <span>
        Paket <strong>{name}</strong>
        {ends ? ` aktif sampai ${ends}` : ' aktif'}
      </span>
      <Link to="/subscription">Detail →</Link>
    </div>
  )
}
