/**
 * Laporan Tools Pro → dialog cetak / "Simpan sebagai PDF".
 *
 * Seluruh angka sudah diformat oleh pemanggil dari objek perhitungan yang sama dengan yang
 * tampil di layar, jadi laporan tidak menghitung ulang apa pun (tidak mungkin berbeda).
 * Dicetak lewat iframe tersembunyi (tidak terkena pemblokir pop-up).
 *
 * report: judul, subjudul, meta (pasangan label-nilai), catatan kaki, dan sections. Tiap section:
 * heading, intro?, kv? (pasangan), table? (head, rows, align), list?, note?.
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const CSS = `
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #1b2420; font-size: 11.5px; line-height: 1.5; }
  .brand { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #b8922f; padding-bottom: 10px; margin-bottom: 16px; }
  .brand h1 { margin: 0; font-size: 22px; }
  .brand .sub { color: #55615a; font-size: 11.5px; margin-top: 2px; }
  .meta { text-align: right; color: #55615a; font-size: 11px; }
  .meta div + div { margin-top: 2px; }
  section { margin: 0 0 16px; break-inside: avoid; }
  h2 { font-size: 14px; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid #d5dcd6; }
  p.intro, p.note { margin: 4px 0 8px; color: #55615a; }
  p.note { font-size: 10.5px; margin-top: 6px; }
  dl.kv { display: grid; grid-template-columns: 1fr auto; gap: 3px 16px; margin: 0; }
  dl.kv dt { color: #55615a; } dl.kv dd { margin: 0; text-align: right; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { padding: 5px 6px; border-bottom: 1px solid #e1e6e2; text-align: left; vertical-align: top; }
  th { font-size: 10.5px; color: #55615a; background: #f3f6f3; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  ul { margin: 4px 0 0; padding-left: 18px; } li { margin: 2px 0; }
  .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #d5dcd6; color: #55615a; font-size: 10.5px; }
`

function section(s) {
  let html = `<section><h2>${esc(s.heading)}</h2>`
  if (s.intro) html += `<p class="intro">${esc(s.intro)}</p>`
  if (s.kv?.length) html += `<dl class="kv">${s.kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`
  if (s.table) {
    const al = s.table.align || []
    html += '<table><thead><tr>' + s.table.head.map((h, i) => `<th class="${al[i] === 'r' ? 'r' : ''}">${esc(h)}</th>`).join('') + '</tr></thead><tbody>'
    html += s.table.rows.map((r) => '<tr>' + r.map((c, i) => `<td class="${al[i] === 'r' ? 'r' : ''}">${esc(c)}</td>`).join('') + '</tr>').join('')
    html += '</tbody></table>'
  }
  if (s.list?.length) html += `<ul>${s.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
  if (s.note) html += `<p class="note">${esc(s.note)}</p>`
  return html + '</section>'
}

export function buildReportHtml(report) {
  const meta = (report.meta || []).map(([k, v]) => `<div>${esc(k)}: <strong>${esc(v)}</strong></div>`).join('')
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>${CSS}</style></head><body>
    <div class="brand"><div><h1>${esc(report.title)}</h1><div class="sub">${esc(report.subtitle || '')}</div></div><div class="meta">${meta}</div></div>
    ${(report.sections || []).map(section).join('')}
    ${report.footnote ? `<div class="foot">${esc(report.footnote)}</div>` : ''}
  </body></html>`
}

/**
 * Buka dialog cetak untuk HTML laporan. Resolve setelah dokumen berhasil dibuat dan dialog cetak
 * dipanggil; reject bila gagal. (Browser tidak memberi tahu apakah PDF benar-benar disimpan.)
 */
export function printHtml(html, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('Lingkungan tidak mendukung pencetakan.'))
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.tabIndex = -1
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
    let settled = false
    const cleanup = () => setTimeout(() => iframe.remove(), 1500)
    const fail = (msg) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(msg))
    }
    const timer = setTimeout(() => fail('Pembuatan laporan terlalu lama. Coba lagi.'), timeoutMs)
    iframe.onload = () => {
      if (settled) return
      try {
        const w = iframe.contentWindow
        if (!w || !iframe.contentDocument?.body?.children.length) throw new Error('Dokumen laporan kosong.')
        w.focus()
        w.print()
        settled = true
        clearTimeout(timer)
        cleanup()
        resolve({ ok: true })
      } catch (e) {
        clearTimeout(timer)
        fail(`Tidak bisa membuka dialog cetak: ${e?.message || 'kesalahan tidak diketahui'}`)
      }
    }
    iframe.onerror = () => { clearTimeout(timer); fail('Gagal menyiapkan dokumen laporan.') }
    iframe.srcdoc = html
    document.body.appendChild(iframe)
  })
}
