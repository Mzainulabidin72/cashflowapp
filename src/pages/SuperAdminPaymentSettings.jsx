import { useEffect, useState } from 'react'
import SuperAdminShell from '../components/super/SuperAdminShell'
import { getPaymentAccount, setPaymentAccount } from '../lib/paymentAccountService'

export default function SuperAdminPaymentSettings() {
  const [pay, setPay] = useState({
    bank_name: '',
    account_number: '',
    account_name: '',
    notes: '',
  })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getPaymentAccount()
      .then((p) =>
        setPay({
          bank_name: p.bank_name || '',
          account_number: p.account_number || '',
          account_name: p.account_name || '',
          notes: p.notes || '',
        })
      )
      .catch((e) => setError(e.message))
  }, [])

  async function save() {
    try {
      await setPaymentAccount(pay)
      setMsg('Payment settings disimpan.')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <SuperAdminShell title="Payment Settings">
      <p className="sa-muted">Manual bank transfer untuk konfirmasi langganan client.</p>
      {msg && <p className="sa-ok">{msg}</p>}
      {error && <p className="sa-err">{error}</p>}

      <div className="sa-card" style={{ maxWidth: 520 }}>
        <h2>Bank transfer</h2>
        {[
          ['bank_name', 'Bank name'],
          ['account_number', 'Account number'],
          ['account_name', 'Account holder'],
        ].map(([key, label]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label className="sa-muted">{label}</label>
            <input
              className="sa-input"
              value={pay[key]}
              onChange={(e) => setPay({ ...pay, [key]: e.target.value })}
            />
          </div>
        ))}
        <div style={{ marginBottom: 16 }}>
          <label className="sa-muted">Payment instructions</label>
          <textarea
            className="sa-textarea"
            value={pay.notes}
            onChange={(e) => setPay({ ...pay, notes: e.target.value })}
          />
        </div>
        <button type="button" className="sa-btn sa-btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </SuperAdminShell>
  )
}
