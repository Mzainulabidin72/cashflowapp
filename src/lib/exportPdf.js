/** Export ringkasan ke PDF via window.print pada elemen tersembunyi — tanpa dependency berat */
export function exportSummaryPdf({ title, lines, filename }) {
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) {
    alert('Popup diblokir. Izinkan popup untuk export PDF.')
    return
  }
  const body = (lines || [])
    .map((l) => `<tr><td>${escapeHtml(l.label)}</td><td style="text-align:right">${escapeHtml(l.value)}</td></tr>`)
    .join('')
  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title || 'Laporan')}</title>
  <style>
    body { font-family: Georgia, serif; padding: 24px; color: #1a1a1a; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 4px; border-bottom: 1px solid #ddd; font-size: 14px; }
  </style></head><body>
  <h1>${escapeHtml(title || 'Laporan Keuangan')}</h1>
  <div class="meta">Dibuat: ${new Date().toLocaleString('id-ID')} · Cash Flow Pro</div>
  <table>${body}</table>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`)
  w.document.close()
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
