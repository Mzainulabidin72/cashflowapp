import { Lightbulb, Clock, TrendingUp, TrendingDown, ChartPie, ShieldAlert, Target } from 'lucide-react'
import { Card, EmptyState, Tag, txt } from './ui'

const ICONS = { clock: Clock, 'trend-up': TrendingUp, 'trend-down': TrendingDown, pie: ChartPie, shield: ShieldAlert, target: Target }
const LEVEL = { warn: ['warn', 'Perlu perhatian'], ok: ['ok', 'Positif'], info: ['neutral', 'Info'] }

export default function InsightsCard({ insights }) {
  return (
    <Card id="pt-insights" title="Insight dan rekomendasi" icon={Lightbulb}
      desc="Dibuat dari transaksi, utang, dan goal-mu. Ini gambaran kondisi saat ini, bukan jaminan hasil ke depan.">
      {insights.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Belum ada insight"
          text="Insight muncul setelah ada transaksi di periode ini, atau saat ada utang dan goal yang perlu diperhatikan." />
      ) : (
        <ul className="pt-list" aria-label="Daftar insight">
          {insights.map((i) => {
            const Icon = ICONS[i.icon] || Lightbulb
            const [tone, word] = LEVEL[i.level] || LEVEL.info
            return (
              <li className="pt-insight" key={i.id}>
                <span className={`pt-insight-icon is-${i.level}`}><Icon size={17} strokeWidth={1.75} aria-hidden="true" /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="pt-insight-title">{i.title} <Tag tone={tone}>{word}</Tag></div>
                  <div className="pt-insight-detail">{txt(i.detail)}</div>
                  <div className="pt-insight-period">Periode: {i.period}</div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
