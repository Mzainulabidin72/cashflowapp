import { FileText, FileDown, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card } from './ui'

const CONTENTS = ['Ringkasan keuangan periode berjalan', 'Skor dan komponen kesehatan keuangan', 'Prakiraan arus kas (ditandai estimasi)', 'Financial goals', 'Utang dan piutang', 'Analisis pengeluaran per kategori']

/** status: objek dengan state ('idle' | 'loading' | 'success' | 'error') dan message */
export default function ReportCard({ onExport, status }) {
  const loading = status.state === 'loading'
  return (
    <Card id="pt-report" title="Laporan PDF" icon={FileText} desc="Laporan dibuat dari data yang sama dengan yang tampil di halaman ini, jadi angkanya identik.">
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <ul className="pt-small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, flex: '1 1 260px' }} aria-label="Isi laporan">
          {CONTENTS.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div style={{ flex: '0 1 280px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" className="pt-btn pt-btn-primary pt-btn-block-sm" style={{ height: 44 }} onClick={onExport} disabled={loading} data-testid="report-export">
            {loading ? <Loader2 size={16} className="pt-spin" aria-hidden="true" /> : <FileDown size={16} aria-hidden="true" />}
            {loading ? 'Menyiapkan laporan…' : 'Export PDF'}
          </button>
          <div aria-live="polite" className="pt-small">
            {status.state === 'success' && <div className="pt-pos" style={{ display: 'flex', gap: 6 }}><CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" /><span>{status.message}</span></div>}
            {status.state === 'error' && <div className="pt-neg" role="alert" style={{ display: 'flex', gap: 6 }}><AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" /><span>{status.message}</span></div>}
          </div>
        </div>
      </div>
    </Card>
  )
}
