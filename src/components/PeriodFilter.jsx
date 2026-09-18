/** Compact period selector — dropdown instead of heavy button row */
export default function PeriodFilter({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
}) {
  const opts = [
    ['today', 'Hari ini'],
    ['week', 'Minggu ini'],
    ['month', 'Bulan ini'],
    ['year', 'Tahun ini'],
    ['custom', 'Custom'],
    ['all', 'Semua'],
  ]

  return (
    <div className="ds-period">
      <label htmlFor="period-select">Periode</label>
      <select
        id="period-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter periode"
      >
        {opts.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      {value === 'custom' && (
        <>
          <input
            type="date"
            className="bk-input"
            style={{ width: 145 }}
            value={customFrom}
            onChange={(e) => onCustomFrom(e.target.value)}
            aria-label="Dari tanggal"
          />
          <span className="ds-caption">s/d</span>
          <input
            type="date"
            className="bk-input"
            style={{ width: 145 }}
            value={customTo}
            onChange={(e) => onCustomTo(e.target.value)}
            aria-label="Sampai tanggal"
          />
        </>
      )}
    </div>
  )
}
